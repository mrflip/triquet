import { describe, expect, it } from 'vitest'
import * as Templating from '../../src/lib/templating'
import * as Bbjank from '../../src/lib/bbjank'
import * as Markdown from '../../src/lib/markdown'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { Widget } from '../../src/models/widget'
import { Widgeting } from '../../src/models/widgeting'
import type { StoredWidgetedT, WidgetedHistoryT } from '../../src/models/widgeted'
import { runOf } from '../support/runs'

/** A typed cell holding `value` */
function typed(value: string): WidgetedHistoryT {
  const row: StoredWidgetedT = { status: 'ok', value, message: null, result_meta: {}, _creationTime: 3.5 }
  return { newest: row, ok: row }
}

/** One question with the fields given */
function questionWith(patch: Partial<QuestionT>): QuestionT {
  return { ...Question.blank(), ...patch }
}

/** The library the quiz below works: a text entry and a formula counting the clueing's characters */
const Library = [
  Widget.fill({ label: 'authors', formulary: 'entry', config: { entry_kind: 'text' } }),
  Widget.fill({ label: 'sizer', formulary: 'jsonata', formula: '$length(qn.clueing)' }),
]

const first = questionWith({ title: 'One', qnum: '1', clueing: 'By {{qn.author}}', hint: 'Not her', stored: { author: typed('Ada') } })
const second = questionWith({ title: 'Two', qnum: '2', clueing: '{{#qns', stored: {} })
/** A quiz of two questions, a typed column (`author`) and a worked-out one (`size`, after it) */
const TwoQuiz: QuizT = {
  ...Quiz.blank('Templated'),
  questions:  [first, second],
  widgetings: [Widgeting.fill({ label: 'author', widget_label: 'authors' }), Widgeting.fill({ label: 'size', widget_label: 'sizer' })],
  templated:  ['question.clueing'],
}
const run = runOf(TwoQuiz, Library)
const bag = Templating.bagOf(run, first._id)

/** A bag holding only what's given, beside the empty rest */
function bagHolding(held: Partial<Templating.TemplateBag>): Templating.TemplateBag {
  return { ...Templating.bagOf(run, null), qns: [], ...held }
}

const FillCases: [string, string, string][] = [
  // regular usage:
  ["By {{qn.author}}",                         "By Ada",               'a column fills in as the value typed into it'],
  ["{{qn.size}} words",                        "16 words",             'a worked-out column fills in as its value'],
  ["{{#qns}}{{title}} {{/qns}}",               "One Two ",             'a section walks the questions'],
  ["{{^qn.missing}}none{{/qn.missing}}",       "none",                 'an inverted section shows when the key is not there'],
  ["{{qn.title}} of {{quiz.title}}",           "One of Templated",     'the quiz is in the bag'],
  ["{{hunt.label}}/{{realm.label}}",           "deep_lake/home",       'the hunt and realm are in the bag'],
  ["{{qn.rank}}. {{qn_label}}",                `1. ${first.label}`,    'the question\'s rank and label are in the bag'],
  ["{{#qns}}{{qn_label}}|{{/qns}}",            `${first.label}|${first.label}|`, 'a key a section\'s item lacks is read from the bag around it'],
  ["{{qn.size.value}}",                        "16",                   'a widgeted\'s value can be read outright'],
  // what fills in as nothing:
  ["[{{qn.nothing}}]",                         "[]",                   'a key the bag lacks fills in as nothing'],
  ["[{{qn.author.err}}]",                      "[]",                   'a null fills in as nothing'],
  // nothing is escaped:
  ["{{qn.hint}} & <b>",                        "Not her & <b>",        'text around the tags is left as typed'],
  // trivial cases:
  ["",                                         "",                     'an empty template comes to nothing'],
  ["No tags at all",                           "No tags at all",       'a template with no tags comes to itself'],
]

/** Keys reaching past the bag's own data, each of which must come to nothing */
const InheritedCases: [string, string][] = [
  ["[{{constructor}}]",                         'the bag\'s constructor'],
  ["[{{qn.constructor}}]",                      'a question\'s constructor'],
  ["[{{qn.toString}}]",                         'an inherited method'],
  ["[{{__proto__}}]",                           'the bag\'s prototype'],
  ["[{{qns.map}}]",                             'a list\'s method'],
  ["[{{qn.clueing.length}}]",                   'a property of a string'],
  ["[{{qn.clueing.constructor.name}}]",         'a property reached through a string'],
  ["[{{qns.constructor.constructor}}]",         'the Function constructor, reached through a list'],
  ["[{{#qn.constructor}}x{{/qn.constructor}}]", 'a section over an inherited function'],
  ["[{{#qns.constructor.constructor.prototype.constructor}}x{{/qns.constructor.constructor.prototype.constructor}}]", 'a section over the Function constructor'],
]

const IssueCases: [string, string | null, string][] = [
  // regular usage:
  ["By {{qn.author}}",            null,                                                                                            'a template that parses is fine'],
  ["{{#qns}}{{title}}{{/qns}}",   null,                                                                                            'a closed section is fine'],
  ["{{=<% %>=}}<% qn.title %>",   null,                                                                                            'changed delimiters are fine'],
  ["Plain text",                  null,                                                                                            'text alone is fine'],
  // what is refused:
  ["{{#qns}}{{title}}",           "Unclosed section \"qns\" at 17",                                                                'an unclosed section'],
  ["{{qn.title",                  "Unclosed tag at 10",                                                                            'an unclosed tag'],
  ["{{{qn.author}}}",             "{{{qn.author}}} is not needed: write {{qn.author}}, which fills in text as it is",              'a raw tag'],
  ["{{&qn.author}}",              "{{&qn.author}} is not needed: write {{qn.author}}, which fills in text as it is",               'a raw tag, spelled with an ampersand'],
  ["{{#qns}}{{{title}}}{{/qns}}", "{{{title}}} is not needed: write {{title}}, which fills in text as it is",                       'a raw tag inside a section'],
  ["{{> footer}}",                "{{> footer}} includes another template, and there are none to include",                         'an included template'],
]

describe("fill", () => {
  it.each(FillCases)('%j => %j: %s', (template, expected) => {
    expect(Templating.fill(template, bag)).to.deep.eq({ markdown: expected, issue: null })
  })

  it.each(InheritedCases)('%j comes to nothing: %s', (template) => {
    expect(Templating.fill(template, bag)).to.deep.eq({ markdown: '[]', issue: null })
  })

  it("fills in a list or an object as its JSON, and a yes-or-no as its word", () => {
    const held = bagHolding({ qn: { spans: [1, 2], pair: { aa: 1 }, yes: true } })
    expect(Templating.fill('{{qn.spans}} {{qn.pair}} {{qn.yes}}', held).markdown).to.eq('[1,2] {"aa":1} true')
  })

  it("fills a missing or failed column in as nothing", () => {
    const held = bagHolding({ qn: { gone: { status: 'missing', value: null, err: null }, failed: { status: 'errored', value: null, err: { message: 'No', at: null, response: null } } } })
    expect(Templating.fill('[{{qn.gone}}{{qn.failed}}]', held).markdown).to.eq('[]')
  })

  it("never calls a function, should one be in the bag", () => {
    const held = bagHolding({ qn: { shout: () => 'called' } })
    expect(Templating.fill('[{{qn.shout}}{{#qn.shout}}x{{/qn.shout}}]', held).markdown).to.eq('[]')
  })

  it("leaves a value holding markdown or HTML as it is, for the parser and the sanitizer to read", () => {
    const held = bagHolding({ qn: { bold: '**bold**', script: '<script>alert(1)</script>', link: '[x](javascript:alert(1))' } })
    expect(Templating.fill('{{qn.bold}} {{qn.script}} {{qn.link}}', held).markdown).to.eq('**bold** <script>alert(1)</script> [x](javascript:alert(1))')
  })

  it("hands back a template that does not parse as typed, with why", () => {
    expect(Templating.fill('{{#qns}}', bag)).to.deep.eq({ markdown: '{{#qns}}', issue: 'Unclosed section "qns" at 8' })
    expect(Templating.fill('{{{qn.author}}}', bag).markdown).to.eq('{{{qn.author}}}')
  })

  it("stops a template that walks a list inside a list too deeply, rather than hang", () => {
    const qns = Array.from({ length: 30 }, (_unused, ii) => ({ title: `Q${String(ii)}` }))
    const nested = '{{#qns}}{{#qns}}{{#qns}}{{title}}{{/qns}}{{/qns}}{{/qns}}'
    const filled = Templating.fill(nested, bagHolding({ qns }))
    expect(filled.markdown).to.eq(nested)
    expect(filled.issue).to.match(/reads too much/)
  })

  it("refuses to hand back far too much text", () => {
    const filled = Templating.fill('{{qn.big}}', bagHolding({ qn: { big: 'x'.repeat(Templating.FilledMax + 1) } }))
    expect(filled).to.deep.eq({ markdown: '{{qn.big}}', issue: 'This template comes to far too much text to show.' })
  })

  it("stops a tag filling in a whole list again and again before it builds the text", () => {
    const qns = [{ body: 'x'.repeat(Templating.FilledMax) }]
    const filled = Templating.fill('{{qns}}'.repeat(6000), bagHolding({ qns }))
    expect(filled.issue).to.eq('This template comes to far too much text to show.')
  })

  it("comes to the same text as often as it is asked", () => {
    expect(Templating.fill('{{qn.size}}', bag)).to.deep.eq(Templating.fill('{{qn.size}}', bag))
  })
})

/** A bag whose one question holds the fields given, as `qn` and as the only item of `qns` */
function bagWithQn(qn: Record<string, unknown>): Templating.TemplateBag {
  return bagHolding({ qn, qns: [qn] })
}

const HelperCases: [string, Record<string, unknown>, string, string][] = [
  // regular usage:
  ["> {{#quote}}{{qn.clueing}}{{/quote}}",           { clueing: 'Who?\nWhen?' },              "> Who?\n> When?",            'quote keeps every line of a field in the quote'],
  ["> {{#quote}}{{qn.clueing}}{{/quote}}",           { clueing: 'Who?\n\n    *verse*\n' }, "> Who?\n>\n> > *verse*",      'quote reads an indent as a quote and drops trailing blank lines, as quotedOf does'],
  ["**{{#oneline}}{{qn.answer}}{{/oneline}}**",      { answer: 'HAMILTON\n\n(ROWAN)' },     "**HAMILTON (ROWAN)**",        'oneline joins a field onto one line'],
  ["Pct\n{{#apart}}{{qn.recap}}{{/apart}}",          { recap: '---\nAfter.' },               "Pct\n\n---\nAfter.",          'apart sets a leading rule apart from the line above'],
  ["Pct\n{{#apart}}{{qn.recap}}{{/apart}}",          { recap: '\nAced.\n' },                 "Pct\nAced.",                  'apart leaves anything else in place, its blank ends dropped'],
  ["> {{#quote}}By {{qn.who}}\nof {{qn.where}}{{/quote}}", { who: 'Ada', where: 'London' },  "> By Ada\n> of London",        'a helper shapes the whole section, text and tags alike'],
  ["{{#qns}}> {{#quote}}{{hint}}{{/quote}}|{{/qns}}", { hint: 'Not\nhim' },                   "> Not\n> him|",               'a helper works on an item of a list'],
  // the line break a closing tag on its own line leaves:
  ["{{#apart}}\n{{qn.recap}}\n{{/apart}}\nNext",      { recap: 'Aced.' },                      "Aced.\nNext",                 'a section closed on its own line keeps its last line break'],
  ["{{#oneline}}{{qn.answer}}{{/oneline}}!",          { answer: 'A\nB\n' },                    "A B!",                        'a section closed on the same line keeps none, whatever the field ends with'],
  // composition:
  ["{{#oneline}}{{#quote}}{{qn.clueing}}{{/quote}}{{/oneline}}", { clueing: 'Who?\nWhen?' },  "Who? > When?",                'oneline around quote joins the quoted lines'],
  ["> {{#quote}}{{#oneline}}{{qn.clueing}}{{/oneline}}{{/quote}}", { clueing: 'Who?\nWhen?' }, "> Who? When?",              'quote around oneline has one line to quote'],
  // trivial cases:
  ["[{{#quote}}{{/quote}}][{{#oneline}}{{qn.none}}{{/oneline}}][{{#apart}}{{/apart}}]", {},  "[][][]",                      'a helper over nothing comes to nothing'],
]

/** Templates that use a helper's name other than as a section, or reach for a helper that is not there, each of which must come to the bracketed text */
const HelperSafetyCases: [string, Record<string, unknown>, string, string][] = [
  ["[{{quote}}{{oneline}}{{apart}}]",                    {},                                     "[]",          'a helper named as a plain tag fills in nothing'],
  ["{{#qns}}[{{quote}}|{{oneline}}]{{/qns}}",            { quote: 'data', oneline: { hint: 'x' } }, "[|]",      'a helper\'s bare name fills in nothing, even where the bag holds it'],
  ["{{#qns}}[{{quote.value}}|{{oneline.hint}}]{{/qns}}", { quote: { status: 'ok', value: 'col', err: null }, oneline: { hint: 'x' } }, "[col|x]", 'a key that only starts with a helper\'s name reads the bag'],
  ["[{{^quote}}shown{{/quote}}]",                        {},                                     "[shown]",     'an inverted section on a helper\'s name reads the bag, where the name is nothing'],
  ["[{{qn.kind}}]",                                      { kind: 'quote' },                      "[quote]",     'a value naming a helper stays data'],
  ["[{{qn.sneaky}}]",                                    { sneaky: '{{#quote}}a\nb{{/quote}}' }, "[{{#quote}}a\nb{{/quote}}]", 'a value holding a helper\'s section stays text, never filled in again'],
  ["{{#qns}}[{{#quote}}x\ny{{/quote}}{{quote}}]{{/qns}}", { quote: () => 'called' },          "[x\n> y]",     'a function in the bag under a helper\'s name is never called; the section is still the helper'],
  ["[{{#constructor}}x{{/constructor}}{{#toString}}x{{/toString}}{{#hasOwnProperty}}x{{/hasOwnProperty}}]", {}, "[]", 'only the registry\'s own keys are helpers'],
  ["[{{#Quote}}x{{/Quote}}]",                            {},                                     "[]",          'a helper\'s name is matched exactly'],
]

/** A template calling `oneline` around `{{qn.text}}`, `depth` deep */
function onelinesAround(depth: number): string {
  return '{{#oneline}}'.repeat(depth) + '{{qn.text}}' + '{{/oneline}}'.repeat(depth)
}

describe("Helpers", () => {
  it.each(HelperCases)('%j over %j => %j: %s', (template, qn, expected) => {
    expect(Templating.fill(template, bagWithQn(qn))).to.deep.eq({ markdown: expected, issue: null })
  })

  it.each(HelperSafetyCases)('%j over %j => %j: %s', (template, qn, expected) => {
    expect(Templating.fill(template, bagWithQn(qn))).to.deep.eq({ markdown: expected, issue: null })
  })

  it("shapes a column as it does a field", () => {
    expect(Templating.fill('> {{#quote}}{{qn.author}}{{/quote}}', bag).markdown).to.eq('> Ada')
  })

  it("wins, as a section, over a value of the same name; the value is still read inside it", () => {
    const filled = Templating.fill('{{#qns}}{{#oneline}}{{oneline.answer}}{{/oneline}}{{/qns}}', bagWithQn({ oneline: { answer: 'A\nB' } }))
    expect(filled.markdown).to.eq('A B')
  })

  it("is frozen, and holds the three helpers", () => {
    expect(Object.isFrozen(Templating.Helpers)).to.eq(true)
    expect(Object.keys(Templating.Helpers)).to.have.members(['quote', 'oneline', 'apart'])
  })

  it("spends the fill's budget on each helper called", () => {
    const qns = Array.from({ length: 6000 }, () => ({}))
    const filled = Templating.fill('{{#qns}}{{#oneline}}x{{/oneline}}{{/qns}}', bagHolding({ qns }))
    expect(filled.issue).to.match(/reads too much/)
    expect(Templating.fill('{{#qns}}x{{/qns}}', bagHolding({ qns })).issue).to.eq(null)
  })

  it("counts a section's own text as it is written out, so a long text a list repeats is stopped before a helper is handed it", () => {
    const qns = Array.from({ length: 20 }, () => ({}))
    const repeated = '{{#qns}}{{#qns}}{{#qns}}a' + '\n'.repeat(20) + '{{/qns}}{{/qns}}{{/qns}}'
    expect(Templating.fill(`{{#oneline}}${repeated}{{/oneline}}`, bagHolding({ qns })).issue).to.eq('This template comes to far too much text to show.')
  })

  it("stops helpers inside helpers once they have shaped too much, however little the fill comes to", () => {
    const held = bagWithQn({ text: 'x'.repeat(90_000) })
    expect(Templating.fill(onelinesAround(11), held).issue).to.eq(null)
    expect(Templating.fill(onelinesAround(12), held).issue).to.eq('This template shapes too much text: a helper inside a helper inside a helper, perhaps.')
  })

  it("counts what a helper adds against the characters a fill may come to", () => {
    const lines = Array.from({ length: 40_000 }, () => 'x').join('\n')
    const filled = Templating.fill('{{#quote}}{{qn.lines}}{{/quote}}', bagWithQn({ lines }))
    expect(filled).to.deep.eq({ markdown: '{{#quote}}{{qn.lines}}{{/quote}}', issue: 'This template comes to far too much text to show.' })
    expect(Templating.fill('{{qn.lines}}', bagWithQn({ lines })).issue).to.eq(null)
  })
})

describe("issueOf", () => {
  it.each(IssueCases)('%j => %j: %s', (template, expected) => {
    expect(Templating.issueOf(template)).to.eq(expected)
  })
})

/** The kind of every node in the markdown tree under `node`, itself first */
function nodekindsIn(node: { type: string, children?: { type: string }[] }): string[] {
  return [node.type, ...(node.children ?? []).flatMap((child) => nodekindsIn(child))]
}

describe("bagOf", () => {
  it("holds the question and every question, each with every widgeting's widgeted", () => {
    expect(bag.qn.clueing).to.eq('By {{qn.author}}')
    expect(bag.qn_label).to.eq(first.label)
    expect(bag.qns).to.have.lengthOf(2)
    expect(bag.qns[1]?.size).to.deep.include({ status: 'ok', value: 6 })
    expect(bag.qn).to.eq(bag.qns[0])
    expect(bag.quiz).to.deep.include({ title: 'Templated' })
    expect(bag).not.to.have.any.keys('params', 'widgeting_label')
  })

  it("holds no question for a text of the quiz's own, or for a question the run lacks", () => {
    expect(Templating.bagOf(run, null).qn).to.deep.eq({})
    expect(Templating.bagOf(run, null).qn_label).to.eq('')
    expect(Templating.bagOf(run, 'nowhere').qn).to.deep.eq({})
  })

  it("holds what each widgeting for the whole quiz came to, as quiz.<label>, which a recap's head fills in", () => {
    const entered = { ...TwoQuiz, stored: { playtesters: typed('Ada and Grace') }, widgetings: [Widgeting.fill({ widget_label: 'authors', label: 'playtesters', tier: 'quiz' }), ...TwoQuiz.widgetings] }
    const quizBag = Templating.bagOf(runOf(entered, Library), null)
    expect(quizBag.quiz.playtesters).to.deep.include({ status: 'ok', value: 'Ada and Grace' })
    expect(Templating.fill('Thanks to {{quiz.playtesters}}!', quizBag).markdown).to.eq('Thanks to Ada and Grace!')
  })

  it("holds in qns only the questions a screen shows, the alternates among them, and in quiz.questions every one", () => {
    const alternate = questionWith({ title: 'Spare', qnum: '3', viz: 'secondary' })
    const archived = questionWith({ title: 'Gone', viz: 'archived', clueing: 'By {{qn.author}}' })
    const viz = { ...TwoQuiz, questions: [first, archived, alternate] }
    const vizRun = runOf(viz, Library)
    const quizBag = Templating.bagOf(vizRun, null)
    expect(quizBag.qns.map((qn) => qn.title)).to.deep.eq(['One', 'Spare'])
    expect((quizBag.quiz.questions as Record<string, unknown>[]).map((qn) => qn.title)).to.deep.eq(['One', 'Gone', 'Spare'])
    expect(quizBag.qns.map((qn) => [qn.archived, qn.secondary])).to.deep.eq([[false, false], [false, true]])
    expect(Templating.bagOf(vizRun, archived._id).qn.title).to.eq('Gone')
  })

  it("holds the hunt's categories, each with its title, for a template to loop over", () => {
    expect(Templating.fill('{{categories.15.title}}', bag).markdown).to.eq('TV')
    expect(Templating.fill('{{#categories}}{{label}} {{/categories}}', bag).markdown.split(' ')).to.have.lengthOf(25)
  })

  it("draws an image in a formula's or a bot's column as a link to it, and keeps one typed into a field or an entry", () => {
    const Imaged = [
      ...Library,
      Widget.fill({ label: 'mapper', formulary: 'jsonata', formula: '"![map](https://host/m.png?q=" & qn.title & ")"' }),
      Widget.fill({ label: 'quiz_mapper', formulary: 'jsonata', formula: '["![all](https://host/all.png)"]' }),
    ]
    const pictured = questionWith({ title: 'Pic', clueing: '![typed](https://host/t.png)', stored: { author: typed('![entered](https://host/e.png)') } })
    const imaged = {
      ...TwoQuiz,
      questions:  [pictured],
      widgetings: [...TwoQuiz.widgetings, Widgeting.fill({ label: 'map', widget_label: 'mapper' }), Widgeting.fill({ label: 'maps', widget_label: 'quiz_mapper', tier: 'quiz' })],
    }
    const imagedRun = runOf(imaged, Imaged)
    const imagedBag = Templating.bagOf(imagedRun, pictured._id)
    expect(Templating.fill('{{qn.map}}', imagedBag).markdown).to.eq('&#33;[map](https://host/m.png?q=Pic)')
    expect(Templating.fill('{{qn.map.value}} {{#quiz.maps.value}}{{.}}{{/quiz.maps.value}} {{quiz.maps}}', imagedBag).markdown).not.to.include('![')
    expect(Templating.fill('{{qn.clueing}} {{qn.author}}', imagedBag).markdown).to.eq('![typed](https://host/t.png) ![entered](https://host/e.png)')
    expect(imagedRun.widgeteds.get('map')?.get(pictured._id)?.value).to.eq('![map](https://host/m.png?q=Pic)')
  })

  it("leaves an image made a link no image to the screen's parser or the board's writer, whatever stands before it", () => {
    const linked = ['&#33;[map](https://host/m.png)', String.raw`\&#33;[map](https://host/m.png)`, String.raw`\\&#33;[map](https://host/m.png)`, '!&#33;[map](https://host/m.png)']
    for (const filled of linked) {
      expect(nodekindsIn(Markdown.treeOf(filled)), filled).to.include('link').and.not.include('image')
      expect(Bbjank.toBbjank(filled), filled).to.include('[url=https://host/m.png]').and.not.include('[img]')
    }
  })

  it("offers no widgeting for the whole quiz for templating: it has no question's cell to fill", () => {
    const entered = { ...TwoQuiz, widgetings: [Widgeting.fill({ widget_label: 'authors', label: 'playtesters', tier: 'quiz' }), ...TwoQuiz.widgetings] }
    expect(Templating.templatableSources(entered, Library).map(({ source }) => source)).to.not.include('playtesters')
  })
})

describe("filledBagOf", () => {
  it("holds every question with its templated texts filled in, each over its own question, once", () => {
    const filled = Templating.filledBagOf(TwoQuiz, run)
    expect(filled.qns.map((qn) => qn.clueing)).to.deep.eq(['By Ada', '{{#qns'])
    expect((filled.quiz.questions as Record<string, unknown>[])[0]?.clueing).to.eq('By Ada')
    expect(filled.qn).to.deep.eq({})
  })

  it("fills in a text entry the quiz templates, as its widgeted's value", () => {
    const bylined = { ...TwoQuiz, questions: [{ ...first, stored: { ...first.stored, byline: typed('By {{qn.author}}') } }], widgetings: [...TwoQuiz.widgetings, Widgeting.fill({ label: 'byline', widget_label: 'authors' })], templated: ['byline'] }
    const [qn] = Templating.filledBagOf(bylined, runOf(bylined, Library)).qns
    expect(qn?.byline).to.deep.include({ status: 'ok', value: 'By Ada' })
    expect(qn?.clueing).to.eq('By {{qn.author}}')
  })

  it("fills a filled text in no further, so a text naming another templated one reads it as typed", () => {
    const chained = { ...TwoQuiz, questions: [{ ...first, hint: '{{qn.clueing}}' }], templated: ['question.clueing', 'question.hint'] }
    const [qn] = Templating.filledBagOf(chained, runOf(chained, Library)).qns
    expect([qn?.clueing, qn?.hint]).to.deep.eq(['By Ada', 'By {{qn.author}}'])
  })

  it("is the bag for no question when the quiz templates nothing", () => {
    expect(Templating.filledBagOf({ templated: [] }, run)).to.deep.eq(Templating.bagOf(run, null))
  })
})

describe("sourceOfField", () => {
  it("names a question's field as a column does", () => {
    expect(Templating.sourceOfField('clueing')).to.eq('question.clueing')
    expect(Templating.sourceOfField('recap')).to.eq('question.recap')
  })
})

describe("templates", () => {
  it("says whether the quiz nominates a source", () => {
    expect(Templating.templates({ templated: ['question.clueing'] }, 'question.clueing')).to.be.true
    expect(Templating.templates({ templated: ['question.clueing'] }, 'question.hint')).to.be.false
    expect(Templating.templates({ templated: ['author'] }, 'author')).to.be.true
  })
})

describe("filledQuiz", () => {
  it("fills in each templated field, keeping one that does not parse as typed", () => {
    const filled = Templating.filledQuiz(TwoQuiz, run)
    expect(filled.questions.map((question) => question.clueing)).to.deep.eq(['By Ada', '{{#qns'])
    expect(filled.questions[0]?.hint).to.eq('Not her')
    expect(filled.title).to.eq('Templated')
  })

  it("leaves a field the quiz does not template as typed", () => {
    const hinted = { ...TwoQuiz, questions: [{ ...first, hint: '{{qn.author}}' }, second] }
    expect(Templating.filledQuiz(hinted, runOf(hinted, Library)).questions[0]?.hint).to.eq('{{qn.author}}')
  })

  it("hands back the very quiz when it templates none of its questions' fields", () => {
    const untemplated = { ...TwoQuiz, templated: ['author'] }
    expect(Templating.filledQuiz(untemplated, run)).to.eq(untemplated)
  })
})

describe("templatableSources", () => {
  const FieldSources = ['question.clueing', 'question.hint', 'question.full_answer', 'question.notes', 'question.recap']

  it("offers each markdown field, then each text entry, each with its title", () => {
    const offered = Templating.templatableSources(TwoQuiz, Library)
    expect(offered.map(({ source }) => source)).to.deep.eq([...FieldSources, 'author'])
    expect(offered.map(({ title }) => title)).to.deep.eq(['Clueing', 'Hint', 'Full Answer', 'Notes', 'Recap', 'Author'])
  })

  it("offers a widgeting of another kind only once the quiz templates it, so it can be let go", () => {
    const offered = Templating.templatableSources({ ...TwoQuiz, templated: ['size'] }, Library)
    expect(offered.map(({ source }) => source)).to.deep.eq([...FieldSources, 'author', 'size'])
  })

  it("offers no widgeting whose widget the library lacks", () => {
    expect(Templating.templatableSources(TwoQuiz, []).map(({ source }) => source)).to.deep.eq(FieldSources)
  })
})
