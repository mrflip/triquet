import type { MigrationStatus } from '@convex-dev/migrations'
import { describe, expect, it } from 'vitest'
import type { Doc, Id, TableNames } from '../../convex/_generated/dataModel'
import {
  assembledQuiz, backfillFrom, backfillsFrom, frameOf, historyOf, huntFrom, huntListingOf, huntTitleOf, quizFrom, quizFromSeen, realmTitleOf, reviewBy, seenQuestionFor, shallowHuntOf, smithsOf, widgetFrom, widgetingFrom,
  type CellRows, type HuntRows, type QuizRows,
} from '../../src/lib/rows'
import * as Wheel from '../../src/lib/wheel'
import * as Runner from '../../src/lib/formulary/runner'
import { Quiz } from '../../src/models/quiz'
import { Widgeted } from '../../src/models/widgeted'
import { runOf } from '../support/runs'

/** A row id for `table`, as the database would hand one back */
function idOf<TN extends TableNames>(_table: TN, tail: string): Id<TN> {
  return `j97d0qbj35dar1v8edndzck${tail.padStart(9, '0')}` as Id<TN>
}

const hunt_id = idOf('hunts', 'h1')
const quiz_id = idOf('quizzes', 'q1')
const question_id = idOf('questions', 'qn1')
const widgeting_id = idOf('widgetings', 'wg1')

/** A widgeted row of the first question's `dumdum` cell, recorded at `at`: an answer, or a failure saying `text` */
function widgetedRow(status: 'ok' | 'errored', at: number, text: string): Doc<'widgeteds'> {
  return {
    _id: idOf('widgeteds', `d${String(at).replace('.', '')}`), _creationTime: at, hunt_id, quiz_id, question_id, widgeting_id, status,
    value: status === 'ok' ? { guess: text, explanation: '' } : null, message: status === 'errored' ? text : null,
    result_meta: status === 'ok' ? { approx_tokens: 12 } : { response: { ok: false } },
  }
}

/** A cell whose newest row failed after an older one answered */
const FailedSince: CellRows = { newest: widgetedRow('errored', 7.25, 'failed'), ok: widgetedRow('ok', 5.5, 'answered') }

const QuizRow: Doc<'quizzes'> = {
  _id: quiz_id, _creationTime: 1, hunt_id, realm_id: idOf('realms', 'r1'), title: 'Princes', label: 'princes',
  smiths_note: 'Theme: princes.', q1_preamble: 'Read the note![br]', locked: false, last_sortkey: null, row_ordering: [question_id],
}
const WidgetingRow: Doc<'widgetings'> = {
  _id: widgeting_id, _creationTime: 1, hunt_id, quiz_id, widget_label: 'dumdum', label: 'dumdum', description: 'The hasty guess.', params: { tone: 'dry' }, position: 0,
}
/** The standings a question's reader can hold on its hunt, as the claims carry them */
const Smith = { standing: 'smith' } as const
const Reviewer = { standing: 'reviewer' } as const
const Stranger = { standing: 'stranger' } as const

const QuestionRow: Doc<'questions'> = {
  _id: question_id, _creationTime: 2, hunt_id, quiz_id, label: 'leon', title: 'Leon', qnum: '1',
  clueing: 'Who?', hint: '', chains_to: null, full_answer: '', alt_text: '', notes: '', viz: 'normal',
}
const HuntRow: Doc<'hunts'> = { _id: hunt_id, _creationTime: 0, label: 'quiet_otter', orglabel: 'alice_smiths', title: '', branch: 'main' }
const RealmRow: Doc<'realms'> = { _id: idOf('realms', 'r1'), _creationTime: 0, hunt_id: HuntRow._id, label: 'home', title: '', position: 0 }
const Rows: HuntRows = { hunt: HuntRow, realms: [{ realm: RealmRow, quizzes: [QuizRow] }] }

describe('historyOf', () => {
  it('is the newest row and the newest ok row, each its own fields and when it was recorded, without its ids', () => {
    expect(historyOf(FailedSince)).to.deep.eq({
      newest: { status: 'errored', value: null, message: 'failed', result_meta: { response: { ok: false } }, _creationTime: 7.25 },
      ok:     { status: 'ok', value: { guess: 'answered', explanation: '' }, message: null, result_meta: { approx_tokens: 12 }, _creationTime: 5.5 },
    })
  })

  it('says the newest row errored when it did', () => {
    expect(historyOf(FailedSince).newest.status).to.eq('errored')
  })

  it('carries no ok row for a cell that never had one', () => {
    expect(historyOf({ newest: widgetedRow('errored', 3, 'failed'), ok: null }).ok).to.be.null
  })

  it('is the one row twice when the newest answered', () => {
    const answered = widgetedRow('ok', 2, 'answered')
    const history = historyOf({ newest: answered, ok: answered })
    expect(history.ok).to.deep.eq(history.newest)
  })
})

describe('quizFrom', () => {
  const rows: QuizRows = { quiz: QuizRow, questions: [QuestionRow], widgetings: [WidgetingRow], columns: [], stored: new Map() }

  it('is the quiz its rows make up, named by the quiz row\'s id', () => {
    const quiz = quizFrom(rows)
    expect([quiz._id, quiz.title, quiz.questions.length, quiz.questions[0]?._id]).to.deep.eq([quiz_id, 'Princes', 1, question_id])
  })

  it('makes a quiz the quiz validator takes whole', () => {
    expect(Quiz.fill(quizFrom(rows)).questions).to.have.lengthOf(1)
  })

  it('carries the smith\'s note', () => {
    expect(quizFrom(rows).smiths_note).to.eq('Theme: princes.')
  })

  it('carries the LL preamble', () => {
    expect(quizFrom(rows).q1_preamble).to.eq('Read the note![br]')
  })

  it('carries the quiz\'s widgetings, each without its ids or place', () => {
    expect(quizFrom(rows).widgetings).to.deep.eq([{ widget_label: 'dumdum', label: 'dumdum', description: 'The hasty guess.', params: { tone: 'dry' } }])
  })

  it('holds what each question stored, under the widgeting\'s label, by the question\'s id', () => {
    const [question] = quizFrom({ ...rows, stored: new Map([[question_id, new Map([['dumdum', FailedSince]])]]) }).questions
    expect(question?.stored).to.deep.eq({ dumdum: historyOf(FailedSince) })
    expect(quizFrom(rows).questions[0]?.stored).to.deep.eq({})
  })

  it('shows a cell\'s newest answer once run, with the failure since riding on it, in whole milliseconds', () => {
    const quiz = quizFrom({ ...rows, stored: new Map([[question_id, new Map([['dumdum', FailedSince]])]]) })
    expect(Runner.widgetedOf(runOf(quiz), 'dumdum', question_id)).to.deep.eq(Widgeted.ok({ guess: 'answered', explanation: '' }, { message: 'failed', at: 7, response: { ok: false } }))
  })
})

describe('seenQuestionFor', () => {
  const Written = { ...QuestionRow, chains_to: 'lear', full_answer: 'Leontes', notes: 'Check the folio.', alt_text: 'A lion.' }

  it('is, for a smith, the question\'s id and every field, with each stored cell\'s history under its widgeting\'s label, its chain still the label it holds', () => {
    const seen = seenQuestionFor(Written, new Map([['dumdum', FailedSince]]), Smith)
    expect(seen).to.deep.eq({
      _id: question_id, label: 'leon', title: 'Leon', qnum: '1', clueing: 'Who?', hint: '', chains_to: 'lear',
      full_answer: 'Leontes', alt_text: 'A lion.', notes: 'Check the folio.', stored: { dumdum: historyOf(FailedSince) },
      viz: 'normal', created_at: 2, updated_at: 2,
    })
  })

  it("sends the viz its row holds, to a smith or a reviewer", () => {
    expect(seenQuestionFor({ ...QuestionRow, viz: 'archived' }, new Map(), Reviewer)).to.deep.include({ viz: 'archived' })
    expect(seenQuestionFor({ ...QuestionRow, viz: 'secondary' }, new Map(), Smith)).to.deep.include({ viz: 'secondary' })
  })

  it("sends a smith the question's stamps: its own, or for a row written before rows were stamped, made and last edited when the database made it", () => {
    const stamped = { ...QuestionRow, created_at: 10, updated_at: 20 }
    expect(seenQuestionFor(stamped, new Map(), Smith)).to.deep.include({ created_at: 10, updated_at: 20 })
    expect(seenQuestionFor({ ...QuestionRow, _creationTime: 3.75 }, new Map(), Smith)).to.deep.include({ created_at: 3, updated_at: 3 })
    expect(seenQuestionFor(stamped, new Map(), Reviewer)).not.to.have.property('created_at')
  })

  it('reads the newest row\'s status where the doc block says', () => {
    const answered = widgetedRow('ok', 5, 'answered')
    const seen = seenQuestionFor(QuestionRow, new Map([['dumdum', { newest: answered, ok: answered }]]), Smith)
    expect('stored' in seen && seen.stored.dumdum?.newest.status).to.eq('ok')
  })

  it('stores nothing for a question with no stored cells', () => {
    expect(seenQuestionFor(QuestionRow, new Map(), Smith)).to.deep.include({ stored: {} })
  })

  it('is, for a reviewer, what a review needs, the answer among it: not the notes, nor what was stored, whatever is handed in', () => {
    const seen = seenQuestionFor(Written, new Map([['dumdum', FailedSince]]), Reviewer)
    expect(seen).to.deep.eq({ _id: question_id, label: 'leon', title: 'Leon', qnum: '1', clueing: 'Who?', hint: '', chains_to: 'lear', full_answer: 'Leontes', viz: 'normal' })
  })

  it('is, for a stranger to the hunt, the id alone', () => {
    expect(seenQuestionFor(Written, new Map(), Stranger)).to.deep.eq({ _id: question_id })
  })

  it('sends none of the row\'s housekeeping: its hunt, its quiz, when it was made', () => {
    expect(seenQuestionFor(QuestionRow, new Map(), Smith)).to.not.have.any.keys('hunt_id', 'quiz_id', '_creationTime')
  })
})

describe('frameOf', () => {
  it('is the quiz without its questions: its fields and their order, its widgetings and columns', () => {
    const frame = frameOf(QuizRow, [WidgetingRow], [])
    expect(frame.row_ordering).to.deep.eq([question_id])
    expect(frame.widgetings.map((widgeting) => widgeting.label)).to.deep.eq(['dumdum'])
    expect(frame).to.not.have.any.keys('questions', 'realm_id', '_creationTime')
  })

  it('sends each column as the grid needs it, its alignment only where one was set', () => {
    const ColumnRow: Doc<'columns'> = { _id: idOf('columns', 'col1'), _creationTime: 2, hunt_id, quiz_id, label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 330, position: 0 }
    const columns = [ColumnRow, { ...ColumnRow, _id: idOf('columns', 'col2'), label: 'qnum', title: 'Q#', source: 'question.qnum', width_px: 60, position: 1, align: 'right' as const }]
    expect(frameOf(QuizRow, [], columns).columns).to.deep.eq([
      { label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 330 },
      { label: 'qnum',    title: 'Q#',      source: 'question.qnum',    width_px: 60,  align: 'right' },
    ])
  })
})

describe('quizFromSeen', () => {
  const second = { ...seenQuestionFor(QuestionRow, new Map(), Smith), _id: idOf('questions', 'qn2'), label: 'lear', chains_to: 'leon' }
  const first = { ...seenQuestionFor(QuestionRow, new Map(), Smith), chains_to: 'lear' }

  it('is the quiz its frame and questions make up, in the order given', () => {
    const quiz = quizFromSeen(frameOf(QuizRow, [], []), [second, first])
    expect(quiz.questions.map((question) => question._id)).to.deep.eq([second._id, question_id])
    expect(quiz).to.not.have.any.keys('row_ordering')
  })

  it('reads each chain as the id of the sibling answering to its label; a chain to itself, or to no sibling, as none', () => {
    const quiz = quizFromSeen(frameOf(QuizRow, [], []), [first, second, { ...second, _id: idOf('questions', 'qn3'), label: 'lone', chains_to: 'lone' }])
    expect(quiz.questions.map((question) => question.chains_to)).to.deep.eq([second._id, question_id, null])
  })

  it('reads a field a reviewer was not sent as blank, and chains their questions as a smith\'s', () => {
    const written = { ...QuestionRow, notes: 'Check the folio.', alt_text: 'A lion.', full_answer: 'Leontes' }
    const reviewed = [
      { ...seenQuestionFor(written, new Map([['dumdum', FailedSince]]), Reviewer), chains_to: 'lear' },
      { ...seenQuestionFor(written, new Map(), Reviewer), _id: idOf('questions', 'qn2'), label: 'lear' },
    ]
    const [question] = quizFromSeen(frameOf(QuizRow, [], []), reviewed).questions
    expect(question).to.deep.include({ full_answer: 'Leontes', notes: '', alt_text: '', stored: {}, chains_to: idOf('questions', 'qn2') })
  })
})

describe('assembledQuiz', () => {
  const frame = { ...frameOf(QuizRow, [], []), row_ordering: [question_id, idOf('questions', 'qn2')] }
  const seen = seenQuestionFor(QuestionRow, new Map(), Smith)

  it('is undefined while a question the frame orders is still on its way', () => {
    expect(assembledQuiz(frame, (id) => (id === question_id ? seen : undefined))).to.be.undefined
  })

  it('leaves out a question read as gone, and is the quiz once every question has been read', () => {
    expect(assembledQuiz(frame, (id) => (id === question_id ? seen : null))?.questions.length).to.eq(1)
  })
})

describe('widgetFrom', () => {
  const shared = { _id: idOf('widgets', 'w1'), _creationTime: 0, scope: 'pub' as const, label: 'shout', title: 'Shout', description: 'Loudly.', position: 4 }
  const sharedFields = { scope: 'pub', label: 'shout', title: 'Shout', description: 'Loudly.' }

  it('is a jsonata widget, without its id or place', () => {
    expect(widgetFrom({ ...shared, formulary: 'jsonata', formula: '$uppercase(qn.title)', input_formula: '$', config: {} }))
      .to.deep.eq({ ...sharedFields, formulary: 'jsonata', formula: '$uppercase(qn.title)', input_formula: '$', config: {} })
  })

  it('is an aibot widget, its config whole, without its id or place', () => {
    const config = { servicelabel: 'claude' as const, model_tier: 'quick' as const, max_tokens: 256 }
    expect(widgetFrom({ ...shared, formulary: 'aibot', formula: 'Say {{clueing}}', input_formula: "{ 'clueing': qn.clueing }", config }))
      .to.deep.eq({ ...sharedFields, formulary: 'aibot', formula: 'Say {{clueing}}', input_formula: "{ 'clueing': qn.clueing }", config })
  })
})

describe('widgetingFrom', () => {
  it('is the widgeting, without its id, its quiz or its place', () => {
    expect(widgetingFrom(WidgetingRow)).to.deep.eq({ widget_label: 'dumdum', label: 'dumdum', description: 'The hasty guess.', params: { tone: 'dry' } })
  })
})

describe('the titles', () => {
  it('read a blank hunt title as its label, titleized, and keep one that is there', () => {
    expect([huntTitleOf(HuntRow), huntTitleOf({ ...HuntRow, title: 'Autumn' })])
      .to.deep.eq(['Quiet Otter', 'Autumn'])
  })

  it('read a blank realm title as its label, titleized', () => {
    expect([realmTitleOf(RealmRow), realmTitleOf({ ...RealmRow, title: 'Far Away' })]).to.deep.eq(['Home', 'Far Away'])
  })
})

/** Who is on the hunt of `Rows`: its maker, a smith, alone */
const Members = [{ ident_id: idOf('idents', 'i1'), label: 'alice_smiths', title: 'Alice', role: 'smith' as const }]

describe('huntListingOf', () => {
  it('is the hunt titled, with its realms titled and holding their quizzes\' rows', () => {
    const listing = huntListingOf(Rows)
    expect([listing.title, listing.realms.map((realm) => [realm.title, realm.quizzes.map((quiz) => quiz.title)])]).to.deep.eq(['Quiet Otter', [['Home', ['Princes']]]])
  })

  it('is addressed under the org the hunt stores', () => {
    expect(huntListingOf({ ...Rows, hunt: { ...HuntRow, orglabel: 'pat_smith' } }).org).to.eq('pat_smith')
  })

  it("lists each realm's quizzes by label, in code-unit order, whatever the order they were made", () => {
    const labels = ['zebra', 'alpha_two', 'alpha', 'b2b']
    const quizzes = labels.map((label) => ({ ...QuizRow, _id: idOf('quizzes', label), label }))
    const listing = huntListingOf({ ...Rows, realms: [{ realm: RealmRow, quizzes }] })
    expect(listing.realms[0]?.quizzes.map((quiz) => quiz.label)).to.deep.eq(['alpha', 'alpha_two', 'b2b', 'zebra'])
  })

  it('leaves out each quiz\'s order of its questions, which only the quiz\'s own screen reads', () => {
    expect(huntListingOf(Rows).realms[0]?.quizzes[0]).to.not.have.any.keys('row_ordering')
  })
})

describe('shallowHuntOf', () => {
  const members = Members

  it('carries who is on the hunt, and the role of whoever is looking', () => {
    const hunt = shallowHuntOf(Rows, members, 'reviewer')
    expect([hunt.members, hunt.role]).to.deep.eq([members, 'reviewer'])
    expect(shallowHuntOf(Rows, members, 'smith').role).to.eq('smith')
  })

  it('is the hunt\'s listing and its wheel, and nothing of a library or expressions', () => {
    expect(shallowHuntOf(Rows, members, 'smith')).to.deep.eq({ ...huntListingOf(Rows), wheel: Wheel.defaultWheel(), members, role: 'smith' })
  })

  it("reads a hunt nobody has arranged as holding the default wheel", () => {
    expect(shallowHuntOf(Rows, members, 'smith').wheel).to.deep.eq(Wheel.defaultWheel())
  })

  it("carries the wheel the hunt holds, holes and all", () => {
    const wheel = Wheel.placed(Wheel.defaultWheel(), 'tv', 'pool')
    expect(shallowHuntOf({ ...Rows, hunt: { ...HuntRow, wheel } }, members, 'smith').wheel).to.deep.eq(wheel)
  })
})

describe("smithsOf", () => {
  it("names the smiths among the members, by label and title, in the order they joined", () => {
    const members = [
      { ident_id: idOf('idents', 'i1'), label: 'alice_smiths',  title: 'Alice', role: 'smith' as const },
      { ident_id: idOf('idents', 'i2'), label: 'bob_reviews',   title: 'Bob',   role: 'reviewer' as const },
      { ident_id: idOf('idents', 'i3'), label: 'carol_smiths',  title: '',      role: 'smith' as const },
    ]
    expect(smithsOf(members)).to.deep.eq([{ label: 'alice_smiths', title: 'Alice' }, { label: 'carol_smiths', title: '' }])
  })
})

describe('huntFrom', () => {
  it('is the whole hunt, each realm holding the quizzes it is handed whole', () => {
    const quiz = quizFrom({ quiz: QuizRow, questions: [QuestionRow], widgetings: [WidgetingRow], columns: [], stored: new Map() })
    const hunt = huntFrom(Rows, new Map([[quiz_id, quiz]]))
    expect([hunt.title, hunt.realms[0]?.quizzes[0]?.title, hunt.realms[0]?.quizzes[0]?.widgetings.length]).to.deep.eq(['Quiet Otter', 'Princes', 1])
    expect(hunt).to.not.have.any.keys('expressions')
  })

  it('leaves out a quiz it is not handed', () => {
    expect(huntFrom(Rows, new Map()).realms[0]?.quizzes).to.deep.eq([])
  })
})

describe('reviewBy', () => {
  const ident_id = idOf('idents', 'i1')
  const ReviewRow: Doc<'reviews'> = { _id: idOf('reviews', 'v1'), _creationTime: 3, hunt_id: idOf('hunts', 'h1'), quiz_id, ident_id, overall: '', phase: 'draft' }
  const Other = { ...ReviewRow, _id: idOf('reviews', 'v2'), ident_id: idOf('idents', 'i2') }
  const Later = { ...ReviewRow, _id: idOf('reviews', 'v3'), _creationTime: 4, overall: 'Twice.' }

  it('finds the review an ident wrote among a quiz\'s reviews', () => {
    expect(reviewBy([Other, ReviewRow], ident_id)?._id).to.eq(ReviewRow._id)
  })

  it('takes the earliest, should an ident have written two', () => {
    expect(reviewBy([ReviewRow, Later], ident_id)?.overall).to.eq('')
  })

  it('is null for an ident who has written none, or a quiz with no reviews', () => {
    expect([reviewBy([Other], ident_id), reviewBy([], ident_id)]).to.deep.eq([null, null])
  })
})

/** The migrations component's status of the migration `fnname`, finished unless told otherwise */
function migrationStatus(fnname: string, fields: Partial<MigrationStatus> = {}): MigrationStatus {
  return { name: `migrations:${fnname}`, state: 'success', isDone: true, processed: 37, latestStart: 1_759_700_000_000, latestEnd: 1_759_700_001_000, cursor: 'opaque', ...fields }
}

describe('backfillFrom', () => {
  it("says a run backfill's state and counts, and leaves its cursor and error behind", () => {
    expect(backfillFrom(migrationStatus('backfillHuntOrglabels', { state: 'failed', isDone: false, error: 'Hunt spring_hunt refused' }), true)).to.deep.eq({
      fnname: 'migrations:backfillHuntOrglabels', defined: true, state: 'failed', is_done: false, processed: 37, started_at: 1_759_700_000_000, ended_at: 1_759_700_001_000,
    })
  })
  it("says a backfill never run started and ended never", () => {
    const status = migrationStatus('backfillHuntOrglabels', { state: 'unknown', isDone: false, processed: 0, latestStart: 0, latestEnd: undefined, cursor: null })
    expect(backfillFrom(status, true)).to.include({ state: 'unknown', processed: 0, started_at: null, ended_at: null })
  })
})

describe('backfillsFrom', () => {
  const orgs         = migrationStatus('backfillHuntOrglabels')
  const quizCopies   = migrationStatus('backfillQuizCopies')
  const huntBranches = migrationStatus('backfillHuntBranches')

  it("lists those defined first, then the rest newest first", () => {
    expect(backfillsFrom([orgs], [quizCopies, orgs, huntBranches], 20).map(({ fnname, defined }) => [fnname, defined])).to.deep.eq([
      ['migrations:backfillHuntOrglabels', true],
      ['migrations:backfillHuntBranches',  false],
      ['migrations:backfillQuizCopies',    false],
    ])
  })
  it("lists at most `pastMax` of those no longer defined, the newest", () => {
    expect(backfillsFrom([orgs], [quizCopies, orgs, huntBranches], 1).map(({ fnname }) => fnname)).to.deep.eq(['migrations:backfillHuntOrglabels', 'migrations:backfillHuntBranches'])
  })
  it("lists only those defined, when the component remembers nothing else", () => {
    expect(backfillsFrom([orgs], [orgs], 20)).to.have.lengthOf(1)
  })
})
