import { describe, expect, it } from 'vitest'
import { Widgeted, WidgetedValidators, type WidgetedT } from '../../src/models/widgeted'

const Err = { message: 'No.', at: null, response: null }

describe('Widgeted', () => {
  it('makes the three states', () => {
    expect(Widgeted.ok(42)).to.deep.eq({ status: 'ok', value: 42, err: null })
    expect(Widgeted.ok(42, Err)).to.deep.eq({ status: 'ok', value: 42, err: Err })
    expect(Widgeted.errored(Err).status).to.eq('errored')
    expect(Widgeted.missing).to.deep.eq({ status: 'missing', value: null, err: null })
  })

  describe('textOf', () => {
    const Cases: [WidgetedT, string, string][] = [
      [Widgeted.ok(42),                "42",              'a number as itself'],
      [Widgeted.ok('Leon'),            "Leon",            'text as itself'],
      [Widgeted.ok(false),             "false",           'a boolean as itself'],
      [Widgeted.ok({ b: 1, a: 2 }),    '{"a":2,"b":1}',   'an object as its JSON, keys in order'],
      [Widgeted.ok([1, 'two']),        '[1,"two"]',       'a list as its JSON'],
      [Widgeted.ok(null),              "null",            'a null value as its JSON'],
      [Widgeted.missing,               "",                'nothing for a missing cell'],
      [Widgeted.errored(Err),          "",                'nothing for a failure'],
    ]
    for (const [widgeted, expected, blurb] of Cases) {
      it(blurb, () => {
        expect(Widgeted.textOf(widgeted)).to.eq(expected)
      })
    }
  })
})

describe('WidgetedValidators.widgeted', () => {
  it('accepts each of the three states as everyone reads them', () => {
    const accepts = [Widgeted.ok({ items: [] }, { message: 'No.', at: 5, response: { ok: false } }), Widgeted.errored(Err), Widgeted.missing]
    expect(accepts.map((widgeted) => WidgetedValidators.widgeted.safeParse(widgeted).success)).to.deep.eq([true, true, true])
  })

  it('refuses a value on a cell that has none, and a missing cell with a failure', () => {
    const refuses = [{ status: 'errored', value: 3, err: Err }, { status: 'missing', value: null, err: Err }, { status: 'stale', value: 1, err: null }]
    expect(refuses.map((widgeted) => WidgetedValidators.widgeted.safeParse(widgeted).success)).to.deep.eq([false, false, false])
  })
})
