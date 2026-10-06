import { describe, expect, it } from 'vitest'
import * as LLSmithExport from '../../src/lib/ll-smith-export'
import { Question, type QuestionT } from '../../src/models/question'
import { DefaultQ1Preamble, Quiz, type QuizT } from '../../src/models/quiz'

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

  it('puts the lead ahead of the body, and makes the two safe together', () => {
    const record = LLSmithExport.recordOf(qn({ clueing: '$5 | what?' }), { ...placed({ rank: 1 }), lead: 'Costs $' })
    expect(record).to.eq('1|Costs $[i][/i]$5 ¦ what?||')
  })
})

describe('leadOf', () => {
  const quiz = { smiths_note: 'Theme: *princes*.\n\nMeta: | initials.', q1_preamble: 'See the **note**![br][br]' }

  it('is nothing when plain', () => {
    expect(LLSmithExport.leadOf(quiz, 'plain')).to.eq('')
  })

  it("is the whole smith's note in BBCode, then a blank line, when playtesting", () => {
    expect(LLSmithExport.leadOf(quiz, 'playtesting')).to.eq('Theme: [i]princes[/i]. [br]  [br] Meta: | initials. [br]  [br] ')
  })

  it("is nothing when playtesting a quiz with no smith's note", () => {
    expect(LLSmithExport.leadOf({ ...quiz, smiths_note: '' }, 'playtesting')).to.eq('')
  })

  it('is the preamble in BBCode when going live', () => {
    expect(LLSmithExport.leadOf(quiz, 'go_live')).to.eq('See the [b]note[/b]![br][br]')
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

  it("leaves the archived questions out in every mode, numbering the rest from 1 with no gaps", () => {
    const questions = [qn({ qnum: '1', clueing: 'First' }), qn({ qnum: '2', clueing: 'Put away', viz: 'archived' }), qn({ qnum: '3', clueing: 'Third' })]
    for (const mode of LLSmithExport.ExportModes) {
      expect(LLSmithExport.recordsOf({ ...quizOf(questions), smiths_note: '', q1_preamble: '' }, mode), mode).to.eq('1|First||$$2|Third||$$')
    }
  })

  it("keeps the alternates when playtesting, unmarked, and after their peers of one Q#; and leaves them out going live", () => {
    const questions = [qn({ qnum: '1', title: 'aa', clueing: 'Alternate', viz: 'secondary' }), qn({ qnum: '1', title: 'zz', clueing: 'First' }), qn({ qnum: '2', clueing: 'Second' })]
    const quiz = { ...quizOf(questions), smiths_note: '', q1_preamble: '' }
    expect(LLSmithExport.recordsOf(quiz, 'playtesting')).to.eq('1|First||$$2|Alternate||$$3|Second||$$')
    expect(LLSmithExport.recordsOf(quiz, 'plain')).to.eq('1|First||$$2|Alternate||$$3|Second||$$')
    expect(LLSmithExport.recordsOf(quiz, 'go_live')).to.eq('1|First||$$2|Second||$$')
  })

  it("still shows the BUT NOT of a chain to a question left out", () => {
    const putAway = qn({ qnum: '2', clueing: 'Put away', hint: 'Not that one', viz: 'archived' })
    const first = qn({ qnum: '1', clueing: 'First', chains_to: putAway._id })
    expect(LLSmithExport.recordsOf(quizOf([first, putAway]))).to.eq('1|First [br]  [br] ...BUT NOT... [br]  [br] Not that one||$$')
  })

  it("reads exportedIn's example: going live, the normal questions alone", () => {
    const questions = [qn({ viz: 'normal' }), qn({ viz: 'secondary' }), qn({ viz: 'archived' })]
    expect(LLSmithExport.exportedIn(questions, 'go_live').map((question) => question.viz)).to.deep.eq(['normal'])
    expect(LLSmithExport.exportedIn(questions, 'playtesting').map((question) => question.viz)).to.deep.eq(['normal', 'secondary'])
  })

  it('is plain unless told otherwise', () => {
    const quiz = { ...quizOf([qn({ qnum: '1', clueing: 'First' })]), smiths_note: 'Theme.' }
    expect(LLSmithExport.recordsOf(quiz)).to.eq(LLSmithExport.recordsOf(quiz, 'plain'))
  })

  it("puts the smith's note ahead of the lowest-ranked question alone when playtesting, its pipes made safe", () => {
    const questions = [qn({ qnum: '2', clueing: 'Second' }), qn({ qnum: '', clueing: 'Draft' }), qn({ qnum: '1', clueing: 'First' })]
    const quiz = { ...quizOf(questions), smiths_note: 'Theme: a | b.' }
    expect(LLSmithExport.recordsOf(quiz, 'playtesting')).to.eq('1|Theme: a ¦ b. [br]  [br] First||$$2|Second||$$|Draft||$$')
  })

  it('puts the preamble ahead of the lowest-ranked question alone when going live, the default one at first', () => {
    const questions = [qn({ qnum: '2', clueing: 'Second' }), qn({ qnum: '1', clueing: 'First' })]
    expect(LLSmithExport.recordsOf(quizOf(questions), 'go_live')).to.eq(`1|${DefaultQ1Preamble}First||$$2|Second||$$`)
  })

  it('puts the lead ahead of the first unranked question when no question has a Q#', () => {
    const quiz = { ...quizOf([qn({ qnum: '', clueing: 'Draft' })]), q1_preamble: 'Read![br]' }
    expect(LLSmithExport.recordsOf(quiz, 'go_live')).to.eq('|Read![br]Draft||$$')
  })
})
