import { describe, expect, it } from 'vitest'
import * as Runner from '../../../src/lib/formulary/runner'
import { JsonataFormulary } from '../../../src/lib/formulary/jsonata'
import { Question } from '../../../src/models/question'
import { Quiz } from '../../../src/models/quiz'
import { Widgeted, type WidgetedT } from '../../../src/models/widgeted'
import { present } from '../../support/present'
import { runOf } from '../../support/runs'

const question = { ...Question.blank(), qnum: '1', title: 'Leon', full_answer: 'Leon' }
const quiz = { ...Quiz.blank('Princes'), smiths_note: 'Meta: their initials.', questions: [question] }
const place = Runner.placeOf({ label: 'deep_lake', forced_label: null, title: 'The Deep Lake Hunt' }, { label: 'finals', title: '' })
const bag = present(Runner.bagsAt(runOf(quiz, [], place), { label: 'col', params: { size: 3 } }).get(question._id))

/** What `formula`, over the whole bag, comes to for the one question */
const runOn = (formula: string, input_formula = '$') => JsonataFormulary.run({ formula, input_formula }, null, bag)
const failed = (message: string): WidgetedT => Widgeted.errored({ message, at: null, response: null })

describe('JsonataFormulary', () => {
  it('reports the facts of a formula worked out on render', () => {
    expect([JsonataFormulary.kind, JsonataFormulary.defaultInput, JsonataFormulary.refresh, JsonataFormulary.store]).to.deep.eq(['jsonata', '$', 'live', null])
    expect(JsonataFormulary.config.safeParse({}).success).to.be.true
    expect(JsonataFormulary.config.safeParse({ model_tier: 'quick' }).success).to.be.false
  })

  describe('run', () => {
    const Cases: [string, WidgetedT, string][] = [
      // formula                                   expected                                           blurb
      ["6 * 7",                                    Widgeted.ok(42),                                   'a number is a value'],
      ["'hello'",                                  Widgeted.ok('hello'),                              'text is a value'],
      ["1 = 1",                                    Widgeted.ok(true),                                 'a boolean is a value'],
      ["[1, 2, 3]",                                Widgeted.ok([1, 2, 3]),                            'a list is a value, as plain JSON'],
      ["{ 'b': 2, 'a': [1] }",                     Widgeted.ok({ a: [1], b: 2 }),                     'an object is a value, as plain JSON'],
      ["{ 'value': 5, 'stale': true }",            Widgeted.ok({ stale: true, value: 5 }),            'an object shaped like the old stale mark is only an object'],
      ["nothing.at.all",                           Widgeted.missing,                                  'a path that leads nowhere is missing'],
      ["''",                                       Widgeted.missing,                                  'an empty string is missing'],
      ["null",                                     Widgeted.missing,                                  'null is missing'],
      ["$exists(nothing) ? 1",                     Widgeted.missing,                                  'a condition with no else is missing'],
      ["$sum",                                     failed('The formula came to a function rather than a value'), 'a function is not a value'],
      // what the bag holds:
      ["hunt.title",                               Widgeted.ok('The Deep Lake Hunt'),                 "the hunt's title"],
      ["hunt.label & '/' & realm.label",           Widgeted.ok('deep_lake/finals'),                   "the hunt's and the realm's labels"],
      ["realm.title",                              Widgeted.ok('Finals'),                             "the realm's title, as shown"],
      ["quiz.smiths_note",                         Widgeted.ok('Meta: their initials.'),              "the smith's note"],
      ["widgeting_label & ':' & $string(params.size)", Widgeted.ok('col:3'),                          "the widgeting's own label and params"],
      ["hunt._id",                                 Widgeted.missing,                                  'no id'],
    ]
    for (const [formula, expected, blurb] of Cases) {
      it(blurb, () => {
        expect(runOn(formula).widgeted).to.deep.eq(expected)
      })
    }

    it('carries no stale mark of its own, only the widgeted and whether to stop', () => {
      expect(runOn("{ 'value': 5, 'stale': true }")).to.have.all.keys('stops', 'widgeted')
    })

    it('runs the formula over its input, not over the bag', () => {
      expect(runOn('$uppercase($)', 'qn.title').widgeted).to.deep.eq(Widgeted.ok('LEON'))
    })

    it('reads an input of nothing as missing, and does not run the formula', () => {
      expect(runOn('42', 'qn.nothing').widgeted).to.deep.eq(Widgeted.missing)
    })

    it('reports a formula, or an input formula, that does not parse as a failure that does not stop the rest', () => {
      const bad = runOn('$sum(')
      expect([bad.widgeted.status, bad.stops]).to.deep.eq(['errored', false])
      const badInput = runOn('1', '$sum(')
      expect(badInput.widgeted.err?.message).to.match(/^The input formula: /)
    })

    it('stops a formula that will not end, and says the rest should stop too', () => {
      const ran = runOn('( $spin := function() { $spin() }; $spin() )')
      expect([ran.widgeted.status, ran.stops]).to.deep.eq(['errored', true])
    })
  })

  describe('input', () => {
    it('is the whole bag by default', () => {
      expect(JsonataFormulary.input({ input_formula: '$' }, bag)).to.deep.eq({ status: 'ok', input: bag })
    })

    it('is what the input formula comes to, or missing for nothing', () => {
      expect(JsonataFormulary.input({ input_formula: 'qn.title' }, bag)).to.deep.eq({ status: 'ok', input: 'Leon' })
      expect(JsonataFormulary.input({ input_formula: 'qn.nothing' }, bag)).to.deep.eq({ status: 'missing' })
    })
  })

  describe('check', () => {
    it('passes a formula and an input formula that both read', () => {
      expect(JsonataFormulary.check({ formula: '$sum(qn.items)', input_formula: '$' })).to.be.null
    })

    it('names the problem with either, saying which', () => {
      expect(JsonataFormulary.check({ formula: '$sum(', input_formula: '$' })).to.be.a('string')
      expect(JsonataFormulary.check({ formula: '1', input_formula: '$sum(' })).to.match(/^The input formula: /)
    })
  })

  describe('advice', () => {
    it('asks for the formula, telling of the widget, the widgeting and a real question', () => {
      const text = JsonataFormulary.advice({ label: 'shout', description: 'Loudly.', formula: '$uppercase(qn.title)' }, { label: 'loud', description: 'For the meta.', title: 'Loud' }, bag)
      expect(text).to.include('- The column\'s title: Loud')
      expect(text).to.include('- What the widgeting is for in this quiz: For the meta.')
      expect(text).to.include('- What the widget works out: Loudly.')
      expect(text).to.include('$uppercase(qn.title)')
      expect(text).to.include('"full_answer": "Leon"')
    })
  })
})
