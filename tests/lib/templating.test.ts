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
  templateable: ['clueing'],
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
  ["{% for qn in qns %}{{ qn.title }} {% endfor %}", "One Two ",      'a loop walks the questions'],
  ["{% unless qn.missing %}none{% endunless %}", "none",               'unless shows when the key is not there'],
  ["{% if qn.notes %}x{% endif %}[{{ qn.notes }}]", "[]",              'an empty value is false, as in JavaScript'],
  ["{{ qns.size }}: {{ qns | map: 'title' | join: ', ' }}", "2: One, Two", "Liquid's own filters work on the questions"],
  ["{{qn.title}} of {{quiz.title}}",           "One of Templated",     'the quiz is in the bag'],
  ["{{hunt.label}}/{{realm.label}}",           "deep_lake/home",       'the hunt and realm are in the bag'],
  ["{{qn.rank}}. {{qn_label}}",                `1. ${first.label}`,    'the question\'s rank and label are in the bag'],
  ["{% for each in qns %}{{ qn_label }}|{% endfor %}", `${first.label}|${first.label}|`, 'the bag around a loop is read inside it'],
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
  ["[{{constructor}}]",                                       'the bag\'s constructor'],
  ["[{{qn.constructor}}]",                                    'a question\'s constructor'],
  ["[{{qn.toString}}]",                                       'an inherited method'],
  ["[{{__proto__}}]",                                         'the bag\'s prototype'],
  ["[{{qns.map}}]",                                           'a list\'s method'],
  ["[{{qn.clueing.constructor.name}}]",                       'a property reached through a string'],
  ["[{{qns.constructor.constructor}}]",                       'the Function constructor, reached through a list'],
  ["[{% if qn.constructor %}x{% endif %}]",                   'a condition on an inherited function'],
  ["[{% for each in qns.constructor.prototype %}x{% endfor %}]", 'a loop over an inherited object'],
]

const IssueCases: [string, string | null, string][] = [
  // regular usage:
  ["By {{qn.author}}",                                null,                                                                                 'a template that parses is fine'],
  ["{% for qn in qns %}{{ qn.title }}{% endfor %}",   null,                                                                                 'a closed loop is fine'],
  ["{{ qn.clueing | quote }}",                        null,                                                                                 "the app's filters are known"],
  ["Plain text",                                      null,                                                                                 'text alone is fine'],
  // what is refused:
  ["{% for qn in qns %}{{ qn.title }}",               "tag {% for qn in qns %} not closed, line:1, col:1",                                  'an unclosed loop'],
  ["{{ qn.title",                                     'output "{{ qn.title" not closed, line:1, col:1',                                     'an unclosed tag'],
  ["{{ qn.title | shout }}",                          "undefined filter: shout, line:1, col:1",                                             'a filter there is none of'],
  ["{{ qn.title | Quote }}",                          "undefined filter: Quote, line:1, col:1",                                             "a filter's name is matched exactly"],
  ["{{ qn.title | constructor }}",                    "undefined filter: constructor, line:1, col:1",                                       'a filter inherited from nothing'],
  ['{% include "footer" %}',                          "{% include %} includes another template, and there are none to include, line:1, col:1", 'an included template'],
  ['{% render "footer" %}',                           "{% render %} includes another template, and there are none to include, line:1, col:1",  'a rendered template'],
  ['{% layout "page" %}',                             "{% layout %} includes another template, and there are none to include, line:1, col:1",  'a layout'],
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

  it("leaves a value holding markdown or HTML as it is, for the parser and the sanitizer to read", () => {
    const held = bagHolding({ qn: { bold: '**bold**', script: '<script>alert(1)</script>', link: '[x](javascript:alert(1))' } })
    expect(Templating.fill('{{qn.bold}} {{qn.script}} {{qn.link}}', held).markdown).to.eq('**bold** <script>alert(1)</script> [x](javascript:alert(1))')
  })

  it("fills in over any plain object, as a liquidize template's input is", () => {
    expect(Templating.fill('{{ title }} by {{ author.label }}', { title: 'Leon', author: { label: 'ada' } })).to.deep.eq({ markdown: 'Leon by ada', issue: null })
  })

  it("hands back a template that does not parse as typed, with why", () => {
    expect(Templating.fill('{% if qn.hint %}', bag)).to.deep.eq({ markdown: '{% if qn.hint %}', issue: 'tag {% if qn.hint %} not closed, line:1, col:1' })
  })

  it("stops a template that walks a list inside a list too deeply, rather than hang", () => {
    const qns = Array.from({ length: 50 }, () => ({ title: '' }))
    const nested = '{% for aa in qns %}{% for bb in qns %}{% for cc in qns %}{{ cc.title }}{% endfor %}{% endfor %}{% endfor %}'
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

  it("stops a loop that writes nothing, by the time it takes", () => {
    const qns = Array.from({ length: 1000 }, () => ({}))
    const filled = Templating.fill('{% for aa in qns %}{% for bb in qns %}{% for cc in qns %}{% endfor %}{% endfor %}{% endfor %}', bagHolding({ qns }))
    expect(filled.issue).to.match(/^template render limit exceeded/)
  })

  it("stops a range of a hundred million numbers, by what it allocates", () => {
    expect(Templating.fill('{% for nn in (1..100000000) %}{% endfor %}', bag).issue).to.match(/^memory alloc limit exceeded/)
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
  ["> {{ qn.clueing | quote }}",                    { clueing: 'Who?\nWhen?' },              "> Who?\n> When?",            'quote keeps every line of a field in the quote'],
  ["> {{ qn.clueing | quote }}",                    { clueing: 'Who?\n\n    *verse*\n' }, "> Who?\n>\n> > *verse*",      'quote reads an indent as a quote and drops trailing blank lines, as quotedOf does'],
  ["**{{ qn.answer | oneline }}**",                 { answer: 'HAMILTON\n\n(ROWAN)' },     "**HAMILTON (ROWAN)**",        'oneline joins a field onto one line'],
  ["Pct\n{{ qn.recap | apart }}",                   { recap: '---\nAfter.' },               "Pct\n\n---\nAfter.",          'apart sets a leading rule apart from the line above'],
  ["Pct\n{{ qn.recap | apart }}",                   { recap: '\nAced.\n' },                 "Pct\nAced.",                  'apart leaves anything else in place, its blank ends dropped'],
  ["{% capture told %}By {{ qn.who }}\nof {{ qn.where }}{% endcapture %}> {{ told | quote }}", { who: 'Ada', where: 'London' }, "> By Ada\n> of London", 'a captured text is shaped whole, text and tags alike'],
  ["{% for qn in qns %}> {{ qn.hint | quote }}|{% endfor %}", { hint: 'Not\nhim' },          "> Not\n> him|",               'a filter works on an item of a list'],
  // composition:
  ["{{ qn.clueing | quote | oneline }}",            { clueing: 'Who?\nWhen?' },              "Who? > When?",                'oneline after quote joins the quoted lines'],
  ["> {{ qn.clueing | oneline | quote }}",          { clueing: 'Who?\nWhen?' },              "> Who? When?",                'quote after oneline has one line to quote'],
  // trivial cases:
  ["[{{ qn.none | quote }}][{{ qn.none | oneline }}][{{ '' | apart }}]", {},                 "[][][]",                      'a filter over nothing comes to nothing'],
]

/** Templates near the app's filters' names that must come to the bracketed text: names in the bag are data, filters are filters */
const HelperSafetyCases: [string, Record<string, unknown>, string, string][] = [
  ["[{{ quote }}{{ oneline }}{{ apart }}]",                  {},                                         "[]",              "a filter's name as a key the bag lacks fills in nothing"],
  ["{% for qn in qns %}[{{ qn.quote }}|{{ qn.oneline.hint }}]{% endfor %}", { quote: 'data', oneline: { hint: 'x' } }, "[data|x]", "a key named like a filter reads the bag"],
  ["[{{ qn.kind }}]",                                        { kind: 'quote' },                          "[quote]",         'a value naming a filter stays data'],
  ["[{{ qn.sneaky }}]",                                      { sneaky: '{{ qn.kind | quote }}' },        "[{{ qn.kind | quote }}]", 'a value holding a template stays text, never filled in again'],
]

/** A template running `{{qn.text}}` through `oneline`, `depth` times */
function onelinesAround(depth: number): string {
  return `{{ qn.text${' | oneline'.repeat(depth)} }}`
}

describe("Helpers", () => {
  it.each(HelperCases)('%j over %j => %j: %s', (template, qn, expected) => {
    expect(Templating.fill(template, bagWithQn(qn))).to.deep.eq({ markdown: expected, issue: null })
  })

  it.each(HelperSafetyCases)('%j over %j => %j: %s', (template, qn, expected) => {
    expect(Templating.fill(template, bagWithQn(qn))).to.deep.eq({ markdown: expected, issue: null })
  })

  it("shapes a column as it does a field", () => {
    expect(Templating.fill('> {{ qn.author | quote }}', bag).markdown).to.eq('> Ada')
  })

  it("is frozen, and holds the three helpers", () => {
    expect(Object.isFrozen(Templating.Helpers)).to.eq(true)
    expect(Object.keys(Templating.Helpers)).to.have.members(['quote', 'oneline', 'apart'])
  })

  it("counts each piece a loop writes, so a long text a list repeats is stopped before it is built", () => {
    const qns = Array.from({ length: 20 }, () => ({}))
    const repeated = '{% for aa in qns %}{% for bb in qns %}{% for cc in qns %}a' + '\n'.repeat(20) + '{% endfor %}{% endfor %}{% endfor %}'
    expect(Templating.fill(repeated, bagHolding({ qns })).issue).to.eq('This template comes to far too much text to show.')
  })

  it("stops filters after filters once they have shaped too much, however little the fill comes to", () => {
    const held = bagWithQn({ text: 'x'.repeat(90_000) })
    expect(Templating.fill(onelinesAround(11), held).issue).to.eq(null)
    expect(Templating.fill(onelinesAround(12), held).issue).to.eq('This template shapes too much text: the same long text shaped again and again, perhaps.')
  })

  it("counts what a filter adds against the characters a fill may come to", () => {
    const lines = Array.from({ length: 40_000 }, () => 'x').join('\n')
    const filled = Templating.fill('{{ qn.lines | quote }}', bagWithQn({ lines }))
    expect(filled).to.deep.eq({ markdown: '{{ qn.lines | quote }}', issue: 'This template comes to far too much text to show.' })
    expect(Templating.fill('{{ qn.lines }}', bagWithQn({ lines })).issue).to.eq(null)
  })
})

describe("inOrder", () => {
  it("lists the questions with a rank in rank order, then those holding a clueing without one, each numbered by its place", () => {
    const qns = [
      { title: 'Third', rank: 3, clueing: 'c' },
      { title: 'Loose', rank: null, clueing: 'Unnumbered' },
      { title: 'First', rank: 1, clueing: 'a' },
      { title: 'Blank', rank: null, clueing: '  ' },
    ]
    expect(Templating.inOrder(qns).map((qn) => [qn.number, qn.title])).to.deep.eq([[1, 'First'], [2, 'Third'], [3, 'Loose']])
  })

  it("leaves out alternates and the archived, numbering past them", () => {
    const qns = [{ title: 'Spare', rank: 1, secondary: true, clueing: 'x' }, { title: 'Gone', rank: 2, archived: true, clueing: 'x' }, { title: 'Kept', rank: 3, clueing: 'x' }]
    expect(Templating.inOrder(qns).map((qn) => [qn.number, qn.title])).to.deep.eq([[1, 'Kept']])
  })

  it("passes over anything not a question, and comes to nothing for anything not a list", () => {
    expect(Templating.inOrder([null, 'x', 3, { rank: 1, clueing: 'a' }])).to.have.lengthOf(1)
    expect(Templating.inOrder('qns')).to.deep.eq([])
  })

  it("is the in_order filter, which goes in an assign", () => {
    const qns = [{ title: 'Two', rank: 2, clueing: 'b' }, { title: 'One', rank: 1, clueing: 'a' }]
    const filled = Templating.fill('{% assign played = qns | in_order %}{% for qn in played %}{{ qn.number }}. {{ qn.title }} {% endfor %}', bagHolding({ qns }))
    expect(filled.markdown).to.eq('1. One 2. Two ')
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
    expect(Templating.fill('{{categories[15].title}}', bag).markdown).to.eq('TV')
    expect(Templating.fill('{% for category in categories %}{{ category.label }} {% endfor %}', bag).markdown.split(' ')).to.have.lengthOf(25)
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

  it("draws an image in a liquidize template's column as a link to it, though its template typed one", () => {
    const Imaged = [...Library, Widget.fill({ label: 'pictured', formulary: 'liquidize', formula: '![logo](https://host/l.png) {{ qn.title }}' })]
    const imaged = { ...TwoQuiz, widgetings: [...TwoQuiz.widgetings, Widgeting.fill({ label: 'picture', widget_label: 'pictured' })] }
    const imagedRun = runOf(imaged, Imaged)
    expect(Templating.fill('{{qn.picture}}', Templating.bagOf(imagedRun, first._id)).markdown).to.match(/^&#33;\[logo\]/)
    expect(imagedRun.widgeteds.get('picture')?.get(first._id)?.value).to.match(/^!\[logo\]/)
  })

  it("leaves an image made a link no image to the screen's parser or the board's writer, whatever stands before it", () => {
    const linked = ['&#33;[map](https://host/m.png)', String.raw`\&#33;[map](https://host/m.png)`, String.raw`\\&#33;[map](https://host/m.png)`, '!&#33;[map](https://host/m.png)']
    for (const filled of linked) {
      expect(nodekindsIn(Markdown.treeOf(filled)), filled).to.include('link').and.not.include('image')
      expect(Bbjank.toBbjank(filled), filled).to.include('[url=https://host/m.png]').and.not.include('[img]')
    }
  })

  it("holds no function anywhere, though a formula come to one, since LiquidJS calls a function it finds", () => {
    const Lambda = [...Library, Widget.fill({ label: 'lambda', formulary: 'jsonata', formula: 'function($x) { $x }' })]
    const lambdaQuiz = { ...TwoQuiz, widgetings: [...TwoQuiz.widgetings, Widgeting.fill({ label: 'fn', widget_label: 'lambda' })] }
    const lambdaBag = Templating.bagOf(runOf(lambdaQuiz, Lambda), first._id)
    const functionsIn = (val: unknown): number => {
      if (typeof val === 'function') { return 1 }
      if (typeof val !== 'object' || val === null) { return 0 }
      return Object.values(val).reduce((sum: number, each) => sum + functionsIn(each), 0)
    }
    expect(functionsIn(lambdaBag)).to.eq(0)
    expect(Templating.fill('[{{ qn.fn.value }}]', lambdaBag).markdown).to.eq('[]')
  })

  it("offers no widgeting for the whole quiz for templating: it has no question's cell to fill", () => {
    const entered = { ...TwoQuiz, widgetings: [Widgeting.fill({ widget_label: 'authors', label: 'playtesters', tier: 'quiz' }), ...TwoQuiz.widgetings] }
    expect(Templating.templatableSources(entered, Library).map(({ source }) => source)).to.not.include('playtesters')
  })
})

describe("finishedQnsOf", () => {
  it("holds every question as the last widgeting left it, each templateable source filled in over its own question", () => {
    expect(Templating.finishedQnsOf(run, ['clueing']).map((qn) => qn.clueing)).to.deep.eq(['By Ada', '{{#qns'])
    expect(Templating.finishedQnsOf(run, ['clueing'])).to.eq(Templating.finishedQnsOf(run, ['clueing']))
  })

  it("is the run's own questions when nothing is nominated", () => {
    expect(Templating.finishedQnsOf(run, [])).to.eq(run.qnsAfter)
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
    const bylined = { ...TwoQuiz, questions: [{ ...first, stored: { ...first.stored, byline: typed('By {{qn.author}}') } }], widgetings: [...TwoQuiz.widgetings, Widgeting.fill({ label: 'byline', widget_label: 'authors' })], templateable: ['byline'] }
    const [qn] = Templating.filledBagOf(bylined, runOf(bylined, Library)).qns
    expect(qn?.byline).to.deep.include({ status: 'ok', value: 'By Ada' })
    expect(qn?.clueing).to.eq('By {{qn.author}}')
  })

  it("fills a filled text in no further, so a text naming another templated one reads it as typed", () => {
    const chained = { ...TwoQuiz, questions: [{ ...first, hint: '{{qn.clueing}}' }], templateable: ['clueing', 'hint'] }
    const [qn] = Templating.filledBagOf(chained, runOf(chained, Library)).qns
    expect([qn?.clueing, qn?.hint]).to.deep.eq(['By Ada', 'By {{qn.author}}'])
  })

  it("is the bag for no question when the quiz templates nothing", () => {
    expect(Templating.filledBagOf({ templateable: [] }, run)).to.deep.eq(Templating.bagOf(run, null))
  })
})


describe("templates", () => {
  it("says whether the quiz nominates a source", () => {
    expect(Templating.templates({ templateable: ['clueing'] }, 'clueing')).to.be.true
    expect(Templating.templates({ templateable: ['clueing'] }, 'hint')).to.be.false
    expect(Templating.templates({ templateable: ['author'] }, 'author')).to.be.true
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
    const untemplated = { ...TwoQuiz, templateable: ['author'] }
    expect(Templating.filledQuiz(untemplated, run)).to.eq(untemplated)
  })
})

describe("templatableSources", () => {
  const FieldSources = ['clueing', 'hint', 'full_answer', 'notes', 'recap']

  it("offers each markdown field, then each text entry, each with its title", () => {
    const offered = Templating.templatableSources(TwoQuiz, Library)
    expect(offered.map(({ source }) => source)).to.deep.eq([...FieldSources, 'author'])
    expect(offered.map(({ title }) => title)).to.deep.eq(['Clueing', 'Hint', 'Full Answer', 'Notes', 'Recap', 'Author'])
  })

  it("offers a widgeting of another kind only once the quiz templates it, so it can be let go", () => {
    const offered = Templating.templatableSources({ ...TwoQuiz, templateable: ['size'] }, Library)
    expect(offered.map(({ source }) => source)).to.deep.eq([...FieldSources, 'author', 'size'])
  })

  it("offers no widgeting whose widget the library lacks", () => {
    expect(Templating.templatableSources(TwoQuiz, []).map(({ source }) => source)).to.deep.eq(FieldSources)
  })
})

describe("valuedBagOf", () => {
  it("is the question's template bag, with the value beside the bag's own words", () => {
    const valued = Templating.valuedBagOf(run, [], first._id, 53)
    expect([valued.value, (valued.qn as { title: string }).title]).to.deep.eq([53, 'One'])
    expect(Templating.fill('{{ value }}%', valued).markdown).to.eq('53%')
  })

  it("holds the questions' templateable sources filled in, as the finished bag does", () => {
    expect((Templating.valuedBagOf(run, ['clueing'], first._id, null).qn as { clueing: string }).clueing).to.eq('By Ada')
    expect((Templating.valuedBagOf(run, [], first._id, null).qn as { clueing: string }).clueing).to.eq('By {{qn.author}}')
  })

  it("fills in an object value as its JSON, and reads into it", () => {
    const valued = Templating.valuedBagOf(run, [], first._id, { guess: 'Leon' })
    expect(Templating.fill('{{ value.guess }} / {{ value }}', valued).markdown).to.eq('Leon / {"guess":"Leon"}')
  })
})

describe("computes", () => {
  it("says a formula's and a bot's values are worked out, and an entry's typed", () => {
    expect(Templating.computes(Widget.fill({ label: 'sizer', formulary: 'jsonata', formula: '1' }))).to.be.true
    expect(Templating.computes(Widget.fill({ label: 'authors', formulary: 'entry', config: { entry_kind: 'text' } }))).to.be.false
    expect(Templating.computes(null)).to.be.false
  })
})

describe("imagesLinkedIn", () => {
  it("writes every image in every string it holds as a link, however deep", () => {
    expect(Templating.imagesLinkedIn({ value: ['![map](https://host/m.png)'] })).to.deep.eq({ value: ['&#33;[map](https://host/m.png)'] })
    expect(Templating.imagesLinkedIn('see ![a](b) and ![c](d)')).to.eq('see &#33;[a](b) and &#33;[c](d)')
  })

  it("leaves anything that is not a string as it is", () => {
    expect([Templating.imagesLinkedIn(3), Templating.imagesLinkedIn(null), Templating.imagesLinkedIn(true)]).to.deep.eq([3, null, true])
  })
})
