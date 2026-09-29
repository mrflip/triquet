import type { Id } from '../_generated/dataModel'
import { refuse } from '../../src/lib/refusals'
import { expressionsOf, huntForLabel, huntingsOf, quizRowsOf, realmsOf } from '../reading'
import { deleteQuiz, updateHunt, type Writer } from './quiz_writing'

/**
 * Give `hunt_id` the label `label`, which every address of its quizzes names it by. The label it
 * was minted with is kept underneath, so relabelling back to it clears the override. Refused when
 * some other hunt already answers to the label, and for a hunt that is gone.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param label - Its new label, already validated.
 *
 * @example await relabelHunt(db, open.hunt_id, 'autumn_hunt')
 */
export async function relabelHunt(db: Writer, hunt_id: Id<'hunts'>, label: string): Promise<void> {
  const [held, taken] = await Promise.all([db.get('hunts', hunt_id), huntForLabel(db, label)])
  if (! held) { refuse('huntGone') }
  if (taken && taken._id !== hunt_id) { refuse('labelTaken') }
  await updateHunt(db, held, { forced_label: label === held.label ? null : label })
}

/**
 * Delete `hunt_id` and everything it holds: each realm's quizzes, with their questions, what bots
 * replied, the reviews and their verdicts; its realms; its expressions; and everyone's place on it.
 * The idents themselves stay. A hunt already gone is nothing to do.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 */
export async function deleteHunt(db: Writer, hunt_id: Id<'hunts'>): Promise<void> {
  const held = await db.get('hunts', hunt_id)
  if (! held) { return }
  const [realms, expressions, huntings] = await Promise.all([realmsOf(db, hunt_id), expressionsOf(db, hunt_id), huntingsOf(db, hunt_id)])
  for (const { realm, quizzes } of realms) {
    for (const quiz of quizzes) {
      const rows = await quizRowsOf(db, quiz._id)
      if (rows) { await deleteQuiz(db, rows) }
    }
    await db.delete('realms', realm._id)
  }
  for (const expression of expressions) { await db.delete('expressions', expression._id) }
  for (const hunting of huntings) { await db.delete('huntings', hunting._id) }
  await db.delete('hunts', hunt_id)
}
