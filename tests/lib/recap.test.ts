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

/** The widgeting a quiz's correct-answer shares are typed into */
const CorrectPct = Widgeting.fill({ label: 'correct_pct', widget_label: 'tallies' })

/** A quiz of `questions` and nothing else, its recap head and tail as given */
function quizOf(questions: QuestionT[], patch: Partial<QuizT> = {}): QuizT {
  return { ...Quiz.blank('Recapped'), questions, ...patch }
}

/** The recap note of `quiz`, run over the library above */
function noteOf(quiz: QuizT): Recap.RecapNoteT {
  return Recap.noteOf(quiz, runOf(quiz, Library))
}

/** The recap of `quiz` in bbjank */
function recapOf(quiz: QuizT): string {
  return noteOf(quiz).bbjank
}

/** The recap of a quiz holding one question, `Who?` unless patched */
function recapOfOne(patch: Partial<QuestionT>, quizPatch: Partial<QuizT> = {}): string {
  return recapOf(quizOf([questionWith({ qnum: '1', clueing: 'Who?', ...patch })], quizPatch))
}

const hamilton = questionWith({ title: 'Ham', qnum: '1', clueing: 'Who?', full_answer: 'HAMILTON' })

/**
 * A quiz with something of everything the recap writes. `EverythingNote` is its note as the recap
 * written in code wrote it (each text converted on its own, the frame written in bbjank around
 * it), which the default template is held to -- but for each question's own hint, after
 * `...OR ELSE...`, where the code wrote the chained-to question's after `...BUT NOT...`.
 */
function everythingQuiz(): QuizT {
  const target = questionWith({ qnum: '3', title: 'Ship', clueing: '**What name** will be borne by CVN-80?\nIt is storied.', hint: "Tubbs' Ferrari-driving partner", full_answer: 'ENTERPRISE\n(USS ENTERPRISE)', stored: { correct_pct: typed(76) } })
  const chained = questionWith({ qnum: '1', title: 'Ham', clueing: 'Who wrote\n    *verse*', hint: 'Not *the* one\nof the stage', full_answer: '(WILLIAM ROWAN) HAMILTON', chains_to: target._id, recap: 'Everyone got it.\n\nSee [the image](https://ex.com/a.png).' })
  const plain = questionWith({ qnum: '2', title: 'Plain', clueing: 'By {{qn.author}}, a ~50 year ~~old~~ thing.', full_answer: 'ADA', stored: { author: typed('Ada') } })
  return quizOf([target, plain, chained, Question.blank()], {
    widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' }), CorrectPct],
    templated:  ['question.clueing'],
    recap_head: 'The recap of *{{quiz.title}}*.\n\nThanks to all.',
    recap_tail: 'See you next season.',
  })
}
const EverythingNote = "The recap of [i]Recapped[/i].\n\nThanks to all.\n----------------------------------------\n\n[quote=\"Q1\"]1. Who wrote\n[list][i]verse[/i][/list]\n\n...OR ELSE...\n\nNot [i]the[/i] one\nof the stage[/quote]\n\nAnswer: [spoiler][b](WILLIAM ROWAN) HAMILTON[/b][/spoiler]\nCorrect Answer %:\nEveryone got it.\n\nSee [url=https://ex.com/a.png]the image[/url].\n\n[quote=\"Q2\"]2. By Ada, a ~50 year [spoiler]old[/spoiler] thing.[/quote]\n\nAnswer: [spoiler][b]ADA[/b][/spoiler]\nCorrect Answer %:\n\n[quote=\"Q3\"]3. [b]What name[/b] will be borne by CVN-80?\nIt is storied.\n\n...OR ELSE...\n\nTubbs' Ferrari-driving partner[/quote]\n\nAnswer: [spoiler][b]ENTERPRISE (USS ENTERPRISE)[/b][/spoiler]\nCorrect Answer %: 76\n\nSee you next season."

describe('Recap.noteOf, by the default template', () => {
  it("writes the note as the recap written in code did, but with each question's own hint after OR ELSE", () => {
    expect(noteOf(everythingQuiz())).to.deep.eq({ bbjank: EverythingNote, issue: null })
  })

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
    expect(recapOf(quizOf([], { recap_tail: 'Broken {{#qns}}' }))).to.eq('Broken {{#qns}}')
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
    expect(recapOf(quiz)).to.eq('[quote="Q1"]1. Who?[/quote]\n\nAnswer: [spoiler][b]HAMILTON[/b][/spoiler]\nCorrect Answer %:')
  })

  it('numbers a question with no Q# after the ranked ones', () => {
    const unranked = questionWith({ qnum: '', clueing: 'Unranked' })
    expect(recapOf(quizOf([unranked, hamilton]))).to.contain('[quote="Q2"]2. Unranked[/quote]')
  })

  it("quotes a question's own hint below its clueing, after OR ELSE, and never the hint of the question it chains to", () => {
    const target = questionWith({ qnum: '2', clueing: 'Ship?', hint: "Tubbs' partner" })
    const chained = questionWith({ qnum: '1', clueing: 'What name?', chains_to: target._id })
    const recap = recapOf(quizOf([chained, target]))
    expect(recap).to.contain('[quote="Q1"]1. What name?[/quote]')
    expect(recap).to.contain("[quote=\"Q2\"]2. Ship?\n\n...OR ELSE...\n\nTubbs' partner[/quote]")
    expect(recap).not.to.contain('BUT NOT')
  })

  it("keeps every line of a hint inside the question's quote", () => {
    expect(recapOfOne({ hint: 'Not him\n---\n# Nor her' })).to.match(/^\[quote="Q1"\]1\. Who\?\n\n\.\.\.OR ELSE\.\.\.\n\n\[b\]Not him\[\/b\]\n\[b\]Nor her\[\/b\]\[\/quote\]\n\nAnswer:/)
  })

  it('reads the correct-answer share from a column labelled correct_pct', () => {
    expect(recapOfOne({ stored: { correct_pct: typed(76) } }, { widgetings: [CorrectPct] })).to.contain('\nCorrect Answer %: 76')
  })

  it('reads no share from a column labelled anything else, however like it', () => {
    const question = questionWith({ qnum: '1', clueing: 'Who?', stored: { pct_correct: typed(76) } })
    const quiz = quizOf([question], { widgetings: [Widgeting.fill({ label: 'pct_correct', widget_label: 'tallies' })] })
    expect(recapOf(quiz)).to.match(/\nCorrect Answer %:$/)
  })

  it('writes the head with no rule when there are no questions to set it apart from', () => {
    expect(recapOf(quizOf([], { recap_head: 'Thanks!', recap_tail: 'Bye.' }))).to.eq('Thanks!\n\nBye.')
  })

  it('comes to nothing for a quiz with nothing to recap', () => {
    expect(noteOf(quizOf([]))).to.deep.eq({ bbjank: '', issue: null })
  })

  it('writes HTML in a head as the characters typed, never as markup', () => {
    expect(recapOf(quizOf([hamilton], { recap_head: '<script>alert(1)</script>' }))).to.match(/^<script>alert\(1\)<\/script>\n-+\n/)
  })

  it("folds an answer's lines into one, so its spoiler stays whole", () => {
    expect(recapOfOne({ full_answer: 'HAMILTON\n\n(accept ROWAN)\n' })).to.contain('Answer: [spoiler][b]HAMILTON (accept ROWAN)[/b][/spoiler]')
  })

  it.each([
    ['1984.',               '1984.'],
    ['2. Bob',              '2. Bob'],
    ['- HAMILTON\n- ALEX',  '- HAMILTON - ALEX'],
    ['> HAMILTON',          '> HAMILTON'],
    ['---',                 '---'],
    ['[x]: https://ex.com', '[x]: [url]https://ex.com[/url]'],
  ])('writes an answer opening %j as typed, never as a list, quote, rule or definition', (fullAnswer, expected) => {
    expect(recapOfOne({ full_answer: fullAnswer })).to.contain(`Answer: [spoiler][b]${expected}[/b][/spoiler]`)
  })

  it("writes an answer's own emphasis inside the spoiler", () => {
    expect(recapOfOne({ full_answer: '*Hamlet*' })).to.contain('Answer: [spoiler][i][b]Hamlet[/b][/i][/spoiler]')
  })

  it('writes a blank answer as no spoiler at all', () => {
    expect(recapOfOne({ full_answer: '' })).to.match(/\nAnswer:\nCorrect Answer %:$/)
  })

  it("keeps a clueing's indented verse a quote within the question's quote, and its link a link", () => {
    expect(recapOfOne({ clueing: 'Who wrote\n    *verse*\n[Click here](https://ex.com/a.png)' })).to.match(/^\[quote="Q1"\]1\. Who wrote\n\[list\]\[i\]verse\[\/i\]\[\/list\]\n\n\[url=https:\/\/ex\.com\/a\.png\]Click here\[\/url\]\[\/quote\]/)
  })

  it('keeps every line of a clueing inside its quote, whatever the line opens with', () => {
    expect(recapOfOne({ clueing: 'Who?\n---\n# Not a heading' })).to.match(/^\[quote="Q1"\]\[b\]1\. Who\?\[\/b\]\n\[b\]Not a heading\[\/b\]\[\/quote\]\n\nAnswer:/)
  })

  it('keeps the number of a clueing that opens like a numbered list', () => {
    expect(recapOfOne({ clueing: '1984. Who wrote it?' })).to.contain('[quote="Q1"]1. 1984. Who wrote it?[/quote]')
  })

  it('opens a clueing that opens with verse on the line below its number', () => {
    expect(recapOfOne({ clueing: '    Shall I compare thee\nWho?' })).to.match(/^\[quote="Q1"\]1\.\n\[list\]Shall I compare thee\[\/list\]\n\nWho\?\[\/quote\]/)
  })

  it("finds a reference link's definition inside the clueing's quote", () => {
    expect(recapOfOne({ clueing: 'See [the map][m].\n\n[m]: https://ex.com/map' })).to.contain('See [url=https://ex.com/map]the map[/url].')
  })

  it("writes a multi-paragraph recap as its paragraphs", () => {
    expect(recapOfOne({ recap: 'First.\n\nSecond, with a [link](https://ex.com).' })).to.match(/Correct Answer %:\nFirst\.\n\nSecond, with a \[url=https:\/\/ex\.com\]link\[\/url\]\.$/)
  })

  it('writes a recap opening with a rule as a rule, never turning the line above into a heading', () => {
    expect(recapOfOne({ recap: '---\nAfter.' })).to.match(/\nCorrect Answer %:\n\n-{40}\nAfter\.$/)
  })

  it('writes a link off the web as its text alone', () => {
    expect(recapOfOne({ recap: '[click](javascript:alert(1))' })).to.match(/\nclick$/)
  })
})

describe("Recap.noteOf, by a template of the quiz's own", () => {
  it('fills it in over the recap bag, then writes it in bbjank whole', () => {
    const quiz = quizOf([hamilton], { recap_head: 'Hi *all*', recap_template: '{{recap_head}}\n\n{{#played}}- **Q{{number}}** {{title}}: {{oneline.full_answer}}\n{{/played}}' })
    expect(recapOf(quiz)).to.eq('Hi [i]all[/i]\n\n[list]\n[*] [b]Q1[/b] Ham: HAMILTON[/list]')
  })

  it('reads every widgeting of a question played, as a field template does', () => {
    const question = questionWith({ qnum: '1', clueing: 'Who?', stored: { author: typed('Ada') } })
    const quiz = quizOf([question], { widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' })], recap_template: '{{#played}}By {{author}} for {{quiz.title}}{{/played}}' })
    expect(recapOf(quiz)).to.eq('By Ada for Recapped')
  })

  it('writes a template that will not fill in as typed, and says why', () => {
    expect(noteOf(quizOf([hamilton], { recap_template: '{{#played}}{{number}}' }))).to.deep.eq({ bbjank: '{{#played}}{{number}}', issue: 'Unclosed section "played" at 21' })
  })

  it('fills a value holding markdown or HTML in before the parser, so the writer reads it last', () => {
    const quiz = quizOf([questionWith({ qnum: '1', clueing: '<img src=x onerror=alert(1)> **bold**' })], { recap_template: '{{#played}}{{clueing}}{{/played}}' })
    expect(recapOf(quiz)).to.eq('<img src=x onerror=alert(1)> [b]bold[/b]')
  })
})

describe('Recap.bagOf', () => {
  it('shapes each of a question\'s own fields for each fragile place, keyed by the field', () => {
    const quiz = quizOf([questionWith({ qnum: '1', clueing: 'Who?\nWhen?', hint: 'Not him', full_answer: 'HAMILTON\n(ROWAN)', recap: '---\nAced.' })])
    const [played] = Recap.bagOf(quiz, runOf(quiz, Library)).played
    expect(played?.quoted).to.deep.include({ clueing: 'Who?\n> When?', hint: 'Not him' })
    expect(played?.oneline).to.deep.include({ full_answer: 'HAMILTON (ROWAN)' })
    expect(played?.below).to.deep.include({ recap: '\n---\nAced.' })
  })
})

describe('Recap.templateOf', () => {
  it("is the quiz's own template, or the default", () => {
    expect(Recap.templateOf({ recap_template: 'Mine' })).to.eq('Mine')
    expect(Recap.templateOf({})).to.eq(Recap.DefaultTemplate)
  })
})

describe('Recap.quotedOf', () => {
  it("writes the doc block's examples", () => {
    expect(Recap.quotedOf('Who?\n\nNot him')).to.eq('Who?\n>\n> Not him')
    expect(Recap.quotedOf('Who wrote\n    *verse*')).to.eq('Who wrote\n> > *verse*')
  })

  it('drops blank lines at either end, and a carriage return', () => {
    expect(Recap.quotedOf('\n\nWho?\r\nWhen?\n\n')).to.eq('Who?\n> When?')
  })
})

describe('Recap.oneLineOf', () => {
  it("writes the doc block's example", () => {
    expect(Recap.oneLineOf('HAMILTON\n\n(accept ROWAN)\n')).to.eq('HAMILTON (accept ROWAN)')
  })
})

describe('Recap.belowOf', () => {
  it("writes the doc block's examples", () => {
    expect(Recap.belowOf('Aced.\n')).to.eq('Aced.')
    expect(Recap.belowOf('---\nAfter.')).to.eq('\n---\nAfter.')
  })

  it('sets an underline of equals signs apart too, and leaves a blank text blank', () => {
    expect(Recap.belowOf('===')).to.eq('\n===')
    expect(Recap.belowOf('  \n')).to.eq('')
  })
})
