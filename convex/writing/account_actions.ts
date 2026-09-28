import type { Id } from '../_generated/dataModel'
import * as PA from '../../src/lib/vv/patterns'
import { Hunt } from '../../src/models/hunt'
import { Ident } from '../../src/models/ident'
import { IdentingValidators } from '../../src/models/identing'
import type { AccountActionT } from '../../src/models/actions'
import { huntForLabel, huntsOf, identForLabel } from '../reading'
import { writeHunt, type Writer } from './quiz_writing'

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
  const ident_id = found ? found._id : await db.insert('idents', Ident.fill(label, title))
  await db.insert('identings', IdentingValidators.row({ browser_key, ident_id }))
  return ident_id
}

/**
 * Make a fresh hunt under `label`: one realm, `home`, holding one blank quiz of the same label.
 * A label some hunt already answers to is refused, as a quiz's is: the caller has already put
 * it in an address. So is one hunt more than the app may hold.
 *
 * @returns The hunt's row id; null when it was refused.
 */
export async function newHunt(db: Writer, label: string): Promise<Id<'hunts'> | null> {
  const [taken, hunts] = await Promise.all([huntForLabel(db, label), huntsOf(db)])
  if (taken || hunts.length >= PA.HuntsInApp.max) { return null }
  return await writeHunt(db, Hunt.blank(label))
}

/**
 * Carry out what a visitor did before opening any quiz, writing the rows it comes to.
 *
 * @param db - The mutation's database.
 * @param browser_key - The visitor's browser.
 * @param action - What the visitor did.
 * @returns The id of the ident taken on or the hunt made; null when the hunt was refused.
 */
export async function performAccount(db: Writer, browser_key: string, action: AccountActionT): Promise<Id<'idents'> | Id<'hunts'> | null> {
  switch (action.kind) {
  case 'assume_ident': { return await assumeIdent(db, browser_key, action.label, action.title) }
  case 'new_hunt':     { return await newHunt(db, action.label) }
  }
}
