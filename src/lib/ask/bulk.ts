import { bulkBottingFor, failedBottingFor } from './bottings'
import type { BulkReplyT, Textkind } from './contract'
import type { BottingRowDNA } from '../../models/botting'
import type { QuestionT } from '../../models/question'

/** One text going into a batched run: which cell it belongs to, and what it says */
export type BulkTarget = {
  key:         string
  question_id: string
  textkind:    Textkind
  text:        string
}

/** How a text is tagged in the batched prompt, so its answer can be found again */
export function bulkKeyFor(question_id: string, textkind: Textkind): string {
  return `${textkind === 'clueing' ? 'c' : 'h'}:${question_id}`
}

/**
 * Every clueing and every hint in the quiz that has any text.
 *
 * The rules and instructions that dominate an extraction prompt are identical every time, so
 * folding the whole quiz into one ask pays for them once instead of once per text.
 *
 * @param questions - The quiz's questions.
 * @returns One target per non-empty text, clueings and hints together.
 *
 * @example bulkTargetsOf(quiz.questions).length  // => 12, for six filled questions
 */
export function bulkTargetsOf(questions: readonly QuestionT[]): BulkTarget[] {
  return questions.flatMap((question) => ([
    { textkind: 'clueing' as const, text: question.clueing.trim() },
    { textkind: 'hint' as const,    text: question.hint.trim() },
  ])
    .filter((slot) => slot.text !== '')
    .map((slot) => ({ key: bulkKeyFor(question._id, slot.textkind), question_id: question._id, ...slot })))
}

/**
 * What a combined run leaves in each cell it was asked about, as the bottings to record.
 *
 * A text the response answered gets its spans. A text it left out gets a failure inviting the
 * author to refresh that one on its own, which rides along on whatever the cell already holds.
 * Nothing filled by a run carries a per-cell token figure: splitting one shared cost across many
 * cells would be an invented number, and the real figure lives on the run.
 *
 * @param targets - What went into the run.
 * @param reply - What came back.
 * @returns One botting per target, in the order they were asked about.
 */
export function bulkBottingsFor(targets: readonly BulkTarget[], reply: BulkReplyT): BottingRowDNA[] {
  const itemsForKey = new Map(reply.groups.map((group) => [group.key, group.items]))
  return targets.map((target) => {
    const cell = { question_id: target.question_id, bot_label: 'numnum' as const, textkind: target.textkind, asked_text: target.text }
    const items = itemsForKey.get(target.key)
    return items === undefined ? failedBottingFor(cell, { ok: false, failurekind: 'missingFromRun' }) : bulkBottingFor(cell, items, reply)
  })
}
