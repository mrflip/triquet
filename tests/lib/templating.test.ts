import { describe, expect, it } from 'vitest'
import * as Templating from '../../src/lib/templating'
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

describe("issueOf", () => {
  it.each(IssueCases)('%j => %j: %s', (template, expected) => {
    expect(Templating.issueOf(template)).to.eq(expected)
  })
})

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
