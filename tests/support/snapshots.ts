import * as Exporting from '../../src/lib/exporting'
import * as Wheel from '../../src/lib/wheel'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SeedWidgets } from '../../src/models/seeds'
import { Widget } from '../../src/models/widget'
import { Widgeting } from '../../src/models/widgeting'
import { classicLayout } from './layouts'
import { present } from './present'

/*
 * A hunt to export: two quizzes, one chained, widgeted and typed into, two members, and a shared
 * review and a draft one. What the balls of `Exporting` and the files of `Huntfiles` are tested on.
 */

/** A stored row of what a widgeting came to: `ok` holding `value`, or `errored` for `why` */
export const storedOk = (value: unknown) => ({ status: 'ok' as const, value, message: null, result_meta: {}, _creationTime: 1000 })
export const storedErrored = (why: string) => ({ status: 'errored' as const, value: null, message: why, result_meta: {}, _creationTime: 2000 })

/** The number spotter's reply to a clueing holding 300 and twelve */
export const SpottedItems = { items: [{ text: '300', value: 300, kind: 'numeral' }, { text: 'twelve', value: 12, kind: 'wordish' }] }

/** The library, with the entry `remark` (text) */
export const EntryLibrary = [...SeedWidgets, Widget.fill({ label: 'remark', formulary: 'entry', config: { entry_kind: 'text' } })]

/**
 * A quiz working the default widgetings and the entry `remark`, whose first question, `leon`,
 * chains to its second, `nantes`. Leon's clueing was read by the number spotter, its quick guess
 * failed, and its remark is typed.
 */
export function chainedQuiz(): QuizT {
  const nantes = { ...Question.blank(), qnum: '2', label: 'nantes', title: 'Nantes' }
  const stored: QuestionT['stored'] = {
    numnum_clueing: { newest: storedOk(SpottedItems), ok: storedOk(SpottedItems) },
    dumdum:         { newest: storedErrored('Overloaded'), ok: null },
    remark:         { newest: storedOk('Ask Flip.'), ok: storedOk('Ask Flip.') },
  } as QuestionT['stored']
  const leon = { ...Question.blank(), qnum: '1', label: 'leon', title: 'Leon', chains_to: nantes._id, stored }
  const layout = classicLayout()
  const widgetings = [...layout.widgetings, Widgeting.fill({ widget_label: 'remark', label: 'remark' })]
  return { ...Quiz.blank('Princes', 'princes'), ...layout, widgetings, questions: [leon, nantes] }
}

/** A hunt of two quizzes, `princes` (chained, widgeted, typed into) and `paris` (blank) */
export function twoQuizHunt(): HuntT {
  const hunt = Hunt.blank('deep_lake')
  const realm = present(hunt.realms[0])
  return { ...hunt, realms: [{ ...realm, quizzes: [chainedQuiz(), Quiz.blank('Paris', 'paris')] }] }
}

/** Lee's verdict on Leon */
export const Verdict = { get_rate: 40, guesses: 'Leon?', comments: 'Lovely.', minutes: 2, keep_it: true, needs_fact_check: false, elimination_candidate: false }

/** Everything the two-quiz hunt's balls are made from: a wheel with TV in the pool, two members, and Lee's shared review and Kim's draft of `princes` */
export function snapshot(): Exporting.HuntSnapshotT {
  const hunt = twoQuizHunt()
  const princes = present(hunt.realms[0]?.quizzes[0])
  return {
    hunt:    { label: hunt.label, title: hunt.title, branch: hunt.branch, org: 'pat_smith' },
    wheel:   Wheel.placed(Wheel.defaultWheel(), 'tv', 'pool'),
    members: [{ label: 'lee_jones', title: 'Lee', role: 'reviewer' }, { label: 'pat_smith', title: 'Pat', role: 'smith' }],
    realms:  hunt.realms,
    library: EntryLibrary,
    reviews: { [princes._id]: [
      { reviewer: { label: 'lee_jones', title: 'Lee' }, phase: 'shared', overall: 'A fair quiz.', reviewings: [{ question_id: present(princes.questions[0])._id, ...Verdict }] },
      { reviewer: { label: 'kim_park', title: 'Kim' }, phase: 'draft', overall: 'Unfinished', reviewings: [] },
    ] },
  }
}

