import _ from 'es-toolkit/compat'
import { describe, expect, it } from 'vitest'
import * as Addresses from '../../src/lib/addresses'
import * as Exporting from '../../src/lib/exporting'
import * as Importing from '../../src/lib/importing'
import * as Jsonball from '../../src/lib/jsonball'
import * as Wheel from '../../src/lib/wheel'
import { CategoryLabelVals } from '../../src/models/category'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { classicHunt, classicLayout } from '../support/layouts'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SeedWidgets } from '../../src/models/seeds'
import { Widget } from '../../src/models/widget'
import { Widgeted } from '../../src/models/widgeted'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'
import { runHolding, runOf } from '../support/runs'

/** A stored row of what a widgeting came to: `ok` holding `value`, or `errored` for `why` */
const storedOk = (value: unknown) => ({ status: 'ok' as const, value, message: null, result_meta: {}, _creationTime: 1000 })
const storedErrored = (why: string) => ({ status: 'errored' as const, value: null, message: why, result_meta: {}, _creationTime: 2000 })

/** The number spotter's reply to a clueing holding 300 and twelve */
const SpottedItems = { items: [{ text: '300', value: 300, kind: 'numeral' }, { text: 'twelve', value: 12, kind: 'wordish' }] }

/** The hunt every ball here is of */
const Place: Addresses.InHuntT = { org: 'pat_smith', hunt: 'deep_lake' }

/** The library, with the entry `remark` (text) */
const EntryLibrary = [...SeedWidgets, Widget.fill({ label: 'remark', formulary: 'entry', config: { entry_kind: 'text' } })]

/**
 * A quiz working the default widgetings and the entry `remark`, whose first question, `leon`,
 * chains to its second, `nantes`. Leon's clueing was read by the number spotter, its quick guess
 * failed, and its remark is typed.
 */
function chainedQuiz(): QuizT {
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

/** Every key naming an id (`id`, `_id`, or one ending `_id`) anywhere inside `val`, by its path */
function idPaths(val: unknown, path = ''): string[] {
  if (Array.isArray(val)) { return val.flatMap((each, idx) => idPaths(each, `${path}[${String(idx)}]`)) }
  if (val === null || typeof val !== 'object') { return [] }
  return Object.entries(val).flatMap(([key, each]) => [
    ...((key === 'id' || key.endsWith('_id')) ? [`${path}.${key}`] : []),
    ...idPaths(each, `${path}.${key}`),
  ])
}

/** Every leaf of `val` (a value that is not a plain object, or an empty one), by its dotted key path */
function leafPaths(val: unknown, path: readonly string[] = []): string[] {
  if (val === null || typeof val !== 'object' || Array.isArray(val) || Object.keys(val).length === 0) { return [path.join('.')] }
  return Object.entries(val).flatMap(([key, each]) => leafPaths(each, [...path, key]))
}

/** `quiz`'s body, run over the library holding its entry */
const bodyOf = (quiz: QuizT) => Exporting.quizBodyOf(quiz, runOf(quiz, EntryLibrary))

/** A hunt of two quizzes, `princes` (chained, widgeted, typed into) and `paris` (blank) */
function twoQuizHunt(): HuntT {
  const hunt = Hunt.blank('deep_lake')
  const realm = present(hunt.realms[0])
  return { ...hunt, realms: [{ ...realm, quizzes: [chainedQuiz(), Quiz.blank('Paris', 'paris')] }] }
}

/** Lee's verdict on Leon */
const Verdict = { get_rate: 40, guesses: 'Leon?', comments: 'Lovely.', minutes: 2, keep_it: true, needs_fact_check: false, elimination_candidate: false }

/** Everything the two-quiz hunt's balls are made from: a wheel with TV in the pool, two members, and Lee's shared review and Kim's draft of `princes` */
function snapshot(): Exporting.HuntSnapshotT {
  const hunt = twoQuizHunt()
  const princes = present(hunt.realms[0]?.quizzes[0])
  return {
    hunt:    { label: hunt.label, title: hunt.title, branch: hunt.branch },
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

describe('placeOf', () => {
  it("is the hunt's org, its earliest smith, and its label", () => {
    expect(Exporting.placeOf(snapshot())).to.deep.eq({ org: 'pat_smith', hunt: 'deep_lake' })
  })

  it("names no org for a hunt with no smith", () => {
    expect(Exporting.placeOf({ hunt: snapshot().hunt, members: [] })).to.deep.eq({ org: '', hunt: 'deep_lake' })
  })
})

describe('huntBall', () => {
  it("is the hunt's own fields, at the root", () => {
    const placed = Exporting.huntBall(Place, { label: 'spring_hunt', title: 'Spring Hunt', branch: 'main' })
    expect(placed.ball).to.deep.eq({ branch: 'main', label: 'spring_hunt', title: 'Spring Hunt' })
    expect(placed.address).to.deep.eq({ kind: 'hunt', ...Place })
  })
})

describe('categoriesBall', () => {
  it("is every category by label, with the slot of the wheel it holds", () => {
    const categories = Exporting.categoriesBall(Place, Wheel.defaultWheel()).ball.categories as Record<string, Jsonball.CategoryBodyT>
    expect(categories.math_econ).to.deep.eq({ position: 0 })
    expect(CategoryLabelVals.map((label) => categories[label]?.position)).to.deep.eq(CategoryLabelVals.map((_label, ii) => ii))
  })

  it("holds a category in the pool at no slot", () => {
    const categories = Exporting.categoriesBall(Place, Wheel.placed(Wheel.defaultWheel(), 'tv', 'pool')).ball.categories as Record<string, Jsonball.CategoryBodyT>
    expect(categories.tv).to.deep.eq({ position: null })
    expect(Object.keys(categories)).to.have.members([...CategoryLabelVals])
  })
})

describe('membersBall', () => {
  it("is each member by their label, with their title and role", () => {
    expect(Exporting.membersBall(Place, [{ label: 'pat_smith', title: 'Pat Smith', role: 'smith' }]).ball).to.deep.eq({ members: { pat_smith: { role: 'smith', title: 'Pat Smith' } } })
  })

  it("is an empty collection for a hunt with no one on it", () => {
    expect(Exporting.membersBall(Place, []).ball).to.deep.eq({ members: {} })
  })
})

describe('quizBodyOf', () => {
  it("carries no id at any depth", () => {
    const body = bodyOf(chainedQuiz())
    expect(idPaths(body)).to.deep.eq([])
  })

  it("keys its questions, widgetings and columns by label, each in order by its position, with no label inside", () => {
    const quiz = chainedQuiz()
    const body = bodyOf(quiz)
    const inOrder = (keyed: Record<string, { position: number }>) => _.sortBy(Object.keys(keyed), (label) => keyed[label]?.position)
    expect(_.mapValues(body.questions, 'position')).to.deep.eq({ leon: 0, nantes: 1 })
    expect(inOrder(body.widgetings)).to.deep.eq(_.map(quiz.widgetings, 'label'))
    expect(inOrder(body.columns)).to.deep.eq(_.map(quiz.columns, 'label'))
    expect([body.questions.leon, body.widgetings.remark, body.columns.title].map((each) => Object.hasOwn(present(each), 'label'))).to.deep.eq([false, false, false])
  })

  it("names a chain by the label of the question it points at", () => {
    const { questions } = bodyOf(chainedQuiz())
    expect([questions.leon?.chains_to, questions.nantes?.chains_to]).to.deep.eq(['nantes', null])
  })

  it("reads the doc block's chain example", () => {
    expect(bodyOf(chainedQuiz()).questions.leon?.chains_to).to.eq('nantes')
  })

  it("names a chain to a question the quiz does not hold as none", () => {
    const quiz = chainedQuiz()
    const dangling = { ...quiz, questions: quiz.questions.map((question) => ({ ...question, chains_to: 'long-gone' })) }
    expect(_.map(bodyOf(dangling).questions, 'chains_to')).to.deep.eq([null, null])
  })

  it("keeps the quiz's own fields and each widgeting's and column's, leaving out its sort memory", () => {
    const quiz = { ...chainedQuiz(), locked: true, smiths_note: 'Kings and lions.', last_sortkey: 'column:title' as const }
    const body = bodyOf(quiz)
    expect(_.omit(body, ['questions', 'widgetings', 'columns'])).to.deep.eq({ title: 'Princes', smiths_note: 'Kings and lions.', q1_preamble: quiz.q1_preamble, locked: true })
    expect(body.widgetings.remark).to.deep.eq({ position: quiz.widgetings.length - 1, widget_label: 'remark', description: '', params: {} })
    expect(body.columns.title).to.deep.eq({ position: 0, title: 'Title', source: 'question.title', width_px: 100 })
  })

  it("puts what each widgeting came to beside the question's own fields, the worked-out ones and an entry's included", () => {
    const { leon } = bodyOf(chainedQuiz()).questions
    expect(leon?.numnum_clueing).to.deep.eq({ status: 'ok', value: SpottedItems })
    expect(leon?.remark).to.deep.eq({ status: 'ok', value: 'Ask Flip.' })
  })

  it("reads the doc block's widgeting example", () => {
    expect(bodyOf(chainedQuiz()).questions.leon?.clueing_full).to.deep.eq({ status: 'ok', value: 312 })
  })

  it("keeps a stored null as it is", () => {
    const quiz = chainedQuiz()
    const leon = present(quiz.questions[0])
    const body = Exporting.quizBodyOf(quiz, runHolding(quiz, { dumdum: { [leon._id]: Widgeted.ok(null) } }))
    expect(body.questions.leon?.dumdum).to.deep.eq({ status: 'ok', value: null })
  })

  it("exposes only the status and the value: a failure's message stays behind", () => {
    expect(bodyOf(chainedQuiz()).questions.leon?.dumdum).to.deep.eq({ status: 'errored', value: null })
  })

  it("names every widgeting on every question, as missing where it came to nothing", () => {
    const quiz = chainedQuiz()
    const nantes = present(bodyOf(quiz).questions.nantes)
    for (const { label } of quiz.widgetings) {
      expect(nantes[label], label).to.deep.eq({ status: 'missing', value: null })
    }
  })

  it("adds nothing beside a question's fields and its position for a quiz with no widgetings", () => {
    const nantes = present(bodyOf({ ...chainedQuiz(), widgetings: [], columns: [] }).questions.nantes)
    expect(_.sortBy(Object.keys(nantes))).to.deep.eq(['alt_text', 'chains_to', 'clueing', 'full_answer', 'hint', 'notes', 'position', 'qnum', 'title'])
  })

  it("is empty collections for a quiz holding nothing", () => {
    const body = bodyOf({ ...Quiz.blank('Empty', 'empty'), questions: [] })
    expect([body.questions, body.widgetings, body.columns]).to.deep.eq([{}, {}, {}])
  })
})

describe('quizBall', () => {
  it("is the quiz's body at its key path, by realm and label", () => {
    const quiz = chainedQuiz()
    const run = runOf(quiz, EntryLibrary)
    const placed = Exporting.quizBall(Place, 'home', quiz, run)
    expect(placed.address).to.deep.eq({ kind: 'quiz', ...Place, realm: 'home', quiz: 'princes' })
    expect(placed.ball).to.deep.eq({ quizzes: { home: { princes: Exporting.quizBodyOf(quiz, run) } } })
  })
})

describe('questionsBall', () => {
  it("is the quiz's questions alone, as its ball holds them, rooted at the quiz and never merged", () => {
    const quiz = chainedQuiz()
    const run = runOf(quiz, EntryLibrary)
    const placed = Exporting.questionsBall(Place, 'home', quiz, run)
    expect(placed.ball).to.deep.eq({ questions: Exporting.quizBodyOf(quiz, run).questions })
    expect(placed.address).to.deep.eq({ kind: 'questions', ...Place, realm: 'home', quiz: 'princes' })
    expect(Addresses.isMerged(placed.address)).to.be.false
  })

  it("reads back through Import as one quiz, into any quiz holding those labels", () => {
    const quiz = chainedQuiz()
    const { ball } = Exporting.questionsBall(Place, 'home', quiz, runOf(quiz, EntryLibrary))
    const outcome = Importing.importInto(quiz, JSON.stringify(ball), EntryLibrary)
    expect(outcome.summary).to.include('Read as one quiz of 2 question(s).')
    expect(outcome.log.map((entry) => [entry.label, entry.outcome])).to.deep.eq([['leon', 'merged'], ['nantes', 'merged']])
  })
})

describe('reviewBall', () => {
  const held = snapshot()
  const princes = present(held.realms[0]?.quizzes[0])
  const [shared, draft] = present(held.reviews[princes._id])

  it("is a shared review's overall, and its verdict on each question by label, under its reviewer's label", () => {
    const placed = present(Exporting.reviewBall(Place, 'home', princes, present(shared)))
    expect(placed.address).to.deep.eq({ kind: 'review', ...Place, realm: 'home', quiz: 'princes', reviewer: 'lee_jones' })
    expect(placed.ball).to.deep.eq({ quizzes: { home: { princes: { reviews: { lee_jones: { overall: 'A fair quiz.', verdicts: { leon: Verdict } } } } } } })
  })

  it("reads the doc block's example", () => {
    const placed = Exporting.reviewBall(Place, 'home', princes, present(shared))
    expect(_.get(placed?.ball, 'quizzes.home.princes.reviews.lee_jones.overall')).to.eq('A fair quiz.')
  })

  it("is nothing for a review not shared, or one whose reviewer is gone", () => {
    expect(Exporting.reviewBall(Place, 'home', princes, present(draft))).to.be.null
    expect(Exporting.reviewBall(Place, 'home', princes, { ...present(shared), reviewer: null })).to.be.null
  })

  it("passes over a verdict on a question the quiz no longer holds", () => {
    const review = { ...present(shared), reviewings: [...present(shared).reviewings, { ...Verdict, question_id: 'long-gone' }] }
    const placed = present(Exporting.reviewBall(Place, 'home', princes, review))
    expect(Object.keys(_.get(placed.ball, 'quizzes.home.princes.reviews.lee_jones.verdicts') as object)).to.deep.eq(['leon'])
  })
})

describe('widgetBall', () => {
  it("is the widget's fields and its place in the library, by scope and label", () => {
    const dumdum = present(SeedWidgets.find((widget) => widget.label === 'dumdum'))
    const placed = Exporting.widgetBall(dumdum, 0)
    const { scope, label, ...fields } = Widget.exported(dumdum)
    expect(placed.ball).to.deep.eq({ widgets: { [scope]: { [label]: { ...fields, position: 0 } } } })
    expect(placed.address).to.deep.eq({ kind: 'widget', scope: 'pub', widget: 'dumdum' })
  })
})

describe('libraryBall', () => {
  it("is every widget, keyed by scope and label, each with its place in library order", () => {
    const pub = _.get(Exporting.libraryBall(SeedWidgets), 'widgets.pub') as Record<string, Jsonball.WidgetBodyT>
    expect(_.sortBy(Object.keys(pub), (label) => pub[label]?.position)).to.deep.eq(SeedWidgets.map((widget) => widget.label))
  })

  it("reads the doc block's example", () => {
    const pub = _.get(Exporting.libraryBall(SeedWidgets), 'widgets.pub') as object
    expect(Object.keys(pub)).to.include.members(['answer_reversed', 'dumdum'])
  })

  it("is an empty collection for an empty library", () => {
    expect(Exporting.libraryBall([])).to.deep.eq({ widgets: {} })
  })

  it("reads back through the library's Import as unchanged", () => {
    const outcome = Importing.libraryImported(SeedWidgets, JSON.stringify(Exporting.libraryBall(SeedWidgets)))
    expect(outcome.widgets).to.deep.eq([])
    expect(outcome.log.map((entry) => entry.label)).to.deep.eq(SeedWidgets.map((widget) => widget.label))
    expect(outcome.ok).to.be.true
  })

  it("reads back into an empty library as every widget, in library order", () => {
    const outcome = Importing.libraryImported([], JSON.stringify(Exporting.libraryBall(EntryLibrary)))
    expect(outcome.widgets).to.deep.eq(EntryLibrary.map((widget) => Widget.exported(widget)))
  })
})

describe('ballsOf', () => {
  it("is the hunt's own, its categories', its members', each quiz's and its questions', each shared review's, and each widget worked", () => {
    expect(Exporting.ballsOf(snapshot()).map(({ address }) => address.kind)).to.deep.eq([
      'hunt', 'categories', 'members', 'quiz', 'questions', 'review', 'quiz', 'questions', ...chainedQuiz().widgetings.map(() => 'widget'),
    ])
  })

  it("holds in each merged ball nothing but its body, at its address's key path", () => {
    for (const { address, ball } of Exporting.ballsOf(snapshot())) {
      if (! Addresses.isMerged(address)) { continue }
      const keypath = Addresses.keypathOf(address)
      const body = keypath.length === 0 ? ball : _.get(ball, keypath) as Jsonball.JsonballT
      expect(Jsonball.ballAt(keypath, body), address.kind).to.deep.eq(ball)
    }
  })

  it("never has two merged balls hold one leaf, so the merge comes out the same in any order", () => {
    const balls = Exporting.ballsOf(snapshot()).filter(({ address }) => Addresses.isMerged(address)).map(({ ball }) => ball)
    const leaves = balls.flatMap((ball) => leafPaths(ball))
    expect(leaves.length).to.eq(new Set(leaves).size)
    expect(Jsonball.merged(balls.toReversed())).to.deep.eq(Jsonball.merged(balls))
  })

  it("writes the widgets the quizzes work, at their place in the library, and no others", () => {
    const placed = Exporting.ballsOf(snapshot()).flatMap(({ address, ball }) => (address.kind === 'widget' ? [[address.widget, _.get(ball, ['widgets', 'pub', address.widget, 'position']) as unknown]] : []))
    const worked = chainedQuiz().widgetings.map((widgeting) => widgeting.widget_label)
    expect(placed.map(([label]) => label)).to.have.members(worked)
    expect(placed).to.deep.include(['remark', EntryLibrary.length - 1])
  })
})

describe('wholeOf', () => {
  it("is the hunt's fields at the root, beside its categories, members, quizzes and the widgets they work", () => {
    const whole = Exporting.wholeOf(snapshot())
    expect(_.sortBy(Object.keys(whole))).to.deep.eq(['branch', 'categories', 'label', 'members', 'quizzes', 'title', 'widgets'])
    expect(Object.keys(_.get(whole, 'quizzes.home') as object)).to.have.members(['princes', 'paris'])
    expect(_.get(whole, 'quizzes.home.princes.reviews.lee_jones.overall')).to.eq('A fair quiz.')
  })

  it("is the merge of every resource's ball, the questions alone left out", () => {
    const held = snapshot()
    const balls = Exporting.ballsOf(held).filter(({ address }) => address.kind !== 'questions').map(({ ball }) => ball)
    expect(Exporting.wholeOf(held)).to.deep.eq(Jsonball.merged(balls))
  })

  it("carries no id at any depth", () => {
    const whole = Exporting.wholeOf(snapshot())
    expect(idPaths(whole)).to.deep.eq([])
  })

  it("reads the doc block's example", () => {
    const whole = Exporting.wholeOf(snapshot())
    expect(_.get(whole, 'quizzes.home.princes.title')).to.eq('Princes')
  })

  it("runs each quiz over the library it is handed", () => {
    const hunt = classicHunt('deep_lake')
    const leon = { ...Question.blank(), label: 'leon', stored: { numnum_clueing: { newest: storedOk(SpottedItems), ok: storedOk(SpottedItems) } } } as QuestionT
    const realms = hunt.realms.map((realm) => ({ ...realm, quizzes: realm.quizzes.map((quiz) => ({ ...quiz, questions: [leon] })) }))
    const clueingFull = (library: typeof SeedWidgets) => _.get(Exporting.wholeOf({ ...snapshot(), realms, library, reviews: {} }), 'quizzes.home.deep_lake.questions.leon.clueing_full')
    expect(clueingFull(SeedWidgets)).to.deep.eq({ status: 'ok', value: 312 })
    expect(clueingFull([])).to.not.deep.eq({ status: 'ok', value: 312 })
  })
})

describe('snapshotOf', () => {
  it("is the hunt read whole, with the wheel and members the screen holds, and no reviews", () => {
    const whole = twoQuizHunt()
    const { wheel, members } = snapshot()
    expect(Exporting.snapshotOf({ wheel, members }, whole, EntryLibrary)).to.deep.eq({
      hunt: { label: 'deep_lake', title: 'Deep Lake', branch: 'main' }, wheel, members, realms: whole.realms, library: EntryLibrary, reviews: {},
    })
  })

  it("reads the doc block's example", () => {
    const { wheel, members } = snapshot()
    const snap = Exporting.snapshotOf({ wheel, members }, twoQuizHunt(), EntryLibrary)
    expect(Exporting.wholeOf(snap).label).to.eq('deep_lake')
  })
})

describe("a quiz's export, imported", () => {
  it("into a quiz holding the same labels, sends nothing that changes it, chains and widgetings and all", () => {
    const quiz = chainedQuiz()
    const unchained = { ...quiz, questions: quiz.questions.map((question) => ({ ...question, chains_to: null })) }
    const { ball } = Exporting.quizBall(Place, 'home', quiz, runOf(quiz, EntryLibrary))
    const outcome = Importing.importInto(unchained, JSON.stringify(ball), EntryLibrary)
    const leon = present(outcome.questions).find((question) => question.label === 'leon')
    expect(leon?.patch.chains_to).to.eq('nantes')
    expect(leon?.patch).to.not.have.property('clueing_full')
    expect(outcome.log.flatMap((entry) => entry.issues)).to.deep.eq([])
    expect(outcome.widgetingLog.map((entry) => entry.outcome)).to.deep.eq(quiz.widgetings.map(() => 'kept'))
    expect(outcome.widgetingActions).to.deep.eq([])
  })

  it("into an empty quiz out of the whole hunt, sends every question in order with all it holds, every widgeting in run order, and what its entries hold", () => {
    const quiz = chainedQuiz()
    const empty = { ...Quiz.blank('Princes', 'princes'), questions: [], widgetings: [], columns: [] }
    const whole = Exporting.wholeOf(snapshot())
    const outcome = Importing.importInto(empty, JSON.stringify(whole), EntryLibrary)
    expect(outcome.ok).to.be.true
    expect(outcome.summary).to.include('matched this quiz by label')
    expect(outcome.widgetingActions).to.deep.eq(quiz.widgetings.map((widgeting) => ({ kind: 'add_widgeting', widgeting })))
    const [leon, nantes] = present(outcome.questions)
    const fields = _.pick(present(quiz.questions[0]), ['qnum', 'clueing', 'hint', 'title', 'alt_text', 'notes', 'full_answer'])
    expect(leon).to.deep.eq({ label: 'leon', patch: { ...fields, chains_to: 'nantes' }, entered: { remark: 'Ask Flip.' } })
    expect(nantes).to.deep.include({ label: 'nantes', entered: { remark: null } })
  })
})
