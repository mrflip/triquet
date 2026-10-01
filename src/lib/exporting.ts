import _ from 'es-toolkit/compat'
import * as Labelmaker from './labelmaker'
import * as Runner from './formulary/runner'
import type { HuntT } from '../models/hunt'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import { Widget, type WidgetT } from '../models/widget'
import type { WidgetedT } from '../models/widgeted'

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

/** What one widgeting came to for one question, as a smith is handed it: its exposed fields */
export type ExportedWidgeted = Pick<WidgetedT, 'status' | 'value'>

/**
 * A question as a smith is handed it: no id, its chain by the label of the question it points
 * at, and beside its own fields what every widgeting of the quiz came to, under the widgeting's
 * label, the worked-out ones included.
 */
export type ExportedQuestion = Omit<QuestionT, '_id' | 'chains_to' | 'stored'> & {
  chains_to: string | null
  [widgeting_label: string]: unknown
}

/** A quiz as a smith is handed it */
export type ExportedQuiz = Omit<QuizT, '_id' | 'questions'> & {
  questions: ExportedQuestion[]
}

/**
 * A hunt as a smith is handed it: its realms in order, each with its quizzes. The widgets its
 * quizzes work are named by label, and are the library's to export.
 */
export type ExportedHunt = Pick<HuntT, 'label' | 'forced_label' | 'title'> & {
  realms: { label: string, title: string, quizzes: ExportedQuiz[] }[]
}

/**
 * `quiz` with its ids gone: each question's chain named by the label in force of the question it
 * points at (a chain to a question the quiz does not hold named as none), and what each of its
 * widgetings came to beside its own fields.
 *
 * @param quiz - The quiz.
 * @param run - The quiz, run: what its widgetings came to.
 * @returns The quiz as a smith is handed it.
 *
 * @example quizExported(quiz, run).questions[0]?.chains_to  // => 'nantes'
 * @example quizExported(quiz, run).questions[0]?.clueing_full  // => { status: 'ok', value: 312 }
 */
export function quizExported(quiz: QuizT, run: Runner.QuizRun): ExportedQuiz {
  const labelForId = new Map(quiz.questions.map((question) => [question._id, Labelmaker.effectiveLabelOf(question)]))
  return {
    ..._.omit(quiz, ['_id', 'questions']),
    questions: quiz.questions.map((question) => ({
      ..._.omit(question, ['_id', 'chains_to', 'stored']),
      chains_to: question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null,
      ...Object.fromEntries(quiz.widgetings.map(({ label }) => [label, exposedOf(Runner.widgetedOf(run, label, question._id))])),
    })),
  }
}

/**
 * `hunt` with its ids gone, down to every question, each quiz run over `library`: what the
 * Export box shows.
 *
 * @param hunt - The hunt, every quiz whole.
 * @param library - The library's widgets, which its quizzes' widgetings work.
 * @returns The hunt as a smith is handed it.
 *
 * @example huntExported(hunt, library).realms[0]?.quizzes[0]?.title
 */
export function huntExported(hunt: HuntT, library: readonly WidgetT[]): ExportedHunt {
  return {
    label:        hunt.label,
    forced_label: hunt.forced_label,
    title:        hunt.title,
    realms:       hunt.realms.map((realm) => {
      const place = Runner.placeOf(hunt, realm)
      const quizzes = realm.quizzes.map((quiz) => quizExported(quiz, Runner.runQuiz(Runner.sourceOf(quiz, library, place))))
      return { label: realm.label, title: realm.title, quizzes }
    }),
  }
}

/** A widgeted's exposed fields */
function exposedOf(widgeted: WidgetedT): ExportedWidgeted {
  return { status: widgeted.status, value: widgeted.value }
}

/** The library as it is handed over on its own: every widget, in library order */
export type ExportedLibrary = { widgets: WidgetT[] }

/**
 * The library, apart from any hunt: every widget's fields, without its place, in the order the
 * library lists them. What its Import reads back.
 *
 * @example libraryExported(library).widgets.map((widget) => widget.label)  // => ['dumdum', 'numnum_clueing', ...]
 */
export function libraryExported(library: readonly WidgetT[]): ExportedLibrary {
  return { widgets: library.map((widget) => Widget.exported(widget)) }
}
