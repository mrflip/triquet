import { describe, expect, it, vi } from 'vitest'
import * as Runner from '../../../src/lib/formulary/runner'
import { LiquidizeFormulary } from '../../../src/lib/formulary/liquidize'
import * as Templating from '../../../src/lib/templating'
import { Question, type QuestionT } from '../../../src/models/question'
import { Quiz } from '../../../src/models/quiz'
import { Widget, type WidgetT } from '../../../src/models/widget'
import { Widgeted, type JsonT, type WidgetedHistoryT, type WidgetedT } from '../../../src/models/widgeted'
import { Widgeting, type WidgetingT } from '../../../src/models/widgeting'
import { SeedWidgets } from '../../../src/models/seeds'
import { present } from '../../support/present'
import { runOf } from '../../support/runs'

const failed = (message: string): WidgetedT => Widgeted.errored({ message, at: null, response: null })

/** A cell whose newest row, and newest `ok` row, both hold `value` */
function answered(value: JsonT): WidgetedHistoryT {
  const row = { status: 'ok' as const, value, message: null, result_meta: {}, _creationTime: 3.5 }
  return { newest: row, ok: row }
}

/** A cell whose only ask failed */
const onlyFailed: WidgetedHistoryT = { newest: { status: 'errored', value: null, message: 'Too many requests.', result_meta: {}, _creationTime: 7.5 }, ok: null }

const blurb = Widget.fill({ label: 'blurb', formulary: 'liquidize', formula: 'Q: {{ qn.title }}' })
const shout = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: "'Hi, {{ qn.full_answer }}'" })
const dumdum = present(SeedWidgets.find((widget) => widget.label === 'dumdum'))
const library: WidgetT[] = [blurb, shout, dumdum]

const leon: QuestionT = { ...Question.blank(), label: 'leon', qnum: '1', title: 'Leon', full_answer: 'Leon Trotsky', hint: 'Ice', notes: 'See {{ qn.hint }}', stored: { dumdum: answered({ guess: 'Leon', template: '*{{ qn.title }}*' }) } }
const ivan: QuestionT = { ...Question.blank(), label: 'ivan', qnum: '2', title: 'Ivan', chains_to: leon._id, stored: { dumdum: onlyFailed } }
const widgetings: WidgetingT[] = [
  Widgeting.fill({ label: 'shout', widget_label: 'shout' }),
  Widgeting.fill({ label: 'dumdum', widget_label: 'dumdum' }),
  Widgeting.fill({ label: 'playtesters', widget_label: 'shout', tier: 'quiz' }),
]
const quiz = { ...Quiz.blank('Princes'), smiths_note: 'Meta: {{ qn.title }} rules', questions: [leon, ivan], widgetings }
const run = runOf(quiz, library)

/** The bag a widgeting placed after every other reads, for one question */
const bagFor = (question: QuestionT) => present(Runner.bagsAt(run, { label: 'blurbing', params: {} }).get(question._id))
/** A widgeting of `blurb` with the params given */
const blurbing = (params: Record<string, JsonT>): WidgetingT => Widgeting.fill({ label: 'blurbing', widget_label: 'blurb', params })
/** What `blurb`, with its widgeting's params, comes to for one question */
const runOn = (params: Record<string, JsonT>, question: QuestionT = leon) => LiquidizeFormulary.run(blurb, blurbing(params), bagFor(question)).widgeted

describe('LiquidizeFormulary', () => {
  it('reports the facts of a template filled in on render', () => {
    expect([LiquidizeFormulary.kind, LiquidizeFormulary.defaultInput, LiquidizeFormulary.refresh, LiquidizeFormulary.store]).to.deep.eq(['liquidize', '$', 'live', null])
    expect(LiquidizeFormulary.columnMs).to.eq(250)
    expect(LiquidizeFormulary.config.safeParse({}).success).to.be.true
    expect(LiquidizeFormulary.config.safeParse({ model_tier: 'quick' }).success).to.be.false
  })

  describe('paramsOf', () => {
    const Cases: [unknown, boolean, string][] = [
      // params                                                                    passes  blurb
      [{},                                                                          true,  'nothing: the widget\'s template'],
      [{ template: '{{ qn.title }}!' },                                             true,  'a template of its own'],
      [{ template_from: { ref: 'dumdum', formula: '$.value.template' } },           true,  'a template read from a widgeting by a formula'],
      [{ template_from: { ref: 'notes' } },                                         true,  'a template read from a field'],
      [{ template_from: { ref: 'quiz.playtesters' } },                              true,  'a template read from a widgeting for the whole quiz'],
      [{ template: '{% if qn.hint %}' },                                            false, 'a template that does not read as Liquid'],
      [{ template: '' },                                                            false, 'an empty template'],
      [{ template: 'x', template_from: { ref: 'notes' } },                          false, 'a template and a template from the bag both'],
      [{ template_from: { ref: 'question.notes' } },                                false, 'a ref in the grammar before October 2026'],
      [{ template_from: { ref: 'Not A Ref' } },                                     false, 'a ref that names nothing'],
      [{ template_from: { ref: 'dumdum', formula: '$sum(' } },                      false, 'a formula that does not parse'],
      [{ template_from: { ref: 'dumdum', extra: 1 } },                              false, 'a key a template_from does not take'],
      [{ min: 1 },                                                                  false, 'an entry\'s param'],
    ]
    for (const [params, passes, describes] of Cases) {
      it(`${passes ? 'takes' : 'refuses'} ${describes}`, () => {
        expect(LiquidizeFormulary.paramsOf().safeParse(params).success).to.eq(passes)
      })
    }

    it("says Liquid's own sentence of the template it refuses, of the template", () => {
      const checked = LiquidizeFormulary.paramsOf().safeParse({ template: '{% if qn.hint %}' })
      expect(checked.error?.issues.map((issue) => [issue.path, issue.message])).to.deep.eq([[['template'], 'does not read as Liquid: tag {% if qn.hint %} not closed, line:1, col:1']])
    })

    it('says of the formula what is wrong with it', () => {
      const checked = LiquidizeFormulary.paramsOf().safeParse({ template_from: { ref: 'dumdum', formula: '$sum(' } })
      expect(checked.error?.issues[0]?.path).to.deep.eq(['template_from', 'formula'])
    })
  })

  describe('check', () => {
    const Cases: [Pick<WidgetT, 'formula' | 'input_formula'>, string | null, string][] = [
      [{ formula: '{{ qn.title }}', input_formula: '$' },             null,                                                          'a template that reads, over the bag'],
      [{ formula: '{% if qn.hint %}', input_formula: '$' },           'The template: tag {% if qn.hint %} not closed, line:1, col:1', 'a template that does not read'],
      [{ formula: ' '.repeat(3), input_formula: '$' },                'The template is empty',                                       'a template of blanks'],
    ]
    for (const [widget, expected, describes] of Cases) {
      it(`says ${expected === null ? 'nothing of' : 'what is wrong with'} ${describes}`, () => {
        expect(LiquidizeFormulary.check(widget)).to.eq(expected)
      })
    }

    it('names an input formula that does not parse', () => {
      expect(LiquidizeFormulary.check({ formula: 'x', input_formula: '$sum(' })).to.match(/^The input formula: /)
    })
  })

  describe('input', () => {
    it('hands on the bag itself for the default input', () => {
      const bag = bagFor(leon)
      expect(LiquidizeFormulary.input({ input_formula: '$' }, bag)).to.deep.eq({ status: 'ok', input: bag })
      expect((LiquidizeFormulary.input({ input_formula: '$' }, bag) as { input: unknown }).input).to.equal(bag)
    })

    it('hands on an object a formula made, as plain JSON, without the functions it holds', () => {
      expect(LiquidizeFormulary.input({ input_formula: "{ 'title': qn.title, 'shout': $uppercase }" }, bagFor(leon))).to.deep.eq({ status: 'ok', input: { title: 'Leon' } })
    })

    it('fails an input that is no object', () => {
      expect(LiquidizeFormulary.input({ input_formula: 'qn.title' }, bagFor(leon))).to.deep.eq({ status: 'errored', message: 'The input formula has to come to an object, for the template to be filled in from', stops: false })
    })

    it('is nothing for an input of nothing', () => {
      expect(LiquidizeFormulary.input({ input_formula: 'qn.nothing' }, bagFor(leon))).to.deep.eq({ status: 'missing' })
    })
  })

  describe('ownOf', () => {
    it("is what a widgeting says of its template, and nothing for params that do not fit or no widgeting", () => {
      expect(LiquidizeFormulary.ownOf({ params: { template: '{{ qn.hint }}' } })).to.deep.eq({ template: '{{ qn.hint }}' })
      expect(LiquidizeFormulary.ownOf({ params: { template_from: { ref: 'dumdum' } } })).to.deep.eq({ template_from: { ref: 'dumdum' } })
      expect(LiquidizeFormulary.ownOf({ params: { loud: true } })).to.deep.eq({})
      expect(LiquidizeFormulary.ownOf(null)).to.deep.eq({})
    })
  })

  describe('templateOf', () => {
    const Cases: [Record<string, JsonT>, QuestionT, ReturnType<typeof LiquidizeFormulary.templateOf>, string][] = [
      // params                                                                  question  expected                                                       blurb
      [{},                                                                        leon,     { status: 'ok', template: 'Q: {{ qn.title }}' },             "the widget's, when the widgeting says nothing"],
      [{ template: '{{ qn.qnum }}.' },                                            leon,     { status: 'ok', template: '{{ qn.qnum }}.' },                "the widgeting's own"],
      [{ template_from: { ref: 'notes' } },                                       leon,     { status: 'ok', template: 'See {{ qn.hint }}' },             'a field itself'],
      [{ template_from: { ref: 'notes' } },                                       ivan,     { status: 'missing' },                                        'an empty field is nothing to fill in'],
      [{ template_from: { ref: 'shout' } },                                       leon,     { status: 'ok', template: 'Hi, {{ qn.full_answer }}' },      "a widgeting's value, with no formula"],
      [{ template_from: { ref: 'dumdum', formula: '$.value.template' } },         leon,     { status: 'ok', template: '*{{ qn.title }}*' },              "a bot's reply, by a formula"],
      [{ template_from: { ref: 'dumdum' } },                                      leon,     { status: 'errored', message: 'The template read from «dumdum» comes to an object, not text', stops: false }, "a bot's whole reply, which is no text"],
      [{ template_from: { ref: 'dumdum', formula: '$.value.template' } },         ivan,     { status: 'errored', message: "The template's source, «dumdum», failed: Too many requests.", stops: false }, 'a failed ask, which passes by the formula'],
      [{ template_from: { ref: 'dumdum', formula: '$.value.nothing' } },          leon,     { status: 'missing' },                                        'a formula that comes to nothing'],
      [{ template_from: { ref: 'dumdum', formula: '$.value.guess + 1' } },        leon,     { status: 'errored', message: "The template's formula: The left side of the \"+\" operator must evaluate to a number (at 15)", stops: false }, 'a formula that fails'],
      [{ template_from: { ref: 'quiz', formula: 'smiths_note' } },               leon,     { status: 'ok', template: 'Meta: {{ qn.title }} rules' },    'a word of the bag, by a formula'],
      [{ template_from: { ref: 'quiz.playtesters' } },                            leon,     { status: 'ok', template: 'Hi, {{ qn.full_answer }}' },      'a widgeting for the whole quiz'],
      [{ template_from: { ref: 'butnot' } },                                      ivan,     { status: 'ok', template: 'Ice' },                            "the view butnot: the hint of the question it chains to"],
      [{ template_from: { ref: 'rank' } },                                        leon,     { status: 'errored', message: 'The template read from «rank» comes to a number, not text', stops: false }, 'a key that is no text'],
      [{ template_from: { ref: 'later_one' } },                                   leon,     { status: 'missing' },                                        'a widgeting the bag does not hold'],
      [{ template_from: { ref: 'notes' }, stray: true },                          leon,     { status: 'ok', template: 'Q: {{ qn.title }}' },             "params that do not fit, read as nothing of the widgeting's own"],
    ]
    for (const [params, question, expected, describes] of Cases) {
      it(`reads ${describes}`, () => {
        expect(LiquidizeFormulary.templateOf(blurb, blurbing(params), bagFor(question))).to.deep.eq(expected)
      })
    }

    it("reads the widget's with no widgeting", () => {
      expect(LiquidizeFormulary.templateOf(blurb, null, bagFor(leon))).to.deep.eq({ status: 'ok', template: 'Q: {{ qn.title }}' })
    })
  })

  describe('run', () => {
    const Cases: [Record<string, JsonT>, QuestionT, WidgetedT, string][] = [
      // params                                                            question  expected                                                   blurb
      [{},                                                                  leon,     Widgeted.ok('Q: Leon'),                                    "the widget's template, filled in"],
      [{ template: '{{ qn.hint }}' },                                       ivan,     Widgeted.missing,                                          'a fill of nothing is missing'],
      [{ template: '  {{ qn.hint }}\n' },                                   ivan,     Widgeted.missing,                                          'a fill of blanks is missing'],
      [{ template: '{{ qn.shout }}' },                                      leon,     Widgeted.ok('Hi, {{ qn.full_answer }}'),                   "a widgeting before it, filled in as its value's text and not filled again"],
      [{ template: '{{ qn.dumdum.value.guess }} by {{ hunt.title }}' },    leon,     Widgeted.ok('Leon by Deep Lake'),                          'a bot reply and the hunt'],
      [{ template: '{{ qn.title | upcase }}{{ qns | size }}' },            leon,     Widgeted.ok('LEON2'),                                      "Liquid's own filters"],
      [{ template: '{{ qn.notes | oneline }}' },                           leon,     Widgeted.ok('See {{ qn.hint }}'),                          "the app's own filters, and a field not filled again"],
      [{ template_from: { ref: 'shout' } },                                 leon,     Widgeted.ok('Hi, Leon Trotsky'),                           'a template a formula wrote, filled in here'],
      [{ template_from: { ref: 'dumdum', formula: '$.value.template' } },   leon,     Widgeted.ok('*Leon*'),                                     'a template a bot wrote, filled in here'],
      [{ template_from: { ref: 'notes' } },                                 leon,     Widgeted.ok('See Ice'),                                    'a template a field holds'],
      [{ template_from: { ref: 'notes' } },                                 ivan,     Widgeted.missing,                                          'a template read from nothing'],
      [{ template_from: { ref: 'dumdum' } },                                leon,     failed('The template read from «dumdum» comes to an object, not text'), 'a template read as no text'],
      [{ template: '{% for qn in qns %}{% for x in qns %}{% for y in qns %}{% endfor %}{% endfor %}{% endfor %}' }, leon, Widgeted.missing, 'loops that write nothing'],
    ]
    for (const [params, question, expected, describes] of Cases) {
      it(`comes to ${describes}`, () => {
        expect(runOn(params, question)).to.deep.eq(expected)
      })
    }

    it("fails with Liquid's own sentence a template read from the bag that does not read", () => {
      const notes = { ...leon, notes: '{% if qn.hint %}' }
      const brokenRun = runOf({ ...quiz, questions: [notes, ivan] }, library)
      const bag = present(Runner.bagsAt(brokenRun, { label: 'blurbing', params: {} }).get(notes._id))
      expect(LiquidizeFormulary.run(blurb, blurbing({ template_from: { ref: 'notes' } }), bag).widgeted).to.deep.eq(failed('The template: tag {% if qn.hint %} not closed, line:1, col:1'))
    })

    it('fails an input that fails, and is nothing for an input of nothing', () => {
      expect(LiquidizeFormulary.run({ ...blurb, input_formula: 'qn.title' }, null, bagFor(leon)).widgeted).to.deep.eq(failed('The input formula has to come to an object, for the template to be filled in from'))
      expect(LiquidizeFormulary.run({ ...blurb, input_formula: 'qn.nothing' }, null, bagFor(leon)).widgeted).to.deep.eq(Widgeted.missing)
    })

    it('fills the template over what the input came to', () => {
      expect(LiquidizeFormulary.run({ formula: '{{ title }}?', input_formula: "{ 'title': qn.title }" }, null, bagFor(leon)).widgeted).to.deep.eq(Widgeted.ok('Leon?'))
    })

    it('stops a runaway template, and with it the rest of its column', () => {
      const deep = '{% for aa in (1..1000) %}{% for bb in (1..1000) %}x{% endfor %}{% endfor %}'
      const ran = LiquidizeFormulary.run(blurb, blurbing({ template: deep }), bagFor(leon))
      expect(ran.widgeted.status).to.eq('errored')
      expect(ran.stops).to.be.true
    })

    it("stops at its column's deadline, and with it the rest of its column", () => {
      // Its input formula, worked out by the same deadline, is stopped first.
      const ran = LiquidizeFormulary.run(blurb, null, bagFor(leon), Templating.clockNow() - 1)
      expect(ran).to.deep.eq({ widgeted: failed('The input formula: The formula took too long to finish'), stops: true })
    })

    it('fills in as ever before its deadline', () => {
      expect(LiquidizeFormulary.run(blurb, null, bagFor(leon), Templating.clockNow() + 60_000)).to.deep.eq({ widgeted: Widgeted.ok('Q: Leon'), stops: false })
    })

    it('does not stop its column for a template that does not read, which may differ question by question', () => {
      expect(LiquidizeFormulary.run(blurb, blurbing({ template_from: { ref: 'shout' } }), { ...bagFor(leon), qn: { ...bagFor(leon).qn, shout: Widgeted.ok('{% if x %}') } }).stops).to.be.false
    })

    it("stops its column for a template that does not read once the column's deadline has passed, as reading it takes time too", () => {
      const bag = { ...bagFor(leon), qn: { ...bagFor(leon).qn, shout: Widgeted.ok('{% if x %}') } }
      expect(LiquidizeFormulary.run(blurb, blurbing({ template_from: { ref: 'shout' } }), bag, Templating.clockNow() - 1).stops).to.be.true
    })
  })

  describe('advice', () => {
    it('asks for a template, over the bag and one real question', () => {
      const advice = LiquidizeFormulary.advice(blurb, { label: 'blurbing', description: 'A line for the board' }, bagFor(leon))
      expect(advice).to.include('Liquid')
      expect(advice).to.include('## The template')
      expect(advice).to.include('Q: {{ qn.title }}')
      expect(advice).to.include('"title": "Leon"')
      expect(advice).to.include('A line for the board')
    })

    it('says what an input formula of its own makes, in place of the bag', () => {
      const advice = LiquidizeFormulary.advice({ ...blurb, input_formula: "{ 'title': qn.title }" }, null, null)
      expect(advice).to.include("{ 'title': qn.title }")
      expect(advice).not.to.include('JSON Schema')
    })
  })
})

describe('a quiz run with a liquidize widgeting', () => {
  const later = Widget.fill({ label: 'measure', formulary: 'jsonata', formula: '$length(qn.blurbing.value)' })
  const steps: WidgetingT[] = [
    blurbing({ template: '{{ qn.title }}: {{ qn.dumdum.value.guess }}' }),
    Widgeting.fill({ label: 'dumdum', widget_label: 'dumdum' }),
    Widgeting.fill({ label: 'measure', widget_label: 'measure' }),
    Widgeting.fill({ label: 'roster', widget_label: 'blurb', tier: 'quiz', params: { template: '{% for qn in qns %}{{ qn.title }} {% endfor %}' } }),
  ]
  const ran = runOf({ ...quiz, widgetings: steps }, [...library, later])

  it('reads only the widgetings before it, in run order', () => {
    expect(Runner.widgetedOf(ran, 'blurbing', leon._id)).to.deep.eq(Widgeted.ok('Leon: '))
  })

  it('is read by the widgetings after it as text', () => {
    expect(Runner.widgetedOf(ran, 'measure', leon._id)).to.deep.eq(Widgeted.ok(6))
  })

  it('runs once for the whole quiz, over every question', () => {
    expect(Runner.quizWidgetedOf(ran, 'roster')).to.deep.eq(Widgeted.ok('Leon Ivan '))
  })

  it("keeps on past a question whose template read from the bag does not read", () => {
    const broken = { ...leon, notes: '{% if qn.hint %}' }
    const fine = { ...ivan, notes: '*{{ qn.title }}*' }
    const mixed = runOf({ ...quiz, questions: [broken, fine], widgetings: [blurbing({ template_from: { ref: 'notes' } })] }, library)
    expect(Runner.widgetedOf(mixed, 'blurbing', broken._id).status).to.eq('errored')
    expect(Runner.widgetedOf(mixed, 'blurbing', fine._id)).to.deep.eq(Widgeted.ok('*Ivan*'))
  })
})

/** A clock that moves a hundredth of a millisecond each time it is read, so a fill's time is how often it is asked */
function ticking() {
  let tick = 0
  return vi.spyOn(performance, 'now').mockImplementation(() => { tick += 0.01; return tick })
}

describe('a column of templates, held to one budget of time', () => {
  const many: QuestionT[] = Array.from({ length: 300 }, (_unused, idx) => ({ ...Question.blank(), label: `q_${String(idx)}`, qnum: String(idx + 1), title: `T${String(idx)}` }))
  const looping = blurbing({ template: '{% for aa in (1..100) %}{% endfor %}{{ qn.title }}' })

  it("stops every question after the fill that ran out its column's time, each reading the same failure", () => {
    const clock = ticking()
    try {
      const ran = runOf({ ...Quiz.blank('Many'), questions: many, widgetings: [looping] }, library)
      const cells = many.map((question) => Runner.widgetedOf(ran, 'blurbing', question._id))
      const firstStopped = cells.findIndex((cell) => cell.status === 'errored')
      expect(cells[0]).to.deep.eq(Widgeted.ok('T0'))
      expect(firstStopped).to.be.above(0)
      expect(cells.slice(0, firstStopped).every((cell) => cell.status === 'ok')).to.be.true
      expect(cells.slice(firstStopped).every((cell) => cell === cells[firstStopped])).to.be.true
      expect(cells[firstStopped]).to.deep.eq(failed('The template: This template takes too long to fill in: a loop inside a loop, perhaps.'))
    } finally {
      clock.mockRestore()
    }
  })

  it('gives each column its own time', () => {
    const clock = ticking()
    try {
      const twice = [looping, Widgeting.fill({ label: 'blurbing_2', widget_label: 'blurb', params: looping.params })]
      const ran = runOf({ ...Quiz.blank('Many'), questions: many, widgetings: twice }, library)
      expect(Runner.widgetedOf(ran, 'blurbing_2', present(many[0])._id)).to.deep.eq(Widgeted.ok('T0'))
    } finally {
      clock.mockRestore()
    }
  })
})
