import type { Id } from '../_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import { refuse } from '../../src/lib/refusals'
import { User } from '../../src/models/user'
import type { UserActionT } from '../../src/models/actions'
import { holderOfUserlabel, huntshipsFor } from '../reading'
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
  const huntships = await huntshipsFor(db, actor.user_id)
  if (filled !== actor.usertitle) { await db.patch('users', actor.user_id, { title: filled }) }
  for (const huntship of huntships) {
    if (huntship.usertitle !== filled) { await db.patch('huntships', huntship._id, { usertitle: filled }) }
  }
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
 * @param userlabel - Its new userlabel, held to the shape and words of one being claimed.
 * @param title - What to call it; its userlabel titleized when blank.
 * @returns How many of its huntships' copies were rewritten.
 * @throws When the userlabel is not one, or the title is not a title; nothing is written.
 *
 * @example await relabelUser(db, user_id, 'mrflip', '')  // => 3, for a user on three hunts
 */
export async function relabelUser(db: Writer, user_id: Id<'users'>, userlabel: string, title: string): Promise<number> {
  const labelled = User.labelled(userlabel, title)
  const huntships = await huntshipsFor(db, user_id)
  await db.patch('users', user_id, labelled)
  const stale = huntships.filter((huntship) => huntship.userlabel !== labelled.userlabel || huntship.usertitle !== labelled.title)
  for (const huntship of stale) {
    await db.patch('huntships', huntship._id, { userlabel: labelled.userlabel, usertitle: labelled.title })
  }
  return stale.length
}

/**
 * Carry out what a visitor did as themselves, writing the rows it comes to: take a userlabel, or
 * retitle the user they are. Whether they may is asked before this (`authorize`).
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
  }
}

/** What Convex Auth tells `createOrUpdateUser` of a sign-in, as far as it is read here */
export type SignInT = {
  /** The user of the account signed in to, when the account is a returning one; null for a new account */
  existingUserId: Id<'users'> | null
  /** The provider signed in with */
  provider:       { id: string }
}

/**
 * The user a sign-in is signed in as, made when it is new: Convex Auth's `createOrUpdateUser`,
 * ours, so that every write to `users` passes our row validator. In order:
 *
 * * A returning account: its own user, as it is
 * * A new anonymous account (every browser's first visit): a new anonymous user, holding no
 *   userlabel until it takes one
 * * Anything else: refused, as no other provider is offered yet
 *
 * @param db - The sign-in's database, running the triggers.
 * @param signIn - What Convex Auth says of the sign-in.
 * @returns The user's row id.
 * @throws For a sign-in with a provider no user is made for.
 *
 * @example await userForSignIn(db, { existingUserId: null, provider: { id: 'anonymous' } })  // => a new anonymous user's id
 */
export async function userForSignIn(db: Writer, signIn: SignInT): Promise<Id<'users'>> {
  if (signIn.existingUserId !== null)     { return signIn.existingUserId }                    // A returning account: its own user
  if (signIn.provider.id === 'anonymous') { return await db.insert('users', User.anonymous()) } // A new anonymous account: a new anonymous user
  throw new Error(`No user is made for a sign-in with ${signIn.provider.id}`)                    // Anything else: refused
}
