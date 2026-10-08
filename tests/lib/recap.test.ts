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

/** An author's own line in place of the Correct Answer line, reading the correct_pct column */
const SolvedBy = "$type(qn.correct_pct.value) = 'number' ? 'Solved by ' & qn.correct_pct.value & '% of teams' : 'Not yet scored'"

/** The library the quizzes below work: a text entry, a number entry, and the formula above */
const Library = [
  Widget.fill({ label: 'authors', formulary: 'entry', config: { entry_kind: 'text' } }),
  Widget.fill({ label: 'tallies', formulary: 'entry', config: { entry_kind: 'number' } }),
  Widget.fill({ label: 'solved_by', formulary: 'jsonata', formula: SolvedBy }),
]

/** The widgeting a quiz's correct-answer shares are typed into */
const CorrectPct = Widgeting.fill({ label: 'correct_pct', widget_label: 'tallies' })

/** `template` with `was` read as `now`; a template holding no `was` is refused */
function swapped(template: string, was: string, now: string): string {
  if (! template.includes(was)) { throw new Error(`The template holds no ${was}`) }
  return template.replace(was, () => now)
}

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
    templateable: ['clueing'],
    recap_head: 'The recap of *{{quiz.title}}*.\n\nThanks to all.',
    recap_tail: 'See you next season.',
    ...patch,
  })
}

/**
 * The everything quiz's note by the default template, which reads only what every template reads:
 * the questions in Q# order, the blank one left out; Q2's templated clueing filled in, as the grid
 * shows it. The filters keep Q1's indented verse and its OR ELSE hint within its quote, and Q3's
 * two-line answer on one line within its spoiler.
 */
const EverythingNote = "The recap of [i]Recapped[/i].\n\nThanks to all.\n----------------------------------------\n\n[quote=\"Q1\"]1. Who wrote\n[list][i]verse[/i][/list]\n\n...OR ELSE...\n\nNot [i]the[/i] one\nof the stage[/quote]\n\nAnswer: [spoiler][b](WILLIAM ROWAN) HAMILTON[/b][/spoiler]\nCorrect Answer %:\nEveryone got it.\n\nSee [url=https://ex.com/a.png]the image[/url].\n\n[quote=\"Q2\"]2. By Ada, a ~50 year [spoiler]old[/spoiler] thing.[/quote]\n\nAnswer: [spoiler][b]ADA[/b][/spoiler]\nCorrect Answer %:\n\n[quote=\"Q3\"]3. [b]What name[/b] will be borne by CVN-80?\nIt is storied.\n\n...OR ELSE...\n\nTubbs' Ferrari-driving partner[/quote]\n\nAnswer: [spoiler][b]ENTERPRISE (USS ENTERPRISE)[/b][/spoiler]\nCorrect Answer %: 76\n\nSee you next season."

describe('Recap.noteOf, by the default template', () => {
  it('writes the everything quiz with nothing but its fields, its columns, Liquid and the app\'s filters', () => {
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

  it("writes the head, every question in Q# order, then the tail, each a blank line apart", () => {
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
    const quiz = quizOf([hamilton], { recap_head: 'The recap of {{quiz.title}}', recap_tail: '{% for qn in qns %}{{ qn.title }} {% endfor %}' })
    expect(recapOf(quiz)).to.match(/^The recap of Recapped\n-+\n[^]*\n\nHam$/)
  })

  it('leaves a head or tail that cannot be filled in as typed', () => {
    expect(recapOf(quizOf([], { recap_tail: 'Broken {% if %}' }))).to.eq('Broken {% if %}')
  })

  it('reads a field the quiz templates filled in, as the grid shows it, and any other as typed', () => {
    const question = questionWith({ qnum: '1', clueing: 'By {{qn.author}}', recap: 'Ask {{qn.author}}', stored: { author: typed('Ada') } })
    const quiz = quizOf([question], {
      widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' })],
      templateable: ['recap'],
    })
    expect(recapOf(quiz)).to.contain('1. By {{qn.author}}[/quote]').and.to.contain('\nAsk Ada')
  })

  it('reads a text entry the quiz templates filled in', () => {
    const question = questionWith({ qnum: '1', clueing: 'Who?', stored: { author: typed('Ada'), byline: typed('By {{qn.author}}') } })
    const quiz = quizOf([question], {
      widgetings:     [Widgeting.fill({ label: 'author', widget_label: 'authors' }), Widgeting.fill({ label: 'byline', widget_label: 'authors' })],
      templateable: ['byline'],
      recap_template: '{% for qn in qns %}{{ qn.byline }}{% endfor %}',
    })
    expect(recapOf(quiz)).to.eq('By Ada')
  })

  it('leaves out archived questions and alternates, and puts one with no Q# last, numbered on', () => {
    const archived = questionWith({ qnum: '1', clueing: 'Put away', viz: 'archived' })
    const alternate = questionWith({ qnum: '2', clueing: 'Spare', viz: 'secondary' })
    const unnumbered = questionWith({ qnum: '', clueing: 'Unnumbered' })
    const played = questionWith({ qnum: '3', clueing: 'Played' })
    const recap = recapOf(quizOf([archived, alternate, unnumbered, played]))
    expect(recap).to.match(/^\[quote="Q1"\]1\. Played\[\/quote\][^]*\[quote="Q2"\]2\. Unnumbered\[\/quote\]/)
    expect(recap).not.to.contain('Put away')
    expect(recap).not.to.contain('Spare')
  })

  it('numbers by place among the questions played, so an alternate takes no number', () => {
    const alternate = questionWith({ qnum: '1', clueing: 'Spare', viz: 'secondary' })
    const played = questionWith({ qnum: '2', clueing: 'Played' })
    expect(recapOf(quizOf([alternate, played]))).to.eq('[quote="Q1"]1. Played[/quote]\n\nAnswer:\nCorrect Answer %:')
  })

  it('orders the questions by Q#, whatever their order in the quiz', () => {
    const third = questionWith({ qnum: '3', clueing: 'Third' })
    const first = questionWith({ qnum: '1', clueing: 'First' })
    expect(recapOf(quizOf([third, first]))).to.match(/^\[quote="Q1"\]1\. First\[\/quote\][^]*\[quote="Q2"\]2\. Third\[\/quote\]/)
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

  it('writes a rule under the head only when a question follows', () => {
    const unplayed = quizOf([Question.blank()], { recap_head: 'Thanks!', recap_tail: 'Bye.' })
    expect(recapOf(unplayed)).to.eq('Thanks!\n\nBye.')
    expect(recapOf(quizOf([hamilton], { recap_head: 'Thanks!' }))).to.match(/^Thanks!\n-{40}\n\n\[quote="Q1"\]/)
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
    const template = swapped(Recap.DefaultTemplate, 'Correct Answer %: {{ qn.correct_pct }}', '{{ qn.solved_by }}')
    const widgetings = [CorrectPct, Widgeting.fill({ label: 'solved_by', widget_label: 'solved_by' })]
    const scored = questionWith({ qnum: '1', clueing: 'Who?', full_answer: 'HAMILTON', stored: { correct_pct: typed(76) } })
    const unscored = questionWith({ qnum: '2', clueing: 'What?', full_answer: 'ENTERPRISE' })
    const recap = recapOf(quizOf([scored, unscored], { widgetings, recap_template: template }))
    expect(recap).to.contain('Answer: [spoiler][b]HAMILTON[/b][/spoiler]\nSolved by 76% of teams')
    expect(recap).to.contain('Answer: [spoiler][b]ENTERPRISE[/b][/spoiler]\nNot yet scored')
    expect(recap).not.to.contain('Correct Answer %')
  })
})

describe("What the default template's filters keep in place", () => {
  it("keeps a clueing's indented verse and a later paragraph within its quote, by quote", () => {
    const clueing = 'Who wrote\n    *verse*\n\n[Click here](https://ex.com/a.png)'
    expect(recapOfOne({ clueing })).to.match(/^\[quote="Q1"\]1\. Who wrote\n\[list\]\[i\]verse\[\/i\]\[\/list\]\n\n\[url=https:\/\/ex\.com\/a\.png\]Click here\[\/url\]\[\/quote\]/)
  })

  it('keeps a line under a clueing that would make it a heading within its quote, by quote', () => {
    const clueing = 'Who?\n---\n# Not a heading'
    expect(recapOfOne({ clueing })).to.match(/^\[quote="Q1"\]\[b\]1\. Who\?\[\/b\]\n\[b\]Not a heading\[\/b\]\[\/quote\]\n\nAnswer:/)
  })

  it("keeps a hint's later lines within its quote, by quote", () => {
    const hint = 'Not him\n---\n# Nor her'
    expect(recapOfOne({ hint })).to.match(/^\[quote="Q1"\]1\. Who\?\n\n\.\.\.OR ELSE\.\.\.\n\n\[b\]Not him\[\/b\]\n\[b\]Nor her\[\/b\]\[\/quote\]\n\nAnswer:/)
  })

  it('keeps an answer with a blank line inside its spoiler, by oneline', () => {
    expect(recapOfOne({ full_answer: 'HAMILTON\n\n(accept ROWAN)\n' })).to.contain('Answer: [spoiler][b]HAMILTON (accept ROWAN)[/b][/spoiler]')
  })

  it("keeps an answer's second line from opening a list, by oneline", () => {
    expect(recapOfOne({ full_answer: '- HAMILTON\n- ALEX' })).to.contain('Answer: [spoiler][b]- HAMILTON - ALEX[/b][/spoiler]')
  })

  it('keeps a recap opening with a rule from making the Correct Answer line a heading, by apart', () => {
    expect(recapOfOne({ recap: '---\nAfter.' })).to.match(/\nCorrect Answer %:\n\n-{40}\nAfter\.$/)
  })
})

describe("Recap.noteOf, by a template of the quiz's own", () => {
  it('fills it in over the recap bag, then writes it in bbjank whole', () => {
    const quiz = quizOf([hamilton], { recap_head: 'Hi *all*', recap_template: '{{ recap_head }}\n\n{% assign played = qns | in_order %}{% for qn in played %}- **Q{{ qn.number }}** {{ qn.title }}: {{ qn.full_answer | oneline }}\n{% endfor %}' })
    expect(recapOf(quiz)).to.eq('Hi [i]all[/i]\n\n[list]\n[*] [b]Q1[/b] Ham: HAMILTON[/list]')
  })

  it('reads every widgeting of a question, as a field template does', () => {
    const question = questionWith({ qnum: '1', clueing: 'Who?', stored: { author: typed('Ada') } })
    const quiz = quizOf([question], { widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' })], recap_template: '{% for qn in qns %}By {{ qn.author }} for {{ quiz.title }}{% endfor %}' })
    expect(recapOf(quiz)).to.eq('By Ada for Recapped')
  })

  it('writes a template that will not fill in as typed, and says why', () => {
    expect(noteOf(quizOf([hamilton], { recap_template: '{% for qn in qns %}{{ qn.number }}' }))).to.deep.eq({ bbjank: '{% for qn in qns %}{{ qn.number }}', issue: 'tag {% for qn in qns %} not closed, line:1, col:1' })
  })

  it('fills a value holding markdown or HTML in before the parser, so the writer reads it last', () => {
    const quiz = quizOf([questionWith({ qnum: '1', clueing: '<img src=x onerror=alert(1)> **bold**' })], { recap_template: '{% for qn in qns %}{{ qn.clueing }}{% endfor %}' })
    expect(recapOf(quiz)).to.eq('<img src=x onerror=alert(1)> [b]bold[/b]')
  })

  it("composes Liquid's own filters with the app's: the questions played that hold a recap, by title", () => {
    const quiz = quizOf([questionWith({ qnum: '2', title: 'Zed', clueing: 'Z?', recap: 'Hard.' }), questionWith({ qnum: '1', title: 'Ann', clueing: 'A?', recap: 'Easy.' }), questionWith({ qnum: '3', title: 'Mid', clueing: 'M?' })], {
      recap_template: '{% assign told = qns | in_order | where_exp: "qn", "qn.recap != blank" | sort: "title" %}{% for qn in told %}{{ qn.number }} {{ qn.title }}; {% endfor %}',
    })
    expect(recapOf(quiz)).to.eq('1 Ann; 2 Zed;')
  })
})

describe('Recap.bagOf', () => {
  it('holds in qns the questions a screen shows, alternates among them, and in quiz.questions every one', () => {
    const quiz = quizOf([questionWith({ qnum: '1', title: 'Shown' }), questionWith({ qnum: '2', title: 'Spare', viz: 'secondary' }), questionWith({ title: 'Gone', viz: 'archived' })])
    const bag = Recap.bagOf(quiz, runOf(quiz, Library))
    expect(bag.qns.map((qn) => qn.title)).to.deep.eq(['Shown', 'Spare'])
    expect((bag.quiz.questions as Record<string, unknown>[]).map((qn) => [qn.title, qn.archived, qn.secondary])).to.deep.eq([['Shown', false, false], ['Spare', false, true], ['Gone', true, false]])
  })

  it('lets a template skip the archived and the alternates by their flags', () => {
    const quiz = quizOf([questionWith({ qnum: '1', title: 'Shown' }), questionWith({ qnum: '2', title: 'Spare', viz: 'secondary' }), questionWith({ title: 'Gone', viz: 'archived' })], {
      recap_template: 'All: {% for qn in quiz.questions %}{{ qn.title }} {% endfor %}\n\nKept: {% for qn in quiz.questions %}{% unless qn.archived %}{{ qn.title }} {% endunless %}{% endfor %}\n\nPlayed: {% for qn in qns %}{% unless qn.secondary %}{{ qn.title }}{% endunless %}{% endfor %}',
    })
    expect(recapOf(quiz)).to.eq('All: Shown Spare Gone\n\nKept: Shown Spare\n\nPlayed: Shown')
  })

  it('holds each question with its templated fields filled in, and its head and tail filled in', () => {
    const question = questionWith({ qnum: '1', clueing: 'By {{ qn.author }}\nWhen?', stored: { author: typed('Ada') } })
    const quiz = quizOf([question], { widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' })], templateable: ['clueing'], recap_head: 'Thanks to {{ qns.first.author }}!' })
    const bag = Recap.bagOf(quiz, runOf(quiz, Library))
    expect([bag.qns[0]?.clueing, bag.recap_head]).to.deep.eq(['By Ada\nWhen?', 'Thanks to Ada!'])
  })

  it("holds the hunt's categories, each with its title", () => {
    const quiz = quizOf([hamilton], { recap_template: '{{ categories.first.title }} ({{ categories.first.label }})' })
    expect(recapOf(quiz)).to.eq('Math & Econ (math_econ)')
  })
})

describe('Recap.templateOf', () => {
  it("is the quiz's own template, or the default", () => {
    expect(Recap.templateOf({ recap_template: 'Mine' })).to.eq('Mine')
    expect(Recap.templateOf({})).to.eq(Recap.DefaultTemplate)
  })
})
