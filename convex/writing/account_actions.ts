import type { Id } from '../_generated/dataModel'
import * as PA from '../../src/lib/vv/patterns'
import { refuse } from '../../src/lib/refusals'
import { HuntingValidators } from '../../src/models/hunting'
import { Ident } from '../../src/models/ident'
import { IdentingValidators } from '../../src/models/identing'
import type { AccountActionT } from '../../src/models/actions'
import { huntForLabel, huntsOf, identFor, identForLabel } from '../reading'
import { insertHunt, type Writer } from './quiz_writing'

/**
 * Become the ident labelled `label`: the one there is, or one made now under `title`. Either way
 * this browser records an identing of it, and from then on is that ident.
 *
 * Where two idents were made with one label, the earlier is the one; and since the ident is
 * looked up inside the write, two browsers taking one new label at once make one ident between
 * them.
 *
 * @param db - The mutation's database.
 * @param browser_key - The browser taking the ident on.
 * @param label - The ident's label, already validated.
 * @param title - What to call a new ident; ignored when the ident exists, and its label titleized when blank.
 * @returns The ident's row id.
 *
 * @example await assumeIdent(ctx.db, browser_key, 'flip_kromer', 'Flip')
 */
export async function assumeIdent(db: Writer, browser_key: string, label: string, title: string): Promise<Id<'idents'>> {
  const found = await identForLabel(db, label)
  const ident_id = found ? found._id : await db.insert('idents', Ident.fill({ label, title }))
  await db.insert('identings', IdentingValidators.row({ browser_key, ident_id }))
  return ident_id
}

/**
 * Make a fresh hunt under `label`: one realm, `home`, holding one blank quiz of the same label,
 * with the ident the browser `browser_key` is now as its smith. A browser that has not said who
 * it is is refused, since a hunt nobody is on is a hunt nobody can open. A label some hunt
 * already answers to is refused, as a quiz's is: the caller has already put it in an address. So
 * is one hunt more than the app may hold.
 *
 * @returns The hunt's row id.
 * @throws A refusal (`notIdentified`, `labelTaken`, `huntsFull`); nothing is written.
 */
export async function newHunt(db: Writer, browser_key: string, label: string): Promise<Id<'hunts'>> {
  const [ident, taken, hunts] = await Promise.all([identFor(db, browser_key), huntForLabel(db, label), huntsOf(db)])
  if (! ident) { refuse('notIdentified') }
  if (taken) { refuse('labelTaken') }
  if (hunts.length >= PA.HuntsInApp.max) { refuse('huntsFull') }
  const hunt_id = await insertHunt(db, label)
  await db.insert('huntings', HuntingValidators.row({ hunt_id, ident_id: ident._id, role: 'smith' }))
  return hunt_id
}

/**
 * Carry out what a visitor did before opening any quiz, writing the rows it comes to.
 *
 * @param db - The mutation's database.
 * @param browser_key - The visitor's browser.
 * @param action - What the visitor did.
 * @returns The id of the ident taken on or the hunt made.
 * @throws A refusal when the action cannot be carried out; nothing is written.
 */
export async function performAccount(db: Writer, browser_key: string, action: AccountActionT): Promise<Id<'idents'> | Id<'hunts'>> {
  switch (action.kind) {
  case 'assume_ident': { return await assumeIdent(db, browser_key, action.label, action.title) }
  case 'new_hunt':     { return await newHunt(db, browser_key, action.label) }
  }
}
