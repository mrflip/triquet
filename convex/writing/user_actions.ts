import type { Doc, Id } from '../_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import { refuse } from '../../src/lib/refusals'
import { Ident } from '../../src/models/ident'
import { IdentingValidators } from '../../src/models/identing'
import type { UserActionT } from '../../src/models/actions'
import { huntingsFor, identForLabel } from '../reading'
import type { Writer } from './quiz_writing'

/**
 * Assert the userlabel `label` for the session `user_id`, and become that ident. In order:
 *
 * * No ident has the label: one is made now under `title`, claimed by this session.
 * * This session claimed it: it is taken on again.
 * * Nobody has claimed it (an ident from before userlabels were held): this session claims it.
 * * Another session claimed it: refused, `userlabelClaimed`, which says what to do instead.
 *
 * Whichever way it is taken on, the session records an identing of it, and from then on is that
 * ident. The ident is looked up and claimed inside the one write, so two sessions asserting one
 * new label at once leave one holder; where two idents were made with one label, the earlier is
 * the one.
 *
 * @param db - The mutation's database.
 * @param user_id - The session asserting the userlabel.
 * @param label - The ident's label, already validated.
 * @param title - What to call a new ident; ignored when the ident exists, and its label titleized when blank.
 * @returns The ident's row id.
 * @throws A refusal (`userlabelClaimed`); nothing is written.
 *
 * @example await assumeIdent(ctx.db, user_id, 'flip_kromer', 'Flip')
 */
export async function assumeIdent(db: Writer, user_id: Id<'users'>, label: string, title: string): Promise<Id<'idents'>> {
  const found = await identForLabel(db, label)
  const ident_id = found ? await claimFor(db, found, user_id) : await db.insert('idents', Ident.fill({ label, title, user_id }))
  await db.insert('identings', IdentingValidators.row({ user_id, ident_id }))
  return ident_id
}

/**
 * The ident `ident`, held by the session `user_id`: already, or from now, when nobody held it.
 *
 * @returns The ident's row id.
 * @throws A refusal (`userlabelClaimed`) when another session holds it; nothing is written.
 */
async function claimFor(db: Writer, ident: Doc<'idents'>, user_id: Id<'users'>): Promise<Id<'idents'>> {
  const holder = ident.user_id
  if (holder === user_id) { return ident._id }            // this session's own
  if (holder !== null)    { refuse('userlabelClaimed') }   // another session's
  await db.patch('idents', ident._id, { user_id })         // nobody's yet: this session's now
  return ident._id
}

/**
 * Retitle the ident `actor` is: what it is called on screen, which it may change at any time, and
 * so the copy of it each of its huntings holds. Its label, which others add it to hunts by, stays.
 * An actor who has asserted no userlabel is refused.
 *
 * @returns The ident's row id.
 * @throws A refusal (`notIdentified`); nothing is written.
 */
export async function retitleIdent(db: Writer, actor: Actor.ActorT, title: string): Promise<Id<'idents'>> {
  if (Actor.isAnonymous(actor)) { refuse('notIdentified') }
  const [ident, huntings] = await Promise.all([db.get('idents', actor.ident_id), huntingsFor(db, actor.ident_id)])
  if (! ident) { refuse('notIdentified') }
  const { title: filled } = Ident.fill({ label: ident.label, title, user_id: actor.user_id })
  if (filled !== ident.title) { await db.patch('idents', ident._id, { title: filled }) }
  for (const hunting of huntings) {
    if (hunting.ident_title !== filled) { await db.patch('huntings', hunting._id, { ident_title: filled }) }
  }
  return ident._id
}

/**
 * Carry out what a visitor did as themselves, writing the rows it comes to: assert a userlabel, or
 * retitle the ident they are. Whether they may is asked before this (`authorize`).
 *
 * @param db - The mutation's database.
 * @param user_id - The visitor's session.
 * @param actor - Who the visitor is now; anonymous until they have asserted a userlabel.
 * @param action - What the visitor did.
 * @returns The id of the ident taken on or retitled.
 * @throws A refusal when the action cannot be carried out; nothing is written.
 */
export async function performUser(db: Writer, user_id: Id<'users'>, actor: Actor.ActorT, action: UserActionT): Promise<Id<'idents'>> {
  switch (action.kind) {
  case 'assume_ident':  { return await assumeIdent(db, user_id, action.label, action.title) }
  case 'retitle_ident': { return await retitleIdent(db, actor, action.title) }
  }
}
