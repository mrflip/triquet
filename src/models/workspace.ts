import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { Quiz, QuizValidators, type QuizT } from './quiz'
import { ExpressionValidators, SeedExpressions, keyOf, type ExpressionT } from './expression'
import { defaultLayoutFor } from './layout'

export const WorkspaceValidators = Validator(({ obj, arr, rowid, treeid }) => {
  const workspace = obj({
    quizzes:        arr(QuizValidators.quiz).min(1)
      .describe('Every quiz this browser holds. Never empty -- deleting the last quiz is refused rather than leaving the author staring at nothing.'),
    active_quiz_id: treeid
      .describe('Which quiz is on screen. A value that names no existing quiz is repaired to the first quiz rather than treated as fatal.'),
    expressions:    arr(ExpressionValidators.expression).default([])
      .describe('The calculations this workspace can put to work as columns, by any of its quizzes.'),
  })
    .check((context) => {
      const expressionsSeen = new Set<string>()
      for (const [ii, expression] of context.value.expressions.entries()) {
        const key = keyOf(expression)
        if (expressionsSeen.has(key)) {
          context.issues.push({ code: 'custom', input: key, path: ['expressions', ii, 'label'], message: 'Two expressions share an owner and a label' })
        }
        expressionsSeen.add(key)
      }
      const labelsHeld = new Set(context.value.expressions.map((expression) => expression.label))
      for (const [qq, quiz] of context.value.quizzes.entries()) {
        for (const [ii, widget] of quiz.widgets.entries()) {
          if (widget.kind === 'expressing' && ! labelsHeld.has(widget.expression_label)) {
            context.issues.push({ code: 'custom', input: widget.expression_label, path: ['quizzes', qq, 'widgets', ii, 'expression_label'], message: 'A widget names an expression this workspace does not have' })
          }
        }
      }
      const hasActive = context.value.quizzes.some((quiz) => quiz.id === context.value.active_quiz_id)
      if (! hasActive) {
        context.issues.push({ code: 'custom', input: context.value.active_quiz_id, path: ['active_quiz_id'], message: 'active_quiz_id names no quiz in this workspace' })
      }
    })
    .describe('Everything the tool holds for one person in one browser. This is also exactly what the Export panel emits and what Import accepts.')

  const row = obj({
    active_quiz_id: rowid.nullable()
      .describe('Which quiz is on screen, or null before there is one.'),
  })
    .describe('One workspace as the database holds it: one per account. Its quizzes and expressions are rows of their own.')

  return { workspace, row }
})

export type WorkspaceDNA = Z.input<typeof WorkspaceValidators.workspace>
export type WorkspaceT   = Z.output<typeof WorkspaceValidators.workspace>

/** Everything the tool holds for one person in one browser */
export class Workspace implements WorkspaceT {
  declare quizzes:        QuizT[]
  declare active_quiz_id: string
  declare expressions:    ExpressionT[]

  /**
   * Validated workspace.
   *
   * @param dna - At least one quiz, and the id of the one on screen.
   * @returns A complete workspace.
   * @throws When `active_quiz_id` names no quiz present, two expressions share a label, or a column names an expression that is not here.
   */
  static fill(dna: WorkspaceDNA): WorkspaceT {
    return WorkspaceValidators.workspace(dna)
  }

  /**
   * Fresh workspace holding one blank quiz, open, with the standard expressions and the standard columns.
   *
   * @returns A workspace ready to type into.
   *
   * @example Workspace.blank().quizzes.length  // => 1
   */
  static blank(): WorkspaceT {
    const quiz = { ...Quiz.blank(), ...defaultLayoutFor(SeedExpressions) }
    return this.fill({ quizzes: [quiz], active_quiz_id: quiz.id, expressions: [...SeedExpressions] })
  }

  /**
   * `dna`, repaired rather than rejected where it can be: an `active_quiz_id` naming no quiz
   * falls back to the first one, and a workspace holding no expressions at all -- one saved
   * before there were any -- is given the standard expressions and each of its quizzes that has no columns the
   * standard widgets and columns. Anything else still throws.
   *
   * @param dna - A workspace read back from storage or an export.
   * @returns A complete workspace.
   */
  static revive(dna: WorkspaceDNA): WorkspaceT {
    const firstQuiz = dna.quizzes[0]
    if (! firstQuiz) { return this.fill(dna) }
    const hasActive = dna.quizzes.some((quiz) => quiz.id === dna.active_quiz_id)
    const active_quiz_id = hasActive ? dna.active_quiz_id : firstQuiz.id
    if ((dna.expressions ?? []).length > 0) { return this.fill({ ...dna, active_quiz_id }) }
    const quizzes = dna.quizzes.map((quiz) => ((quiz.columns ?? []).length > 0 ? quiz : { ...quiz, ...defaultLayoutFor(SeedExpressions) }))
    return this.fill({ ...dna, active_quiz_id, quizzes, expressions: [...SeedExpressions] })
  }
}

/** The quiz the workspace last had open, or null when it names one it does not hold */
export function openQuizOf(workspace: WorkspaceT): QuizT | null {
  return workspace.quizzes.find((quiz) => quiz.id === workspace.active_quiz_id) ?? null
}

/**
 * How many widgets, across every quiz, work the expression labelled `label`.
 *
 * @param workspace - The workspace as it stands.
 * @param label - An expression's label.
 * @returns How many expressing widgets name it; an expression is only deletable at zero.
 *
 * @example expressionUsage(workspace, 'clueing_full')  // => 1
 */
export function expressionUsage(workspace: WorkspaceT, label: string): number {
  return workspace.quizzes.reduce((total, quiz) => total + quiz.widgets.filter((widget) => widget.kind === 'expressing' && widget.expression_label === label).length, 0)
}
