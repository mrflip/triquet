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

/**
 * The JSONata formulas that close the default template's gaps, each a column a quiz adds and its
 * own template names in place of the bare field: what `human/20261007-recap_template.md` hands an
 * author, held here to what it says it does.
 */
const Recipes = {
  /** A field to follow a `> `: every line after the first opens `> `, and a four-space indent reads as a quote within it */
  quoted:     (field: string) => String.raw`$join($map($split(qn.${field}, '\n'), function($line) { $replace($line, /^ {4}/, '> ') }), '\n> ')`,
  /** The answer on one line: each line trimmed, the blank ones dropped, the rest joined by a space */
  answerLine: String.raw`$join($split(qn.full_answer, '\n').$trim($)[$ != ''], ' ')`,
  /** The recap, set a blank line apart when it opens with a line that would make the line above a heading */
  recapBelow: String.raw`$contains(qn.recap, /^ {0,3}(-+|=+)[ \t]*(\n|$)/) ? '\n' & qn.recap : qn.recap`,
  /** For the whole quiz: the questions with a rank, in rank order, each numbered from 1; a list, even of one or none */
  inOrder:    "[$map(qns[$type(rank) = 'number']^(rank), function($qn, $idx) { $merge([$qn, { 'number': $idx + 1 }]) })]",
  /** An author's own line in place of the Correct Answer line, reading the correct_pct column */
  solvedBy:   "$type(qn.correct_pct.value) = 'number' ? 'Solved by ' & qn.correct_pct.value & '% of teams' : 'Not yet scored'",
}

/** The library the quizzes below work: a text entry, a number entry, and a formula for each recipe */
const Library = [
  Widget.fill({ label: 'authors', formulary: 'entry', config: { entry_kind: 'text' } }),
  Widget.fill({ label: 'tallies', formulary: 'entry', config: { entry_kind: 'number' } }),
  Widget.fill({ label: 'quoted_clueing', formulary: 'jsonata', formula: Recipes.quoted('clueing') }),
  Widget.fill({ label: 'quoted_hint', formulary: 'jsonata', formula: Recipes.quoted('hint') }),
  Widget.fill({ label: 'answer_line', formulary: 'jsonata', formula: Recipes.answerLine }),
  Widget.fill({ label: 'recap_below', formulary: 'jsonata', formula: Recipes.recapBelow }),
  Widget.fill({ label: 'in_order', formulary: 'jsonata', formula: Recipes.inOrder }),
  Widget.fill({ label: 'solved_by', formulary: 'jsonata', formula: Recipes.solvedBy }),
]

/** The widgeting a quiz's correct-answer shares are typed into */
const CorrectPct = Widgeting.fill({ label: 'correct_pct', widget_label: 'tallies' })

/** A widgeting of each recipe's widget, labelled as it is: the quiz-wide `in_order` last, below the questions */
const RecipeWidgetings = [
  ...['quoted_clueing', 'quoted_hint', 'answer_line', 'recap_below'].map((label) => Widgeting.fill({ label, widget_label: label })),
  Widgeting.fill({ label: 'in_order', widget_label: 'in_order', tier: 'quiz' }),
]

/** `template` with each of `swaps` (what it reads, what to read instead) made once; a swap it has no place for is refused */
function swapped(template: string, swaps: readonly (readonly [string, string])[]): string {
  let swapping = template
  for (const [was, now] of swaps) {
    if (! swapping.includes(was)) { throw new Error(`The template holds no ${was}`) }
    swapping = swapping.replace(was, () => now)
  }
  return swapping
}

/** The default template, reading every recipe's column in place of what it closes the gap of */
const ClosingTemplate = swapped(Recap.DefaultTemplate.replaceAll('{{rank}}', '{{number}}'), [
  ['***\n', '{{#quiz.in_order.value.0}}\n***\n{{/quiz.in_order.value.0}}\n'],
  ['{{#qns}}\n', '{{#quiz.in_order.value}}\n'],
  ['{{/qns}}', '{{/quiz.in_order.value}}'],
  ['{{clueing}}', '{{quoted_clueing}}'],
  ['> {{hint}}', '> {{quoted_hint}}'],
  ['**{{full_answer}}**', '**{{answer_line}}**'],
  ['{{recap}}', '{{recap_below}}'],
])

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

/** The recap of a quiz holding one question, `Who?` unless patched, by the template reading every recipe's column */
function closedOfOne(patch: Partial<QuestionT>): string {
  return recapOfOne(patch, { widgetings: RecipeWidgetings, recap_template: ClosingTemplate })
}

const hamilton = questionWith({ title: 'Ham', qnum: '1', clueing: 'Who?', full_answer: 'HAMILTON' })

/**
 * A quiz with something of everything the recap writes: questions out of Q# order, a templated
 * clueing, indented verse, multi-line hints and answers, a multi-paragraph recap, a correct-answer
 * share, a blank question.
 */
function everythingQuiz(patch: Partial<QuizT> = {}): QuizT {
  const target = questionWith({ qnum: '3', title: 'Ship', clueing: '**What name** will be borne by CVN-80?\nIt is storied.', hint: "Tubbs' Ferrari-driving partner", full_answer: 'ENTERPRISE\n(USS ENTERPRISE)', stored: { correct_pct: typed(76) } })
  const chained = questionWith({ qnum: '1', title: 'Ham', clueing: 'Who wrote\n    *verse*', hint: 'Not *the* one\nof the stage', full_answer: '(WILLIAM ROWAN) HAMILTON', chains_to: target._id, recap: 'Everyone got it.\n\nSee [the image](https://ex.com/a.png).' })
  const plain = questionWith({ qnum: '2', title: 'Plain', clueing: 'By {{qn.author}}, a ~50 year ~~old~~ thing.', full_answer: 'ADA', stored: { author: typed('Ada') } })
  return quizOf([target, plain, chained, Question.blank()], {
    widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' }), CorrectPct],
    templated:  ['question.clueing'],
    recap_head: 'The recap of *{{quiz.title}}*.\n\nThanks to all.',
    recap_tail: 'See you next season.',
    ...patch,
  })
}

/**
 * The everything quiz's note by the default template, which reads only what every template reads.
 * Its gaps show: the questions in the quiz's own order; Q2's templated clueing as typed; Q1's
 * indented verse closing its quote, so its OR ELSE hint falls outside it.
 */
const EverythingNote = "The recap of [i]Recapped[/i].\n\nThanks to all.\n----------------------------------------\n\n[quote=\"Q3\"]3. [b]What name[/b] will be borne by CVN-80?\nIt is storied.\n\n...OR ELSE...\n\nTubbs' Ferrari-driving partner[/quote]\n\nAnswer: [spoiler][b]ENTERPRISE\n(USS ENTERPRISE)[/b][/spoiler]\nCorrect Answer %: 76\n\n[quote=\"Q2\"]2. By {{qn.author}}, a ~50 year [spoiler]old[/spoiler] thing.[/quote]\n\nAnswer: [spoiler][b]ADA[/b][/spoiler]\nCorrect Answer %:\n\n[quote=\"Q1\"]1. Who wrote\n[i]verse[/i][/quote]\n[list]...OR ELSE...\n\nNot [i]the[/i] one\nof the stage[/list]\n\nAnswer: [spoiler][b](WILLIAM ROWAN) HAMILTON[/b][/spoiler]\nCorrect Answer %:\nEveryone got it.\n\nSee [url=https://ex.com/a.png]the image[/url].\n\nSee you next season."

describe('Recap.noteOf, by the default template', () => {
  it('writes the everything quiz with nothing but its fields, its columns and plain mustache', () => {
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

  it("writes the head, every question in the quiz's own order numbered by its rank, then the tail, each a blank line apart", () => {
    const second = questionWith({ title: 'Ent', qnum: '2', clueing: '**What name**?', full_answer: 'ENTERPRISE', recap: 'Everyone got it.' })
    const quiz = quizOf([second, hamilton], { recap_head: 'First, *thanks*.', recap_tail: 'See you next season.' })
    expect(recapOf(quiz)).to.eq([
      'First, [i]thanks[/i].',
      '----------------------------------------',
      '',
      '[quote="Q2"]2. [b]What name[/b]?[/quote]',
      '',
      'Answer: [spoiler][b]ENTERPRISE[/b][/spoiler]',
      'Correct Answer %:',
      'Everyone got it.',
      '',
      '[quote="Q1"]1. Who?[/quote]',
      '',
      'Answer: [spoiler][b]HAMILTON[/b][/spoiler]',
      'Correct Answer %:',
      '',
      'See you next season.',
    ].join('\n'))
  })

  it('fills the head and tail in as templates over the quiz', () => {
    const quiz = quizOf([hamilton], { recap_head: 'The recap of {{quiz.title}}', recap_tail: '{{#qns}}{{title}} {{/qns}}' })
    expect(recapOf(quiz)).to.match(/^The recap of Recapped\n-+\n[^]*\n\nHam$/)
  })

  it('leaves a head or tail that cannot be filled in as typed', () => {
    expect(recapOf(quizOf([], { recap_tail: 'Broken {{#qns}}' }))).to.eq('Broken {{#qns}}')
  })

  it('reads a field the quiz templates as typed, as every question in qns holds it', () => {
    const question = questionWith({ qnum: '1', clueing: 'By {{qn.author}}', recap: 'Ask {{qn.author}}', stored: { author: typed('Ada') } })
    const quiz = quizOf([question], {
      widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' })],
      templated:  ['question.recap'],
    })
    expect(recapOf(quiz)).to.contain('1. By {{qn.author}}[/quote]').and.to.contain('\nAsk {{qn.author}}')
  })

  it('leaves out archived questions and those with no Q#, which have no rank, but not alternates', () => {
    const archived = questionWith({ qnum: '1', clueing: 'Put away', viz: 'archived' })
    const alternate = questionWith({ qnum: '2', clueing: 'Spare', viz: 'secondary' })
    const unnumbered = questionWith({ qnum: '', clueing: 'Unnumbered' })
    const played = questionWith({ qnum: '3', clueing: 'Played' })
    const recap = recapOf(quizOf([archived, alternate, unnumbered, played]))
    expect(recap).to.contain('[quote="Q1"]1. Spare[/quote]').and.to.contain('[quote="Q2"]2. Played[/quote]')
    expect(recap).not.to.contain('Put away')
    expect(recap).not.to.contain('Unnumbered')
  })

  it('leaves out a question never written into, as a fresh quiz holds several', () => {
    const quiz = quizOf([Question.blank(), hamilton, Question.blank()])
    expect(recapOf(quiz)).to.eq('[quote="Q1"]1. Who?[/quote]\n\nAnswer: [spoiler][b]HAMILTON[/b][/spoiler]\nCorrect Answer %:')
  })

  it("quotes a question's own hint below its clueing, after OR ELSE, and never the hint of the question it chains to", () => {
    const target = questionWith({ qnum: '2', clueing: 'Ship?', hint: "Tubbs' partner" })
    const chained = questionWith({ qnum: '1', clueing: 'What name?', chains_to: target._id })
    const recap = recapOf(quizOf([chained, target]))
    expect(recap).to.contain('[quote="Q1"]1. What name?[/quote]')
    expect(recap).to.contain("[quote=\"Q2\"]2. Ship?\n\n...OR ELSE...\n\nTubbs' partner[/quote]")
    expect(recap).not.to.contain('BUT NOT')
  })

  it('reads the correct-answer share from a column labelled correct_pct', () => {
    expect(recapOfOne({ stored: { correct_pct: typed(76) } }, { widgetings: [CorrectPct] })).to.contain('\nCorrect Answer %: 76')
  })

  it('reads no share from a column labelled anything else, however like it', () => {
    const question = questionWith({ qnum: '1', clueing: 'Who?', stored: { pct_correct: typed(76) } })
    const quiz = quizOf([question], { widgetings: [Widgeting.fill({ label: 'pct_correct', widget_label: 'tallies' })] })
    expect(recapOf(quiz)).to.match(/\nCorrect Answer %:$/)
  })

  it('writes a rule under the head, question or none', () => {
    expect(recapOf(quizOf([], { recap_head: 'Thanks!', recap_tail: 'Bye.' }))).to.eq('Thanks!\n----------------------------------------\n\nBye.')
  })

  it('comes to nothing for a quiz with nothing to recap', () => {
    expect(noteOf(quizOf([]))).to.deep.eq({ bbjank: '', issue: null })
  })

  it('writes HTML in a head as the characters typed, never as markup', () => {
    expect(recapOf(quizOf([hamilton], { recap_head: '<script>alert(1)</script>' }))).to.match(/^<script>alert\(1\)<\/script>\n-+\n/)
  })

  it.each([
    ['1984.',               '1984.'],
    ['2. Bob',              '2. Bob'],
    ['> HAMILTON',          '> HAMILTON'],
    ['---',                 '---'],
    ['[x]: https://ex.com', '[x]: [url]https://ex.com[/url]'],
  ])('writes a one-line answer %j as typed, never as a list, quote, rule or definition', (fullAnswer, expected) => {
    expect(recapOfOne({ full_answer: fullAnswer })).to.contain(`Answer: [spoiler][b]${expected}[/b][/spoiler]`)
  })

  it("writes an answer's own emphasis inside the spoiler", () => {
    expect(recapOfOne({ full_answer: '*Hamlet*' })).to.contain('Answer: [spoiler][i][b]Hamlet[/b][/i][/spoiler]')
  })

  it('writes a blank answer as no spoiler at all', () => {
    expect(recapOfOne({ full_answer: '' })).to.match(/\nAnswer:\nCorrect Answer %:$/)
  })

  it("keeps a clueing's second line in its quote, when it opens with nothing markdown reads", () => {
    expect(recapOfOne({ clueing: 'Who\nwrote it?' })).to.contain('[quote="Q1"]1. Who\nwrote it?[/quote]')
  })

  it('keeps the number of a clueing that opens like a numbered list', () => {
    expect(recapOfOne({ clueing: '1984. Who wrote it?' })).to.contain('[quote="Q1"]1. 1984. Who wrote it?[/quote]')
  })

  it("finds a reference link's definition inside the clueing's quote", () => {
    expect(recapOfOne({ clueing: 'See [the map][m].\n\n[m]: https://ex.com/map' })).to.contain('See [url=https://ex.com/map]the map[/url].')
  })

  it("writes a multi-paragraph recap as its paragraphs", () => {
    expect(recapOfOne({ recap: 'First.\n\nSecond, with a [link](https://ex.com).' })).to.match(/Correct Answer %:\nFirst\.\n\nSecond, with a \[url=https:\/\/ex\.com\]link\[\/url\]\.$/)
  })

  it('writes a link off the web as its text alone', () => {
    expect(recapOfOne({ recap: '[click](javascript:alert(1))' })).to.match(/\nclick$/)
  })

  it("takes an author's own column in place of the Correct Answer line", () => {
    const template = swapped(Recap.DefaultTemplate, [['Correct Answer %: {{correct_pct}}', '{{solved_by}}']])
    const widgetings = [CorrectPct, Widgeting.fill({ label: 'solved_by', widget_label: 'solved_by' })]
    const scored = questionWith({ qnum: '1', clueing: 'Who?', full_answer: 'HAMILTON', stored: { correct_pct: typed(76) } })
    const unscored = questionWith({ qnum: '2', clueing: 'What?', full_answer: 'ENTERPRISE' })
    const recap = recapOf(quizOf([scored, unscored], { widgetings, recap_template: template }))
    expect(recap).to.contain('Answer: [spoiler][b]HAMILTON[/b][/spoiler]\nSolved by 76% of teams')
    expect(recap).to.contain('Answer: [spoiler][b]ENTERPRISE[/b][/spoiler]\nNot yet scored')
    expect(recap).not.to.contain('Correct Answer %')
  })
})

describe("The default template's gaps, and the columns that close them", () => {
  it('writes the everything quiz as the shaped values did, but for the templated clueing, by a column for each gap', () => {
    const note = recapOf(everythingQuiz({ widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' }), CorrectPct, ...RecipeWidgetings], recap_template: ClosingTemplate }))
    expect(note).to.eq("The recap of [i]Recapped[/i].\n\nThanks to all.\n----------------------------------------\n\n[quote=\"Q1\"]1. Who wrote\n[list][i]verse[/i][/list]\n\n...OR ELSE...\n\nNot [i]the[/i] one\nof the stage[/quote]\n\nAnswer: [spoiler][b](WILLIAM ROWAN) HAMILTON[/b][/spoiler]\nCorrect Answer %:\nEveryone got it.\n\nSee [url=https://ex.com/a.png]the image[/url].\n\n[quote=\"Q2\"]2. By {{qn.author}}, a ~50 year [spoiler]old[/spoiler] thing.[/quote]\n\nAnswer: [spoiler][b]ADA[/b][/spoiler]\nCorrect Answer %:\n\n[quote=\"Q3\"]3. [b]What name[/b] will be borne by CVN-80?\nIt is storied.\n\n...OR ELSE...\n\nTubbs' Ferrari-driving partner[/quote]\n\nAnswer: [spoiler][b]ENTERPRISE (USS ENTERPRISE)[/b][/spoiler]\nCorrect Answer %: 76\n\nSee you next season.")
  })

  it('sets the rule under the head only when a question follows, by a quiz-wide list', () => {
    const ends = { recap_head: 'Thanks!', recap_tail: 'Bye.' }
    const closing = { ...ends, widgetings: RecipeWidgetings, recap_template: ClosingTemplate }
    const blank = Question.blank()
    expect(recapOf(quizOf([blank], ends))).to.eq('Thanks!\n----------------------------------------\n\nBye.')
    expect(recapOf(quizOf([blank], closing))).to.eq('Thanks!\n\nBye.')
    expect(recapOf(quizOf([hamilton], closing))).to.match(/^Thanks!\n-{40}\n\n\[quote="Q1"\]/)
  })

  it('orders and numbers the questions by Q#, past archived ones, by a quiz-wide list', () => {
    const third = questionWith({ qnum: '3', clueing: 'Third' })
    const archived = questionWith({ qnum: '2', clueing: 'Put away', viz: 'archived' })
    const first = questionWith({ qnum: '1', clueing: 'First' })
    expect(recapOf(quizOf([third, archived, first]))).to.match(/^\[quote="Q2"\]2\. Third[^]*\[quote="Q1"\]1\. First/)
    const closed = recapOf(quizOf([third, archived, first], { widgetings: RecipeWidgetings, recap_template: ClosingTemplate }))
    expect(closed).to.match(/^\[quote="Q1"\]1\. First\[\/quote\][^]*\[quote="Q2"\]2\. Third\[\/quote\]/)
    expect(closed).not.to.contain('Put away')
  })

  it("lets a clueing's indented verse run into its first line, and a later paragraph leave its quote, and keeps both within by a column", () => {
    const clueing = 'Who wrote\n    *verse*\n\n[Click here](https://ex.com/a.png)'
    expect(recapOfOne({ clueing })).to.match(/^\[quote="Q1"\]1\. Who wrote\n\[i\]verse\[\/i\]\[\/quote\]\n\n\[url=https:\/\/ex\.com\/a\.png\]Click here\[\/url\]\n/)
    expect(closedOfOne({ clueing })).to.match(/^\[quote="Q1"\]1\. Who wrote\n\[list\]\[i\]verse\[\/i\]\[\/list\]\n\n\[url=https:\/\/ex\.com\/a\.png\]Click here\[\/url\]\[\/quote\]/)
  })

  it('lets a line under a clueing that would make it a heading close its quote, and keeps it within by a column', () => {
    const clueing = 'Who?\n---\n# Not a heading'
    expect(recapOfOne({ clueing })).to.match(/^\[quote="Q1"\]1\. Who\?\[\/quote\]\n-{40}\n\[b\]Not a heading\[\/b\]\n/)
    expect(closedOfOne({ clueing })).to.match(/^\[quote="Q1"\]\[b\]1\. Who\?\[\/b\]\n\[b\]Not a heading\[\/b\]\[\/quote\]\n\nAnswer:/)
  })

  it("lets a hint's later lines leave its quote, and keeps them within by a column", () => {
    const hint = 'Not him\n---\n# Nor her'
    expect(recapOfOne({ hint })).to.match(/^\[quote="Q1"\]1\. Who\?\n\n\.\.\.OR ELSE\.\.\.\n\nNot him\[\/quote\]\n-{40}\n\[b\]Nor her\[\/b\]\n/)
    expect(closedOfOne({ hint })).to.match(/^\[quote="Q1"\]1\. Who\?\n\n\.\.\.OR ELSE\.\.\.\n\n\[b\]Not him\[\/b\]\n\[b\]Nor her\[\/b\]\[\/quote\]\n\nAnswer:/)
  })

  it('lets a blank line in an answer break its spoiler open, and folds it onto one line by a column', () => {
    const full_answer = 'HAMILTON\n\n(accept ROWAN)\n'
    expect(recapOfOne({ full_answer })).to.contain('Answer: ~~**HAMILTON\n\n(accept ROWAN)\n**~~')
    expect(closedOfOne({ full_answer })).to.contain('Answer: [spoiler][b]HAMILTON (accept ROWAN)[/b][/spoiler]')
  })

  it("lets an answer's second line open a list, and folds it onto one line by a column", () => {
    const full_answer = '- HAMILTON\n- ALEX'
    expect(recapOfOne({ full_answer })).to.contain('[list]\n[*] ALEX**~~')
    expect(closedOfOne({ full_answer })).to.contain('Answer: [spoiler][b]- HAMILTON - ALEX[/b][/spoiler]')
  })

  it('lets a recap opening with a rule make the Correct Answer line a heading, and sets it apart by a column', () => {
    const recap = '---\nAfter.'
    expect(recapOfOne({ recap })).to.match(/\[b\]Answer:\nCorrect Answer %:\[\/b\]\nAfter\.$/)
    expect(closedOfOne({ recap })).to.match(/\nCorrect Answer %:\n\n-{40}\nAfter\.$/)
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
