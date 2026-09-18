import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { Quiz, QuizValidators, type QuizT } from './quiz'

export const WorkspaceValidators = Validator(({ obj, arr, ulid }) => {
  const workspace = obj({
    quizzes:        arr(QuizValidators.quiz).min(1)
      .describe('Every round this browser holds. Never empty -- deleting the last round is refused rather than leaving the author staring at nothing.'),
    active_quiz_id: ulid
      .describe('Which round is on screen. A value that names no existing round is repaired to the first round rather than treated as fatal.'),
  })
    .check((context) => {
      const hasActive = context.value.quizzes.some((quiz) => quiz.id === context.value.active_quiz_id)
      if (! hasActive) {
        context.issues.push({ code: 'custom', input: context.value.active_quiz_id, path: ['active_quiz_id'], message: 'active_quiz_id names no quiz in this workspace' })
      }
    })
    .describe('Everything the tool holds for one person in one browser. This is also exactly what the Export panel emits and what Import accepts.')

  return { workspace }
})

export type WorkspaceDNA = Z.input<typeof WorkspaceValidators.workspace>
export type WorkspaceT   = Z.output<typeof WorkspaceValidators.workspace>

/** Everything the tool holds for one person in one browser */
export class Workspace implements WorkspaceT {
  declare quizzes:        QuizT[]
  declare active_quiz_id: string

  /**
   * Validated workspace.
   *
   * @param dna - At least one round, and the id of the one on screen.
   * @returns A complete workspace.
   * @throws When `active_quiz_id` names no round present.
   */
  static fill(dna: WorkspaceDNA): WorkspaceT {
    return WorkspaceValidators.workspace(dna)
  }

  /**
   * Fresh workspace holding one blank round, open.
   *
   * @returns A workspace ready to type into.
   *
   * @example Workspace.blank().quizzes.length  // => 1
   */
  static blank(): WorkspaceT {
    const quiz = Quiz.blank()
    return this.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
  }

  /**
   * `dna`, repaired rather than rejected where it can be: an `active_quiz_id` naming no round
   * falls back to the first one. Anything else still throws.
   *
   * @param dna - A workspace read back from storage or an export.
   * @returns A complete workspace.
   */
  static revive(dna: WorkspaceDNA): WorkspaceT {
    const firstQuiz = dna.quizzes[0]
    if (! firstQuiz) { return this.fill(dna) }
    const hasActive = dna.quizzes.some((quiz) => quiz.id === dna.active_quiz_id)
    return this.fill(hasActive ? dna : { ...dna, active_quiz_id: firstQuiz.id })
  }
}
