import { describe, expect, it } from 'vitest'
import { latestBySlot, resultsFor, slotkeyOf, unrecordedAnswerings, type AnsweringT } from '../../src/models/answering'
import { Question } from '../../src/models/question'
import { mintId } from '../../src/lib/ids'

const answeringOf = (overrides: Partial<AnsweringT>): AnsweringT => ({
  id:                 mintId(),
  question_id:        'q1',
  player_label:       'dumdum',
  textkind:           'clueing',
  asked_text:         'Who?',
  status:             'done',
  answer_text:        'Leon',
  items:              null,
  message:            null,
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
  it('keeps only the newest answering in each cell, however they arrive', () => {
    const [older, newer] = [answeringOf({ created_at: 1 }), answeringOf({ created_at: 2 })]
    expect(latestBySlot([newer, older]).get('q1:dumdum:clueing')).to.eq(newer)
    expect(latestBySlot([older, newer]).get('q1:dumdum:clueing')).to.eq(newer)
  })

  it('keeps cells apart: another player, or another text, is another cell', () => {
    const latest = latestBySlot([
      answeringOf({}),
      answeringOf({ player_label: 'numnum', answer_text: null, items: [] }),
      answeringOf({ player_label: 'numnum', textkind: 'hint', answer_text: null, items: [] }),
    ])
    expect(latest.keys().toArray()).to.have.members(['q1:dumdum:clueing', 'q1:numnum:clueing', 'q1:numnum:hint'])
  })

  it('finds nothing in nothing', () => {
    expect(latestBySlot([]).size).to.eq(0)
  })
})

describe('resultsFor', () => {
  const question = { id: 'q1', clueing: 'Who?', hint: 'BUT NOT three' }

  it('shows a dumdum answering as the guess', () => {
    const { guess } = resultsFor(question, latestBySlot([answeringOf({})]))
    expect(guess).to.deep.eq({ status: 'done', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 84, updated_at: 1 })
  })

  it('shows a numnum answering as the ishes of the text it was asked about', () => {
    const items = [{ text: 'three', value: 3, kind: 'wordish' as const }]
    const latest = latestBySlot([answeringOf({ player_label: 'numnum', textkind: 'hint', asked_text: 'BUT NOT three', answer_text: null, items })])
    const results = resultsFor(question, latest)
    expect(results.hint_ishes).to.include({ status: 'done', stale: false })
    expect(results.clueing_ishes).to.eq(null)
  })

  it('marks ishes stale once the text they were asked about has been edited', () => {
    const latest = latestBySlot([answeringOf({ player_label: 'numnum', asked_text: 'Who, once?', answer_text: null, items: [] })])
    expect(resultsFor(question, latest).clueing_ishes).to.include({ stale: true })
  })

  it('marks ishes stale when what they were asked about is not known', () => {
    const latest = latestBySlot([answeringOf({ player_label: 'numnum', asked_text: null, answer_text: null, items: [] })])
    expect(resultsFor(question, latest).clueing_ishes).to.include({ stale: true })
  })

  it('shows a failed answering as the error its cell reads', () => {
    const latest = latestBySlot([answeringOf({ status: 'error', answer_text: null, message: 'A connection hiccup — try again.' })])
    expect(resultsFor(question, latest).guess).to.deep.eq({ status: 'error', message: 'A connection hiccup — try again.', updated_at: 1 })
  })

  it('shows nothing where nothing was ever asked', () => {
    expect(resultsFor(question, new Map())).to.deep.eq({ guess: null, clueing_ishes: null, hint_ishes: null })
  })
})

describe('unrecordedAnswerings', () => {
  const guess = { status: 'done' as const, text: 'Leon', truncated: false, model_tier_applied: 'quick' as const, approx_tokens: 84, updated_at: 5 }

  it('records a guess as a dumdum answering, asked the clueing', () => {
    const question = Question.fill({ id: mintId(), clueing: '  Who?  ', guess })
    const [answering] = unrecordedAnswerings(question, NoneRecorded, () => 'a1')
    expect(answering).to.include({
      id: 'a1', question_id: question.id, player_label: 'dumdum', textkind: 'clueing',
      asked_text: 'Who?', status: 'done', answer_text: 'Leon', created_at: 5,
    })
  })

  it('records ishes as numnum answerings, one per text', () => {
    const ishes = { status: 'done' as const, items: [], updated_at: 5 }
    const question = Question.fill({ id: mintId(), clueing: 'Two', hint: 'Three', clueing_ishes: ishes, hint_ishes: ishes })
    const answerings = unrecordedAnswerings(question, NoneRecorded)
    expect(answerings.map((answering) => [answering.player_label, answering.textkind, answering.asked_text])).to.deep.eq([
      ['numnum', 'clueing', 'Two'],
      ['numnum', 'hint',    'Three'],
    ])
  })

  it('records stale ishes as asked about some text no longer known', () => {
    const question = Question.fill({ id: mintId(), clueing: 'Two', clueing_ishes: { status: 'done', items: [], stale: true, updated_at: 5 } })
    expect(unrecordedAnswerings(question, NoneRecorded)[0]?.asked_text).to.eq(null)
  })

  it('records a failure with its message', () => {
    const question = Question.fill({ id: mintId(), clueing: 'Who?', guess: { status: 'error', message: 'Try again.', updated_at: 5 } })
    expect(unrecordedAnswerings(question, NoneRecorded)[0]).to.include({ status: 'error', message: 'Try again.', answer_text: null })
  })

  it('records nothing already recorded, so saving twice records once', () => {
    const question = Question.fill({ id: mintId(), clueing: 'Who?', guess })
    const recordedAt = (created_at: number) => new Map([[`${question.id}:dumdum:clueing`, created_at]])
    expect(unrecordedAnswerings(question, recordedAt(5))).to.deep.eq([])
    expect(unrecordedAnswerings(question, recordedAt(9))).to.deep.eq([])
    expect(unrecordedAnswerings(question, recordedAt(4))).to.have.length(1)
  })

  it('records nothing for a question nobody has answered', () => {
    expect(unrecordedAnswerings(Question.blank(), NoneRecorded)).to.deep.eq([])
  })
})
