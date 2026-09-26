import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { PlayingValidators, latestBySlot, resultsFor, slotkeyOf, unrecordedPlayings, type PlayingT } from '../../src/models/playing'
import { Question } from '../../src/models/question'
import { mintId } from '../../src/lib/ids'

const playingOf = (overrides: Partial<PlayingT>): PlayingT => ({
  id:                 mintId(),
  question_id:        'q1',
  player_label:       'dumdum',
  textkind:           'clueing',
  asked_text:         'Who?',
  status:             'done',
  reply_text:        'Leon',
  items:              null,
  message:            null,
  response:           null,
  truncated:          false,
  model_tier_applied: 'quick',
  approx_tokens:      84,
  created_at:         1,
  ...overrides,
})

const NoneRecorded = new Map<string, number>()

describe('slotkeyOf', () => {
  it('names a cell by question, player and text', () => {
    expect(slotkeyOf({ question_id: 'q1', player_label: 'dumdum', textkind: 'clueing' })).to.eq('q1:dumdum:clueing')
  })
})

describe('latestBySlot', () => {
  it('keeps only the newest result in each cell, however they arrive', () => {
    const [older, newer] = [playingOf({ created_at: 1 }), playingOf({ created_at: 2 })]
    expect(latestBySlot([newer, older]).get('q1:dumdum:clueing')).to.deep.eq({ done: newer, failed: null })
    expect(latestBySlot([older, newer]).get('q1:dumdum:clueing')).to.deep.eq({ done: newer, failed: null })
  })

  it('keeps a failure only while it is newer than every result', () => {
    const [done, failure] = [playingOf({ created_at: 5 }), playingOf({ status: 'error', reply_text: null, created_at: 9 })]
    expect(latestBySlot([done, failure]).get('q1:dumdum:clueing')).to.deep.eq({ done, failed: failure })
    const later = playingOf({ created_at: 12 })
    expect(latestBySlot([done, failure, later]).get('q1:dumdum:clueing')).to.deep.eq({ done: later, failed: null })
  })

  it('keeps a failure in a cell that has only ever failed', () => {
    const failure = playingOf({ status: 'error', reply_text: null })
    expect(latestBySlot([failure]).get('q1:dumdum:clueing')).to.deep.eq({ done: null, failed: failure })
  })

  it('keeps cells apart: another player, or another text, is another cell', () => {
    const latest = latestBySlot([
      playingOf({}),
      playingOf({ player_label: 'numnum', reply_text: null, items: [] }),
      playingOf({ player_label: 'numnum', textkind: 'hint', reply_text: null, items: [] }),
    ])
    expect(latest.keys().toArray()).to.have.members(['q1:dumdum:clueing', 'q1:numnum:clueing', 'q1:numnum:hint'])
  })

  it('finds nothing in nothing', () => {
    expect(latestBySlot([]).size).to.eq(0)
  })
})

describe('resultsFor', () => {
  const question = { id: 'q1', clueing: 'Who?', hint: 'BUT NOT three' }

  it('shows a dumdum playing as the guess', () => {
    const { guess } = resultsFor(question, latestBySlot([playingOf({})]))
    expect(guess).to.deep.eq({ status: 'done', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 84, updated_at: 1, last_err: null })
  })

  it('shows a numnum playing as the ishes of the text it was asked about', () => {
    const items = [{ text: 'three', value: 3, kind: 'wordish' as const }]
    const latest = latestBySlot([playingOf({ player_label: 'numnum', textkind: 'hint', asked_text: 'BUT NOT three', reply_text: null, items })])
    const results = resultsFor(question, latest)
    expect(results.hint_ishes).to.include({ status: 'done', stale: false })
    expect(results.clueing_ishes).to.eq(null)
  })

  it('marks ishes stale once the text they were asked about has been edited', () => {
    const latest = latestBySlot([playingOf({ player_label: 'numnum', asked_text: 'Who, once?', reply_text: null, items: [] })])
    expect(resultsFor(question, latest).clueing_ishes).to.include({ stale: true })
  })

  it('marks ishes stale when what they were asked about is not known', () => {
    const latest = latestBySlot([playingOf({ player_label: 'numnum', asked_text: null, reply_text: null, items: [] })])
    expect(resultsFor(question, latest).clueing_ishes).to.include({ stale: true })
  })

  it('shows a cell that has only ever failed as the error its cell reads, with the response', () => {
    const response = { ok: false, failurekind: 'connection' }
    const latest = latestBySlot([playingOf({ status: 'error', reply_text: null, message: 'A connection hiccup — try again.', response })])
    const err = { message: 'A connection hiccup — try again.', response, at: 1 }
    expect(resultsFor(question, latest).guess).to.deep.eq({ status: 'error', message: err.message, updated_at: 1, last_err: err })
  })

  it('leaves a result as it was when a failure came after it, carrying the failure as its last_err', () => {
    const response = { ok: false, failurekind: 'rateLimited' }
    const latest = latestBySlot([
      playingOf({ created_at: 5 }),
      playingOf({ status: 'error', reply_text: null, message: 'Too many requests.', response, created_at: 9 }),
    ])
    expect(resultsFor(question, latest).guess).to.deep.include({ status: 'done', text: 'Leon', updated_at: 5, last_err: { message: 'Too many requests.', response, at: 9 } })
  })

  it('shows no last_err once a later success has cleared it', () => {
    const latest = latestBySlot([
      playingOf({ created_at: 5 }),
      playingOf({ status: 'error', reply_text: null, message: 'Too many requests.', created_at: 9 }),
      playingOf({ reply_text: 'Lyon', created_at: 12 }),
    ])
    expect(resultsFor(question, latest).guess).to.deep.include({ text: 'Lyon', last_err: null })
  })

  it('still marks ishes stale, and still carries a failure, when both are so', () => {
    const latest = latestBySlot([
      playingOf({ player_label: 'numnum', asked_text: 'Who, once?', reply_text: null, items: [], created_at: 5 }),
      playingOf({ player_label: 'numnum', status: 'error', reply_text: null, message: 'No.', created_at: 9 }),
    ])
    expect(resultsFor(question, latest).clueing_ishes).to.deep.include({ stale: true, updated_at: 5 })
    expect(resultsFor(question, latest).clueing_ishes).to.have.property('last_err').that.deep.include({ at: 9 })
  })

  it('shows nothing where nothing was ever asked', () => {
    expect(resultsFor(question, new Map())).to.deep.eq({ guess: null, clueing_ishes: null, hint_ishes: null })
  })
})

describe('unrecordedPlayings', () => {
  const guess = { status: 'done' as const, text: 'Leon', truncated: false, model_tier_applied: 'quick' as const, approx_tokens: 84, updated_at: 5, last_err: null }

  it('records a guess as a dumdum playing, asked the clueing', () => {
    const question = Question.fill({ id: mintId(), clueing: '  Who?  ', guess })
    const [playing] = unrecordedPlayings(question, NoneRecorded, () => 'a1')
    expect(playing).to.include({
      id: 'a1', question_id: question.id, player_label: 'dumdum', textkind: 'clueing',
      asked_text: 'Who?', status: 'done', reply_text: 'Leon', created_at: 5,
    })
  })

  it('records ishes as numnum playings, one per text', () => {
    const ishes = { status: 'done' as const, items: [], updated_at: 5, last_err: null }
    const question = Question.fill({ id: mintId(), clueing: 'Two', hint: 'Three', clueing_ishes: ishes, hint_ishes: ishes })
    const playings = unrecordedPlayings(question, NoneRecorded)
    expect(playings.map((playing) => [playing.player_label, playing.textkind, playing.asked_text])).to.deep.eq([
      ['numnum', 'clueing', 'Two'],
      ['numnum', 'hint',    'Three'],
    ])
  })

  it('records stale ishes as asked about some text no longer known', () => {
    const question = Question.fill({ id: mintId(), clueing: 'Two', clueing_ishes: { status: 'done', items: [], stale: true, updated_at: 5, last_err: null } })
    expect(unrecordedPlayings(question, NoneRecorded)[0]?.asked_text).to.eq(null)
  })

  const err = { message: 'Try again.', response: { ok: false, failurekind: 'connection' }, at: 5 }

  it('records a cell that has only failed as one failed playing, with its message and response', () => {
    const question = Question.fill({ id: mintId(), clueing: 'Who?', guess: { status: 'error', message: err.message, updated_at: 5, last_err: err } })
    const playings = unrecordedPlayings(question, NoneRecorded)
    expect(playings).to.have.length(1)
    expect(playings[0]).to.include({ status: 'error', message: 'Try again.', reply_text: null, created_at: 5 })
    expect(playings[0]?.response).to.deep.eq(err.response)
  })

  it('records a failure riding on a result as a playing of its own, beside the result', () => {
    const question = Question.fill({ id: mintId(), clueing: 'Who?', guess: { ...guess, last_err: { ...err, at: 9 } } })
    expect(unrecordedPlayings(question, NoneRecorded).map((playing) => [playing.status, playing.created_at])).to.deep.eq([['done', 5], ['error', 9]])
  })

  it('records only the failure when the result was recorded already', () => {
    const question = Question.fill({ id: mintId(), clueing: 'Who?', guess: { ...guess, last_err: { ...err, at: 9 } } })
    const recorded = new Map([[`${question.id}:dumdum:clueing`, 5]])
    expect(unrecordedPlayings(question, recorded).map((playing) => playing.status)).to.deep.eq(['error'])
  })

  it('records nothing again for a failure already recorded', () => {
    const question = Question.fill({ id: mintId(), clueing: 'Who?', guess: { ...guess, last_err: { ...err, at: 9 } } })
    expect(unrecordedPlayings(question, new Map([[`${question.id}:dumdum:clueing`, 9]]))).to.deep.eq([])
  })

  it('records nothing already recorded, so saving twice records once', () => {
    const question = Question.fill({ id: mintId(), clueing: 'Who?', guess })
    const recordedAt = (created_at: number) => new Map([[`${question.id}:dumdum:clueing`, created_at]])
    expect(unrecordedPlayings(question, recordedAt(5))).to.deep.eq([])
    expect(unrecordedPlayings(question, recordedAt(9))).to.deep.eq([])
    expect(unrecordedPlayings(question, recordedAt(4))).to.have.length(1)
  })

  it('records nothing for a question no player has been put', () => {
    expect(unrecordedPlayings(Question.blank(), NoneRecorded)).to.deep.eq([])
  })
})

describe('PlayingValidators.row', () => {
  const Done = {
    question_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', player_label: 'numnum', textkind: 'clueing', asked_text: 'three and #17', status: 'done',
    reply_text: null, items: [{ text: 'three', value: 3, kind: 'wordish' }], message: null, response: null, truncated: false,
    model_tier_applied: 'careful', approx_tokens: 210,
  } satisfies Z.input<typeof PlayingValidators.row>
  const Failed = {
    ...Done, status: 'error', items: [], message: 'The model was busy.', response: { error: 'overloaded' }, model_tier_applied: null, approx_tokens: null,
  } satisfies Z.input<typeof PlayingValidators.row>

  it('takes a reply, and a failure, as the database holds them', () => {
    expect(PlayingValidators.row(Done)).to.deep.eq(Done)
    expect(PlayingValidators.row(Failed)).to.deep.eq(Failed)
  })

  it('keeps a dumdum reply exactly as it came, surrounding space and all', () => {
    expect(PlayingValidators.row({ ...Done, player_label: 'dumdum', reply_text: '  Hamlet\n', items: [] }).reply_text).to.eq('  Hamlet\n')
  })

  const Refused: [object, string][] = [
    [{ question_id: 'hamlet' },                                   'a question that is not a row id'],
    [{ status: 'pending' },                                       'a status there is not'],
    [{ items: null },                                             'no spans at all, rather than an empty list'],
    [{ items: [{ text: '', value: 3, kind: 'numeral' }] },        'a span with no text'],
    [{ items: Array.from({ length: 201 }, () => Done.items[0]) }, 'more spans than one text may carry'],
    [{ approx_tokens: -1 },                                       'a negative token count'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => PlayingValidators.row({ ...Done, ...overrides })).to.throw(Z.ZodError)
    })
  }
})
