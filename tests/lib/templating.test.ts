import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Templating from '../../src/lib/templating'
import * as Bbjank from '../../src/lib/bbjank'
import * as Markdown from '../../src/lib/markdown'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { Widget } from '../../src/models/widget'
import { Widgeting } from '../../src/models/widgeting'
import type { StoredWidgetedT, WidgetedHistoryT } from '../../src/models/widgeted'
import { present } from '../support/present'
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
  Widget.fill({ label: 'sizer', formulary: 'jsonata', formula: '$length(question.clueing)' }),
]

const first = questionWith({ title: 'One', qnum: '1', clueing: 'By {{question.author}}', hint: 'Not her', stored: { author: typed('Ada') } })
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
function bagHolding(held: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { ...Templating.bagOf(run, null), questions: {}, ...held }
}

const FillCases: [string, string, string][] = [
  // regular usage:
  ["By {{question.author}}",                         "By Ada",               'a column fills in as the value typed into it'],
  ["{{question.size}} words",                        "22 words",             'a worked-out column fills in as its value'],
  ["{% assign list = questions | values %}{% for each in list %}{{ each.title }} {% endfor %}", "One Two ", 'a loop walks the questions, made a list first'],
  ["{% for pair in questions %}{{ pair[0] }}|{% endfor %}", `${first.label}|${second.label}|`, 'a bare loop over the questions walks [label, question] pairs'],
  ["[{% for each in questions | values %}{{ each.title }}{% endfor %}]", "[]", 'a loop tag passes a filter over, so a list is made in an assign'],
  ["{{ questions[question.label].title }}",    "One",                  'a question is found by its label at once'],
  ["{% unless question.missing %}none{% endunless %}", "none",               'unless shows when the key is not there'],
  ["{% if question.notes %}x{% endif %}[{{ question.notes }}]", "[]",              'an empty value is false, as in JavaScript'],
  ["{{ questions.size }}: {{ questions | values | map: 'title' | join: ', ' }}", "2: One, Two", "Liquid's own filters work on the questions"],
  ["{{question.title}} of {{quiz.title}}",           "One of Templated",     'the quiz is in the bag'],
  ["{{hunt.label}}/{{realm.label}}",           "deep_lake/home",       'the hunt and realm are in the bag'],
  ["{{question.rank}}. {{question_label}}",                `1. ${first.label}`,    'the question\'s rank and label are in the bag'],
  ["{% assign list = questions | values %}{% for each in list %}{{ question_label }}|{% endfor %}", `${first.label}|${first.label}|`, 'the bag around a loop is read inside it'],
  ["{{question.size.value}}",                        "22",                   'a widgeted\'s value can be read outright'],
  // what fills in as nothing:
  ["[{{question.nothing}}]",                         "[]",                   'a key the bag lacks fills in as nothing'],
  ["[{{question.author.err}}]",                      "[]",                   'a null fills in as nothing'],
  // nothing is escaped:
  ["{{question.hint}} & <b>",                        "Not her & <b>",        'text around the tags is left as typed'],
  // trivial cases:
  ["",                                         "",                     'an empty template comes to nothing'],
  ["No tags at all",                           "No tags at all",       'a template with no tags comes to itself'],
]

/** Keys reaching past the bag's own data, each of which must come to nothing */
const InheritedCases: [string, string][] = [
  ["[{{constructor}}]",                                       'the bag\'s constructor'],
  ["[{{question.constructor}}]",                                    'a question\'s constructor'],
  ["[{{question.toString}}]",                                       'an inherited method'],
  ["[{{__proto__}}]",                                         'the bag\'s prototype'],
  ["{% assign list = questions | values %}[{{list.map}}]",    'a list\'s method'],
  ["[{{question.clueing.constructor.name}}]",                       'a property reached through a string'],
  ["[{{questions.constructor.constructor}}]",                 'the Function constructor, reached through a collection'],
  ["[{% if question.constructor %}x{% endif %}]",                   'a condition on an inherited function'],
  ["[{% for each in questions.constructor.prototype %}x{% endfor %}]", 'a loop over an inherited object'],
]

const IssueCases: [string, string | null, string][] = [
  // regular usage:
  ["By {{question.author}}",                                null,                                                                                 'a template that parses is fine'],
  ["{% for question in questions %}{{ question.title }}{% endfor %}", null,                                                                                 'a closed loop is fine'],
  ["{{ question.clueing | quote }}",                        null,                                                                                 "the app's filters are known"],
  ["Plain text",                                      null,                                                                                 'text alone is fine'],
  // what is refused:
  ["{% for question in questions %}{{ question.title }}", "tag {% for question in questions %} not closed, line:1, col:1",                                  'an unclosed loop'],
  ["{{ question.title",                                     'output "{{ question.title" not closed, line:1, col:1',                                     'an unclosed tag'],
  ["{{ question.title | shout }}",                          "undefined filter: shout, line:1, col:1",                                             'a filter there is none of'],
  ["{{ question.title | Quote }}",                          "undefined filter: Quote, line:1, col:1",                                             "a filter's name is matched exactly"],
  ["{{ question.title | constructor }}",                    "undefined filter: constructor, line:1, col:1",                                       'a filter inherited from nothing'],
  ['{% include "footer" %}',                          "{% include %} includes another template, and there are none to include, line:1, col:1", 'an included template'],
  ['{% render "footer" %}',                           "{% render %} includes another template, and there are none to include, line:1, col:1",  'a rendered template'],
  ['{% layout "page" %}',                             "{% layout %} includes another template, and there are none to include, line:1, col:1",  'a layout'],
]

describe("fill", () => {
  it.each(FillCases)('%j => %j: %s', (template, expected) => {
    expect(Templating.fill(template, bag)).to.deep.eq({ markdown: expected, issue: null, failkind: null })
  })

  it.each(InheritedCases)('%j comes to nothing: %s', (template) => {
    expect(Templating.fill(template, bag)).to.deep.eq({ markdown: '[]', issue: null, failkind: null })
  })

  it("fills in a list or an object as its JSON, and a yes-or-no as its word", () => {
    const held = bagHolding({ question: { spans: [1, 2], pair: { aa: 1 }, yes: true } })
    expect(Templating.fill('{{question.spans}} {{question.pair}} {{question.yes}}', held).markdown).to.eq('[1,2] {"aa":1} true')
  })

  it("fills a missing or failed column in as nothing", () => {
    const held = bagHolding({ question: { gone: { status: 'missing', value: null, err: null }, failed: { status: 'errored', value: null, err: { message: 'No', at: null, response: null } } } })
    expect(Templating.fill('[{{question.gone}}{{question.failed}}]', held).markdown).to.eq('[]')
  })

  it("leaves a value holding markdown or HTML as it is, for the parser and the sanitizer to read", () => {
    const held = bagHolding({ question: { bold: '**bold**', script: '<script>alert(1)</script>', link: '[x](javascript:alert(1))' } })
    expect(Templating.fill('{{question.bold}} {{question.script}} {{question.link}}', held).markdown).to.eq('**bold** <script>alert(1)</script> [x](javascript:alert(1))')
  })

  it("fills in over any plain object, as a liquidize template's input is", () => {
    expect(Templating.fill('{{ title }} by {{ author.label }}', { title: 'Leon', author: { label: 'ada' } })).to.deep.eq({ markdown: 'Leon by ada', issue: null, failkind: null })
  })

  it("hands back a template that does not parse as typed, with why", () => {
    expect(Templating.fill('{% if question.hint %}', bag)).to.deep.eq({ markdown: '{% if question.hint %}', issue: 'tag {% if question.hint %} not closed, line:1, col:1', failkind: 'syntax' })
  })

  it("stops a template that walks a list inside a list too deeply, rather than hang", () => {
    const list = Array.from({ length: 50 }, () => ({ title: '' }))
    const nested = '{% for aa in list %}{% for bb in list %}{% for cc in list %}{{ cc.title }}{% endfor %}{% endfor %}{% endfor %}'
    const filled = Templating.fill(nested, bagHolding({ list }))
    expect(filled.markdown).to.eq(nested)
    expect(filled.issue).to.match(/reads too much/)
  })

  it("refuses to hand back far too much text", () => {
    const filled = Templating.fill('{{question.big}}', bagHolding({ question: { big: 'x'.repeat(Templating.FilledMax + 1) } }))
    expect(filled).to.deep.eq({ markdown: '{{question.big}}', issue: 'This template comes to far too much text to show.', failkind: 'limit' })
  })

  it("stops a tag filling in a whole list again and again before it builds the text", () => {
    const list = [{ body: 'x'.repeat(Templating.FilledMax) }]
    const filled = Templating.fill('{{list}}'.repeat(6000), bagHolding({ list }))
    expect(filled.issue).to.eq('This template comes to far too much text to show.')
  })

  it("stops a loop that writes nothing, by the time it takes", () => {
    const list = Array.from({ length: 1000 }, () => ({}))
    const filled = Templating.fill('{% for aa in list %}{% for bb in list %}{% for cc in list %}{% endfor %}{% endfor %}{% endfor %}', bagHolding({ list }))
    expect(filled.issue).to.eq('This template takes too long to fill in: a loop inside a loop, perhaps.')
    expect(filled.failkind).to.eq('limit')
  })

  it("stops a fill at a deadline sooner than its own time", () => {
    const list = Array.from({ length: 1000 }, () => ({}))
    const filled = Templating.fill('{% for aa in list %}{% for bb in list %}{% endfor %}{% endfor %}', bagHolding({ list }), Templating.clockNow() + 20)
    expect(filled.failkind).to.eq('limit')
  })

  it("stops a range of a hundred million numbers, by what it allocates", () => {
    const filled = Templating.fill('{% for nn in (1..100000000) %}{% endfor %}', bag)
    expect(filled.issue).to.eq('This template makes too long a list or text at once: a range of more than 100,000, perhaps.')
    expect(filled.failkind).to.eq('limit')
  })

  it("comes to the same text as often as it is asked", () => {
    expect(Templating.fill('{{question.size}}', bag)).to.deep.eq(Templating.fill('{{question.size}}', bag))
  })
})

/** A bag whose one question holds the fields given, as `question` and as the only one of `questions` */
function bagWithQn(qn: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return bagHolding({ question: qn, questions: { only: qn } })
}

const HelperCases: [string, Record<string, unknown>, string, string][] = [
  // regular usage:
  ["> {{ question.clueing | quote }}",                    { clueing: 'Who?\nWhen?' },              "> Who?\n> When?",            'quote keeps every line of a field in the quote'],
  ["> {{ question.clueing | quote }}",                    { clueing: 'Who?\n\n    *verse*\n' }, "> Who?\n>\n> > *verse*",      'quote reads an indent as a quote and drops trailing blank lines, as quotedOf does'],
  ["**{{ question.answer | oneline }}**",                 { answer: 'HAMILTON\n\n(ROWAN)' },     "**HAMILTON (ROWAN)**",        'oneline joins a field onto one line'],
  ["Pct\n{{ question.recap | apart }}",                   { recap: '---\nAfter.' },               "Pct\n\n---\nAfter.",          'apart sets a leading rule apart from the line above'],
  ["Pct\n{{ question.recap | apart }}",                   { recap: '\nAced.\n' },                 "Pct\nAced.",                  'apart leaves anything else in place, its blank ends dropped'],
  ["{% capture told %}By {{ question.who }}\nof {{ question.where }}{% endcapture %}> {{ told | quote }}", { who: 'Ada', where: 'London' }, "> By Ada\n> of London", 'a captured text is shaped whole, text and tags alike'],
  ["{% assign list = questions | values %}{% for question in list %}> {{ question.hint | quote }}|{% endfor %}", { hint: 'Not\nhim' }, "> Not\n> him|", 'a filter works on an item of a list'],
  // composition:
  ["{{ question.clueing | quote | oneline }}",            { clueing: 'Who?\nWhen?' },              "Who? > When?",                'oneline after quote joins the quoted lines'],
  ["> {{ question.clueing | oneline | quote }}",          { clueing: 'Who?\nWhen?' },              "> Who? When?",                'quote after oneline has one line to quote'],
  // trivial cases:
  ["[{{ question.none | quote }}][{{ question.none | oneline }}][{{ '' | apart }}]", {},                 "[][][]",                      'a filter over nothing comes to nothing'],
]

/** Templates near the app's filters' names that must come to the bracketed text: names in the bag are data, filters are filters */
const HelperSafetyCases: [string, Record<string, unknown>, string, string][] = [
  ["[{{ quote }}{{ oneline }}{{ apart }}]",                  {},                                         "[]",              "a filter's name as a key the bag lacks fills in nothing"],
  ["{% assign list = questions | values %}{% for question in list %}[{{ question.quote }}|{{ question.oneline.hint }}]{% endfor %}", { quote: 'data', oneline: { hint: 'x' } }, "[data|x]", "a key named like a filter reads the bag"],
  ["[{{ question.kind }}]",                                        { kind: 'quote' },                          "[quote]",         'a value naming a filter stays data'],
  ["[{{ question.sneaky }}]",                                      { sneaky: '{{ question.kind | quote }}' },        "[{{ question.kind | quote }}]", 'a value holding a template stays text, never filled in again'],
]

/** A template running `{{qn.text}}` through `oneline`, `depth` times */
function onelinesAround(depth: number): string {
  return `{{ question.text${' | oneline'.repeat(depth)} }}`
}

describe("Helpers", () => {
  it.each(HelperCases)('%j over %j => %j: %s', (template, qn, expected) => {
    expect(Templating.fill(template, bagWithQn(qn))).to.deep.eq({ markdown: expected, issue: null, failkind: null })
  })

  it.each(HelperSafetyCases)('%j over %j => %j: %s', (template, qn, expected) => {
    expect(Templating.fill(template, bagWithQn(qn))).to.deep.eq({ markdown: expected, issue: null, failkind: null })
  })

  it("shapes a column as it does a field", () => {
    expect(Templating.fill('> {{ question.author | quote }}', bag).markdown).to.eq('> Ada')
  })

  it("is frozen, and holds the three helpers", () => {
    expect(Object.isFrozen(Templating.Helpers)).to.eq(true)
    expect(Object.keys(Templating.Helpers)).to.have.members(['quote', 'oneline', 'apart'])
  })

  it("counts each piece a loop writes, so a long text a list repeats is stopped before it is built", () => {
    const list = Array.from({ length: 20 }, () => ({}))
    const repeated = '{% for aa in list %}{% for bb in list %}{% for cc in list %}a' + '\n'.repeat(20) + '{% endfor %}{% endfor %}{% endfor %}'
    expect(Templating.fill(repeated, bagHolding({ list })).issue).to.eq('This template comes to far too much text to show.')
  })

  it("stops filters after filters once they have shaped too much, however little the fill comes to", () => {
    const held = bagWithQn({ text: 'x'.repeat(90_000) })
    expect(Templating.fill(onelinesAround(11), held).issue).to.eq(null)
    expect(Templating.fill(onelinesAround(12), held).issue).to.eq('This template shapes too much text: the same long text shaped again and again, perhaps.')
  })

  it("counts what a filter adds against the characters a fill may come to", () => {
    const lines = Array.from({ length: 40_000 }, () => 'x').join('\n')
    const filled = Templating.fill('{{ question.lines | quote }}', bagWithQn({ lines }))
    expect(filled).to.deep.eq({ markdown: '{{ question.lines | quote }}', issue: 'This template comes to far too much text to show.', failkind: 'limit' })
    expect(Templating.fill('{{ question.lines }}', bagWithQn({ lines })).issue).to.eq(null)
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

  it("passes over anything not a question, and comes to nothing for anything not a collection", () => {
    expect(Templating.inOrder([null, 'x', 3, { rank: 1, clueing: 'a' }])).to.have.lengthOf(1)
    expect(Templating.inOrder('questions')).to.deep.eq([])
  })

  it("takes the questions keyed by label, as the bag holds them", () => {
    const questions = { two: { title: 'Two', rank: 2, clueing: 'b' }, one: { title: 'One', rank: 1, clueing: 'a' } }
    expect(Templating.inOrder(questions).map((qn) => [qn.number, qn.title])).to.deep.eq([[1, 'One'], [2, 'Two']])
  })

  it("is the in_order filter, which goes in an assign", () => {
    const questions = { two: { title: 'Two', rank: 2, clueing: 'b' }, one: { title: 'One', rank: 1, clueing: 'a' } }
    const filled = Templating.fill('{% assign played = questions | in_order %}{% for question in played %}{{ question.number }}. {{ question.title }} {% endfor %}', bagHolding({ questions }))
    expect(filled.markdown).to.eq('1. One 2. Two ')
  })
})

describe("valuesOf", () => {
  it("lists a collection keyed by label in its order, a list as it is, and anything else as none", () => {
    expect(Templating.valuesOf({ leon: { title: 'Leon' }, nantes: { title: 'Nantes' } })).to.deep.eq([{ title: 'Leon' }, { title: 'Nantes' }])
    expect(Templating.valuesOf([1, 2])).to.deep.eq([1, 2])
    expect([Templating.valuesOf('Leon'), Templating.valuesOf(null)]).to.deep.eq([[], []])
  })

  it("is the values filter, which goes in an assign, since a for tag takes no filter", () => {
    const filled = Templating.fill('{% assign cats = categories | values %}{{ cats.size }} {{ cats[15].title }}', bag)
    expect(filled.markdown).to.eq('24 TV')
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
    expect(bag.question.clueing).to.eq('By {{question.author}}')
    expect(bag.question_label).to.eq(first.label)
    expect(Object.keys(bag.questions)).to.deep.eq([first.label, second.label])
    expect(bag.questions[second.label]?.size).to.deep.eq({ status: 'ok', value: 6 })
    expect(bag.question).to.eq(bag.questions[first.label])
    expect(bag.quiz).to.deep.include({ title: 'Templated' })
    expect(bag).not.to.have.any.keys('params', 'widgeting_label')
  })

  it("holds no question for a text of the quiz's own, or for a question the run lacks", () => {
    expect(Templating.bagOf(run, null).question).to.deep.eq({})
    expect(Templating.bagOf(run, null).question_label).to.eq('')
    expect(Templating.bagOf(run, 'nowhere').question).to.deep.eq({})
  })

  it("hands back the very same bag for the same run and question, and another for another of either", () => {
    const second_id = present(TwoQuiz.questions[1])._id
    expect(Templating.bagOf(run, first._id)).to.eq(bag)
    expect(Templating.bagOf(run, null)).to.eq(Templating.bagOf(run, null))
    expect(Templating.bagOf(run, second_id)).not.to.eq(bag)
    expect(Templating.bagOf(run, second_id).questions).to.eq(bag.questions)
    const rerun = runOf(TwoQuiz, Library)
    expect(Templating.bagOf(rerun, first._id)).not.to.eq(bag)
    expect(Templating.bagOf(rerun, first._id)).to.deep.eq(bag)
  })

  it("is left as it was by a fill that counts, so the next fill over it counts afresh and still reads question", () => {
    const shared = Templating.bagOf(run, first._id)
    expect(Templating.fill('{% increment n %}{% decrement question %}', shared).markdown).to.eq('0-1')
    expect(Templating.fill('{% increment n %}|{{ question.title }}', shared).markdown).to.eq('0|One')
    expect(shared).not.to.have.property('n')
  })

  it("holds what each widgeting for the whole quiz came to, as quiz.<label>, which a recap's head fills in", () => {
    const entered = { ...TwoQuiz, stored: { playtesters: typed('Ada and Grace') }, widgetings: [Widgeting.fill({ widget_label: 'authors', label: 'playtesters', tier: 'quiz' }), ...TwoQuiz.widgetings] }
    const quizBag = Templating.bagOf(runOf(entered, Library), null)
    expect(quizBag.quiz.playtesters).to.deep.include({ status: 'ok', value: 'Ada and Grace' })
    expect(Templating.fill('Thanks to {{quiz.playtesters}}!', quizBag).markdown).to.eq('Thanks to Ada and Grace!')
  })

  it("holds every question in questions, the archived and the alternates among them, each saying which it is", () => {
    const alternate = questionWith({ title: 'Spare', qnum: '3', viz: 'secondary' })
    const archived = questionWith({ title: 'Gone', viz: 'archived', clueing: 'By {{question.author}}' })
    const viz = { ...TwoQuiz, questions: [first, archived, alternate] }
    const vizRun = runOf(viz, Library)
    const quizBag = Templating.bagOf(vizRun, null)
    expect(Object.values(quizBag.questions).map((qn) => qn.title)).to.deep.eq(['One', 'Gone', 'Spare'])
    expect(quizBag.quiz).to.not.have.property('questions')
    expect(Object.values(quizBag.questions).map((qn) => [qn.archived, qn.secondary])).to.deep.eq([[false, false], [true, false], [false, true]])
    expect(Templating.bagOf(vizRun, archived._id).question.title).to.eq('Gone')
  })

  it("holds the hunt's categories, each with its title, for a template to loop over", () => {
    expect(Templating.fill('{{categories.tv.title}}', bag).markdown).to.eq('TV')
    expect(Templating.fill('{% assign cats = categories | values %}{% for category in cats %}{{ category.label }} {% endfor %}', bag).markdown.split(' ')).to.have.lengthOf(25)
  })

  it("draws an image in a formula's or a bot's column as a link to it, and keeps one typed into a field or an entry", () => {
    const Imaged = [
      ...Library,
      Widget.fill({ label: 'mapper', formulary: 'jsonata', formula: '"![map](https://host/m.png?q=" & question.title & ")"' }),
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
    expect(Templating.fill('{{question.map}}', imagedBag).markdown).to.eq('&#33;[map](https://host/m.png?q=Pic)')
    expect(Templating.fill('{{question.map.value}} {{#quiz.maps.value}}{{.}}{{/quiz.maps.value}} {{quiz.maps}}', imagedBag).markdown).not.to.include('![')
    expect(Templating.fill('{{question.clueing}} {{question.author}}', imagedBag).markdown).to.eq('![typed](https://host/t.png) ![entered](https://host/e.png)')
    expect(imagedRun.widgeteds.get('map')?.get(pictured._id)?.value).to.eq('![map](https://host/m.png?q=Pic)')
  })

  it("draws an image in a liquidize template's column as a link to it, though its template typed one", () => {
    const Imaged = [...Library, Widget.fill({ label: 'pictured', formulary: 'liquidize', formula: '![logo](https://host/l.png) {{ question.title }}' })]
    const imaged = { ...TwoQuiz, widgetings: [...TwoQuiz.widgetings, Widgeting.fill({ label: 'picture', widget_label: 'pictured' })] }
    const imagedRun = runOf(imaged, Imaged)
    expect(Templating.fill('{{question.picture}}', Templating.bagOf(imagedRun, first._id)).markdown).to.match(/^&#33;\[logo\]/)
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
    expect(Templating.fill('[{{ question.fn.value }}]', lambdaBag).markdown).to.eq('[]')
  })

  it("offers no widgeting for the whole quiz for templating: it has no question's cell to fill", () => {
    const entered = { ...TwoQuiz, widgetings: [Widgeting.fill({ widget_label: 'authors', label: 'playtesters', tier: 'quiz' }), ...TwoQuiz.widgetings] }
    expect(Templating.templatableSources(entered, Library).map(({ source }) => source)).to.not.include('playtesters')
  })
})

describe("finishedQuestionsOf", () => {
  it("holds every question as the last widgeting left it, each templateable source filled in over its own question", () => {
    expect(Templating.finishedQuestionsOf(run, ['clueing']).map((qn) => qn.clueing)).to.deep.eq(['By Ada', '{{#qns'])
    expect(Templating.finishedQuestionsOf(run, ['clueing'])).to.eq(Templating.finishedQuestionsOf(run, ['clueing']))
  })

  it("is the run's own questions when nothing is nominated", () => {
    expect(Templating.finishedQuestionsOf(run, [])).to.eq(run.questionsAfter)
  })
})

describe("fillWithin", () => {
  it("fills in as fill does, spending the fill's time from the column's budget, per the doc examples", () => {
    const budget = Templating.columnBudget()
    expect(Templating.fillWithin('By {{ question.author }}', bag, budget)).to.deep.eq(Templating.fill('By {{ question.author }}', bag))
    expect(budget.leftMs).to.be.below(Templating.ColumnMs)
    expect(Templating.fillWithin('{{ question.title }}', bag, { leftMs: 0, stopped: null }).failkind).to.eq('limit')
  })

  it("stops its column at a limit, every later fill saying the same at once, its own text as typed", () => {
    const budget = Templating.columnBudget()
    const runaway = Templating.fillWithin('{% for aa in (1..100000000) %}{% endfor %}', bag, budget)
    expect(runaway.failkind).to.eq('limit')
    expect(Templating.fillWithin('By {{ question.author }}', bag, budget)).to.deep.eq({ markdown: 'By {{ question.author }}', issue: runaway.issue, failkind: 'limit' })
  })

  it("leaves its column going past a template that does not read, which may differ question by question", () => {
    const budget = Templating.columnBudget()
    expect(Templating.fillWithin('{% if x %}', bag, budget).failkind).to.eq('syntax')
    expect(Templating.fillWithin('By {{ question.author }}', bag, budget).markdown).to.eq('By Ada')
  })
})

describe("finishedQuestionsOf, each source held to one budget of time", () => {
  afterEach(() => { vi.restoreAllMocks() })

  it("leaves a source's later questions as typed once its fills run out its time, and every other source filling on", () => {
    const many = Array.from({ length: 300 }, (_unused, idx) => questionWith({ title: `T${String(idx)}`, qnum: String(idx + 1), clueing: '{% for aa in (1..100) %}{% endfor %}{{ question.title }}', hint: '{{ question.qnum }}' }))
    const quiz = { ...Quiz.blank('Many'), questions: many, templateable: ['clueing', 'hint'] }
    const manyRun = runOf(quiz, [])
    // A clock that moves a hundredth of a millisecond each time it is read, so a fill's time is how often it is asked.
    let tick = 0
    vi.spyOn(performance, 'now').mockImplementation(() => { tick += 0.01; return tick })
    const finished = Templating.finishedQuestionsOf(manyRun, ['clueing', 'hint'])
    const firstStopped = finished.findIndex((qn) => qn.clueing !== qn.title)
    expect(firstStopped).to.be.above(0)
    expect(finished.slice(firstStopped).every((qn) => qn.clueing === many[0]?.clueing)).to.be.true
    expect(finished.every((qn, idx) => qn.hint === String(idx + 1))).to.be.true
  })
})

describe("filledBagOf", () => {
  it("holds every question with its templated texts filled in, each over its own question, once", () => {
    const filled = Templating.filledBagOf(TwoQuiz, run)
    expect(Object.values(filled.questions).map((qn) => qn.clueing)).to.deep.eq(['By Ada', '{{#qns'])
    expect(filled.question).to.deep.eq({})
  })

  it("fills in a text entry the quiz templates, as its widgeted's value", () => {
    const bylined = { ...TwoQuiz, questions: [{ ...first, stored: { ...first.stored, byline: typed('By {{question.author}}') } }], widgetings: [...TwoQuiz.widgetings, Widgeting.fill({ label: 'byline', widget_label: 'authors' })], templateable: ['byline'] }
    const [qn] = Object.values(Templating.filledBagOf(bylined, runOf(bylined, Library)).questions)
    expect(qn?.byline).to.deep.include({ status: 'ok', value: 'By Ada' })
    expect(qn?.clueing).to.eq('By {{question.author}}')
  })

  it("fills a filled text in no further, so a text naming another templated one reads it as typed", () => {
    const chained = { ...TwoQuiz, questions: [{ ...first, hint: '{{question.clueing}}' }], templateable: ['clueing', 'hint'] }
    const [qn] = Object.values(Templating.filledBagOf(chained, runOf(chained, Library)).questions)
    expect([qn?.clueing, qn?.hint]).to.deep.eq(['By Ada', 'By {{question.author}}'])
  })

  it("is the bag for no question when the quiz templates nothing", () => {
    expect(Templating.filledBagOf({ templateable: [] }, run)).to.eq(Templating.bagOf(run, null))
  })

  it("hands back the very same bag for the same run, apart from the bag of the questions as typed", () => {
    expect(Templating.filledBagOf(TwoQuiz, run)).to.eq(Templating.filledBagOf(TwoQuiz, run))
    expect(Templating.filledBagOf(TwoQuiz, run)).not.to.eq(Templating.bagOf(run, null))
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
    const hinted = { ...TwoQuiz, questions: [{ ...first, hint: '{{question.author}}' }, second] }
    expect(Templating.filledQuiz(hinted, runOf(hinted, Library)).questions[0]?.hint).to.eq('{{question.author}}')
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
    expect([valued.value, (valued.question as { title: string }).title]).to.deep.eq([53, 'One'])
    expect(Templating.fill('{{ value }}%', valued).markdown).to.eq('53%')
  })

  it("holds the questions' templateable sources filled in, as the finished bag does", () => {
    expect((Templating.valuedBagOf(run, ['clueing'], first._id, null).question as { clueing: string }).clueing).to.eq('By Ada')
    expect((Templating.valuedBagOf(run, [], first._id, null).question as { clueing: string }).clueing).to.eq('By {{question.author}}')
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
