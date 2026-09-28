import { lastErrFor } from './errs'
import type { BulkReplyT, Textkind } from './contract'
import type { LastErrT } from '../../models/ask'
import type { IshesDoneT } from '../../models/ish'
import type { QuestionT } from '../../models/question'

/** One text going into a batched run: which cell it belongs to, and what it says */
export type BulkTarget = {
  key:         string
  question_id: string
  textkind:    Textkind
  text:        string
}

/**
 * Where one text's answer lands when the run comes back: the extraction, or -- for a text the
 * response left out -- the failure to ride along on whatever the cell already holds.
 */
export type BulkLanding = {
  question_id: string
  textkind:    Textkind
  ishes:       IshesDoneT | null
  err:         LastErrT | null
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
 * Where each target's answer lands.
 *
 * A text the combined response left out gets a per-cell `last_err` inviting the author to refresh
 * that one on its own, and keeps whatever value and stale flag it had. Nothing filled by a run
 * carries a per-cell token figure: splitting one shared cost across many cells would be an
 * invented number, and the real figure lives on the run.
 *
 * @param targets - What went into the run.
 * @param reply - What came back.
 * @param updated_at - When the run finished.
 * @returns One landing per target, in the order they were asked about.
 */
export function bulkLandingsFor(targets: readonly BulkTarget[], reply: BulkReplyT, updated_at: number = Date.now()): BulkLanding[] {
  const itemsForKey = new Map(reply.groups.map((group) => [group.key, group.items]))
  return targets.map((target) => {
    const items = itemsForKey.get(target.key)
    return {
      question_id: target.question_id,
      textkind:    target.textkind,
      ishes:       items === undefined
        ? null
        : {
          status:             'done' as const,
          items,
          truncated:          reply.truncated,
          stale:              false,
          model_tier_applied: reply.model_tier_applied,
          updated_at,
          last_err:           null,
        },
      err:         items === undefined ? lastErrFor({ ok: false, failurekind: 'missingFromRun' }, updated_at) : null,
    }
  })
}
