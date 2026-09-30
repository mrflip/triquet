import { describe, expect, it } from 'vitest'
import * as LLExport from '../../src/lib/ll-export'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'

/** A question with the given fields and nothing else written */
const qn = (fields: Partial<QuestionT>): QuestionT => ({ ...Question.blank(), ...fields })

const EmphasisCases: [string, string, string][] = [
  // regular usage:
  ["**bold**",                  "[b]bold[/b]",                        'double asterisks are bold'],
  ["__bold__",                  "[b]bold[/b]",                        'double underscores are bold too'],
  ["*italic*",                  "[i]italic[/i]",                      'single asterisks are italic'],
  ["_italic_",                  "[i]italic[/i]",                      'single underscores are italic too'],
  ["Name **WHAT** it is",       "Name [b]WHAT[/b] it is",             'the text around the emphasis is untouched'],
  // bold-italics and italics-bold:
  ["***both***",                "[i][b]both[/b][/i]",                 'three asterisks are italic around bold, as markdown nests them'],
  ["**_both_**",                "[b][i]both[/i][/b]",                 'italic inside bold closes before the bold does'],
  ["_**both**_",                "[i][b]both[/b][/i]",                 'bold inside italic closes before the italic does'],
  ["*__both__*",                "[i][b]both[/b][/i]",                 'underscore bold inside asterisk italic'],
  ["**bold *both* bold**",      "[b]bold [i]both[/i] bold[/b]",       'italics partway through a bold run'],
  ["*it **both** it*",          "[i]it [b]both[/b] it[/i]",           'bold partway through an italic run'],
  ["***both** italic*",         "[i][b]both[/b] italic[/i]",          'bold closing before the italic around it'],
  ["***both* bold**",           "[b][i]both[/i] bold[/b]",            'italic closing before the bold around it'],
  // what markdown does not call emphasis:
  ["4 * 5 * 6",                 "4 * 5 * 6",                          'an asterisk with space on both sides is arithmetic, not emphasis'],
  ["snake_case_word",           "snake_case_word",                    'underscores inside a word are not emphasis'],
  ["**unclosed",                "**unclosed",                         'an unclosed marker is left as written'],
  ["`*code*`",                  "`*code*`",                           'a code span is left as written'],
  [String.raw`\*not\*`,         String.raw`\*not\*`,                  'escaped asterisks are left as written, backslashes and all'],
  // the rest of the text survives verbatim:
  ["> *verse*\n> **bold**",     "> [i]verse[/i]\n> [b]bold[/b]",      'emphasis inside a quoted block converts, and the quote marks stay'],
  ["[b]Already[/b] **new**",    "[b]Already[/b] [b]new[/b]",          'bbcode already in the text is left alone'],
  ["# Heading *it*",            "# Heading [i]it[/i]",                'a line that markdown reads as a heading keeps its hash'],
  // trivial cases:
  ["",                          "",                                   'empty text stays empty'],
  ["plain",                     "plain",                              'text without emphasis is untouched'],
  // weird cases:
  ["*Léon* **千**",              "[i]Léon[/i] [b]千[/b]",              'non-Latin text keeps its place around the tags'],
]

describe('emphasisToBbcode', () => {
  for (const [text, expected, blurb] of EmphasisCases) {
    it(blurb, () => {
      expect(LLExport.emphasisToBbcode(text)).to.eq(expected)
    })
  }
})

const FieldCases: [string, string, string][] = [
  // line breaks:
  ["two\nlines",                "two [br] lines",                     'a line break becomes a spaced [br]'],
  ["two\r\nlines",              "two [br] lines",                     'a Windows line break counts once, not twice'],
  ["para\n\npara",              "para [br]  [br] para",               'a blank line is two breaks'],
  // dollars:
  ["$$",                        "$[i][/i]$",                          'two dollars are fenced apart'],
  ["$$$",                       "$[i][/i]$[i][/i]$",                  'a run of three leaves no two touching'],
  ["costs $5 or $10",           "costs $5 or $10",                    'a lone dollar sign is left alone'],
  // pipes:
  ["this | that",               "this ¦ that",                   'a pipe becomes a broken bar'],
  ["||",                        "¦¦",                       'every pipe becomes one'],
  // together:
  ["**Who** wrote\n*Hamlet*?",  "[b]Who[/b] wrote [br] [i]Hamlet[/i]?", 'emphasis and line breaks convert together'],
  ["**a\nb**",                  "[b]a [br] b[/b]",                    'emphasis spanning a line break converts before the break does'],
  ["[b]x[/b] [br] $5",          "[b]x[/b] [br] $5",                   'bbcode already in the text is left alone'],
  // trivial cases:
  ["",                          "",                                   'empty text stays empty'],
]

describe('fieldTextOf', () => {
  for (const [text, expected, blurb] of FieldCases) {
    it(blurb, () => {
      expect(LLExport.fieldTextOf(text)).to.eq(expected)
    })
  }
})

describe('bodyOf', () => {
  it("sandwiches the chained-to question's hint below the clueing", () => {
    expect(LLExport.bodyOf(qn({ clueing: 'Who?' }), qn({ hint: 'Not him' }))).to.eq('Who?\n\n...BUT NOT...\n\nNot him')
  })

  it('is just the clueing when the question is unchained', () => {
    expect(LLExport.bodyOf(qn({ clueing: 'Who?', hint: 'its own hint' }), null)).to.eq('Who?')
  })

  it('is just the clueing when the chained-to question has no hint yet', () => {
    expect(LLExport.bodyOf(qn({ clueing: 'Who?' }), qn({ hint: '' }))).to.eq('Who?')
  })
})

/** Where a question sits: unchained and unranked, unless told otherwise */
const placed = (fields: { target?: QuestionT, rank?: number } = {}) => ({ target: fields.target ?? null, rank: fields.rank ?? null })

describe('recordOf', () => {
  it('is rank, body, full answer and notes, joined by pipes', () => {
    const question = qn({ clueing: 'Who?', full_answer: 'Me', notes: 'n.b.', title: 'unused', qnum: '7' })
    expect(LLExport.recordOf(question, placed({ rank: 3 }))).to.eq('3|Who?|Me|n.b.')
  })

  it('leaves the alt text out, as the league sheet does', () => {
    expect(LLExport.recordOf(qn({ clueing: 'Who?', alt_text: 'skipped' }), placed({ rank: 1 }))).to.eq('1|Who?||')
  })

  it('leaves the number blank for a question with no rank', () => {
    expect(LLExport.recordOf(qn({ clueing: 'Who?' }), placed())).to.eq('|Who?||')
  })

  it('fences a dollar at the end of a record from the $$ that follows it', () => {
    expect(LLExport.recordOf(qn({ clueing: 'Who?', notes: 'paid in $' }), placed({ rank: 1 }))).to.eq('1|Who?||paid in $[i][/i]')
  })

  it('needs no fence for a dollar at the start of the body, which the number keeps from the $$ before it', () => {
    expect(LLExport.recordOf(qn({ clueing: '$5 is how much?' }), placed({ rank: 1 }))).to.eq('1|$5 is how much?||')
  })

  it('converts every field, the body included', () => {
    const question = qn({ clueing: '**Who**\nthen?', full_answer: 'A | B', notes: 'x\ny' })
    const record = LLExport.recordOf(question, placed({ target: qn({ hint: '*not*' }), rank: 2 }))
    expect(record).to.eq('2|[b]Who[/b] [br] then? [br]  [br] ...BUT NOT... [br]  [br] [i]not[/i]|A ¦ B|x [br] y')
  })
})

/** A quiz holding just `questions` */
const quizOf = (questions: QuestionT[]): QuizT => ({ ...Quiz.blank('League'), questions })

describe('llExport', () => {
  it('is one record per question, each followed by $$, in rank order', () => {
    const questions = [qn({ qnum: '2', clueing: 'Second' }), qn({ qnum: '1', clueing: 'First' })]
    expect(LLExport.llExport(quizOf(questions))).to.eq('1|First||$$2|Second||$$')
  })

  it('numbers by rank, not by the Q# as typed', () => {
    const questions = [qn({ qnum: '10', clueing: 'Ten' }), qn({ qnum: '3.5', clueing: 'Three and a half' }), qn({ qnum: '3', clueing: 'Three' })]
    expect(LLExport.llExport(quizOf(questions))).to.eq('1|Three||$$2|Three and a half||$$3|Ten||$$')
  })

  it('puts the questions with no Q# last, unnumbered, as Renumber leaves them', () => {
    const questions = [qn({ qnum: '', clueing: 'Draft' }), qn({ qnum: '5', clueing: 'Only' }), qn({ qnum: '', clueing: 'Sketch' })]
    expect(LLExport.llExport(quizOf(questions))).to.eq('1|Only||$$|Draft||$$|Sketch||$$')
  })

  it('finds each BUT NOT by following the chain', () => {
    const second = qn({ qnum: '2', clueing: 'Second', hint: 'Not the second' })
    const first = qn({ qnum: '1', clueing: 'First', chains_to: second._id })
    expect(LLExport.llExport(quizOf([first, second]))).to.eq('1|First [br]  [br] ...BUT NOT... [br]  [br] Not the second||$$2|Second||$$')
  })

  it('shows no BUT NOT for a chain whose target is gone', () => {
    const dangling = qn({ qnum: '1', clueing: 'Alone', chains_to: 'nobody' })
    expect(LLExport.llExport(quizOf([dangling]))).to.eq('1|Alone||$$')
  })

  it('is empty for a quiz with no questions', () => {
    expect(LLExport.llExport(quizOf([]))).to.eq('')
  })
})
