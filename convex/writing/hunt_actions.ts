import type { Id } from '../_generated/dataModel'
import { refuse } from '../../src/lib/refusals'
import { huntingsOf, realmsOf, type CensusT } from '../reading'
import { deleteQuiz, updateHunt, type Writer } from './quiz_writing'

/**
 * Give `hunt_id` the title `title`, what it is called on screen. Its label, and so every address
 * of its quizzes, stays as it is. A blank title shows as the label titleized. Refused for a hunt
 * that is gone.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param title - Its new title, already validated.
 *
 * @example await retitleHunt(db, open.hunt_id, 'Autumn Hunt')
 */
export async function retitleHunt(db: Writer, hunt_id: Id<'hunts'>, title: string): Promise<void> {
  const held = await db.get('hunts', hunt_id)
  if (! held) { refuse('huntGone') }
  await updateHunt(db, held, { title })
}

/**
 * Give `hunt_id` the label `label`, which every address of its quizzes names it by; the label it
 * had answers to nothing afterwards. Refused when some other hunt already answers to the label,
 * and for a hunt that is gone.
 *
 * @param db - The mutation's database.
 * @param census - Whose each hunt label is, across every hunt.
 * @param hunt_id - Which hunt.
 * @param label - Its new label, already validated.
 *
 * @example await relabelHunt(db, census, open.hunt_id, 'autumn_hunt')
 */
export async function relabelHunt(db: Writer, census: CensusT, hunt_id: Id<'hunts'>, label: string): Promise<void> {
  const [held, holder_id] = await Promise.all([db.get('hunts', hunt_id), census.huntIdForLabel(label)])
  if (! held) { refuse('huntGone') }
  if (holder_id !== null && holder_id !== hunt_id) { refuse('labelTaken') }
  await updateHunt(db, held, { label })
}

/**
 * Delete `hunt_id` along with its last quiz, and everything they hold: the quiz's questions, its
 * widgetings and what they stored, the reviews and their verdicts; its realms; and everyone's
 * place on it. The library's widgets stay, being every hunt's. The idents themselves stay. A hunt is deleted only once it is down to one quiz, so that
 * no single act loses a hunt's worth of quizzes. A hunt already gone is nothing to do.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @throws A refusal (`huntNotEmptied`) while the hunt holds more than one quiz; nothing is written.
 */
export async function deleteHunt(db: Writer, hunt_id: Id<'hunts'>): Promise<void> {
  const held = await db.get('hunts', hunt_id)
  if (! held) { return }
  const [realms, huntings] = await Promise.all([realmsOf(db, hunt_id), huntingsOf(db, hunt_id)])
  if (realms.flatMap(({ quizzes }) => quizzes).length > 1) { refuse('huntNotEmptied') }
  for (const { realm, quizzes } of realms) {
    for (const quiz of quizzes) { await deleteQuiz(db, quiz._id) }
    await db.delete('realms', realm._id)
  }
  for (const hunting of huntings) { await db.delete('huntings', hunting._id) }
  await db.delete('hunts', hunt_id)
}
