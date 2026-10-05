import _ from 'es-toolkit/compat'
import { describe, expect, it } from 'vitest'
import * as Exporting from '../../src/lib/exporting'
import * as Importing from '../../src/lib/importing'
import { Hunt } from '../../src/models/hunt'
import { classicHunt, classicLayout } from '../support/layouts'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SeedWidgets } from '../../src/models/seeds'
import { Widgeted } from '../../src/models/widgeted'
import { present } from '../support/present'
import { runHolding, runOf } from '../support/runs'

/** A stored row of what a widgeting came to: `ok` holding `value`, or `errored` for `why` */
const storedOk = (value: unknown) => ({ status: 'ok' as const, value, message: null, result_meta: {}, _creationTime: 1000 })
const storedErrored = (why: string) => ({ status: 'errored' as const, value: null, message: why, result_meta: {}, _creationTime: 2000 })

/** The number spotter's reply to a clueing holding 300 and twelve */
const SpottedItems = { items: [{ text: '300', value: 300, kind: 'numeral' }, { text: 'twelve', value: 12, kind: 'wordish' }] }

/**
 * A quiz working the default widgetings, whose first question, `leon`, chains to its second,
 * `nantes`. Leon's clueing was read by the number spotter, and its
 * quick guess failed.
 */
function chainedQuiz(): QuizT {
  const nantes = { ...Question.blank(), label: 'nantes', title: 'Nantes' }
  const stored: QuestionT['stored'] = {
    numnum_clueing: { newest: storedOk(SpottedItems), ok: storedOk(SpottedItems) },
    dumdum:         { newest: storedErrored('Overloaded'), ok: null },
  } as QuestionT['stored']
  const leon = { ...Question.blank(), label: 'leon', title: 'Leon', chains_to: nantes._id, stored }
  return { ...Quiz.blank('Princes', 'princes'), ...classicLayout(), questions: [leon, nantes] }
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

/** `quiz` exported over its own run */
const exportedOf = (quiz: QuizT) => Exporting.quizExported(quiz, runOf(quiz))

describe('quizExported', () => {
  it("carries no id at any depth", () => {
    const exported = exportedOf(chainedQuiz())
    expect(idPaths(exported)).to.deep.eq([])
  })

  it("names a chain by the label in force of the question it points at", () => {
    const [leon, nantes] = exportedOf(chainedQuiz()).questions
    expect([leon?.chains_to, nantes?.chains_to]).to.deep.eq(['nantes', null])
  })

  it("reads the doc block's chain example", () => {
    expect(exportedOf(chainedQuiz()).questions[0]?.chains_to).to.eq('nantes')
  })

  it("names a chain to a question the quiz does not hold as none", () => {
    const quiz = chainedQuiz()
    const dangling = { ...quiz, questions: quiz.questions.map((question) => ({ ...question, chains_to: 'long-gone' })) }
    expect(exportedOf(dangling).questions.map((question) => question.chains_to)).to.deep.eq([null, null])
  })

  it("keeps everything else the quiz holds, its widgetings in run order among it", () => {
    const quiz = { ...chainedQuiz(), version: 'draft_two', locked: true }
    const exported = exportedOf(quiz)
    expect(exported).to.deep.include({ title: 'Princes', label: 'princes', version: 'draft_two', locked: true })
    expect(exported.widgetings).to.deep.eq(quiz.widgetings)
    expect(present(exported.questions[1])).to.deep.include({ label: 'nantes', title: 'Nantes' })
    expect([exported, present(exported.questions[1])].map((each) => Object.hasOwn(each, 'forced_label'))).to.deep.eq([false, false])
  })

  it("puts what each widgeting came to beside the question's own fields, the worked-out ones included", () => {
    const leon = present(exportedOf(chainedQuiz()).questions[0])
    expect(leon.numnum_clueing).to.deep.eq({ status: 'ok', value: SpottedItems })
    expect(leon.clueing_full).to.deep.eq({ status: 'ok', value: 312 })
  })

  it("reads the doc block's widgeting example", () => {
    expect(exportedOf(chainedQuiz()).questions[0]?.clueing_full).to.deep.eq({ status: 'ok', value: 312 })
  })

  it("keeps a stored null as it is, where the sheet and the table write nothing", () => {
    const quiz = chainedQuiz()
    const leon = present(quiz.questions[0])
    const exported = Exporting.quizExported(quiz, runHolding(quiz, { dumdum: { [leon._id]: Widgeted.ok(null) } }))
    expect(exported.questions[0]?.dumdum).to.deep.eq({ status: 'ok', value: null })
  })

  it("exposes only the status and the value: a failure's message stays behind", () => {
    const leon = present(exportedOf(chainedQuiz()).questions[0])
    expect(leon.dumdum).to.deep.eq({ status: 'errored', value: null })
  })

  it("names every widgeting on every question, as missing where it came to nothing", () => {
    const quiz = chainedQuiz()
    const nantes = present(exportedOf(quiz).questions[1])
    for (const { label } of quiz.widgetings) {
      expect(nantes[label], label).to.deep.eq({ status: 'missing', value: null })
    }
  })

  it("drops what the widgetings stored, which the flat widgeteds stand in for", () => {
    for (const question of exportedOf(chainedQuiz()).questions) {
      expect(question).to.not.have.property('stored')
    }
  })

  it("reads what the widgetings came to off the run it is handed", () => {
    const quiz = chainedQuiz()
    const leon = present(quiz.questions[0])
    const exported = Exporting.quizExported(quiz, runHolding(quiz, { clueing_full: { [leon._id]: Widgeted.ok(7) } }))
    expect(exported.questions[0]?.clueing_full).to.deep.eq({ status: 'ok', value: 7 })
    expect(exported.questions[0]?.numnum_clueing).to.deep.eq({ status: 'missing', value: null })
  })

  it("adds nothing beside a question's fields for a quiz with no widgetings", () => {
    const quiz = { ...chainedQuiz(), widgetings: [] }
    const exported = Exporting.quizExported(quiz, runOf(quiz))
    const ownFields = Object.keys(Question.blank()).filter((key) => key !== '_id' && key !== 'stored')
    const nantes = present(exported.questions[1])
    expect(_.sortBy(Object.keys(nantes))).to.deep.eq(_.sortBy(ownFields))
  })

  it("reads back through Import onto a quiz with the same labels, chains and widgetings and all", () => {
    const quiz = chainedQuiz()
    const unchained = { ...quiz, questions: quiz.questions.map((question) => ({ ...question, chains_to: null })) }
    const outcome = Importing.importInto(unchained, JSON.stringify(exportedOf(quiz)), SeedWidgets)
    const leon = present(outcome.questions).find((question) => question.label === 'leon')
    expect(leon?.patch.chains_to).to.eq('nantes')
    expect(leon?.patch).to.not.have.property('clueing_full')
    expect(outcome.log.flatMap((entry) => entry.issues)).to.deep.eq([])
    expect(outcome.widgetingLog.map((entry) => entry.outcome)).to.deep.eq(quiz.widgetings.map(() => 'kept'))
    expect(outcome.widgetingActions).to.deep.eq([])
  })
})

describe('huntExported', () => {
  it("is the hunt by label, realm by realm, naming its widgets by label only, and carries no id at any depth", () => {
    const hunt = Hunt.blank('deep_lake')
    const exported = Exporting.huntExported(hunt, SeedWidgets)
    expect(idPaths(exported)).to.deep.eq([])
    expect(exported).to.deep.include({ label: 'deep_lake', title: 'Deep Lake' })
    expect(exported.realms.map((realm) => [realm.label, realm.quizzes.map((quiz) => quiz.label)])).to.deep.eq([['home', ['deep_lake']]])
    expect(_.sortBy(Object.keys(exported))).to.deep.eq(['label', 'realms', 'title'])
  })

  it("reads the doc block's example", () => {
    expect(Exporting.huntExported(Hunt.blank('deep_lake'), SeedWidgets).realms[0]?.quizzes[0]?.title).to.eq('Deep Lake')
  })

  it("runs each quiz over the library it is handed", () => {
    const hunt = classicHunt('deep_lake')
    const [realm] = hunt.realms
    const quiz = present(realm?.quizzes[0])
    const leon = { ...Question.blank(), label: 'leon', stored: { numnum_clueing: { newest: storedOk(SpottedItems), ok: storedOk(SpottedItems) } } } as QuestionT
    const held = { ...hunt, realms: [{ ...present(realm), quizzes: [{ ...quiz, questions: [leon] }] }] }
    const question = (library: typeof SeedWidgets) => present(Exporting.huntExported(held, library).realms[0]?.quizzes[0]?.questions[0])
    expect(question(SeedWidgets).clueing_full).to.deep.eq({ status: 'ok', value: 312 })
    expect(question([]).clueing_full).to.not.deep.eq({ status: 'ok', value: 312 })
  })
})

describe('libraryExported', () => {
  it("is every widget, in library order", () => {
    expect(Exporting.libraryExported(SeedWidgets).widgets.map((widget) => widget.label)).to.deep.eq(SeedWidgets.map((widget) => widget.label))
  })

  it("reads the doc block's example", () => {
    expect(Exporting.libraryExported(SeedWidgets).widgets.map((widget) => widget.label).slice(0, 2)).to.deep.eq(['dumdum', 'numnum_clueing'])
  })

  it("carries each widget's fields without its place in the library", () => {
    const rows = SeedWidgets.map((widget, ii) => ({ ...widget, position: ii }))
    const exported = Exporting.libraryExported(rows)
    expect(exported.widgets).to.deep.eq(SeedWidgets)
    expect(exported.widgets.some((widget) => Object.hasOwn(widget, 'position'))).to.be.false
  })

  it("is an empty list for an empty library", () => {
    expect(Exporting.libraryExported([])).to.deep.eq({ widgets: [] })
  })

  it("reads back through the library's Import as unchanged", () => {
    const outcome = Importing.libraryImported(SeedWidgets, JSON.stringify(Exporting.libraryExported(SeedWidgets)))
    expect(outcome.widgets).to.deep.eq([])
    expect(outcome.ok).to.be.true
  })
})
