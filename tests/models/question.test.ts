import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Question, QuestionValidators } from '../../src/models/question'
import { mintId } from '../../src/lib/ids'

const anId = mintId()

const QnumCases: [string, boolean, string][] = [
  // regular usage:
  ["",         true,   'blank Q#: legal, and means unranked'],
  ["1",        true,   'a plain integer'],
  ["3.1",      true,   'a decimal, the slot-between-two-questions trick'],
  ["100",      true,   'a number of more than one digit'],
  // not-quite-absurd mismatches:
  ["03",       true,   'a leading zero: odd, but a number all the same'],
  ["3.",       false,  'a trailing decimal point with no fraction'],
  [".5",       false,  'a bare fraction with no whole part'],
  ["-1",       false,  'a negative: questions do not count backwards'],
  ["1e3",      false,  'exponent notation'],
  ["1,000",    false,  'a thousands comma'],
  [" 1",       false,  'leading whitespace, which would sort surprisingly'],
  // absurd mismatches:
  ["three",    false,  'a spelled-out number'],
  ["Q1",       false,  'a number with its label still attached'],
]

describe('Question.fill', () => {
  it('defaults every field but the id', () => {
    expect(Question.fill({ id: anId })).to.deep.eq({
      id:            anId,
      qnum:          '',
      clueing:       '',
      hint:          '',
      short_answer:  '',
      chains_to:     null,
      guess:         null,
      clueing_ishes: null,
      hint_ishes:    null,
      alt_text:      '',
      notes:         '',
      full_answer:   '',
    })
  })

  it('keeps the text it is given, untouched', () => {
    const clueing = 'Which *région* gave its name to **Léon**, and to 千 other things?'
    expect(Question.fill({ id: anId, clueing }).clueing).to.eq(clueing)
  })

  it('drops keys it does not recognize', () => {
    expect(Question.fill({ id: anId, hintNumbers: [1] } as never)).to.not.have.property('hintNumbers')
  })

  it('rejects a missing id', () => {
    expect(() => Question.fill({} as never)).to.throw(Z.ZodError)
  })

  it('rejects an id that is not a ULID', () => {
    expect(() => Question.fill({ id: 'question-1' })).to.throw(Z.ZodError)
  })

  it('rejects a short answer past 200 characters', () => {
    expect(() => Question.fill({ id: anId, short_answer: 'x'.repeat(201) })).to.throw(Z.ZodError)
  })

  it('accepts a done guess and a done extraction', () => {
    const question = Question.fill({
      id:            anId,
      guess:         { status: 'done', text: 'Leon', updated_at: 1 },
      clueing_ishes: { status: 'done', items: [{ text: '千', value: 1000, kind: 'wordish' }], updated_at: 1 },
    })
    expect(question.guess?.status).to.eq('done')
    expect(question.clueing_ishes).to.deep.include({ status: 'done', truncated: false, stale: false })
  })

  it('accepts an error in place of a result', () => {
    const question = Question.fill({ id: anId, guess: { status: 'error', message: 'A connection hiccup — try again.', updated_at: 1 } })
    expect(question.guess?.status).to.eq('error')
  })

  describe('qnum', () => {
    for (const [qnum, isLegal, blurb] of QnumCases) {
      it(blurb, () => {
        expect(QuestionValidators.question.safeParse({ id: anId, qnum }).success).to.eq(isLegal)
      })
    }
  })
})

describe('Question.blank', () => {
  it('mints an id and leaves everything else empty', () => {
    const question = Question.blank()
    expect(question.id).to.have.length(26)
    expect(question.clueing).to.eq('')
  })

  it('mints a distinct id each time', () => {
    expect(Question.blank().id).to.not.eq(Question.blank().id)
  })
})
