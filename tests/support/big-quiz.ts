import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import * as Wheel from '../../src/lib/wheel'
import type { QuizFrameT, SeenQuestionT, ShallowHuntT, ShallowRealmT } from '../../src/lib/rows'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import type { IshItemT } from '../../src/models/ish'
import type { StoredWidgetedT, WidgetedHistoryT, JsonT } from '../../src/models/widgeted'
import { classicLayout } from './layouts'

/*
 * A quiz the size of a real one, for measuring what the screen costs: forty questions in the
 * classic layout (the three bots, the BUT NOT ishes and the eight sums), each chained to the next,
 * its number spotters answered, its clueing and notes templated. What `tests/**\/*.bench.tsx`
 * measures the grid and the run over.
 */

/** How many questions a big quiz holds, unless told otherwise */
export const BigQuizQty = 40

/** A cell whose newest row, and newest `ok` row, both hold `value` */
function answered(value: JsonT): WidgetedHistoryT {
  const row: StoredWidgetedT = { status: 'ok', value, message: null, result_meta: {}, _creationTime: 3.5 }
  return { newest: row, ok: row }
}

/** A number spotter's answer: the spans it found */
function spotted(...values: number[]): WidgetedHistoryT {
  const items: IshItemT[] = values.map((val) => ({ text: String(val), value: val, kind: 'numeral' }))
  return answered({ items })
}

/** The `idx`th question of a big quiz, chained to the one labelled `chains_to` */
function bigQuestion(idx: number, chains_to: string | null): QuestionT {
  const num = idx + 1
  return {
    ...Question.blank(),
    label:       `question_${String(num)}`,
    title:       `Answer ${String(num)}`,
    qnum:        String(num),
    clueing:     `**{{ question.title }}** was crowned in ${String(1800 + num)}, the ${String(num)}th of ${String(num * 3)} heirs. Which *prince* was it?`,
    hint:        `BUT NOT one of the ${String(num + 2)} dukes of [the duchy](https://example.com/${String(num)})`,
    full_answer: `PRINCE ${String(num)} (accept ANSWER ${String(num)})`,
    notes:       `Checked against {{ questions | values | size }} others; see {{ quiz.title }}.`,
    recap:       `Number ${String(num)} went *well*.`,
    chains_to,
    stored: {
      numnum_clueing: spotted(1800 + num, num, num * 3),
      numnum_hint:    spotted(num + 2),
      dumdum:         answered({ guess: `Guess ${String(num)}`, explanation: 'A first instinct.' }),
    },
  }
}

/**
 * A quiz of `qty` questions in the classic layout, each chained to the next, its number spotters
 * and its quick guesser answered, its clueing and notes nominated as templateable.
 *
 * @example bigQuiz().questions.length  // => 40
 */
export function bigQuiz(qty = BigQuizQty): QuizT {
  const ids = Array.from({ length: qty }, () => Question.blank()._id)
  const questions = ids.map((_id, ii) => ({ ...bigQuestion(ii, ids[ii + 1] ?? null), _id }))
  return { ...Quiz.blank('Princes of the Realm', 'princes'), questions, ...classicLayout(), templateable: ['clueing', 'notes'] }
}

/** The hunt a big quiz sits in, as a quiz's screen holds it: one realm, holding it, and a smith */
export function bigHuntFor(quiz: QuizT): { hunt: ShallowHuntT, realm: ShallowRealmT } {
  const realm: ShallowRealmT = { _id: 'realm_home' as Id<'realms'>, label: 'home', title: 'Home', quizzes: [{ _id: quiz._id, label: quiz.label, title: quiz.title, locked: false }] as unknown as ShallowRealmT['quizzes'] }
  const hunt: ShallowHuntT = {
    _id: 'hunt_big' as Id<'hunts'>, label: 'deep_lake', org: 'seed_smith', title: 'Deep Lake', branch: 'main', created_at: 1, updated_at: 1,
    realms: [realm], wheel: Wheel.defaultWheel(), members: [], role: 'smith',
  }
  return { hunt, realm }
}

/** A smith's claims on the hunt `bigHuntFor` makes, with `quiz` on screen */
export function smithClaimsOn(hunt: ShallowHuntT, quiz: QuizT): Actor.QuizClaimsT {
  const smith = Actor.asIdent('users_smith' as Id<'users'>, { _id: 'idents_smith' as Id<'idents'>, label: 'seed_smith' }, true)
  return { ...Actor.claimsOn(smith, hunt._id, { role: 'smith' }), quiz: { locked: quiz.locked } }
}

/** A big quiz as the screen reads it: its frame (`quizzes.open`), and each question's reading (`questions.open`), by its id */
export type BigReadingsT = {
  frame:    QuizFrameT
  readings: Map<string, SeenQuestionT>
}

/**
 * `quiz` as a smith's screen is sent it: the frame, ordering its questions and naming each
 * widgeting's id, and each question as its own query sends it, its chain a label and what it
 * stored by widgeting id. What `assembledQuiz` makes `quiz` of again.
 *
 * @example assembledQuiz(frame, (question_id) => readings.get(question_id))  // => quiz, as a tree
 */
export function bigReadingsOf(quiz: QuizT): BigReadingsT {
  const widgeting_ids = Object.fromEntries(quiz.widgetings.map((widgeting) => [widgeting.label, `widgeting_${widgeting.label}` as Id<'widgetings'>]))
  const labelOf = new Map(quiz.questions.map((question) => [question._id, question.label]))
  const { questions, ...rest } = quiz
  const frame: QuizFrameT = { ...rest, row_ordering: questions.map((question) => question._id as Id<'questions'>), widgeting_ids }
  const readings = new Map(questions.map((question): [string, SeenQuestionT] => [question._id, {
    ...question,
    _id:       question._id as Id<'questions'>,
    chains_to: question.chains_to === null ? null : labelOf.get(question.chains_to) ?? null,
    stored:    Object.fromEntries(Object.entries(question.stored).map(([label, history]) => [widgeting_ids[label] ?? label, history])),
    created_at: 1,
    updated_at: 1,
  }]))
  return { frame, readings }
}
