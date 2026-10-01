import * as Runner from '../../src/lib/formulary/runner'
import * as Standins from '../../src/lib/formulary/standins'
import { SeedExpressions, type ExpressionT } from '../../src/models/expression'
import { Quiz, type QuizT } from '../../src/models/quiz'
import type { WidgetedT } from '../../src/models/widgeted'
import { Here } from './places'

/**
 * `quiz` run as the screen runs it: its widgets standing in for widgetings, working `expressions`
 * (the seeds, unless told otherwise), sitting `Here` unless told otherwise.
 *
 * @example widgetedOf(runOf(quiz), 'clueing_full', question._id)
 */
export function runOf(quiz: QuizT, expressions: readonly ExpressionT[] = SeedExpressions, place: Runner.QuizPlace = Here): Runner.QuizRun {
  return Runner.runQuiz(Standins.sourceOf(quiz, expressions, place))
}

/**
 * A run of `quiz` whose widgeteds are exactly those given, by widgeting label and then question
 * id: for a reader under test that only reads them.
 *
 * @example runHolding(quiz, { size: { [question._id]: Widgeted.ok(30) } })
 */
export function runHolding(quiz: Pick<QuizT, 'questions'>, widgeteds: Record<string, Record<string, WidgetedT>>): Runner.QuizRun {
  const held = new Map(Object.entries(widgeteds).map(([label, cells]) => [label, new Map(Object.entries(cells))]))
  return { ...runOf({ ...Quiz.blank(), questions: quiz.questions }), widgeteds: held }
}
