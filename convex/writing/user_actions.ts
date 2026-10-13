import type { Doc, Id } from '../_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import { refuse } from '../../src/lib/refusals'
import { GhostingValidators } from '../../src/models/ghosting'
import { Huntship } from '../../src/models/huntship'
import { User, UserValidators, type SignInDNA, type SignInT } from '../../src/models/user'
import type { UserActionT } from '../../src/models/actions'
import { googleAccountOf, holderOfUserlabel, huntInOrg, huntshipFor, huntshipsFor, userForUserlabel } from '../reading'
import { removeHuntship, smithOfSandbox } from './huntship_actions'
import type { Writer } from './quiz_writing'

/**
 * Give the user `user_id` the userlabel `userlabel`, titled `title`: one write to the user. A user
 * holds one userlabel, set once, so a user already holding this one is left as it is (whether it
 * may take another is policy's to say first: `Approve.mayAssertUserlabel`). In order:
 *
 * * The user holds it already: nothing to do.
 * * Something else holds it (`holderOfUserlabel`): another user, a ghosting that keeps a userlabel
 *   a merge retired, or a hunt carrying it as its address (`orglabel`). Refused,
 *   `userlabelClaimed`, which says what to do instead.
 * * It is free: the user takes it, and the title, a blank one its userlabel titleized.
 *
 * The userlabel is looked up and taken inside the one write, so two users taking one userlabel at
 * once leave one holder: Convex runs the second again once the first has landed, and it finds the
 * userlabel held.
 *
 * @param db - The mutation's database.
 * @param user_id - The user taking the userlabel.
 * @param actor - Who the user is now: unlabelled, or already holding this userlabel.
 * @param userlabel - The userlabel, already validated.
 * @param title - What to call the user; its userlabel titleized when blank.
 * @returns The user's row id.
 * @throws A refusal (`userlabelClaimed`); nothing is written.
 *
 * @example await assumeUserlabel(ctx.db, user_id, ctx.actor, 'flip_kromer', 'Flip')
 */
export async function assumeUserlabel(db: Writer, user_id: Id<'users'>, actor: Actor.ActorT, userlabel: string, title: string): Promise<Id<'users'>> {
  if (! Actor.isUnlabelled(actor) && actor.userlabel === userlabel) { return user_id } // the user's own already
  if (await holderOfUserlabel(db, userlabel) !== null) { refuse('userlabelClaimed') }   // not free
  await db.patch('users', user_id, User.labelled(userlabel, title))                    // free: the user's now
  return user_id
}

/**
 * Retitle the user `actor` is: what it is called on screen, which it may change at any time, and
 * so the copy of it each of its huntships holds. Its userlabel, which others add it to hunts by,
 * stays. An actor without a userlabel is refused.
 *
 * @returns The user's row id.
 * @throws A refusal (`notIdentified`); nothing is written.
 */
export async function retitleUser(db: Writer, actor: Actor.ActorT, title: string): Promise<Id<'users'>> {
  if (Actor.isUnlabelled(actor)) { refuse('notIdentified') }
  const filled = User.titleFor(actor.userlabel, title)
  if (filled !== actor.usertitle) { await db.patch('users', actor.user_id, { title: filled }) }
  await recopyOntoHuntships(db, actor.user_id, { userlabel: actor.userlabel, title: filled })
  return actor.user_id
}

/**
 * Give the user `user_id` the userlabel `userlabel`, titled `title`, whatever it held before, and
 * rewrite the copies each of its huntships holds to match (`notes/convex.md`, *Denormalized
 * fields*): the one write that changes a userlabel once it is set. Whether the userlabel is the
 * user's to take is the caller's to say first: no policy is asked here, and no address moves (a
 * hunt's `orglabel` stays as it was made).
 *
 * @param db - The mutation's database.
 * @param user_id - The user to relabel.
 * @param userlabel - Its userlabel, new or the one it holds already, held to the one userlabel check (`User.labelled`).
 * @param title - What to call it; its userlabel titleized when blank.
 * @returns How many of its huntships' copies were rewritten.
 * @throws When the userlabel is not one, or the title is not a title; nothing is written.
 *
 * @example await relabelUser(db, user_id, 'mrflip', '')  // => 3, for a user on three hunts
 */
export async function relabelUser(db: Writer, user_id: Id<'users'>, userlabel: string, title: string): Promise<number> {
  return await rewriteUserlabel(db, user_id, User.labelled(userlabel, title))
}

/**
 * Write `labelled`, a userlabel and title already held to their rules, onto the user `user_id`, and
 * the copies each of its huntships holds to match: what `relabelUser` and a settled name choice
 * share.
 *
 * @returns How many of its huntships' copies were rewritten.
 */
async function rewriteUserlabel(db: Writer, user_id: Id<'users'>, labelled: { userlabel: string, title: string }): Promise<number> {
  await db.patch('users', user_id, labelled)
  return await recopyOntoHuntships(db, user_id, labelled)
}

/**
 * Rewrite the copy of the user `user_id` each of its huntships holds (`notes/convex.md`,
 * *Denormalized fields*) to `labelled`, its userlabel and title as they now stand, where it is
 * stale (`Huntship.isStale`): what a relabel and a retitle share. A huntship already holding them
 * is left unwritten.
 *
 * @returns How many huntships' copies were rewritten.
 */
async function recopyOntoHuntships(db: Writer, user_id: Id<'users'>, labelled: { userlabel: string, title: string }): Promise<number> {
  const huntships = await huntshipsFor(db, user_id)
  const stale = huntships.filter((huntship) => Huntship.isStale(huntship, labelled))
  for (const huntship of stale) {
    await db.patch('huntships', huntship._id, { userlabel: labelled.userlabel, usertitle: labelled.title })
  }
  return stale.length
}

/**
 * Settle the name choice a merge left the user `actor` is: keep `keep`, which is either `merged`,
 * the handle the merged browser went by, or the user's own, and retire the other. The user merged
 * away gives up `merged` either way, and the handle not kept goes into a ghosting (appended, never
 * edited), so nobody else takes it:
 *
 * * Keeping its own: `merged` is retired, held by the user merged away.
 * * Keeping `merged`: the user is relabelled with it and retitled with the merged user's title,
 *   and its huntships' copies follow (`notes/convex.md`, *Denormalized fields*); its own handle
 *   is retired, held by itself.
 *
 * No address moves: a hunt's `orglabel` stays as it was made. The next pending choice, if any,
 * comes up by itself (`nameChoiceFor`).
 *
 * @param db - The mutation's database.
 * @param actor - Who the user is now.
 * @param merged - The handle that names the choice: a user merged into this one holds it still.
 * @param keep - The handle to keep: `merged`, or the user's own.
 * @returns The user's row id.
 * @throws A refusal: `notIdentified` for a user holding no userlabel, `nameChoiceGone` when no user
 *   merged into this one holds `merged`, or `keep` is neither handle (settled already, in another
 *   tab); nothing is written.
 *
 * @example await settleNameChoice(ctx.db, ctx.actor, 'mrflip', 'mrflip')  // the user is mrflip now; its old handle is retired
 */
export async function settleNameChoice(db: Writer, actor: Actor.ActorT, merged: string, keep: string): Promise<Id<'users'>> {
  if (Actor.isUnlabelled(actor)) { refuse('notIdentified') }
  const gone = await userForUserlabel(db, merged)
  const mark = gone?.merged
  if (! gone || mark?.into_user_id !== actor.user_id) { refuse('nameChoiceGone') }         // no choice of this handle is pending
  if (keep !== merged && keep !== actor.userlabel) { refuse('nameChoiceGone') }            // nor between these two
  const keepsMerged = keep === merged
  const retired = keepsMerged ? { userlabel: actor.userlabel, user_id: actor.user_id } : { userlabel: merged, user_id: gone._id }
  await db.patch('users', gone._id, { userlabel: undefined })
  await db.insert('ghostings', GhostingValidators.row({ ...retired, into_user_id: actor.user_id, account_id: mark.account_id }))
  if (keepsMerged) { await rewriteUserlabel(db, actor.user_id, User.labelled(merged, gone.title ?? '')) }
  return actor.user_id
}

/**
 * Carry out what a visitor did as themselves, writing the rows it comes to: take a userlabel,
 * retitle the user they are, or settle the name choice a merge left them. Whether they may is asked before this (`authorize`).
 *
 * @param db - The mutation's database.
 * @param user_id - The visitor's session's user.
 * @param actor - Who the visitor is now; unlabelled until their user holds a userlabel.
 * @param action - What the visitor did.
 * @returns The id of the user labelled or retitled.
 * @throws A refusal when the action cannot be carried out; nothing is written.
 */
export async function performUser(db: Writer, user_id: Id<'users'>, actor: Actor.ActorT, action: UserActionT): Promise<Id<'users'>> {
  switch (action.kind) {
  case 'assume_userlabel': { return await assumeUserlabel(db, user_id, actor, action.userlabel, action.title) }
  case 'retitle_user':     { return await retitleUser(db, actor, action.title) }
  case 'settle_name_choice': { return await settleNameChoice(db, actor, action.merged, action.keep) }
  }
}

/**
 * The user a sign-in is signed in as, made when it is new: Convex Auth's `createOrUpdateUser`,
 * ours, so that every write to `users` passes our row validator. What Convex Auth hands over is
 * validated here, and kept to what a user holds (`UserValidators.signIn`). In order:
 *
 * * Anonymous: a returning account's own user, or for a new account (every browser's first
 *   visit), a new anonymous user, holding no userlabel until it takes one.
 * * Google: as `userForGoogle` says, in two steps, from whose the account is and, once the
 *   browser has proved it started the sign-in, whose the browser was.
 * * Anything else: refused, as no other provider is offered.
 *
 * @param db - The sign-in's database, running the triggers.
 * @param signIn - What Convex Auth says of the sign-in.
 * @returns The user's row id.
 * @throws For a sign-in with a provider no user is made for.
 *
 * @example await userForSignIn(db, { existingUserId: null, provider: { id: 'anonymous' } })  // => a new anonymous user's id
 */
export async function userForSignIn(db: Writer, signIn: SignInDNA): Promise<Id<'users'>> {
  const checked = UserValidators.signIn(signIn)
  const { existingUserId, provider } = checked
  if (provider.id === 'google') { return await userForGoogle(db, checked) }
  if (provider.id !== 'anonymous') { throw new Error(`No user is made for a sign-in with ${provider.id}`) }
  return existingUserId ?? await db.insert('users', User.anonymous())
}

/**
 * The user a Google sign-in is signed in as, decided in two steps, as Convex Auth asks twice.
 *
 * * **At Google's callback** (`oauth`), the account is linked to a user, and nothing more: nothing
 *   there proves that the browser Google sent back is the one that started the sign-in (a link to
 *   the deployment's sign-in address works from any browser), so nothing of the starting browser's
 *   user is read or written (`accountUserAtCallback`).
 * * **At the code's exchange** (`verification`), the finishing browser has proved it started the
 *   sign-in: it holds the verifier it kept, and the code Google sent it. Only now is the starting
 *   browser's user (`authUserId`) weighed, and upgraded, merged or switched from
 *   (`userAtExchange`).
 *
 * Nothing is decided by email: two Google accounts sharing one are two users.
 *
 * @returns The user's row id.
 * @throws For a Google sign-in asked at a step that is neither.
 */
async function userForGoogle(db: Writer, signIn: SignInT): Promise<Id<'users'>> {
  if (signIn.type === 'oauth') { return await accountUserAtCallback(db, signIn) }
  if (signIn.type === 'verification') { return await userAtExchange(db, signIn) }
  throw new Error(`A Google sign-in is not asked for its user at ${String(signIn.type)}`)
}

/**
 * The user Google's callback links the account to: a known account's own user, its email, name
 * and picture brought up to date with what Google sent; or, for a new account, a new provisional
 * user holding them (`User.provisional`), which the exchange keeps or folds away. The browser that
 * started the sign-in is never asked about here.
 *
 * @returns The user's row id.
 */
async function accountUserAtCallback(db: Writer, { existingUserId, profile }: SignInT): Promise<Id<'users'>> {
  if (existingUserId === null) { return await db.insert('users', User.provisional(profile)) }
  await db.patch('users', existingUserId, User.fromGoogle(profile))
  return existingUserId
}

/**
 * The user a Google sign-in ends with, once the browser has proved it started it: by whose the
 * account is (its user, provisional for an account new at the callback) and whose the browser was
 * as it started (`authUserId`: anonymous, signed in with Google, or no session). In order:
 *
 * * A new account, from an anonymous browser: **upgrade in place**. The account joins that user,
 *   which takes what Google sent and is no longer anonymous, keeping its userlabel, its sandbox and
 *   its sessions; the provisional user, which nobody was ever signed in as, is deleted.
 * * A new account, from a browser signed in with Google or with no session: the provisional user
 *   is kept, a new user holding no userlabel. (Linking a second Google account to a user is not
 *   done.)
 * * A known account, from its own user's browser, one signed in with Google as another user (two
 *   Google users are never merged), no session, or an anonymous user holding no userlabel: the
 *   account's user, which the browser switches to.
 * * A known account, from an anonymous browser holding a userlabel: **merge** (`mergeInto`). The
 *   account's user carries on.
 *
 * @returns The user's row id; Convex Auth moves the account to it.
 */
async function userAtExchange(db: Writer, { existingUserId, authUserId }: SignInT): Promise<Id<'users'>> {
  if (existingUserId === null) { throw new Error('A Google sign-in reaches its exchange with its account linked') }
  const [account, browser] = await Promise.all([db.get('users', existingUserId), authUserId === null ? null : db.get('users', authUserId)])
  if (account === null) { throw new Error('A Google sign-in reaches its exchange with its account\'s user there') }
  const anonymous = browser !== null && User.isAnonymous(browser)
  if (account.provisional === true) {
    if (! anonymous) {                                                             // a new user
      await db.patch('users', account._id, { provisional: undefined })
      return account._id
    }
    await db.patch('users', browser._id, User.fromGoogle(UserValidators.googleProfile(account))) // upgrade in place
    await db.delete('users', account._id)
    return browser._id
  }
  if (anonymous && browser.userlabel !== undefined) { await mergeInto(db, browser, browser.userlabel, account._id) }
  return account._id
}

/**
 * Merge the anonymous user `gone`, holding a userlabel, into `into_user_id`, a user signed in with
 * Google, whose account its browser has just signed in to. `into_user_id` carries on:
 *
 * * It is made smith of `gone`'s sandbox, if `gone` has one, which keeps its address; `gone` is
 *   taken off it, as nobody can be signed in as `gone` again.
 * * A name choice: while `into_user_id` holds a userlabel, it keeps it, and `gone` keeps its own,
 *   held from everyone else, until the choice is settled (`nameChoiceFor`). An `into_user_id`
 *   holding none has nothing to choose between, and takes `gone`'s userlabel and title.
 * * `gone` is marked (`merged`), never deleted, and its sessions are deleted, with their refresh
 *   tokens: Convex Auth's own rows.
 *
 * @param db - The sign-in's database.
 * @param gone - The anonymous user the browser was.
 * @param goneLabel - The userlabel it holds.
 * @param into_user_id - The user of the Google account signed in to.
 */
async function mergeInto(db: Writer, gone: Doc<'users'>, goneLabel: string, into_user_id: Id<'users'>): Promise<void> {
  const [into, account, sandbox] = await Promise.all([
    db.get('users', into_user_id), googleAccountOf(db, into_user_id), huntInOrg(db, goneLabel, goneLabel),
  ])
  if (into === null || account === null) { throw new Error('A merge is into a user signed in with Google') }
  const carried = sandbox === null ? null : await huntshipFor(db, sandbox._id, gone._id)
  const takesLabel = into.userlabel === undefined
  await db.patch('users', gone._id, { ...User.mergedInto(into._id, account._id), ...(takesLabel && { userlabel: undefined }) })
  const taken = takesLabel ? User.labelled(goneLabel, gone.title ?? '') : null
  const heir = taken === null ? into : { ...into, ...taken }
  if (taken !== null) { await db.patch('users', into._id, taken) }
  if (sandbox !== null && carried !== null) {
    await smithOfSandbox(db, heir, sandbox)
    await removeHuntship(db, sandbox._id, gone._id)
  }
  await endSessionsOf(db, gone._id)
}

/**
 * Delete every session of the user `user_id`, and each one's refresh tokens, as Convex Auth's sign
 * out deletes one: nobody is signed in as it afterwards. Convex Auth's own rows, written here only
 * for a merge.
 */
async function endSessionsOf(db: Writer, user_id: Id<'users'>): Promise<void> {
  const sessions = db.query('authSessions').withIndex('userId', (cvx) => cvx.eq('userId', user_id))
  for await (const session of sessions) {
    const tokens = db.query('authRefreshTokens').withIndex('sessionId', (cvx) => cvx.eq('sessionId', session._id))
    for await (const token of tokens) { await db.delete('authRefreshTokens', token._id) }
    await db.delete('authSessions', session._id)
  }
}
