import type { Id } from '../_generated/dataModel'
import * as PA from '../../src/lib/vv/patterns'
import { identUnknownNotice } from '../../src/lib/notices'
import { refuse } from '../../src/lib/refusals'
import { HuntingValidators, type HuntRole } from '../../src/models/hunting'
import { huntingFor, huntingsOf, identForLabel } from '../reading'
import type { Writer } from './quiz_writing'

/**
 * Put the ident labelled `ident_label` on `hunt_id` as `role`: a new hunting, or the role of the
 * one it already has replaced, never a second.
 *
 * Nobody changes their own place on a hunt; another smith does. Refused when no ident answers to
 * the label (they have to choose it first), when it is the one acting, or when the hunt holds as
 * many members as a hunt may.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param acting_ident_id - Who is adding them.
 * @param ident_label - Who to add, by the label they chose.
 * @param role - What they are to do on it.
 *
 * @example await addHunting(db, open.hunt_id, ident_id, 'alice_reviews', 'reviewer')
 */
export async function addHunting(db: Writer, hunt_id: Id<'hunts'>, acting_ident_id: Id<'idents'>, ident_label: string, role: HuntRole): Promise<void> {
  const ident = await identForLabel(db, ident_label)
  if (! ident) { refuse('identUnknown', identUnknownNotice(ident_label)) }
  const held = await huntingFor(db, hunt_id, ident._id)
  if (held?.role === role) { return }
  if (ident._id === acting_ident_id) { refuse('ownHunting') }
  const row = HuntingValidators.row({ hunt_id, ident_id: ident._id, role })
  if (held) {
    await db.patch('huntings', held._id, { role: row.role })
    return
  }
  const huntings = await huntingsOf(db, hunt_id)
  if (huntings.length >= PA.HuntingsPerHunt.max) { refuse('huntingsFull') }
  await db.insert('huntings', row)
}

/**
 * Take `ident_id` off `hunt_id`. Nobody takes themselves off: refused for the one acting. One not
 * on the hunt is left as they are.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param acting_ident_id - Who is removing them.
 * @param ident_id - Who to remove.
 */
export async function removeHunting(db: Writer, hunt_id: Id<'hunts'>, acting_ident_id: Id<'idents'>, ident_id: Id<'idents'>): Promise<void> {
  if (ident_id === acting_ident_id) { refuse('ownHunting') }
  const held = await huntingFor(db, hunt_id, ident_id)
  if (held) { await db.delete('huntings', held._id) }
}
