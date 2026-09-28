import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Expression } from '../../src/models/expression'
import { Expressing, BottingWidget, WidgetValidators, expressingsOf, bottingsOf } from '../../src/models/widget'

describe('Expressing.fill', () => {
  it('defaults the description to nothing, and trims the one it is given', () => {
    const base = { kind: 'expressing' as const, label: 'letters', expression_label: 'answer_letter_count' }
    expect(Expressing.fill(base).description).to.eq('')
    expect(Expressing.fill({ ...base, description: '  For the anagram round.\n' }).description).to.eq('For the anagram round.')
  })

  const Refused: [object, string][] = [
    [{ label: 'Letters' },                  'a label that is not one'],
    [{ expression_label: 'A B' },           'an expression label that is not one'],
    [{ description: 'x'.repeat(3601) },     'a description past 3600 characters'],
    [{ kind: 'somethingelse' },             'a kind there is not'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => WidgetValidators.widget({ kind: 'expressing', label: 'letters', expression_label: 'answer_letter_count', ...overrides } as never)).to.throw(Z.ZodError)
    })
  }

  it('exposes one field, the value it comes to', () => {
    expect(Expressing.exposed).to.deep.eq(['value'])
  })
})

describe('Expressing.forExpression', () => {
  const expression = Expression.fill({ label: 'answer_reversed', formula: '1' })

  it('is labelled after the expression', () => {
    expect(Expressing.forExpression(expression, new Set())).to.deep.eq({ kind: 'expressing', label: 'answer_reversed', expression_label: 'answer_reversed', description: '' })
  })

  it('takes a suffixed label when a sibling already has the plain one, and still names the same expression', () => {
    const second = Expressing.forExpression(expression, new Set(['answer_reversed']))
    expect(second.label).to.match(/^answer_reversed_[a-z0-9]{8}$/)
    expect(second.expression_label).to.eq('answer_reversed')
  })
})

describe('BottingWidget', () => {
  const Allowed: [string, string, string][] = [
    ['dumdum', 'clueing', 'guess'],
    ['numnum', 'clueing', 'clueing_ishes'],
    ['numnum', 'hint',    'hint_ishes'],
  ]
  for (const [bot_label, textkind, field] of Allowed) {
    it(`connects ${bot_label} to a ${textkind}, held in ${field}`, () => {
      const widget = BottingWidget.fill({ kind: 'botting', label: 'thing', bot_label, textkind } as never)
      expect(BottingWidget.slotOf(widget).field).to.eq(field)
    })
  }

  it('refuses a bot that is not put that text in this tool', () => {
    expect(() => BottingWidget.fill({ kind: 'botting', label: 'thing', bot_label: 'dumdum', textkind: 'hint' })).to.throw(Z.ZodError)
  })

  it('refuses a bot there is not', () => {
    expect(() => BottingWidget.fill({ kind: 'botting', label: 'thing', bot_label: 'smartypants' as never, textkind: 'clueing' })).to.throw(Z.ZodError)
  })

  it('exposes the answer and whether it is stale, and never the cost, the model, the time or the failure', () => {
    expect(BottingWidget.exposed({ bot_label: 'dumdum', textkind: 'clueing' })).to.deep.eq(['status', 'text'])
    expect(BottingWidget.exposed({ bot_label: 'numnum', textkind: 'hint' })).to.deep.eq(['items', 'stale', 'status'])
  })

  it('exposes its fields alphabetically, so a table of them is in a fixed order', () => {
    for (const [bot_label, textkind] of Allowed) {
      const fields = BottingWidget.exposed({ bot_label, textkind } as never)
      expect(fields).to.deep.eq(fields.toSorted((aa, bb) => aa.localeCompare(bb)))
    }
  })
})

describe('the two kinds of widget in one list', () => {
  const widgets = [
    WidgetValidators.widget({ kind: 'botting', label: 'dumdum', bot_label: 'dumdum', textkind: 'clueing' }),
    WidgetValidators.widget({ kind: 'expressing', label: 'letters', expression_label: 'answer_letter_count' }),
  ]

  it('are told apart by kind', () => {
    expect(expressingsOf(widgets).map((widget) => widget.label)).to.deep.eq(['letters'])
    expect(bottingsOf(widgets).map((widget) => widget.label)).to.deep.eq(['dumdum'])
  })
})

describe('WidgetValidators.row', () => {
  const Base = { quiz_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', label: 'thing', description: '', position: 0 }
  const Expressing = { ...Base, kind: 'expressing', expression_label: 'shout' } satisfies Z.input<typeof WidgetValidators.row>
  const Botting = { ...Base, kind: 'botting', bot_label: 'numnum', textkind: 'hint' } satisfies Z.input<typeof WidgetValidators.row>

  it('takes either kind as the database holds it, with its own kind\'s fields alone', () => {
    expect(WidgetValidators.row(Expressing)).to.deep.eq(Expressing)
    expect(WidgetValidators.row(Botting)).to.deep.eq(Botting)
  })

  it('drops the other kind\'s fields, which the table has no place for', () => {
    expect(WidgetValidators.row({ ...Expressing, bot_label: 'dumdum', textkind: 'clueing' } as never)).to.deep.eq(Expressing)
    expect(WidgetValidators.row({ ...Botting, expression_label: 'shout' } as never)).to.deep.eq(Botting)
  })

  const Refused: [object, string][] = [
    [{ ...Expressing, expression_label: null },          'an expressing that names no expression'],
    [{ ...Botting, textkind: null },                     'a botting that names no text'],
    [{ ...Botting, bot_label: 'dumdum' },                'a bot that is not put that text in this tool'],
    [{ ...Botting, bot_label: 'smartypants' },           'a bot there is not'],
    [{ ...Botting, kind: 'gadget' },                     'a kind there is not'],
    [{ ...Botting, position: -1 },                       'a place before the first'],
  ]
  for (const [row, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => WidgetValidators.row(row as never)).to.throw(Z.ZodError)
    })
  }
})
