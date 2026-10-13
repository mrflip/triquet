import { ConvexError } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import * as Actor from '../src/lib/actor'
import { AdoptionValidators, type AdoptChangeT, type AdoptedT, type AdoptionT } from '../src/models/adoption'
import { Huntship, type HuntRole } from '../src/models/huntship'
import { User } from '../src/models/user'
import { zInternalMutation, zInternalQuery } from './functions'
import { holderOfUserlabel, huntInOrg, huntsOf, huntshipFor, huntshipsFor, userForUserlabel, type Reader } from './reading'
import { grantHuntship } from './writing/huntship_actions'
import { relabelUser } from './writing/user_actions'
import type { Writer } from './writing/quiz_writing'

// What the command line gives one user (`scripts/adopt`): a userlabel, past the rule that keeps
// one a hunt's address holds; the admin flag; a role on a hunt, or on every hunt. Internal, so only
// a holder of the deployment's admin key reaches it, and that key is what vouches for the command:
// how the Coach takes back `mrflip`, and admin with it, once production's people are cleared
// (`notes/deploy.md`, *Adopting a user*). `plan` says what `perform` would do and writes nothing;
// `perform` does it, and running it again changes nothing more. A refusal is a `ConvexError` whose
// data is its reason, in words for the person at the command line, which `convex run` shows them.

/** How many users an email that more than one holds is answered with, for the Coach to choose among */
const EmailHoldersShown = 9

/** One role to give on one hunt, and the role held there now, if any */
type GrantPlanT = { hunt: Doc<'hunts'>, role: HuntRole, from: HuntRole | null }

/** What an adoption will write, worked out before anything is */
type PlanT = {
  user:    Doc<'users'>
  relabel: { userlabel: string, title: string, huntships: number } | null
  admin:   boolean | null
  grants:  GrantPlanT[]
  kept:    number
}

/**
 * What adopting a user would change, and writes nothing: the dry run of `perform`, found and
 * checked the same way, refused for the same reasons. A user found by email is a lookup for a
 * Coach watching it once: emails are no standing way to name a user (one can be reassigned), so
 * nothing else here or in the app finds a user by one.
 *
 * @returns The user as it stands, what `perform` would change, and how much of what was asked it holds already.
 * @throws When the user is not found (or an email names more than one), it is provisional (a Google sign-in not yet finished), the userlabel is held by another user or a ghosting, an anonymous user is to be an admin or put on a hunt, a user with no userlabel is put on one, or a hunt named is not there.
 *
 * @example npx convex run adopt:plan '{"find": {"email": "pat@example.com"}, "userlabel": "mrflip", "admin": true, "grants": [{"role": "smith", "hunts": "every"}]}'
 *   // => { user: { user_id, userlabel: null, title: null, anonymous: false, admin: false }, changes: [{ kind: 'userlabel', from: null, to: 'mrflip', title: 'Mrflip', huntships: 0 }, { kind: 'admin', to: true }, { kind: 'huntship', org: 'mrflip', hunt: 'quiet_otter', role: 'smith', from: null }], kept: 0 }
 */
export const plan = zInternalQuery({
  args:    AdoptionValidators.request.shape,
  returns: AdoptionValidators.outcome,
  handler: async (ctx, request): Promise<AdoptedT> => {
    const planned = await planFor(ctx.db, request)
    return outcomeOf(planned, planned.relabel?.huntships ?? 0)
  },
})

/**
 * Adopt a user: give it a userlabel (though a hunt's address holds it), set or clear its admin
 * flag, and give it a role on one hunt or on every hunt, in one transaction. Idempotent: a role is
 * never lowered, and what the user already holds is left as it is, so a second run changes
 * nothing. The user must be signed in with Google (not anonymous) to be made an admin or put on a
 * hunt. Found and refused as `plan` says.
 *
 * @returns The user as it stood, what was changed, and how much of what was asked it held already.
 * @throws As `plan` does, or a refusal from a hunt holding as many members as a hunt may; nothing is written.
 *
 * @example npx convex run adopt:perform '{"find": {"userlabel": "flippy"}, "admin": true}'
 *   // => { user: { ..., admin: false }, changes: [{ kind: 'admin', to: true }], kept: 0 }
 */
export const perform = zInternalMutation({
  args:    AdoptionValidators.request.shape,
  returns: AdoptionValidators.outcome,
  handler: async (ctx, request): Promise<AdoptedT> => {
    const planned = await planFor(ctx.db, request)
    const huntships = await carryOut(ctx.db, planned)
    return outcomeOf(planned, huntships)
  },
})

/** What an adoption of `request` will write, every check made; nothing is written */
async function planFor(db: Reader, request: AdoptionT): Promise<PlanT> {
  const user = await userFound(db, request.find)
  // A provisional user's next finished sign-in, from an anonymous browser, deletes it and all it was given
  if (user.provisional === true) { throw new ConvexError(`The user ${userline(user)} is provisional: its owner began signing in with Google and did not finish. Have them sign in with Google again, then adopt the user they are.`) }
  const relabel = await relabelFor(db, user, request)
  const userlabel = relabel?.userlabel ?? user.userlabel
  const signedIn = Actor.isSignedInWithGoogle(user)
  if (! signedIn && request.admin === true) { throw new ConvexError(`The user ${userline(user)} is anonymous: only a user signed in with Google is made an admin.`) }
  if (request.grants.length > 0) {
    if (! signedIn) { throw new ConvexError(`The user ${userline(user)} is anonymous: only a user signed in with Google is put on a hunt.`) }
    if (userlabel === undefined) { throw new ConvexError(`The user ${userline(user)} holds no userlabel, so it cannot be put on a hunt: give it one too.`) }
  }
  const admin = request.admin === undefined || request.admin === (user.admin === true) ? null : request.admin
  const grants = await grantsFor(db, user._id, request.grants)
  const keptLabel = relabel === null && (request.userlabel !== undefined || request.title !== undefined) ? 1 : 0
  const keptAdmin = admin === null && request.admin !== undefined ? 1 : 0
  return { user, relabel, admin, grants: grants.planned, kept: keptLabel + keptAdmin + grants.kept }
}

/** The user `find` names, by id, userlabel or email; refused when there is none, or an email names several */
async function userFound(db: Reader, find: AdoptionT['find']): Promise<Doc<'users'>> {
  if ('user_id' in find) {
    const user = await db.get('users', find.user_id)
    if (! user) { throw new ConvexError(`No user has the id ${find.user_id}.`) }
    return user
  }
  if ('userlabel' in find) {
    const user = await userForUserlabel(db, find.userlabel)
    if (! user) { throw new ConvexError(`No user holds the userlabel ${find.userlabel}.`) }
    return user
  }
  const holders = await db.query('users').withIndex('email', (cvx) => cvx.eq('email', find.email)).take(EmailHoldersShown)
  const [user, ...others] = holders
  if (! user) { throw new ConvexError(`No user has the email ${find.email}, letter for letter as Google sent it. Has its owner signed in with Google?`) }
  if (others.length > 0) {
    throw new ConvexError(`More than one user has the email ${find.email}, so none is chosen: ${holders.map((holder) => userline(holder)).join(', ')}. Name one by its id.`)
  }
  return user
}

/**
 * The userlabel and title `user` is to take, if either changes. A userlabel only a hunt's address
 * holds is given all the same: the command line is trusted. One another user or a ghosting holds
 * is refused.
 */
async function relabelFor(db: Reader, user: Doc<'users'>, request: AdoptionT): Promise<PlanT['relabel']> {
  if (request.userlabel === undefined && request.title === undefined) { return null }
  const userlabel = request.userlabel ?? user.userlabel
  if (userlabel === undefined) { throw new ConvexError(`The user ${userline(user)} holds no userlabel to title: give it one too.`) }
  const title = User.titleFor(userlabel, request.title ?? user.title ?? '')
  if (userlabel === user.userlabel && title === user.title) { return null }
  if (userlabel !== user.userlabel) {
    const holder = await holderOfUserlabel(db, userlabel)
    if (holder === 'user')     { throw new ConvexError(`Another user holds the userlabel ${userlabel}.`) }
    if (holder === 'ghosting') { throw new ConvexError(`The userlabel ${userlabel} is retired by a merge (a ghosting holds it).`) }
  }
  const huntships = await huntshipsFor(db, user._id)
  const stale = huntships.filter((huntship) => huntship.userlabel !== userlabel || huntship.usertitle !== title)
  return { userlabel, title, huntships: stale.length }
}

/**
 * The roles `grants` would give `user_id`, hunt by hunt, the highest asked of each, but for those
 * it holds already (or a higher one), which are counted as kept.
 */
async function grantsFor(db: Reader, user_id: Id<'users'>, grants: AdoptionT['grants']): Promise<{ planned: GrantPlanT[], kept: number }> {
  const wanted = new Map<Id<'hunts'>, { hunt: Doc<'hunts'>, role: HuntRole }>()
  for (const grant of grants) {
    const hunts = await huntsGranted(db, grant.hunts)
    for (const hunt of hunts) {
      const prev = wanted.get(hunt._id)
      if (! prev || ! Huntship.holdsAtLeast(prev.role, grant.role)) { wanted.set(hunt._id, { hunt, role: grant.role }) }
    }
  }
  const sought = await Promise.all(wanted.values().map(async ({ hunt, role }) => {
    const held = await huntshipFor(db, hunt._id, user_id)
    return { hunt, role, from: held?.role ?? null }
  }))
  const planned = sought.filter(({ role, from }) => from === null || ! Huntship.holdsAtLeast(from, role))
  return { planned, kept: sought.length - planned.length }
}

/** The hunts a grant is for: the one at its address, refused when there is none there; or every hunt */
async function huntsGranted(db: Reader, hunts: AdoptionT['grants'][number]['hunts']): Promise<Doc<'hunts'>[]> {
  if (hunts === 'every') { return await huntsOf(db) }
  const hunt = await huntInOrg(db, hunts.org, hunts.hunt)
  if (! hunt) { throw new ConvexError(`There is no hunt at ~${hunts.org}/${hunts.hunt}.`) }
  return [hunt]
}

/** Write what `planned` says, in order: the userlabel first, so every huntship made after carries it. Answers how many huntships' copies were rewritten */
async function carryOut(db: Writer, planned: PlanT): Promise<number> {
  const { user, relabel, admin, grants } = planned
  const huntships = relabel ? await relabelUser(db, user._id, relabel.userlabel, relabel.title) : 0
  if (admin !== null) { await db.patch('users', user._id, { admin: admin ? true : undefined }) } // absent for no
  if (grants.length === 0) { return huntships }
  const face = User.faceOf({ ...user, ...(relabel && { userlabel: relabel.userlabel, title: relabel.title }) })
  if (! face) { throw new ConvexError(`The user ${userline(user)} holds no userlabel, so it cannot be put on a hunt.`) }
  for (const { hunt, role } of grants) { await grantHuntship(db, hunt._id, face, role) }
  return huntships
}

/** What an adoption came to, as the command line is told: the user as it stood, and each change */
function outcomeOf(planned: PlanT, huntships: number): AdoptedT {
  const { user, relabel, admin, grants, kept } = planned
  const changes: AdoptChangeT[] = [
    ...(relabel ? [{ kind: 'userlabel' as const, from: user.userlabel ?? null, to: relabel.userlabel, title: relabel.title, huntships }] : []),
    ...(admin === null ? [] : [{ kind: 'admin' as const, to: admin }]),
    ...grants.map(({ hunt, role, from }) => ({ kind: 'huntship' as const, org: hunt.orglabel, hunt: hunt.label, role, from })),
  ]
  return {
    user:    { user_id: user._id, userlabel: user.userlabel ?? null, title: user.title ?? null, anonymous: User.isAnonymous(user), admin: user.admin === true },
    changes,
    kept,
  }
}

/** A user as a refusal names it: its id, and its userlabel or that it holds none */
function userline(user: Doc<'users'>): string {
  const held = user.userlabel === undefined ? 'no userlabel' : User.atLabel({ userlabel: user.userlabel })
  return `${user._id} (${held})`
}
