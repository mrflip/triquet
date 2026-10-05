import _ from 'es-toolkit/compat'
import { describe, expect, it, vi } from 'vitest'
import * as Z from 'zod'
import type { Id } from '../../convex/_generated/dataModel'
import { Question, QuestionValidators, RankField, type QuestionDNA } from '../../src/models/question'
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
      chains_to:     null,
      alt_text:      '',
      notes:         '',
      full_answer:   '',
      stored:        {},
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

  it("defaults to nothing stored by any widgeting", () => {
    expect(Question.fill({ _id: anId }).stored).to.deep.eq({})
  })

  it("holds what each widgeting stored, by its label: the newest row and the newest ok one", () => {
    const answered = { status: 'ok' as const, value: { guess: 'Leon', explanation: '' }, message: null, result_meta: {}, _creationTime: 1 }
    const failed = { status: 'errored' as const, value: null, message: 'A connection hiccup — try again.', result_meta: { response: { ok: false } }, _creationTime: 2 }
    const question = Question.fill({ _id: anId, stored: { dumdum: { newest: failed, ok: answered } } })
    expect(question.stored.dumdum).to.deep.eq({ newest: failed, ok: answered })
  })

  it("refuses what was stored under something that is not a label", () => {
    const answered = { status: 'ok' as const, value: 1, message: null, result_meta: {}, _creationTime: 1 }
    expect(() => Question.fill({ _id: anId, stored: { 'Dum Dum': { newest: answered, ok: answered } } })).to.throw(Z.ZodError)
  })

  it("drops the old bot fields, which are widgetings' widgeteds now", () => {
    const question = Question.fill({ _id: anId, guess: { status: 'done', text: 'Leon', updated_at: 1 } } as never)
    expect(question).to.not.have.property('guess')
  })

  describe('qnum', () => {
    for (const [qnum, isLegal, blurb] of QnumCases) {
      it(blurb, () => {
        expect(QuestionValidators.question.safeParse({ _id: anId, qnum }).success).to.eq(isLegal)
      })
    }

    it("keeps a Q# written as a number, as a spreadsheet's import sends one, as the text it reads as", () => {
      expect(QuestionValidators.question.parse({ _id: anId, qnum: 3.1 }).qnum).to.eq('3.1')
    })

    it("refuses a Q# past the numbers it can count on", () => {
      expect(QuestionValidators.question.safeParse({ _id: anId, qnum: '9'.repeat(17) }).success).to.be.false
    })
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
    expect(ValidatorKit.treeid.safeParse(question._id).success).to.be.true
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
    hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f8', quiz_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', label: 'hamlet', title: 'Hamlet', qnum: '1', clueing: '  Dane,\n melancholy ',
    hint: '', chains_to: 'lear', full_answer: 'Hamlet', alt_text: '', notes: '', created_at: 1_759_700_000_000, updated_at: 1_759_700_100_000,
  }

  it('takes a question as the database holds it, its clueing untouched', () => {
    expect(QuestionValidators.row(Row)).to.deep.eq(Row)
  })

  it("stamps a question given no stamps with the moment it is checked, as the database's writer will again", () => {
    vi.useFakeTimers({ now: 1_759_800_000_000, toFake: ['Date'] })
    const { created_at, updated_at } = QuestionValidators.row(_.omit(Row, ['created_at', 'updated_at']))
    vi.useRealTimers()
    expect([created_at, updated_at]).to.deep.eq([1_759_800_000_000, 1_759_800_000_000])
  })

  const Refused: [object, string][] = [
    [{ hunt_id: 'hamlet' },                  'a hunt that is not a row id'],
    [{ quiz_id: 'hamlet' },                  'a quiz that is not a row id'],
    [{ chains_to: '01j0000000000000000000000a' }, 'a chain naming a question by id rather than by label'],
    [{ qnum: 'three' },                      'a question number that is not a number'],
    [{ created_at: 1.5 },                    'a stamp that is not a whole millisecond'],
    [{ updated_at: '2026-10-05T00:00:00Z' }, 'a stamp written as a person reads it'],
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

describe('Question.exposed and RankField', () => {
  it("is every field a formula may read, alphabetically, and never what its widgetings stored", () => {
    expect(Question.exposed).to.deep.eq(['alt_text', 'chains_to', 'clueing', 'full_answer', 'hint', 'label', 'notes', 'qnum', 'title'])
    expect(Question.exposed).not.to.include('stored')
  })

  it("names the rank the bag adds beside them, which is not a field of the question", () => {
    expect(RankField).to.eq('rank')
    expect(Question.exposed).not.to.include(RankField)
  })

  it("leaves what its widgetings stored out of a patch, which never revises it", () => {
    expect(QuestionValidators.questionPatch({ stored: {} } as never)).to.deep.eq({})
  })
})

/** `fieldnames`, in alphabetical order */
function alphabetically(fieldnames: readonly string[]): string[] {
  return fieldnames.toSorted((aa, bb) => aa.localeCompare(bb))
}

describe('Question.sentTo', () => {
  it("sends a smith every field of a question, what a formula reads, what its widgetings stored and its stamps", () => {
    const everyField = Object.keys(Question.blank()).filter((fieldname) => fieldname !== '_id')
    expect(Question.sentTo.smith).to.deep.eq(alphabetically([...Question.exposed, 'stored', 'created_at', 'updated_at']))
    expect(Question.sentTo.smith).to.deep.eq(alphabetically(everyField))
  })

  it("sends a reviewer what a review needs, the answer among it, and not the notes or what the widgetings stored", () => {
    expect(Question.sentTo.reviewer).to.deep.eq(['chains_to', 'clueing', 'full_answer', 'hint', 'label', 'qnum', 'title'])
    for (const withheld of ['notes', 'alt_text', 'stored']) { expect(Question.sentTo.reviewer).to.not.include(withheld) }
  })

  it("sends a stranger to the hunt nothing", () => {
    expect(Question.sentTo.stranger).to.deep.eq([])
  })
})

describe('Question.isSent', () => {
  it("says whether a standing is sent a field, as `sentTo` lists it", () => {
    expect([Question.isSent('stored', 'smith'), Question.isSent('stored', 'reviewer'), Question.isSent('full_answer', 'reviewer'), Question.isSent('title', 'stranger')])
      .to.deep.eq([true, false, true, false])
  })
})

describe('Question.isSentWhole', () => {
  it("is so for a smith alone", () => {
    expect([Question.isSentWhole('smith'), Question.isSentWhole('reviewer'), Question.isSentWhole('stranger')]).to.deep.eq([true, false, false])
  })
})
