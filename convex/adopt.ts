import { ConvexError } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import * as Actor from '../src/lib/actor'
import * as Stamps from '../src/lib/stamps'
import { AdoptionValidators, type AdoptChangeT, type AdoptedT, type AdoptionT } from '../src/models/adoption'
import { Hunt } from '../src/models/hunt'
import { Huntship, type HuntRole } from '../src/models/huntship'
import { User } from '../src/models/user'
import { zInternalMutation, zInternalQuery } from './functions'
import { anyHuntInOrg, holderOfUserlabel, huntInOrg, huntsOf, huntshipFor, huntshipsFor, userForUserlabel, type Reader } from './reading'
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
// It keeps to sealing where sealing has no actor to ask: it puts nobody on an anonymous user's
// sandbox, relabels no anonymous user holding one, and gives no anonymous user a userlabel a hunt's
// address holds.

/** How many users an email that more than one holds is answered with, for the Coach to choose among */
const EmailHoldersShown = 9

/** One role to give on one hunt, and the role held there now, if any */
type GrantPlanT = { hunt: Doc<'hunts'>, role: HuntRole, from: HuntRole | null }

/** What an adoption will write, worked out before anything is */
type PlanT = {
  user:    Doc<'users'>
  relabel: { userlabel: string, title: string, huntships: number } | null
  leaves:  'free' | 'address' | null
  admin:   boolean | null
  grants:  GrantPlanT[]
  kept:    number
  skipped: number
}

/**
 * What adopting a user would change, and writes nothing: the dry run of `perform`, found and
 * checked the same way, refused for the same reasons. A user found by email is a lookup for a
 * Coach watching it once: emails are no standing way to name a user (one can be reassigned), so
 * nothing else here or in the app finds a user by one.
 *
 * The user found is named by its Google name, when its row was made, and when Google last said
 * its email is verified, beside its id and userlabel, so whoever runs the command knows it for
 * theirs before anything is written: an email Google has not verified is only Google's claim.
 *
 * @returns The user as it stands, what `perform` would change, how much of what was asked it holds already, and how many anonymous users' sandboxes a grant on every hunt passes over.
 * @throws When the user is not found (or an email names more than one), it is provisional (a Google sign-in not yet finished), the userlabel is held by another user or a ghosting (or, for an anonymous user, a hunt's address), an anonymous user holding a sandbox is relabelled, an anonymous user is to be an admin or put on a hunt, a user with no userlabel is put on one, or a hunt named is not there or is an anonymous user's sandbox.
 *
 * @example npx convex run adopt:plan '{"find": {"email": "pat@example.com"}, "userlabel": "mrflip", "admin": true, "grants": [{"role": "smith", "hunts": "every"}]}'
 *   // => { user: { user_id, userlabel: null, title: null, anonymous: false, admin: false, name: 'Pat Smith', created_at: 1760300000000, email_verified_at: 1760300000000 }, changes: [{ kind: 'userlabel', from: null, to: 'mrflip', title: 'Mrflip', huntships: 0, leaves: null }, { kind: 'admin', to: true }, { kind: 'huntship', org: 'mrflip', hunt: 'quiet_otter', role: 'smith', from: null }], kept: 0, skipped: 0 }
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
 *   // => { user: { ..., admin: false }, changes: [{ kind: 'admin', to: true }], kept: 0, skipped: 0 }
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
  const leaves = await leftBehind(db, user, relabel)
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
  return { user, relabel, leaves, admin, grants: grants.planned, kept: keptLabel + keptAdmin + grants.kept, skipped: grants.skipped }
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
 * holds is given all the same to a user signed in with Google: the command line is trusted. One
 * another user or a ghosting holds is refused; so is one a hunt's address holds, for an anonymous
 * user, which would seem to own hunts it is not on (`~label/label` among them, so its sandbox's
 * address is taken), and could be put on none of them.
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
    if (holder === 'address' && User.isAnonymous(user)) {
      throw new ConvexError(`The user ${userline(user)} is anonymous, and hunts are addressed ~${userlabel}/…: only a user signed in with Google is given a userlabel a hunt's address holds. Have its owner sign in with Google first.`)
    }
  }
  const huntships = await huntshipsFor(db, user._id)
  return { userlabel, title, huntships: huntships.filter((huntship) => Huntship.isStale(huntship, { userlabel, title })).length }
}

/**
 * What becomes of the userlabel `user` holds when `relabel` moves it to another: `free` for anyone
 * to claim, since an adoption is no merge and retires nothing into a ghosting (thread 4's
 * decision), or still held by a hunt's `address`; null when nothing moves. An anonymous user
 * holding its sandbox is refused: relabelled, it could make a second (sealing lets it make the one
 * labelled with its userlabel), and a merge would find only that.
 */
async function leftBehind(db: Reader, user: Doc<'users'>, relabel: PlanT['relabel']): Promise<PlanT['leaves']> {
  const held = user.userlabel
  if (relabel === null || held === undefined || relabel.userlabel === held) { return null }
  if (User.isAnonymous(user) && await huntInOrg(db, held, held)) {
    throw new ConvexError(`The user ${userline(user)} is anonymous and holds its sandbox, ~${held}/${held}: relabelled, it could make a second. Have its owner sign in with Google first.`)
  }
  return await anyHuntInOrg(db, held) ? 'address' : 'free'
}

/**
 * The roles `grants` would give `user_id`, hunt by hunt, the highest asked of each, but for those
 * it holds already (or a higher one), which are counted as kept, and anonymous users' sandboxes,
 * which a grant on every hunt passes over and counts as skipped.
 */
async function grantsFor(db: Reader, user_id: Id<'users'>, grants: AdoptionT['grants']): Promise<{ planned: GrantPlanT[], kept: number, skipped: number }> {
  const wanted = new Map<Id<'hunts'>, { hunt: Doc<'hunts'>, role: HuntRole }>()
  const skipped = new Set<Id<'hunts'>>()
  for (const grant of grants) {
    const { hunts, sealed } = await huntsGranted(db, grant.hunts)
    for (const hunt of sealed) { skipped.add(hunt._id) }
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
  return { planned, kept: sought.length - planned.length, skipped: skipped.size }
}

/**
 * The hunts a grant is for, and the anonymous users' sandboxes it passes over (`isSealedSandbox`):
 * the one at its address, refused when there is none there or it is such a sandbox; or every hunt
 * but those.
 */
async function huntsGranted(db: Reader, hunts: AdoptionT['grants'][number]['hunts']): Promise<{ hunts: Doc<'hunts'>[], sealed: Doc<'hunts'>[] }> {
  if (hunts === 'every') {
    const every = await huntsOf(db)
    const judged = await Promise.all(every.map(async (hunt) => ({ hunt, sealed: await isSealedSandbox(db, hunt) })))
    return { hunts: judged.filter(({ sealed }) => ! sealed).map(({ hunt }) => hunt), sealed: judged.filter(({ sealed }) => sealed).map(({ hunt }) => hunt) }
  }
  const hunt = await huntInOrg(db, hunts.org, hunts.hunt)
  if (! hunt) { throw new ConvexError(`There is no hunt at ~${hunts.org}/${hunts.hunt}.`) }
  if (await isSealedSandbox(db, hunt)) { throw new ConvexError(`~${hunts.org}/${hunts.hunt} is an anonymous user's sandbox, which sealing keeps its own alone: nobody is put on it.`) }
  return { hunts: [hunt], sealed: [] }
}

/**
 * Whether `hunt` is an anonymous user's sandbox: labelled with its own org (`Hunt.isSandbox`), whose
 * userlabel an anonymous user holds, and with that user on it. Sealing keeps such a hunt its user's
 * alone; this keeps the command line to it, there being no actor to ask. A sandbox merged into a
 * user signed in with Google, its anonymous user taken off it, is that user's hunt, and no longer one.
 */
async function isSealedSandbox(db: Reader, hunt: Doc<'hunts'>): Promise<boolean> {
  if (! Hunt.isSandbox(hunt)) { return false }
  const holder = await userForUserlabel(db, hunt.orglabel)
  if (! holder || ! User.isAnonymous(holder)) { return false }
  return await huntshipFor(db, hunt._id, holder._id) !== null
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
  const { user, relabel, leaves, admin, grants, kept, skipped } = planned
  const changes: AdoptChangeT[] = [
    ...(relabel ? [{ kind: 'userlabel' as const, from: user.userlabel ?? null, to: relabel.userlabel, title: relabel.title, huntships, leaves }] : []),
    ...(admin === null ? [] : [{ kind: 'admin' as const, to: admin }]),
    ...grants.map(({ hunt, role, from }) => ({ kind: 'huntship' as const, org: hunt.orglabel, hunt: hunt.label, role, from })),
  ]
  return {
    user:    {
      user_id:    user._id,
      userlabel:  user.userlabel ?? null,
      title:      user.title ?? null,
      anonymous:  User.isAnonymous(user),
      admin:      user.admin === true,
      name:       user.name ?? null,
      created_at: Stamps.of(user).created_at,
      email_verified_at: user.emailVerificationTime ?? null,
    },
    changes,
    kept,
    skipped,
  }
}

/** A user as a refusal names it: its id, and its userlabel or that it holds none */
function userline(user: Doc<'users'>): string {
  const held = user.userlabel === undefined ? 'no userlabel' : User.atLabel({ userlabel: user.userlabel })
  return `${user._id} (${held})`
}
