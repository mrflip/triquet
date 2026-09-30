import { describe, expect, it } from 'vitest'
import * as LLSmithExport from '../../src/lib/ll-smith-export'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'

/** A question with the given fields and nothing else written */
const qn = (fields: Partial<QuestionT>): QuestionT => ({ ...Question.blank(), ...fields })

const FieldCases: [string, string, string][] = [
  // dollars:
  ["$$",                        "$[i][/i]$",                          'two dollars are fenced apart'],
  ["$$$",                       "$[i][/i]$[i][/i]$",                  'a run of three leaves no two touching'],
  ["costs $5 or $10",           "costs $5 or $10",                    'a lone dollar sign is left alone'],
  // pipes:
  ["this | that",               "this ¦ that",                        'a pipe becomes a broken bar'],
  ["||",                        "¦¦",                                 'every pipe becomes one'],
  // with the BBCode translation:
  ["**Who** wrote\n*Hamlet*?",  "[b]Who[/b] wrote [br] [i]Hamlet[/i]?", 'emphasis and line breaks are translated as LLBBCode does'],
  ["*$*$ |\n| $",               "[i]$[/i]$ ¦ [br] ¦ $",               'the escaping looks at the translated text'],
  // trivial cases:
  ["",                          "",                                   'empty text stays empty'],
]

describe('fieldTextOf', () => {
  for (const [text, expected, blurb] of FieldCases) {
    it(blurb, () => {
      expect(LLSmithExport.fieldTextOf(text)).to.eq(expected)
    })
  }
})

describe('bodyOf', () => {
  it("sandwiches the chained-to question's hint below the clueing", () => {
    expect(LLSmithExport.bodyOf(qn({ clueing: 'Who?' }), qn({ hint: 'Not him' }))).to.eq('Who?\n\n...BUT NOT...\n\nNot him')
  })

  it('is just the clueing when the question is unchained', () => {
    expect(LLSmithExport.bodyOf(qn({ clueing: 'Who?', hint: 'its own hint' }), null)).to.eq('Who?')
  })

  it('is just the clueing when the chained-to question has no hint yet', () => {
    expect(LLSmithExport.bodyOf(qn({ clueing: 'Who?' }), qn({ hint: '' }))).to.eq('Who?')
  })
})

/** Where a question sits: unchained and unranked, unless told otherwise */
const placed = (fields: { target?: QuestionT, rank?: number } = {}) => ({ target: fields.target ?? null, rank: fields.rank ?? null })

describe('recordOf', () => {
  it('is rank, body, full answer and notes, joined by pipes', () => {
    const question = qn({ clueing: 'Who?', full_answer: 'Me', notes: 'n.b.', title: 'unused', qnum: '7' })
    expect(LLSmithExport.recordOf(question, placed({ rank: 3 }))).to.eq('3|Who?|Me|n.b.')
  })

  it('leaves the alt text out, as the league sheet does', () => {
    expect(LLSmithExport.recordOf(qn({ clueing: 'Who?', alt_text: 'skipped' }), placed({ rank: 1 }))).to.eq('1|Who?||')
  })

  it('leaves the number blank for a question with no rank', () => {
    expect(LLSmithExport.recordOf(qn({ clueing: 'Who?' }), placed())).to.eq('|Who?||')
  })

  it('fences a dollar at the end of a record from the $$ that follows it', () => {
    expect(LLSmithExport.recordOf(qn({ clueing: 'Who?', notes: 'paid in $' }), placed({ rank: 1 }))).to.eq('1|Who?||paid in $[i][/i]')
  })

  it('needs no fence for a dollar at the start of the body, which the number keeps from the $$ before it', () => {
    expect(LLSmithExport.recordOf(qn({ clueing: '$5 is how much?' }), placed({ rank: 1 }))).to.eq('1|$5 is how much?||')
  })

  it('converts every field, the body included', () => {
    const question = qn({ clueing: '**Who**\nthen?', full_answer: 'A | B', notes: 'x\ny' })
    const record = LLSmithExport.recordOf(question, placed({ target: qn({ hint: '*not*' }), rank: 2 }))
    expect(record).to.eq('2|[b]Who[/b] [br] then? [br]  [br] ...BUT NOT... [br]  [br] [i]not[/i]|A ¦ B|x [br] y')
  })
})

/** A quiz holding just `questions` */
const quizOf = (questions: QuestionT[]): QuizT => ({ ...Quiz.blank('League'), questions })

describe('recordsOf', () => {
  it('is one record per question, each followed by $$, in rank order', () => {
    const questions = [qn({ qnum: '2', clueing: 'Second' }), qn({ qnum: '1', clueing: 'First' })]
    expect(LLSmithExport.recordsOf(quizOf(questions))).to.eq('1|First||$$2|Second||$$')
  })

  it('numbers by rank, not by the Q# as typed', () => {
    const questions = [qn({ qnum: '10', clueing: 'Ten' }), qn({ qnum: '3.5', clueing: 'Three and a half' }), qn({ qnum: '3', clueing: 'Three' })]
    expect(LLSmithExport.recordsOf(quizOf(questions))).to.eq('1|Three||$$2|Three and a half||$$3|Ten||$$')
  })

  it('puts the questions with no Q# last, unnumbered, as Renumber leaves them', () => {
    const questions = [qn({ qnum: '', clueing: 'Draft' }), qn({ qnum: '5', clueing: 'Only' }), qn({ qnum: '', clueing: 'Sketch' })]
    expect(LLSmithExport.recordsOf(quizOf(questions))).to.eq('1|Only||$$|Draft||$$|Sketch||$$')
  })

  it('finds each BUT NOT by following the chain', () => {
    const second = qn({ qnum: '2', clueing: 'Second', hint: 'Not the second' })
    const first = qn({ qnum: '1', clueing: 'First', chains_to: second._id })
    expect(LLSmithExport.recordsOf(quizOf([first, second]))).to.eq('1|First [br]  [br] ...BUT NOT... [br]  [br] Not the second||$$2|Second||$$')
  })

  it('shows no BUT NOT for a chain whose target is gone', () => {
    const dangling = qn({ qnum: '1', clueing: 'Alone', chains_to: 'nobody' })
    expect(LLSmithExport.recordsOf(quizOf([dangling]))).to.eq('1|Alone||$$')
  })

  it('is empty for a quiz with no questions', () => {
    expect(LLSmithExport.recordsOf(quizOf([]))).to.eq('')
  })
})
