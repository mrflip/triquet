import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { BottingValidators, resultsFor, slotkeyOf, type RecordedBottingT, type SlotLatest } from '../../src/models/botting'

const bottingOf = (overrides: Partial<RecordedBottingT>): RecordedBottingT => ({
  question_id:        'q1',
  bot_label:          'dumdum',
  textkind:           'clueing',
  asked_text:         'Who?',
  status:             'done',
  reply_text:        'Leon',
  items:              [],
  message:            null,
  response:           null,
  truncated:          false,
  model_tier_applied: 'quick',
  approx_tokens:      84,
  _creationTime:      1,
  ...overrides,
})

/** A history of one cell of `q1`, as the server's walk of it would hand it over */
const cellOf = (latest: SlotLatest, slotkey = 'q1:dumdum:clueing') => new Map([[slotkey, latest]])

describe('slotkeyOf', () => {
  it('names a cell by question, bot and text', () => {
    expect(slotkeyOf({ question_id: 'q1', bot_label: 'dumdum', textkind: 'clueing' })).to.eq('q1:dumdum:clueing')
  })
})

describe('resultsFor', () => {
  const question = { _id: 'q1', clueing: 'Who?', hint: 'BUT NOT three' }

  it('shows a dumdum botting as the guess', () => {
    const { guess } = resultsFor(question, cellOf({ done: bottingOf({}), failed: null }))
    expect(guess).to.deep.eq({ status: 'done', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 84, updated_at: 1, last_err: null })
  })

  it('shows a numnum botting as the ishes of the text it was asked about', () => {
    const items = [{ text: 'three', value: 3, kind: 'wordish' as const }]
    const latest = cellOf({ done: bottingOf({ bot_label: 'numnum', textkind: 'hint', asked_text: 'BUT NOT three', reply_text: null, items }), failed: null }, 'q1:numnum:hint')
    const results = resultsFor(question, latest)
    expect(results.hint_ishes).to.include({ status: 'done', stale: false })
    expect(results.clueing_ishes).to.eq(null)
  })

  it('marks ishes stale once the text they were asked about has been edited', () => {
    const latest = cellOf({ done: bottingOf({ bot_label: 'numnum', asked_text: 'Who, once?', reply_text: null, items: [] }), failed: null }, 'q1:numnum:clueing')
    expect(resultsFor(question, latest).clueing_ishes).to.include({ stale: true })
  })

  it('marks ishes stale when what they were asked about is not known', () => {
    const latest = cellOf({ done: bottingOf({ bot_label: 'numnum', asked_text: null, reply_text: null, items: [] }), failed: null }, 'q1:numnum:clueing')
    expect(resultsFor(question, latest).clueing_ishes).to.include({ stale: true })
  })

  it('shows a cell that has only ever failed as the error its cell reads, with the response', () => {
    const response = { ok: false, failurekind: 'connection' }
    const latest = cellOf({ done: null, failed: bottingOf({ status: 'error', reply_text: null, message: 'A connection hiccup — try again.', response }) })
    const err = { message: 'A connection hiccup — try again.', response, at: 1 }
    expect(resultsFor(question, latest).guess).to.deep.eq({ status: 'error', message: err.message, updated_at: 1, last_err: err })
  })

  it('leaves a result as it was when a failure came after it, carrying the failure as its last_err', () => {
    const response = { ok: false, failurekind: 'rateLimited' }
    const latest = cellOf({
      done:   bottingOf({ _creationTime: 5 }),
      failed: bottingOf({ status: 'error', reply_text: null, message: 'Too many requests.', response, _creationTime: 9 }),
    })
    expect(resultsFor(question, latest).guess).to.deep.include({ status: 'done', text: 'Leon', updated_at: 5, last_err: { message: 'Too many requests.', response, at: 9 } })
  })

  it('shows no last_err when the newest botting answered', () => {
    const latest = cellOf({ done: bottingOf({ reply_text: 'Lyon', _creationTime: 12 }), failed: null })
    expect(resultsFor(question, latest).guess).to.deep.include({ text: 'Lyon', last_err: null })
  })

  it('reads when a botting was asked in whole milliseconds, as the tree\'s timestamps are', () => {
    const latest = cellOf({ done: bottingOf({ _creationTime: 1_727_470_000_000.625 }), failed: null })
    expect(resultsFor(question, latest).guess).to.deep.include({ updated_at: 1_727_470_000_000 })
  })

  it('still marks ishes stale, and still carries a failure, when both are so', () => {
    const latest = cellOf({
      done:   bottingOf({ bot_label: 'numnum', asked_text: 'Who, once?', reply_text: null, items: [], _creationTime: 5 }),
      failed: bottingOf({ bot_label: 'numnum', status: 'error', reply_text: null, message: 'No.', _creationTime: 9 }),
    }, 'q1:numnum:clueing')
    expect(resultsFor(question, latest).clueing_ishes).to.deep.include({ stale: true, updated_at: 5 })
    expect(resultsFor(question, latest).clueing_ishes).to.have.property('last_err').that.deep.include({ at: 9 })
  })

  it('shows nothing where nothing was ever asked', () => {
    expect(resultsFor(question, new Map())).to.deep.eq({ guess: null, clueing_ishes: null, hint_ishes: null })
  })
})

describe('BottingValidators.row', () => {
  const Done = {
    question_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', bot_label: 'numnum', textkind: 'clueing', asked_text: 'three and #17', status: 'done',
    reply_text: null, items: [{ text: 'three', value: 3, kind: 'wordish' }], message: null, response: null, truncated: false,
    model_tier_applied: 'careful', approx_tokens: 210,
  } satisfies Z.input<typeof BottingValidators.row>
  const Failed = {
    ...Done, status: 'error', items: [], message: 'The model was busy.', response: { error: 'overloaded' }, model_tier_applied: null, approx_tokens: null,
  } satisfies Z.input<typeof BottingValidators.row>

  it('takes a reply, and a failure, as the database holds them', () => {
    expect(BottingValidators.row(Done)).to.deep.eq(Done)
    expect(BottingValidators.row(Failed)).to.deep.eq(Failed)
  })

  it('keeps a dumdum reply exactly as it came, surrounding space and all', () => {
    expect(BottingValidators.row({ ...Done, bot_label: 'dumdum', reply_text: '  Hamlet\n', items: [] }).reply_text).to.eq('  Hamlet\n')
  })

  const Refused: [object, string][] = [
    [{ question_id: 'hamlet' },                                   'a question that is not a row id'],
    [{ status: 'pending' },                                       'a status there is not'],
    [{ items: null },                                             'no spans at all, rather than an empty list'],
    [{ items: [{ text: '', value: 3, kind: 'numeral' }] },        'a span with no text'],
    [{ items: Array.from({ length: 201 }, () => Done.items[0]) }, 'more spans than one text may carry'],
    [{ approx_tokens: -1 },                                       'a negative token count'],
    [{ bot_label: 'dumdum', textkind: 'hint' },                   'a bot put a text the tool never puts it'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => BottingValidators.row({ ...Done, ...overrides })).to.throw(Z.ZodError)
    })
  }
})
