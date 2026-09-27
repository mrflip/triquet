import type { Db } from 'jazz-tools'
import { app } from '../db/schema'
import { Hunt } from '../models/hunt'
import { Ident, IdentValidators } from '../models/ident'
import { IdentingValidators } from '../models/identing'
import { lookUp } from './lookup'
import { huntRowFor, type HeldRows } from './quiz-rows'
import { transact, writeHunt } from './quiz-writing'
import type { AccountAction } from './actions'

/**
 * Become the ident labelled `label`: the one there is, or one made now under `title`. Either way
 * this account records an identing of it, and from then on is that ident.
 *
 * Where two idents were made with one label, the earlier is the one. A browser holding no ident
 * of that label asks the server before making one, so a friend's first visit finds the ident
 * they made on another device rather than making a second.
 *
 * @param db - The account's database.
 * @param label - The ident's label, already normalized (`Ident.labelFor`).
 * @param title - What to call a new ident; ignored when the ident exists, and its label titleized when blank.
 * @returns The ident's row id.
 * @throws When the label is not an ident label; nothing is written.
 *
 * @example await assumeIdent(db, 'flip_kromer', 'Flip')
 */
export async function assumeIdent(db: Db, label: string, title: string): Promise<string> {
  const clean = IdentValidators.identLabel(label)
  const [found] = await lookUp(db, app.idents.where({ label: clean }).orderBy('$createdAt').limit(1))
  const ident_id = await transact(db, (tx) => {
    const id = found ? found.id : tx.insert(app.idents, Ident.fill(clean, title)).id
    tx.insert(app.identings, IdentingValidators.row({ ident_id: id }))
    return id
  })
  if (ident_id === null) { throw new Error('Taking on an ident wrote nothing') }
  return ident_id
}

/**
 * Make a fresh hunt under `label`: one realm, `home`, holding one blank quiz of the same label.
 * A label some hunt already answers to is refused, as a quiz's is: the caller has already put
 * it in an address.
 *
 * @returns The hunt's row id; null when the label was refused.
 */
export async function newHunt(db: Db, held: Pick<HeldRows, 'hunts'>, label: string): Promise<string | null> {
  if (huntRowFor(held, label)) { return null }
  return await transact(db, (tx) => writeHunt(tx, Hunt.blank(label)))
}

/**
 * Carry out what a visitor did before opening any quiz, writing the rows it comes to.
 *
 * @param db - The account's database.
 * @param held - The hunts this browser holds, for a new hunt's label to be checked against.
 * @param action - What the visitor did.
 * @throws When the action carries something invalid; nothing is written.
 */
export async function performAccount(db: Db, held: Pick<HeldRows, 'hunts'>, action: AccountAction): Promise<void> {
  switch (action.kind) {
  case 'assume_ident': { await assumeIdent(db, action.label, action.title); return }
  case 'new_hunt':     { await newHunt(db, held, action.label) }
  }
}
