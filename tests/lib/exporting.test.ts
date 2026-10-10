import _ from 'es-toolkit/compat'
import { describe, expect, it } from 'vitest'
import * as Addresses from '../../src/lib/addresses'
import * as Exporting from '../../src/lib/exporting'
import * as Importing from '../../src/lib/importing'
import * as Runner from '../../src/lib/formulary/runner'
import * as Jsonball from '../../src/lib/jsonball'
import * as Wheel from '../../src/lib/wheel'
import { CategoryLabelVals } from '../../src/models/category'
import { classicHunt } from '../support/layouts'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SeedWidgets } from '../../src/models/seeds'
import { Widget } from '../../src/models/widget'
import { Widgeted } from '../../src/models/widgeted'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'
import { runHolding, runOf } from '../support/runs'
import { EntryLibrary, ReviewedAtIso, SpottedItems, Verdict, chainedQuiz, snapshot, storedOk, twoQuizHunt } from '../support/snapshots'

/** The hunt every ball here is of */
const Place: Addresses.InHuntT = { org: 'pat_smith', hunt: 'deep_lake' }

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

describe('placeOf', () => {
  it("is the hunt's org, as the hunt holds it, and its label", () => {
    expect(Exporting.placeOf(snapshot())).to.deep.eq({ org: 'pat_smith', hunt: 'deep_lake' })
  })
})

describe('huntBall', () => {
  it("is the hunt's own fields, at the root, its stamps as a person reads them", () => {
    const placed = Exporting.huntBall(Place, { label: 'spring_hunt', title: 'Spring Hunt', branch: 'main', created_at: Date.UTC(2026, 9, 5, 12), updated_at: Date.UTC(2026, 9, 5, 13) })
    expect(placed.ball).to.deep.eq({ branch: 'main', label: 'spring_hunt', title: 'Spring Hunt', created_at: '2026-10-05T12:00:00.000Z', updated_at: '2026-10-05T13:00:00.000Z' })
    expect(placed.address).to.deep.eq({ kind: 'hunt', ...Place })
  })

  it("writes no stamps for a hunt built rather than read", () => {
    expect(Exporting.huntBall(Place, { label: 'spring_hunt', title: 'Spring Hunt', branch: 'main' }).ball).to.deep.include({ created_at: null, updated_at: null })
  })
})

describe('categoriesBall', () => {
  it("is every category by label, with its label, its title and the slot of the wheel it holds, as the bag holds them", () => {
    const categories = Exporting.categoriesBall(Place, Wheel.defaultWheel()).ball.categories as Record<string, Jsonball.CategoryBodyT>
    expect(categories.math_econ).to.deep.eq({ label: 'math_econ', title: 'Math & Econ', position: 0 })
    expect(categories).to.deep.eq(Runner.placeOf({ label: 'spring_hunt', title: '' }, { label: 'home', title: '' }).categories)
    expect(CategoryLabelVals.map((label) => categories[label]?.position)).to.deep.eq(CategoryLabelVals.map((_label, ii) => ii))
  })

  it("holds a category in the pool at no slot", () => {
    const categories = Exporting.categoriesBall(Place, Wheel.placed(Wheel.defaultWheel(), 'tv', 'pool')).ball.categories as Record<string, Jsonball.CategoryBodyT>
    expect(categories.tv).to.deep.eq({ label: 'tv', title: 'TV', position: null })
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

describe('the export and the bag', () => {
  const quiz = { ...chainedQuiz(), questions: chainedQuiz().questions.map((question, ii) => ({ ...question, viz: ii === 1 ? 'archived' as const : question.viz })) }
  const run = runOf(quiz, EntryLibrary)
  const body = Exporting.quizBodyOf(quiz, run)
  // What a widgeting the quiz does not run reads: every question as the run left it, and the quiz too.
  const bag = Runner.quizBagAt(run, { label: 'reader', params: {} })
  const WorkedOut = ['rank', 'archived', 'secondary']

  it("hold each question alike, in the same order, the bag adding only what it works out", () => {
    expect(Object.keys(bag.questions)).to.deep.eq(Object.keys(body.questions))
    for (const [label, held] of Object.entries(body.questions)) {
      const bagged = present(bag.questions[label])
      expect(_.difference(Object.keys(bagged), Object.keys(held)), label).to.have.members(WorkedOut)
      // A widgeted the bag holds may carry an estimate's parts beside its status and value.
      for (const [key, val] of Object.entries(held)) { expect(_.isPlainObject(val) ? _.pick(bagged[key], Object.keys(val as object)) : bagged[key], `${label}.${key}`).to.deep.eq(val) }
    }
  })

  it("hold the quiz's own fields alike, and what each widgeting run once for the whole quiz came to", () => {
    expect(bag.quiz).to.deep.eq(_.omit(body, ['questions', 'widgetings', 'columns']))
  })

  it("hold the hunt alike", () => {
    const hunt = { label: 'deep_lake', title: 'Deep Lake', branch: 'main', created_at: 0, updated_at: 0 }
    expect(Runner.placeOf(hunt, { label: 'home', title: 'Home' }).hunt).to.deep.eq(Exporting.huntBall(Place, hunt).body)
  })
})

describe('quizBodyOf', () => {
  it("carries no id at any depth", () => {
    const body = bodyOf(chainedQuiz())
    expect(idPaths(body)).to.deep.eq([])
  })

  it("keys its questions, widgetings and columns by label, each in order by its position, with its label inside", () => {
    const quiz = chainedQuiz()
    const body = bodyOf(quiz)
    const inOrder = (keyed: Record<string, { position: number }>) => _.sortBy(Object.keys(keyed), (label) => keyed[label]?.position)
    expect(_.mapValues(body.questions, 'position')).to.deep.eq({ leon: 0, nantes: 1 })
    expect(inOrder(body.widgetings)).to.deep.eq(_.map(quiz.widgetings, 'label'))
    expect(inOrder(body.columns)).to.deep.eq(_.map(quiz.columns, 'label'))
    expect([body.questions.leon?.label, body.widgetings.remark?.label, body.columns.title?.label]).to.deep.eq(['leon', 'remark', 'title'])
  })

  it("holds what each widgeting run once for the whole quiz came to beside the quiz's own fields, as the bag does, and never on a question", () => {
    const quiz = chainedQuiz()
    const quizWide = {
      ...quiz,
      stored:     { playtesters: { newest: storedOk('Ada and Grace'), ok: storedOk('Ada and Grace') } } as QuizT['stored'],
      widgetings: [Widgeting.fill({ widget_label: 'remark', label: 'playtesters', tier: 'quiz' }), ...quiz.widgetings],
    }
    const body = bodyOf(quizWide)
    expect(body.playtesters).to.deep.eq({ status: 'ok', value: 'Ada and Grace' })
    expect(body).to.not.have.property('widgeteds')
    expect(body.widgetings.playtesters).to.deep.include({ tier: 'quiz' })
    expect(body.questions.leon).to.not.have.property('playtesters')
    expect(body.questions.leon).to.have.property('remark')
  })

  it("holds no more than its own fields and its layout for a quiz with no widgeting run once for the whole quiz", () => {
    const body = bodyOf(chainedQuiz())
    expect(Object.keys(body)).to.have.members([...Quiz.bagKeys])
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

  it("keeps every field the quiz stores and each widgeting's and column's, its sort memory and a column's alignment among them", () => {
    const chained = chainedQuiz()
    const columns = chained.columns.map((column, ii) => (ii === 0 ? { ...column, align: 'right' as const } : column))
    const recap = { recap_head: 'Thanks to our playtesters.', recap_tail: 'Until next season.', recap_template: '{{#played}}{{number}}. {{title}}{{/played}}', templateable: ['recap', 'remark'] }
    const quiz = { ...chained, columns, locked: true, smiths_note: 'Kings and lions.', ...recap, last_sortkey: 'column:title' as const }
    const body = bodyOf(quiz)
    expect(_.omit(body, ['questions', 'widgetings', 'columns'])).to.deep.eq({ label: 'princes', title: 'Princes', smiths_note: 'Kings and lions.', q1_preamble: quiz.q1_preamble, ...recap, locked: true, last_sortkey: 'column:title', created_at: null, updated_at: null })
    expect(body.widgetings.remark).to.deep.eq({ position: quiz.widgetings.length - 1, label: 'remark', widget_label: 'remark', description: '', params: {}, tier: 'question' })
    expect(body.columns.title).to.deep.eq({ position: 0, label: 'title', title: 'Title', source: 'title', width_px: 100, align: 'right' })
  })

  it("writes each column as it is held, its formula beside it", () => {
    const chained = chainedQuiz()
    const columns = [
      { label: 'title', title: 'Title', source: 'title', width_px: 100 },
      { label: 'shout', title: 'Shout', source: 'title', formula: '$uppercase($)', width_px: 100 },
    ]
    const body = bodyOf({ ...chained, columns })
    expect([body.columns.title?.source, body.columns.shout?.source, body.columns.shout?.formula]).to.deep.eq(['title', 'title', '$uppercase($)'])
    expect(body.columns.title).to.not.have.property('formula')
  })

  it("writes the recap template of a quiz that follows the default as null", () => {
    expect(bodyOf(chainedQuiz()).recap_template).to.be.null
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

  it("adds nothing beside a question's fields, its label and its position for a quiz with no widgetings", () => {
    const nantes = present(bodyOf({ ...chainedQuiz(), widgetings: [], columns: [] }).questions.nantes)
    expect(_.sortBy(Object.keys(nantes))).to.deep.eq(['alt_text', 'chains_to', 'clueing', 'created_at', 'full_answer', 'hint', 'label', 'notes', 'position', 'qnum', 'recap', 'title', 'updated_at', 'viz'])
  })

  it("writes the stamps of the quiz and each question as a person reads them: ISO-8601, in UTC", () => {
    const chained = chainedQuiz()
    const [made, edited] = [Date.UTC(2026, 9, 5, 9, 30), Date.UTC(2026, 9, 5, 10, 45, 1, 500)]
    const quiz = { ...chained, created_at: made, updated_at: made, questions: chained.questions.map((question) => ({ ...question, created_at: made, updated_at: edited })) }
    const body = bodyOf(quiz)
    expect([body.created_at, body.updated_at]).to.deep.eq(['2026-10-05T09:30:00.000Z', '2026-10-05T09:30:00.000Z'])
    expect(_.pick(body.questions.leon, ['created_at', 'updated_at'])).to.deep.eq({ created_at: '2026-10-05T09:30:00.000Z', updated_at: '2026-10-05T10:45:01.500Z' })
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

  it("leaves the archived questions out, which its quiz's ball holds with their viz, each question placed among those it holds", () => {
    const chained = chainedQuiz()
    const quiz = { ...chained, questions: chained.questions.map((question, ii) => (ii === 0 ? { ...question, viz: 'archived' as const } : question)) }
    const run = runOf(quiz, EntryLibrary)
    expect(Exporting.questionsBall(Place, 'home', quiz, run).body).to.have.all.keys('nantes')
    expect(_.get(Exporting.questionsBall(Place, 'home', quiz, run).body, 'nantes.position')).to.eq(0)
    expect(Exporting.quizBall(Place, 'home', quiz, run).body).to.have.nested.property('questions.leon.viz', 'archived')
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
    expect(placed.ball).to.deep.eq({ quizzes: { home: { princes: { reviews: { lee_jones: { overall: 'A fair quiz.', ...ReviewedAtIso, verdicts: { leon: { ...Verdict, ...ReviewedAtIso } } } } } } } })
  })

  it("reads the doc block's example", () => {
    const placed = Exporting.reviewBall(Place, 'home', princes, present(shared))
    expect(_.get(placed?.ball, 'quizzes.home.princes.reviews.lee_jones.overall')).to.eq('A fair quiz.')
  })

  it("is nothing for a review not shared, or one whose reviewer is gone", () => {
    expect(Exporting.reviewBall(Place, 'home', princes, present(draft))).to.be.null
    expect(Exporting.reviewBall(Place, 'home', princes, { ...present(shared), reviewer: null })).to.be.null
  })

  it("writes of each reviewing its verdict and its stamps, as a reviewing's row is read: no ids, and not whether the reviewer peeked", () => {
    const stamps = { created_at: Date.UTC(2026, 9, 5), updated_at: Date.UTC(2026, 9, 6) }
    const row = { _id: 'r1', _creationTime: 1, review_id: 'rv1', hunt_id: 'h1', quiz_id: 'q1', ident_id: 'i1', peeked: true, question_id: present(princes.questions[0])._id, ...Verdict, ...stamps }
    const placed = present(Exporting.reviewBall(Place, 'home', princes, { ...present(shared), reviewings: [row] }))
    expect(_.get(placed.ball, 'quizzes.home.princes.reviews.lee_jones.verdicts.leon')).to.deep.eq({ ...Verdict, created_at: '2026-10-05T00:00:00.000Z', updated_at: '2026-10-06T00:00:00.000Z' })
  })

  it("writes the stamps of a row written before rows were stamped as it is read meanwhile: made, and last edited, when the database made it", () => {
    const unstamped = _.omit(present(shared), ['created_at', 'updated_at'])
    const placed = present(Exporting.reviewBall(Place, 'home', princes, { ...unstamped, _creationTime: Date.UTC(2026, 9, 1) + 0.25 }))
    const review: unknown = _.get(placed.ball, 'quizzes.home.princes.reviews.lee_jones')
    expect(_.pick(review, ['created_at', 'updated_at'])).to.deep.eq({ created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' })
  })

  it("passes over a verdict on a question the quiz no longer holds", () => {
    const review = { ...present(shared), reviewings: [...present(shared).reviewings, { ...Verdict, question_id: 'long-gone' }] }
    const placed = present(Exporting.reviewBall(Place, 'home', princes, review))
    expect(Object.keys(_.get(placed.ball, 'quizzes.home.princes.reviews.lee_jones.verdicts') as object)).to.deep.eq(['leon'])
  })
})

describe('quizBalls', () => {
  const held = snapshot()
  const princes = present(held.realms[0]?.quizzes[0])
  const run = runOf(princes, EntryLibrary)

  it("is the quiz's own ball, its questions alone, and each shared review's, the drafts left out", () => {
    const balls = Exporting.quizBalls(Place, 'home', princes, run, present(held.reviews[princes._id]))
    expect(balls.map(({ address }) => address.kind)).to.deep.eq(['quiz', 'questions', 'review'])
    expect(balls[2]?.address).to.deep.include({ reviewer: 'lee_jones' })
  })

  it("is each ball as its own function makes it", () => {
    const [shared] = present(held.reviews[princes._id])
    expect(Exporting.quizBalls(Place, 'home', princes, run, [present(shared)])).to.deep.eq([
      Exporting.quizBall(Place, 'home', princes, run), Exporting.questionsBall(Place, 'home', princes, run), Exporting.reviewBall(Place, 'home', princes, present(shared)),
    ])
  })

  it("is the quiz and its questions alone for a quiz with no reviews", () => {
    expect(Exporting.quizBalls(Place, 'home', princes, run, []).map(({ address }) => address.kind)).to.deep.eq(['quiz', 'questions'])
  })
})

describe('huntLevelBalls', () => {
  it("is the hunt's own ball, its categories' and its members', as their own functions make them", () => {
    const held = snapshot()
    const place = Exporting.placeOf(held)
    expect(Exporting.huntLevelBalls(held)).to.deep.eq([
      Exporting.huntBall(place, held.hunt), Exporting.categoriesBall(place, held.wheel), Exporting.membersBall(place, held.members),
    ])
  })

  it("reads the doc block's example", () => {
    expect(Exporting.huntLevelBalls(snapshot()).map(({ address }) => address.kind)).to.deep.eq(['hunt', 'categories', 'members'])
  })
})

describe('quizBallsIn', () => {
  const held = snapshot()
  const realm = present(held.realms[0])
  const princes = present(realm.quizzes[0])
  const reviews = present(held.reviews[princes._id])

  it("is the quiz's balls, the quiz run over the library, in its realm, against the hunt's wheel", () => {
    const run = Runner.runQuiz(Runner.sourceOf(princes, held.library, Runner.placeOf({ ...held.hunt, wheel: held.wheel }, realm)))
    expect(Exporting.quizBallsIn(held, realm, princes, reviews)).to.deep.eq(Exporting.quizBalls(Exporting.placeOf(held), 'home', princes, run, reviews))
  })

  it("reads the doc block's example", () => {
    expect(Exporting.quizBallsIn(held, realm, princes, reviews).map(({ address }) => address.kind)).to.deep.eq(['quiz', 'questions', 'review'])
  })

  it("changes with the library the quiz is run over", () => {
    const remarkless = held.library.filter((widget) => widget.label !== 'remark')
    const remarkOf = (library: typeof held.library) => _.get(Exporting.quizBallsIn({ ...held, library }, realm, princes, [])[0]?.ball, 'quizzes.home.princes.questions.leon.remark')
    expect(remarkOf(held.library)).to.deep.eq({ status: 'ok', value: 'Ask Flip.' })
    expect(remarkOf(remarkless)).to.not.deep.eq(remarkOf(held.library))
  })
})

describe('workedBalls', () => {
  it("is a ball for each widget of the library any of the quizzes works, at its place in the library, in library order", () => {
    const balls = Exporting.workedBalls(EntryLibrary, [chainedQuiz()])
    const worked = new Set(chainedQuiz().widgetings.map((widgeting) => widgeting.widget_label))
    expect(balls).to.deep.eq(EntryLibrary.flatMap((widget, idx) => (worked.has(widget.label) ? [Exporting.widgetBall(widget, idx)] : [])))
  })

  it("reads the doc block's example", () => {
    const labels = Exporting.workedBalls(EntryLibrary, [chainedQuiz()]).map(({ address }) => address.kind === 'widget' && address.widget)
    expect(labels).to.include.members(['dumdum', 'numnum_clueing'])
  })

  it("is nothing for no quizzes, or quizzes working nothing", () => {
    expect(Exporting.workedBalls(EntryLibrary, [])).to.deep.eq([])
    expect(Exporting.workedBalls(EntryLibrary, [Quiz.blank('Paris', 'paris')])).to.deep.eq([])
  })

  it("passes over a widgeting of a widget the library lacks", () => {
    expect(Exporting.workedBalls([], [chainedQuiz()])).to.deep.eq([])
  })
})

describe('widgetBall', () => {
  it("is the widget's fields, its label among them, and its place in the library, by scope and label", () => {
    const dumdum = present(SeedWidgets.find((widget) => widget.label === 'dumdum'))
    const placed = Exporting.widgetBall(dumdum, 0)
    const { scope, ...fields } = Widget.exported(dumdum)
    expect(placed.ball).to.deep.eq({ [scope]: { widgets: { [fields.label]: { ...fields, position: 0 } } } })
    expect(placed.address).to.deep.eq({ kind: 'widget', scope: 'pub', widget: 'dumdum' })
  })
})

describe('libraryBall', () => {
  it("is every widget under its scope, keyed by label, each with its place in library order", () => {
    const pub = _.get(Exporting.libraryBall(SeedWidgets), 'pub.widgets') as Record<string, Jsonball.WidgetBodyT>
    expect(_.sortBy(Object.keys(pub), (label) => pub[label]?.position)).to.deep.eq(SeedWidgets.map((widget) => widget.label))
  })

  it("reads the doc block's example", () => {
    const pub = _.get(Exporting.libraryBall(SeedWidgets), 'pub.widgets') as object
    expect(Object.keys(pub)).to.include.members(['answer_reversed', 'dumdum'])
  })

  it("is an empty collection for an empty library", () => {
    expect(Exporting.libraryBall([])).to.deep.eq({ pub: { widgets: {} } })
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

  it("carries each ball's body, what it holds at its key path (the questions alone, under `questions`)", () => {
    for (const { address, body, ball } of Exporting.ballsOf(snapshot())) {
      const keypath = address.kind === 'questions' ? ['questions'] : Addresses.keypathOf(address)
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
    const placed = Exporting.ballsOf(snapshot()).flatMap(({ address, ball }) => (address.kind === 'widget' ? [[address.widget, _.get(ball, ['pub', 'widgets', address.widget, 'position']) as unknown]] : []))
    const worked = chainedQuiz().widgetings.map((widgeting) => widgeting.widget_label)
    expect(placed.map(([label]) => label)).to.have.members(worked)
    expect(placed).to.deep.include(['remark', EntryLibrary.length - 1])
  })
})

describe('wholeOf', () => {
  it("is the hunt's fields at the root, beside its categories, members, quizzes and the widgets they work", () => {
    const whole = Exporting.wholeOf(snapshot())
    expect(_.sortBy(Object.keys(whole))).to.deep.eq(['branch', 'categories', 'created_at', 'label', 'members', 'pub', 'quizzes', 'title', 'updated_at'])
    expect(Object.keys(_.get(whole, 'pub.widgets') as object)).to.include('dumdum')
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
  it("is the hunt read whole, with the org, wheel and members the screen holds, and no reviews", () => {
    const whole = twoQuizHunt()
    const { wheel, members } = snapshot()
    expect(Exporting.snapshotOf({ org: 'pat_smith', wheel, members }, whole, EntryLibrary)).to.deep.eq({
      hunt: { label: 'deep_lake', title: 'Deep Lake', branch: 'main', org: 'pat_smith' }, wheel, members, realms: whole.realms, library: EntryLibrary, reviews: {},
    })
  })

  it("carries the stamps of the hunt the screen holds", () => {
    const { wheel, members } = snapshot()
    const stamps = { created_at: Date.UTC(2026, 9, 1), updated_at: Date.UTC(2026, 9, 5) }
    expect(Exporting.snapshotOf({ org: 'pat_smith', ...stamps, wheel, members }, twoQuizHunt(), EntryLibrary).hunt).to.deep.include(stamps)
  })

  it("reads the doc block's example", () => {
    const { wheel, members } = snapshot()
    const snap = Exporting.snapshotOf({ org: 'pat_smith', wheel, members }, twoQuizHunt(), EntryLibrary)
    expect(Exporting.wholeOf(snap).label).to.eq('deep_lake')
  })
})

/** `quiz` worked over the library holding its entry, with a widgeting `playtesters` of the entry `remark` run once for the whole quiz, holding `typed` */
function withQuizEntry(quiz: QuizT, typed: string): QuizT {
  return {
    ...quiz,
    stored:     { playtesters: { newest: storedOk(typed), ok: storedOk(typed) } } as QuizT['stored'],
    widgetings: [...quiz.widgetings, Widgeting.fill({ widget_label: 'remark', label: 'playtesters', tier: 'quiz' })],
  }
}

/** `quiz` with its `playtesters` widgeting held to at most `max_length` characters */
function cappedEntry(quiz: QuizT, max_length: number): QuizT {
  return { ...quiz, widgetings: quiz.widgetings.map((widgeting) => (widgeting.label === 'playtesters' ? { ...widgeting, params: { max_length } } : widgeting)) }
}

/** `quiz`'s copy (`quizCopyOf`), run over the library holding its entry */
const copyOf = (quiz: QuizT) => Exporting.quizCopyOf(quiz, runOf(quiz, EntryLibrary), EntryLibrary) as Jsonball.QuizBodyT & { pub: { widgets: Record<string, { formulary: string }> } }

describe('quizCopyOf', () => {
  it("is the quiz's body with the widgets it works beside it, and says nothing of whether it is locked", () => {
    const quiz = { ...chainedQuiz(), locked: true }
    const { pub, ...rest } = copyOf(quiz)
    expect(rest).to.deep.eq(_.omit(bodyOf(quiz), ['label', 'locked']))
    const worked = _.uniq(quiz.widgetings.map((widgeting) => widgeting.widget_label))
    expect(Object.keys(pub.widgets)).to.have.members(worked)
  })

  it("carries no id at any depth, and names neither its quiz nor its hunt", () => {
    const copy = copyOf(chainedQuiz())
    expect(idPaths(copy)).to.deep.eq([])
    expect(copy).to.not.have.any.keys('label', 'quizzes', 'org', 'hunt')
  })

  it("reads the doc block's widget example", () => {
    expect(copyOf(chainedQuiz()).pub.widgets.dumdum?.formulary).to.eq('aibot')
  })

  it("reads back as one quiz of no label to a quiz's Import, and as the widgets it works to the library's", () => {
    const copy = copyOf(chainedQuiz())
    const read = Jsonball.quizzesIn(copy)
    expect(read?.shape).to.eq('quiz')
    expect(read?.quizzes[0]?.label).to.be.null
    expect(Jsonball.widgetsIn(copy)?.map((widget) => (widget as { label: string }).label)).to.include.members(['dumdum', 'remark'])
  })

  it("holds what the quiz's own entries hold, beside its fields under their widgetings' labels", () => {
    const quiz = withQuizEntry(chainedQuiz(), 'Ada and Grace')
    expect(copyOf(quiz).playtesters).to.deep.eq({ status: 'ok', value: 'Ada and Grace' })
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

  it("carries the recap template across: a quiz's own onto one on the default, and the default onto one with its own", () => {
    const quiz = chainedQuiz()
    const owned = { ...quiz, recap_template: '{{#played}}{{number}}. {{title}}{{/played}}' }
    const ballOf = (from: QuizT) => JSON.stringify(Exporting.quizBall(Place, 'home', from, runOf(from, EntryLibrary)).ball)
    expect(Importing.importInto(quiz, ballOf(owned), EntryLibrary).fieldActions).to.deep.eq([{ kind: 'set_recap_template', recap_template: owned.recap_template }])
    expect(Importing.importInto(owned, ballOf(quiz), EntryLibrary).fieldActions).to.deep.eq([{ kind: 'set_recap_template', recap_template: null }])
    expect(Importing.importInto(owned, ballOf(owned), EntryLibrary).fieldActions).to.deep.eq([])
  })

  it("into an empty quiz out of the whole hunt, sends every question in order with all it holds, every widgeting in run order, what its entries hold, and what its bots replied", () => {
    const quiz = chainedQuiz()
    const empty = { ...Quiz.blank('Princes', 'princes'), questions: [], widgetings: [], columns: [] }
    const whole = Exporting.wholeOf(snapshot())
    const outcome = Importing.importInto(empty, JSON.stringify(whole), EntryLibrary)
    expect(outcome.ok).to.be.true
    expect(outcome.summary).to.include('matched this quiz by label')
    expect(outcome.widgetingActions).to.deep.eq(quiz.widgetings.map((widgeting) => ({ kind: 'add_widgeting', widgeting })))
    const [leon, nantes] = present(outcome.questions)
    const fields = _.pick(present(quiz.questions[0]), ['qnum', 'clueing', 'hint', 'title', 'alt_text', 'notes', 'full_answer', 'recap', 'viz'])
    expect(leon).to.deep.eq({ label: 'leon', patch: { ...fields, chains_to: 'nantes' }, entered: { remark: 'Ask Flip.' }, replied: { numnum_clueing: SpottedItems } })
    expect(nantes).to.deep.include({ label: 'nantes', entered: { remark: null } })
  })

  it("as a copy, into an empty quiz of another name, sends every widgeting, column and question, its fields, and what its own entries hold", () => {
    const quiz = withQuizEntry({ ...chainedQuiz(), smiths_note: 'Play fair.' }, 'Ada and Grace')
    const empty = { ...Quiz.blank('Elsewhere', 'elsewhere'), questions: [], widgetings: [], columns: [] }
    const outcome = Importing.importInto(empty, JSON.stringify(copyOf(quiz)), EntryLibrary)
    expect(outcome.ok).to.be.true
    expect(outcome.summary).to.include('Read as one quiz')
    expect(outcome.widgetingActions).to.deep.eq(quiz.widgetings.map((widgeting) => ({ kind: 'add_widgeting', widgeting })))
    expect(outcome.columnLog.map((entry) => [entry.label, entry.outcome])).to.deep.eq(quiz.columns.map((column) => [column.label, 'added']))
    expect(present(outcome.questions).map((question) => question.label)).to.deep.eq(['leon', 'nantes'])
    expect(outcome.fieldActions).to.deep.include({ kind: 'set_smiths_note', smiths_note: 'Play fair.' })
    expect(outcome.fieldActions).to.deep.include({ kind: 'retitle_quiz', title: 'Princes' })
    expect(outcome.quizEntryLog).to.deep.eq([{ label: 'playtesters', outcome: 'carried', reason: null }])
    expect(outcome.actions).to.deep.include({ kind: 'enter_quiz_widgeted', entered: { widgeting_label: 'playtesters', value: 'Ada and Grace' } })
    // Its own entries are typed once their widgetings are there, and before the questions come in.
    const kinds = outcome.actions.map((action) => action.kind)
    expect(kinds.indexOf('enter_quiz_widgeted')).to.be.greaterThan(kinds.lastIndexOf('add_widgeting'))
    expect(kinds.at(-1)).to.eq('import_questions')
  })

  it("keeps a quiz entry already as the paste has it, and sends nothing for it", () => {
    const quiz = withQuizEntry(chainedQuiz(), 'Ada and Grace')
    const outcome = Importing.importInto(quiz, JSON.stringify(copyOf(quiz)), EntryLibrary)
    expect(outcome.quizEntryLog).to.deep.eq([{ label: 'playtesters', outcome: 'kept', reason: null }])
    expect(outcome.actions.map((action) => action.kind)).to.not.include('enter_quiz_widgeted')
  })

  it("holds a quiz entry to the params the paste revises its widgeting to, which the server will hold it to", () => {
    const quiz = withQuizEntry(chainedQuiz(), 'Ada and Grace')
    const target = cappedEntry(withQuizEntry(chainedQuiz(), 'Ada'), 5)
    const loosened = Importing.importInto(target, JSON.stringify(copyOf(quiz)), EntryLibrary)
    expect(loosened.actions).to.deep.include({ kind: 'edit_widgeting', label: 'playtesters', patch: { description: '', params: {} } })
    expect(loosened.quizEntryLog).to.deep.eq([{ label: 'playtesters', outcome: 'carried', reason: null }])
    const tightenedCopy = copyOf(cappedEntry(quiz, 5))
    const tightened = Importing.importInto(quiz, JSON.stringify(tightenedCopy), EntryLibrary)
    expect(tightened.quizEntryLog.map((entry) => entry.outcome)).to.deep.eq(['skipped'])
    expect(tightened.actions.map((action) => action.kind)).to.not.include('enter_quiz_widgeted')
  })

  it("skips a quiz entry whose value will not do, naming why, and carries the rest", () => {
    const quiz = withQuizEntry(chainedQuiz(), 'Ada and Grace')
    const pasted = { ...copyOf(quiz), playtesters: { status: 'errored', value: null } }
    const outcome = Importing.importInto(quiz, JSON.stringify(pasted), EntryLibrary)
    expect(outcome.ok).to.be.false
    expect(outcome.quizEntryLog).to.deep.eq([{ label: 'playtesters', outcome: 'skipped', reason: 'An entry is typed, so it cannot be "errored"' }])
    expect(outcome.summary).to.include('quiz entries 0 carried, 1 skipped')
  })

  it("carries nothing a formula for the whole quiz came to, which is worked out again", () => {
    const quiz = { ...chainedQuiz(), widgetings: [...chainedQuiz().widgetings, Widgeting.fill({ widget_label: 'answer_reversed', label: 'backward', tier: 'quiz' })] }
    const pasted = { ...copyOf(quiz), backward: { status: 'ok', value: 'drawkcab' } }
    expect(Importing.importInto(quiz, JSON.stringify(pasted), EntryLibrary).quizEntryLog).to.deep.eq([])
  })

  it("still reads what an older export held under widgeteds, and prefers what sits beside the fields", () => {
    const quiz = withQuizEntry(chainedQuiz(), 'Ada and Grace')
    const empty = { ...Quiz.blank('Elsewhere', 'elsewhere'), questions: [], widgetings: [], columns: [] }
    const { playtesters, ...rest } = copyOf(quiz)
    const older = { ...rest, widgeteds: { playtesters } }
    expect(Importing.importInto(empty, JSON.stringify(older), EntryLibrary).quizEntryLog).to.deep.eq([{ label: 'playtesters', outcome: 'carried', reason: null }])
    const both = { ...rest, playtesters: { status: 'ok', value: 'Barbara' }, widgeteds: { playtesters } }
    const entered = Importing.importInto(empty, JSON.stringify(both), EntryLibrary).actions.find((action) => action.kind === 'enter_quiz_widgeted')
    expect(entered).to.deep.eq({ kind: 'enter_quiz_widgeted', entered: { widgeting_label: 'playtesters', value: 'Barbara' } })
  })
})
