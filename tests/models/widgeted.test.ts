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

  describe('isNothing', () => {
    const Cases: [WidgetedT, boolean, string][] = [
      [Widgeted.ok(null),              true,              'a null value is nothing'],
      [Widgeted.ok(''),                true,              'empty text is nothing'],
      [Widgeted.ok(0),                 false,             'nought is a value'],
      [Widgeted.ok(false),             false,             'false is a value'],
      [Widgeted.ok([]),                false,             'an empty list is a value'],
      [Widgeted.missing,               true,              'a missing cell is nothing'],
      [Widgeted.errored(Err),          true,              'a failure is nothing'],
    ]
    for (const [widgeted, expected, blurb] of Cases) {
      it(blurb, () => {
        expect(Widgeted.isNothing(widgeted)).to.eq(expected)
      })
    }
  })

  describe('isStructured', () => {
    it('is a list or an object, and nothing else', () => {
      const widgeteds = [Widgeted.ok([]), Widgeted.ok({ items: [] }), Widgeted.ok(null), Widgeted.ok('Leon'), Widgeted.ok(3), Widgeted.missing]
      expect(widgeteds.map((widgeted) => Widgeted.isStructured(widgeted))).to.deep.eq([true, true, false, false, false, false])
    })
  })

  describe('textOf', () => {
    const Cases: [WidgetedT, string, string][] = [
      [Widgeted.ok(42),                "42",              'a number as itself'],
      [Widgeted.ok('Leon'),            "Leon",            'text as itself'],
      [Widgeted.ok(false),             "false",           'a boolean as itself'],
      [Widgeted.ok({ b: 1, a: 2 }),    '{"a":2,"b":1}',   'an object as its JSON, keys in order'],
      [Widgeted.ok([1, 'two']),        '[1,"two"]',       'a list as its JSON'],
      [Widgeted.ok(null),              "",                'nothing for a null value, as for no value'],
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

const QuestionId = 'k57a2tq9b3d1a1z6e0w6m9c4hd7r9x2s'
const WidgetingId = 'k97bcq0xz8wb4j3v5r2nqg1y6d7r9x2s'
const QuizId = 'k17bcq0xz8wb4j3v5r2nqg1y6d7r9x2s'
const HuntId = 'k27bcq0xz8wb4j3v5r2nqg1y6d7r9x2s'

describe('WidgetedValidators.row', () => {
  const Ok = { hunt_id: HuntId, quiz_id: QuizId, question_id: QuestionId, widgeting_id: WidgetingId, status: 'ok' as const, value: { items: [] }, message: null, result_meta: { approx_tokens: 12 } }
  const Errored = { ...Ok, status: 'errored' as const, value: null, message: 'The model would not say.', result_meta: { response: 'nope' } }

  it("takes an ok row and an errored row as the database holds them", () => {
    expect(WidgetedValidators.row(Ok)).to.deep.eq(Ok)
    expect(WidgetedValidators.row(Errored)).to.deep.eq(Errored)
  })

  it("takes a null value on an ok row: JSON null is a value", () => {
    expect(WidgetedValidators.row({ ...Ok, value: null }).value).to.be.null
  })

  it("trims the message", () => {
    expect(WidgetedValidators.row({ ...Errored, message: '  No.\n' }).message).to.eq('No.')
  })

  const Refused: [object, string][] = [
    // status consistency:
    [{ ...Ok, message: 'But also no.' },                      'an ok row carrying a failure message'],
    [{ ...Errored, value: 3 },                                'an errored row carrying a value'],
    [{ ...Errored, message: null },                           'an errored row that does not say why'],
    [{ ...Ok, status: 'missing' },                            'a missing row, which is never stored'],
    // size bounds:
    [{ ...Ok, value: 'x'.repeat(40_000) },                    'a value whose JSON runs past 40,000 characters'],
    [{ ...Ok, result_meta: { response: 'x'.repeat(40_000) } }, 'a result_meta whose JSON runs past 40,000 characters'],
    // ids:
    [{ ...Ok, widgeting_id: 'dumdum' },                       'a widgeting named by label rather than id'],
    [{ ...Ok, quiz_id: undefined },                           'no quiz'],
    [{ ...Ok, hunt_id: undefined },                           'no hunt'],
  ]
  for (const [row, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(WidgetedValidators.row.safeParse(row).success).to.be.false
    })
  }

  it("takes a value just inside the bound", () => {
    // Its JSON is the text and its two quotes.
    expect(WidgetedValidators.row.safeParse({ ...Ok, value: 'x'.repeat(39_998) }).success).to.be.true
    expect(WidgetedValidators.row.safeParse({ ...Ok, value: 'x'.repeat(39_999) }).success).to.be.false
  })
})

describe('WidgetedValidators.record', () => {
  const Recording = { question_id: QuestionId, widgeting_label: 'dumdum', status: 'ok', value: { guess: 'Leon', explanation: '' } } as const

  it("defaults the message to none and the result_meta to empty", () => {
    expect(WidgetedValidators.record(Recording)).to.deep.eq({ ...Recording, message: null, result_meta: {} })
  })

  it("defaults the value to none for a failure", () => {
    expect(WidgetedValidators.record({ question_id: QuestionId, widgeting_label: 'dumdum', status: 'errored', message: 'No.' }).value).to.be.null
  })

  const Refused: [object, string][] = [
    [{ ...Recording, widgeting_label: 'Dum Dum' },                       'a widgeting label that is not one'],
    [{ ...Recording, message: 'No.' },                                   'an ok recording carrying a failure message'],
    [{ ...Recording, status: 'errored' },                                'an errored recording that does not say why'],
    [{ ...Recording, status: 'errored', message: 'No.' },                'an errored recording carrying a value'],
    [{ ...Recording, value: 'x'.repeat(40_000) },                        'a value past the bound'],
  ]
  for (const [recording, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(WidgetedValidators.record.safeParse(recording).success).to.be.false
    })
  }
})

describe('WidgetedValidators.stored and .history', () => {
  const Stored = { status: 'ok', value: 7, message: null, result_meta: {}, _creationTime: 1_700_000_000_000.25 } as const

  it("takes a stored row's fields and when it was recorded, fraction and all", () => {
    expect(WidgetedValidators.stored(Stored)).to.deep.eq(Stored)
  })

  it("refuses a stored row with no time, or a time before the epoch", () => {
    expect(WidgetedValidators.stored.safeParse({ ...Stored, _creationTime: undefined }).success).to.be.false
    expect(WidgetedValidators.stored.safeParse({ ...Stored, _creationTime: -1 }).success).to.be.false
  })

  it("takes a history whose newest row is a failure and which never had a value", () => {
    const failed = { ...Stored, status: 'errored', value: null, message: 'No.' } as const
    expect(WidgetedValidators.history({ newest: failed, ok: null })).to.deep.eq({ newest: failed, ok: null })
  })

  it("takes a history whose newest row is its newest ok one", () => {
    expect(WidgetedValidators.history({ newest: Stored, ok: Stored }).ok).to.deep.eq(Stored)
  })

  it("refuses a history with no newest row", () => {
    expect(WidgetedValidators.history.safeParse({ newest: null, ok: Stored }).success).to.be.false
  })
})
