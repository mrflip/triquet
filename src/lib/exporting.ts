import _ from 'es-toolkit/compat'
import * as Labelmaker from './labelmaker'
import type { ExpressionT } from '../models/expression'
import type { HuntT } from '../models/hunt'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'

/**
 * What a smith is handed of their work: the hunt and its quizzes as the Export box shows them and
 * as each quiz's history keeps them, with every thing named by its label and no ids anywhere.
 *
 * Ids are the database's, and mean nothing outside it. Smiths export, edit by hand, re-import,
 * and carry questions from one draft or one quiz to another; labels are how they say which is
 * which, and two things sharing a label across quizzes is a feature of that, not a collision to
 * guard against. So nothing a smith reads, pastes or diffs carries an id, and a chain names the
 * question it points at by label.
 */

/** A question as a smith is handed it: no id, and its chain by the label of the question it points at */
export type ExportedQuestion = Omit<QuestionT, '_id' | 'chains_to'> & {
  chains_to: string | null
}

/** A quiz as a smith is handed it */
export type ExportedQuiz = Omit<QuizT, '_id' | 'questions'> & {
  questions: ExportedQuestion[]
}

/** A hunt as a smith is handed it: its realms in order, each with its quizzes, and its expressions */
export type ExportedHunt = Pick<HuntT, 'label' | 'forced_label' | 'title'> & {
  realms:      { label: string, title: string, quizzes: ExportedQuiz[] }[]
  expressions: ExpressionT[]
}

/**
 * `quiz` with its ids gone: each question's chain named by the label in force of the question it
 * points at, and a chain to a question the quiz does not hold named as none.
 *
 * @example quizExported(quiz).questions[0]?.chains_to  // => 'nantes'
 */
export function quizExported(quiz: QuizT): ExportedQuiz {
  const labelForId = new Map(quiz.questions.map((question) => [question._id, Labelmaker.effectiveLabelOf(question)]))
  return {
    ..._.omit(quiz, ['_id', 'questions']),
    questions: quiz.questions.map((question) => ({
      ..._.omit(question, ['_id', 'chains_to']),
      chains_to: question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null,
    })),
  }
}

/**
 * `hunt` with its ids gone, down to every question: what the Export box shows.
 *
 * @example huntExported(hunt).realms[0]?.quizzes[0]?.title
 */
export function huntExported(hunt: HuntT): ExportedHunt {
  return {
    label:        hunt.label,
    forced_label: hunt.forced_label,
    title:        hunt.title,
    realms:       hunt.realms.map((realm) => ({ label: realm.label, title: realm.title, quizzes: realm.quizzes.map((quiz) => quizExported(quiz)) })),
    expressions:  [...hunt.expressions],
  }
}
