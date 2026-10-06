import { describe, expect, it } from 'vitest'
import * as Recap from '../../src/lib/recap'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { Widget } from '../../src/models/widget'
import { Widgeting } from '../../src/models/widgeting'
import type { StoredWidgetedT, WidgetedHistoryT } from '../../src/models/widgeted'
import { runOf } from '../support/runs'

/** A typed cell holding `value` */
function typed(value: string | number): WidgetedHistoryT {
  const row: StoredWidgetedT = { status: 'ok', value, message: null, result_meta: {}, _creationTime: 3.5 }
  return { newest: row, ok: row }
}

/** One question with the fields given */
function questionWith(patch: Partial<QuestionT>): QuestionT {
  return { ...Question.blank(), ...patch }
}

/** The library the quizzes below work: a text entry and a number entry */
const Library = [
  Widget.fill({ label: 'authors', formulary: 'entry', config: { entry_kind: 'text' } }),
  Widget.fill({ label: 'tallies', formulary: 'entry', config: { entry_kind: 'number' } }),
]

/** A quiz of `questions` and nothing else, its recap head and tail as given */
function quizOf(questions: QuestionT[], patch: Partial<QuizT> = {}): QuizT {
  return { ...Quiz.blank('Recapped'), questions, ...patch }
}

/** The recap of `quiz`, run over the library above */
function recapOf(quiz: QuizT): string {
  return Recap.bbjankOf(quiz, runOf(quiz, Library))
}

const hamilton = questionWith({ title: 'Ham', qnum: '1', clueing: 'Who?', full_answer: 'HAMILTON' })

describe('Recap.bbjankOf', () => {
  it("writes the doc block's example: the head, a rule, then the question's block", () => {
    expect(recapOf(quizOf([hamilton], { recap_head: 'Thanks!' }))).to.eq([
      'Thanks!',
      '----------------------------------------',
      '',
      '[quote="Q1"]1. Who?[/quote]',
      '',
      'Answer: [spoiler][b]HAMILTON[/b][/spoiler]',
      'Correct Answer %:',
    ].join('\n'))
  })

  it('writes the head, every question in rank order, then the tail, each a blank line apart', () => {
    const second = questionWith({ title: 'Ent', qnum: '2', clueing: '**What name**?', full_answer: 'ENTERPRISE', recap: 'Everyone got it.' })
    const quiz = quizOf([second, hamilton], { recap_head: 'First, *thanks*.', recap_tail: 'See you next season.' })
    expect(recapOf(quiz)).to.eq([
      'First, [i]thanks[/i].',
      '----------------------------------------',
      '',
      '[quote="Q1"]1. Who?[/quote]',
      '',
      'Answer: [spoiler][b]HAMILTON[/b][/spoiler]',
      'Correct Answer %:',
      '',
      '[quote="Q2"]2. [b]What name[/b]?[/quote]',
      '',
      'Answer: [spoiler][b]ENTERPRISE[/b][/spoiler]',
      'Correct Answer %:',
      'Everyone got it.',
      '',
      'See you next season.',
    ].join('\n'))
  })

  it('fills the head and tail in as templates over the quiz', () => {
    const quiz = quizOf([], { recap_head: 'The recap of {{quiz.title}}', recap_tail: '{{#qns}}{{title}} {{/qns}}' })
    expect(recapOf(quiz)).to.eq('The recap of Recapped')
  })

  it('leaves a head or tail that cannot be filled in as typed', () => {
    expect(recapOf(quizOf([], { recap_head: 'Broken {{#qns}}' }))).to.eq('Broken {{#qns}}')
  })

  it('fills in the fields the quiz templates, and leaves the rest as typed', () => {
    const question = questionWith({ qnum: '1', clueing: 'By {{qn.author}}', recap: 'Ask {{qn.author}}', stored: { author: typed('Ada') } })
    const quiz = quizOf([question], {
      widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' })],
      templated:  ['question.recap'],
    })
    expect(recapOf(quiz)).to.contain('1. By {{qn.author}}[/quote]').and.to.contain('\nAsk Ada')
  })

  it('leaves out archived questions and alternates, numbering the rest from 1 without gaps', () => {
    const archived = questionWith({ qnum: '1', clueing: 'Put away', viz: 'archived' })
    const alternate = questionWith({ qnum: '2', clueing: 'Spare', viz: 'secondary' })
    const played = questionWith({ qnum: '3', clueing: 'Played' })
    const recap = recapOf(quizOf([archived, alternate, played]))
    expect(recap).to.contain('[quote="Q1"]1. Played[/quote]')
    expect(recap).not.to.contain('Put away')
    expect(recap).not.to.contain('Spare')
  })

  it('leaves out a question never written into, as a fresh quiz holds several', () => {
    const quiz = quizOf([Question.blank(), hamilton, Question.blank()])
    expect(recapOf(quiz)).to.match(/^\[quote="Q1"\]1\. Who\?\[\/quote\]\n\nAnswer: \[spoiler\]\[b\]HAMILTON\[\/b\]\[\/spoiler\]\nCorrect Answer %:$/)
  })

  it('numbers a question with no Q# after the ranked ones', () => {
    const unranked = questionWith({ qnum: '', clueing: 'Unranked' })
    expect(recapOf(quizOf([unranked, hamilton]))).to.contain('[quote="Q2"]2. Unranked[/quote]')
  })

  it("quotes a question's BUT NOT, the hint of the question it chains to, below its clueing", () => {
    const target = questionWith({ qnum: '2', clueing: 'Ship?', hint: "Tubbs' partner" })
    const chained = questionWith({ qnum: '1', clueing: 'What name?', chains_to: target._id })
    expect(recapOf(quizOf([chained, target]))).to.contain("[quote=\"Q1\"]1. What name?\n\n...BUT NOT...\n\nTubbs' partner[/quote]")
  })

  it('reads the correct-answer share from a column whose label says it is one', () => {
    const question = questionWith({ qnum: '1', clueing: 'Who?', stored: { correct_pct: typed(76) } })
    const quiz = quizOf([question], { widgetings: [Widgeting.fill({ label: 'correct_pct', widget_label: 'tallies' })] })
    expect(recapOf(quiz)).to.contain('\nCorrect Answer %: 76')
  })

  it('reads no share from a column whose label does not say so', () => {
    const question = questionWith({ qnum: '1', clueing: 'Who?', stored: { tally: typed(76) } })
    const quiz = quizOf([question], { widgetings: [Widgeting.fill({ label: 'tally', widget_label: 'tallies' })] })
    expect(recapOf(quiz)).to.match(/\nCorrect Answer %:$/)
  })

  it('writes the head with no rule when there are no questions to set it apart from', () => {
    expect(recapOf(quizOf([], { recap_head: 'Thanks!', recap_tail: 'Bye.' }))).to.eq('Thanks!\n\nBye.')
  })

  it('comes to nothing for a quiz with nothing to recap', () => {
    expect(recapOf(quizOf([]))).to.eq('')
  })

  it('writes HTML in a head as the characters typed, never as markup', () => {
    expect(recapOf(quizOf([], { recap_head: '<script>alert(1)</script>' }))).to.eq('<script>alert(1)</script>')
  })
})

describe('Recap.blockOf', () => {
  it("writes the doc block's example", () => {
    const question = questionWith({ clueing: 'Who?', full_answer: 'HAMILTON', recap: 'Aced.' })
    expect(Recap.blockOf(question, { number: 1, target: null, pct: '76' })).to.eq('[quote="Q1"]1. Who?[/quote]\n\nAnswer: [spoiler][b]HAMILTON[/b][/spoiler]\nCorrect Answer %: 76\nAced.')
  })

  it("folds an answer's lines into one, so its spoiler stays whole", () => {
    const question = questionWith({ full_answer: 'HAMILTON\n\n(accept ROWAN)\n' })
    expect(Recap.blockOf(question, { number: 1, target: null, pct: '' })).to.contain('Answer: [spoiler][b]HAMILTON (accept ROWAN)[/b][/spoiler]')
  })

  it.each([
    ['1984.',               '1984.'],
    ['2. Bob',              '2. Bob'],
    ['- HAMILTON\n- ALEX',  '- HAMILTON - ALEX'],
    ['> HAMILTON',          '> HAMILTON'],
    ['---',                 '---'],
    ['[x]: https://ex.com', '[x]: [url]https://ex.com[/url]'],
  ])('writes an answer opening %j as typed, never as a list, quote, rule or definition', (fullAnswer, expected) => {
    const question = questionWith({ full_answer: fullAnswer })
    expect(Recap.blockOf(question, { number: 1, target: null, pct: '' })).to.contain(`Answer: [spoiler][b]${expected}[/b][/spoiler]`)
  })

  it('writes an answer\'s own emphasis inside the bold', () => {
    const question = questionWith({ full_answer: '*Hamlet*' })
    expect(Recap.blockOf(question, { number: 3, target: null, pct: '' })).to.contain('Answer: [spoiler][b][i]Hamlet[/i][/b][/spoiler]')
  })

  it("keeps a clueing's indented verse a quote within the question's quote, and its link a link", () => {
    const question = questionWith({ clueing: 'Who wrote\n    *verse*\n[Click here](https://ex.com/a.png)' })
    expect(Recap.blockOf(question, { number: 2, target: null, pct: '' })).to.match(/^\[quote="Q2"\]2\. Who wrote\n\[list\]\[i\]verse\[\/i\]\[\/list\]\n\[url=https:\/\/ex\.com\/a\.png\]Click here\[\/url\]\[\/quote\]/)
  })

  it("writes a multi-paragraph recap as its paragraphs", () => {
    const question = questionWith({ recap: 'First.\n\nSecond, with a [link](https://ex.com).' })
    expect(Recap.blockOf(question, { number: 1, target: null, pct: '' })).to.match(/Correct Answer %:\nFirst\.\n\nSecond, with a \[url=https:\/\/ex\.com\]link\[\/url\]\.$/)
  })

  it('writes a link off the web as its text alone', () => {
    const question = questionWith({ recap: '[click](javascript:alert(1))' })
    expect(Recap.blockOf(question, { number: 1, target: null, pct: '' })).to.match(/\nclick$/)
  })
})

describe('Recap.CorrectPctRE', () => {
  const Cases: [string, boolean][] = [
    ["correct_pct",            true],
    ["correct_percent",        true],
    ["correct_answer_pct",     true],
    ["correct_answer_percent", true],
    ["pct_correct",            true],
    ["percent_correct",        true],
    ["correct",                false],
    ["correct_answer",         false],
    ["pct",                    false],
    ["my_correct_pct",         false],
  ]
  for (const [label, expected] of Cases) {
    it(`${expected ? 'takes' : 'passes over'} a column labelled ${label}`, () => {
      expect(Recap.CorrectPctRE.test(label)).to.eq(expected)
    })
  }
})
