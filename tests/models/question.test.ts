import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { Id } from '../../convex/_generated/dataModel'
import { Question, QuestionValidators, type QuestionDNA } from '../../src/models/question'
import { mintId } from '../../src/lib/ids'
import { ValidatorKit } from '../../src/lib/validator'
import * as Labelmaker from '../../src/lib/labelmaker'

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
    const question = Question.fill({ _id: anId })
    expect(question).to.deep.include({
      _id:           anId,
      qnum:          '',
      clueing:       '',
      hint:          '',
      forced_label:  null,
      chains_to:     null,
      guess:         null,
      clueing_ishes: null,
      hint_ishes:    null,
      alt_text:      '',
      notes:         '',
      full_answer:   '',
    })
    expect(question.label).to.match(/^[a-z]+_[a-z]+$/)
  })

  it('populates a blank title from the generated label, titleized', () => {
    const question = Question.fill({ _id: anId })
    expect(question.title).to.eq(Labelmaker.titleize(question.label))
  })

  it('leaves a given title alone even though a label was generated too', () => {
    expect(Question.fill({ _id: anId, title: 'Leon' }).title).to.eq('Leon')
  })

  it('keeps the text it is given, untouched', () => {
    const clueing = 'Which *région* gave its name to **Léon**, and to 千 other things?'
    expect(Question.fill({ _id: anId, clueing }).clueing).to.eq(clueing)
  })

  it('drops keys it does not recognize', () => {
    expect(Question.fill({ _id: anId, hintNumbers: [1] } as never)).to.not.have.property('hintNumbers')
  })

  it('rejects a missing id', () => {
    expect(() => Question.fill({} as never)).to.throw(Z.ZodError)
  })

  it('rejects an id that is not a row id or a UUID', () => {
    expect(() => Question.fill({ _id: 'question-1' })).to.throw(Z.ZodError)
  })

  it('rejects a title past 200 characters', () => {
    expect(() => Question.fill({ _id: anId, title: 'x'.repeat(201) })).to.throw(Z.ZodError)
  })

  it('accepts a done guess and a done extraction', () => {
    const question = Question.fill({
      _id:           anId,
      guess:         { status: 'done', text: 'Leon', updated_at: 1 },
      clueing_ishes: { status: 'done', items: [{ text: '千', value: 1000, kind: 'wordish' }], updated_at: 1 },
    })
    expect(question.guess?.status).to.eq('done')
    expect(question.clueing_ishes).to.deep.include({ status: 'done', truncated: false, stale: false })
  })

  it('accepts an error in place of a result', () => {
    const question = Question.fill({ _id: anId, guess: { status: 'error', message: 'A connection hiccup — try again.', updated_at: 1, last_err: { message: 'A connection hiccup — try again.', response: { ok: false }, at: 1 } } })
    expect(question.guess?.status).to.eq('error')
  })

  describe('qnum', () => {
    for (const [qnum, isLegal, blurb] of QnumCases) {
      it(blurb, () => {
        expect(QuestionValidators.question.safeParse({ _id: anId, qnum }).success).to.eq(isLegal)
      })
    }
  })
})

describe('QuestionValidators.questionPatch', () => {
  it('carries only the fields the patch names', () => {
    expect(QuestionValidators.questionPatch({ title: 'Leon' })).to.deep.eq({ title: 'Leon' })
  })

  it('reads an empty patch as "change nothing"', () => {
    expect(QuestionValidators.questionPatch({})).to.deep.eq({})
  })

  it('never fills an absent field in with a default, which would wipe what the author had', () => {
    const patch = QuestionValidators.questionPatch({ title: 'Leon' })
    expect(patch).to.not.have.property('clueing')
    expect(patch).to.not.have.property('chains_to')
  })

  it('takes an explicit clearing of a field', () => {
    expect(QuestionValidators.questionPatch({ clueing: '', chains_to: null })).to.deep.eq({ clueing: '', chains_to: null })
  })

  it('refuses to patch the id', () => {
    expect(QuestionValidators.questionPatch({ _id: anId } as never)).to.not.have.property('_id')
  })

  it('validates what it does carry', () => {
    expect(() => QuestionValidators.questionPatch({ qnum: 'three' })).to.throw(Z.ZodError)
  })
})

describe('Question.blank', () => {
  it('mints an id and leaves everything else empty', () => {
    const question = Question.blank()
    expect(ValidatorKit.treeid.safeParse(question._id).success).to.eq(true)
    expect(question.clueing).to.eq('')
  })

  it('mints a distinct id each time', () => {
    expect(Question.blank()._id).to.not.eq(Question.blank()._id)
  })
})

describe('QuestionValidators, field by field', () => {
  it('keeps a clueing and a hint exactly as written, surrounding space and all', () => {
    const question = Question.fill({ _id: anId, clueing: '  "Verse,\n   indented"  ', hint: '\tBUT NOT this ' })
    expect(question.clueing).to.eq('  "Verse,\n   indented"  ')
    expect(question.hint).to.eq('\tBUT NOT this ')
  })

  it('trims the notes, the alt text and the answer', () => {
    const question = Question.fill({ _id: anId, notes: ' check this\n', alt_text: '  alt ', full_answer: ' Leon, in Spain ' })
    expect([question.notes, question.alt_text, question.full_answer]).to.deep.eq(['check this', 'alt', 'Leon, in Spain'])
  })

  const Refused: [QuestionDNA, string][] = [
    [{ _id: anId, clueing: 'x'.repeat(3601) },    'a clueing past 3600 characters'],
    [{ _id: anId, hint: 'BUT NOT\u{1}' },          'a hint carrying a control character'],
    [{ _id: anId, notes: 'x'.repeat(3601) },      'notes past 3600 characters'],
    [{ _id: anId, title: 'x'.repeat(83) },        'a title past 82 characters'],
    [{ _id: anId, title: 'Two\nlines' },          'a title on more than one line'],
    [{ _id: anId, label: 'ends_' },               'a label ending in an underscore'],
    [{ _id: anId, label: 'x'.repeat(41) },        'a label past 40 characters'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Question.fill(dna)).to.throw(Z.ZodError)
    })
  }
})

describe('QuestionValidators.row', () => {
  const Row = {
    hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f8', quiz_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', label: 'hamlet', forced_label: null, title: 'Hamlet', qnum: '1', clueing: '  Dane,\n melancholy ',
    hint: '', chains_to: 'lear', full_answer: 'Hamlet', alt_text: '', notes: '',
  }

  it('takes a question as the database holds it, its clueing untouched', () => {
    expect(QuestionValidators.row(Row)).to.deep.eq(Row)
  })

  const Refused: [object, string][] = [
    [{ hunt_id: 'hamlet' },                  'a hunt that is not a row id'],
    [{ quiz_id: 'hamlet' },                  'a quiz that is not a row id'],
    [{ chains_to: '01j0000000000000000000000a' }, 'a chain naming a question by id rather than by label'],
    [{ qnum: 'three' },                      'a question number that is not a number'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => QuestionValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})

describe("Question.blankRow", () => {
  const place = { hunt_id: 'j97d0qbj35dar1v8edndzckvsx8f8200' as Id<'hunts'>, quiz_id: 'j97d0qbj35dar1v8edndzckvsx8f8299' as Id<'quizzes'> }

  it("is a blank, unchained row of the quiz and hunt given, titled from its label", () => {
    expect(Question.blankRow(place, 'quiet_otter')).to.deep.include({ ...place, label: 'quiet_otter', title: 'Quiet Otter', clueing: '', chains_to: null })
  })

  it("takes a fresh label when none is given", () => {
    expect(Question.blankRow(place).label).to.match(/^[a-z][a-z0-9_]+$/)
  })
})
