import { describe, expect, it } from 'vitest'
import type { Doc, Id, TableNames } from '../../convex/_generated/dataModel'
import {
  bottingFrom, expressionFrom, huntFrom, huntListingOf, huntTitleOf, quizFrom, realmTitleOf, recordedAtOf, reviewBy, shallowHuntOf, slotLatestOf, widgetFrom,
  type HuntRows, type QuizRows,
} from '../../src/lib/rows'
import { Quiz } from '../../src/models/quiz'

/** A row id for `table`, as the database would hand one back */
function idOf<TN extends TableNames>(_table: TN, tail: string): Id<TN> {
  return `j97d0qbj35dar1v8edndzck${tail.padStart(9, '0')}` as Id<TN>
}

const quiz_id = idOf('quizzes', 'q1')
const question_id = idOf('questions', 'qn1')

/** A numnum botting of the first question's clueing, made at `at` */
function botting(status: 'done' | 'error', at: number, text: string): Doc<'bottings'> {
  return {
    _id: idOf('bottings', `b${String(at)}`), _creationTime: at, question_id, bot_label: 'numnum', textkind: 'clueing', asked_text: 'Who?', status,
    reply_text: null, items: status === 'done' ? [{ text, value: 1, kind: 'numeral' }] : [], message: status === 'error' ? text : null,
    response: null, truncated: false, model_tier_applied: null, approx_tokens: null,
  }
}

const QuizRow: Doc<'quizzes'> = {
  _id: quiz_id, _creationTime: 1, realm_id: idOf('realms', 'r1'), title: 'Princes', label: 'princes', forced_label: null,
  version: 'main', locked: false, last_sortkey: null, bulk_ishes_last: null,
}
const QuestionRow: Doc<'questions'> = {
  _id: question_id, _creationTime: 2, quiz_id, position: 0, label: 'leon', forced_label: null, title: 'Leon', qnum: '1',
  clueing: 'Who?', hint: '', chains_to: null, full_answer: '', alt_text: '', notes: '',
}
const HuntRow: Doc<'hunts'> = { _id: idOf('hunts', 'h1'), _creationTime: 0, label: 'quiet_otter', forced_label: null, title: '' }
const RealmRow: Doc<'realms'> = { _id: idOf('realms', 'r1'), _creationTime: 0, hunt_id: HuntRow._id, label: 'home', title: '', position: 0 }
const ExpressionRow: Doc<'expressions'> = {
  _id: idOf('expressions', 'e1'), _creationTime: 0, hunt_id: HuntRow._id, owner: 'tq', label: 'shout', formula: '$uppercase(qn.title)', description: '', position: 0,
}
const Rows: HuntRows = { hunt: HuntRow, realms: [{ realm: RealmRow, quizzes: [QuizRow] }], expressions: [ExpressionRow] }

describe('bottingFrom', () => {
  it('is the row as the tree reads it: its id, and when it was asked in whole milliseconds', () => {
    const tree = bottingFrom(botting('done', 1_727_470_000_000.625, 'one'))
    expect([tree.id, tree.created_at]).to.deep.eq([idOf('bottings', 'b1727470000000.625'), 1_727_470_000_000])
    expect(tree).to.not.have.any.keys('_id', '_creationTime')
  })
})

describe('slotLatestOf', () => {
  it('is the newest answer, and a failure newer than it', () => {
    const latest = slotLatestOf({ newest: botting('error', 3, 'failed'), done: botting('done', 2, 'answered') })
    expect([latest.done?.items[0]?.text, latest.failed?.status]).to.deep.eq(['answered', 'error'])
  })

  it('carries no failure when the newest botting answered', () => {
    const answered = botting('done', 2, 'answered')
    expect(slotLatestOf({ newest: answered, done: answered }).failed).to.eq(null)
  })

  it('carries no answer for a cell that never had one', () => {
    expect(slotLatestOf({ newest: botting('error', 3, 'failed'), done: null }).done).to.eq(null)
  })
})

describe('recordedAtOf', () => {
  it('is when each cell\'s newest botting was made, to the fraction', () => {
    const newest = botting('error', 3.5, 'failed')
    expect(recordedAtOf(new Map([['cell', { newest, done: null }]]))).to.deep.eq(new Map([['cell', 3.5]]))
  })
})

describe('quizFrom', () => {
  const rows: QuizRows = { quiz: QuizRow, questions: [QuestionRow], widgets: [], columns: [], slots: new Map() }

  it('is the quiz its rows make up, named by the quiz row\'s id', () => {
    const quiz = quizFrom(rows)
    expect([quiz._id, quiz.title, quiz.questions.length, quiz.questions[0]?._id]).to.deep.eq([quiz_id, 'Princes', 1, question_id])
  })

  it('makes a quiz the quiz validator takes whole', () => {
    expect(Quiz.fill(quizFrom(rows)).questions).to.have.lengthOf(1)
  })

  it('shows a cell\'s newest answer, with the failure since riding on it, in whole milliseconds', () => {
    const slots = new Map([[`${question_id}:numnum:clueing`, { newest: botting('error', 7.25, 'failed'), done: botting('done', 5.5, 'answered') }]])
    const [question] = quizFrom({ ...rows, slots }).questions
    expect(question?.clueing_ishes).to.deep.include({ status: 'done', updated_at: 5, last_err: { message: 'failed', response: null, at: 7 } })
  })
})

describe('widgetFrom', () => {
  const row = { _id: idOf('widgets', 'w1'), _creationTime: 0, quiz_id, label: 'shouted', description: '', position: 0 }

  it('is a widget of the row\'s kind, with only that kind\'s fields', () => {
    expect(widgetFrom({ ...row, kind: 'expressing', expression_label: 'shout', bot_label: null, textkind: null }))
      .to.deep.eq({ kind: 'expressing', label: 'shouted', description: '', expression_label: 'shout' })
  })

  it('throws for a row lacking its kind\'s fields', () => {
    expect(() => widgetFrom({ ...row, kind: 'botting', expression_label: null, bot_label: null, textkind: null })).to.throw(/lacks the fields/)
  })
})

describe('expressionFrom', () => {
  it('is the expression, without its row\'s place or hunt', () => {
    expect(expressionFrom(ExpressionRow)).to.deep.eq({ owner: 'tq', label: 'shout', formula: '$uppercase(qn.title)', description: '' })
  })
})

describe('the titles', () => {
  it('read a blank hunt title as the label in force, titleized, and keep one that is there', () => {
    expect([huntTitleOf(HuntRow), huntTitleOf({ ...HuntRow, forced_label: 'loud_heron' }), huntTitleOf({ ...HuntRow, title: 'Autumn' })])
      .to.deep.eq(['Quiet Otter', 'Loud Heron', 'Autumn'])
  })

  it('read a blank realm title as its label, titleized', () => {
    expect([realmTitleOf(RealmRow), realmTitleOf({ ...RealmRow, title: 'Far Away' })]).to.deep.eq(['Home', 'Far Away'])
  })
})

describe('huntListingOf', () => {
  it('is the hunt titled, with its realms titled and holding their quizzes\' rows', () => {
    const listing = huntListingOf(Rows)
    expect([listing.title, listing.realms.map((realm) => [realm.title, realm.quizzes.map((quiz) => quiz.title)])]).to.deep.eq(['Quiet Otter', [['Home', ['Princes']]]])
  })
})

describe('shallowHuntOf', () => {
  it('counts each expression\'s widgets, nought for one no widget works', () => {
    expect(shallowHuntOf(Rows, new Map([['shout', 1]])).expressions[0]?.usage).to.eq(1)
    expect(shallowHuntOf(Rows, new Map()).expressions[0]?.usage).to.eq(0)
  })
})

describe('huntFrom', () => {
  it('is the whole hunt, each realm holding the quizzes it is handed whole', () => {
    const quiz = quizFrom({ quiz: QuizRow, questions: [QuestionRow], widgets: [], columns: [], slots: new Map() })
    const hunt = huntFrom(Rows, new Map([[quiz_id, quiz]]))
    expect([hunt.title, hunt.realms[0]?.quizzes[0]?.title, hunt.expressions.map((expression) => expression.label)]).to.deep.eq(['Quiet Otter', 'Princes', ['shout']])
  })
})

describe('reviewBy', () => {
  const ident_id = idOf('idents', 'i1')
  const ReviewRow: Doc<'reviews'> = { _id: idOf('reviews', 'v1'), _creationTime: 3, quiz_id, ident_id, overall: '', phase: 'draft' }
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
