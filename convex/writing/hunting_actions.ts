import type { Id } from '../_generated/dataModel'
import * as PA from '../../src/lib/vv/patterns'
import { identUnknownNotice } from '../../src/lib/notices'
import { refuse } from '../../src/lib/refusals'
import { HuntingValidators, type HuntRole } from '../../src/models/hunting'
import { huntingFor, huntingsOf, identForLabel } from '../reading'
import type { Writer } from './quiz_writing'

/**
 * Put the ident labelled `ident_label` on `hunt_id` as `role`: a new hunting, carrying the
 * ident's label and title, or the role of the one it already has replaced, never a second.
 *
 * Refused when no ident answers to the label (they have to choose it first), or when the hunt
 * holds as many members as a hunt may. Whether the one acting may change this member's place is
 * asked before this (`Approve.mayChangeMembership`).
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param ident_label - Who to add, by the label they chose.
 * @param role - What they are to do on it.
 *
 * @example await addHunting(db, open.hunt_id, 'alice_reviews', 'reviewer')
 */
export async function addHunting(db: Writer, hunt_id: Id<'hunts'>, ident_label: string, role: HuntRole): Promise<void> {
  const ident = await identForLabel(db, ident_label)
  if (! ident) { refuse('identUnknown', identUnknownNotice(ident_label)) }
  const held = await huntingFor(db, hunt_id, ident._id)
  if (held?.role === role) { return }
  const row = HuntingValidators.row({ hunt_id, ident_id: ident._id, ident_label: ident.label, ident_title: ident.title, role })
  if (held) {
    await db.patch('huntings', held._id, { role: row.role })
    return
  }
  const huntings = await huntingsOf(db, hunt_id)
  if (huntings.length >= PA.HuntingsPerHunt.max) { refuse('huntingsFull') }
  await db.insert('huntings', row)
}

/**
 * Take `ident_id` off `hunt_id`. One not on the hunt is left as they are. Whether the one acting
 * may take them off is asked before this (`Approve.mayChangeMembership`).
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param ident_id - Who to remove.
 */
export async function removeHunting(db: Writer, hunt_id: Id<'hunts'>, ident_id: Id<'idents'>): Promise<void> {
  const held = await huntingFor(db, hunt_id, ident_id)
  if (held) { await db.delete('huntings', held._id) }
}
