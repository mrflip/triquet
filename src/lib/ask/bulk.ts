import { AskFailureNotices } from '../notices'
import { askError } from '../../models/ask'
import type { BulkReplyT, Textkind } from './contract'
import type { IshesT } from '../../models/ish'
import type { QuestionT } from '../../models/question'

/** One text going into a batched run: which cell it belongs to, and what it says */
export type BulkTarget = {
  key:         string
  question_id: string
  textkind:    Textkind
  text:        string
}

/** Where one text's answer lands when the run comes back */
export type BulkLanding = {
  question_id: string
  textkind:    Textkind
  ishes:       IshesT
}

/** How a text is tagged in the batched prompt, so its answer can be found again */
export function bulkKeyFor(question_id: string, textkind: Textkind): string {
  return `${textkind === 'clueing' ? 'c' : 'h'}:${question_id}`
}

/**
 * Every clueing and every hint in the round that has any text.
 *
 * The rules and instructions that dominate an extraction prompt are identical every time, so
 * folding the whole round into one ask pays for them once instead of once per text.
 *
 * @param questions - The round's questions.
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
    .map((slot) => ({ key: bulkKeyFor(question.id, slot.textkind), question_id: question.id, ...slot })))
}

/**
 * Where each target's answer lands.
 *
 * A text the combined response left out becomes a per-cell error inviting the author to refresh
 * that one on its own, rather than a stale value that looks fresh. Nothing filled by a run
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
        ? askError(AskFailureNotices.missingFromRun, updated_at)
        : {
          status:             'done' as const,
          items,
          truncated:          reply.truncated,
          stale:              false,
          model_tier_applied: reply.model_tier_applied,
          updated_at,
        },
    }
  })
}
