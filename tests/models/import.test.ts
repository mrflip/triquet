import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { ClearedValueFor, ImportValidators, ImportableFieldnames, type ImportedBottingT } from '../../src/models/import'

describe('ImportValidators.importQuestion', () => {
  it('tells absent, null and present apart: leave it, clear it, take this', () => {
    const question = ImportValidators.importQuestion({ clueing: 'Who?', hint: null })
    expect(question).to.deep.eq({ clueing: 'Who?', hint: null })
    expect('title' in question).to.be.false
  })

  it('names a chain by the label of the question it points at', () => {
    expect(ImportValidators.importQuestion({ chains_to: 'nantes' })).to.deep.eq({ chains_to: 'nantes' })
  })

  it('rejects a chain that is not a label', () => {
    expect(() => ImportValidators.importQuestion({ chains_to: 'Not A Label' })).to.throw(Z.ZodError)
  })

  it('drops keys it does not know, what a bot replied among them', () => {
    const guess = { status: 'done', text: 'Leon', truncated: false, updated_at: 1, last_err: null }
    expect(ImportValidators.importQuestion({ clueing: 'Who?', difficulty: 9, guess } as never)).to.deep.eq({ clueing: 'Who?' })
  })
})

describe('ImportValidators.importPayload', () => {
  const PayloadCases = [
    [{ realms: [{ quizzes: [{ title: 'One', questions: [{ clueing: 'Who?' }] }] }] }, 'a whole hunt'],
    [{ title: 'One', questions: [{ clueing: 'Who?' }] },                'a single quiz'],
    [[{ clueing: 'Who?' }],                                             'a bare list of questions'],
  ] as const

  for (const [payload, story] of PayloadCases) {
    it(`accepts ${story}`, () => {
      expect(() => ImportValidators.importPayload(payload as never)).not.to.throw()
    })
  }

  it('leaves each question unjudged, so one bad one cannot block the rest', () => {
    const quiz = ImportValidators.importQuiz({ questions: [{ clueing: 'Who?' }, 'not a question'] })
    expect(quiz.questions).to.deep.eq([{ clueing: 'Who?' }, 'not a question'])
  })

  it('rejects a hunt holding no realms, or a realm holding no quizzes', () => {
    expect(() => ImportValidators.importHunt({ realms: [] })).to.throw(Z.ZodError)
    expect(() => ImportValidators.importHunt({ realms: [{ quizzes: [] }] })).to.throw(Z.ZodError)
  })
})

describe('ImportValidators.importedQuestions', () => {
  it('takes one entry per label, each with what to change and no replies unless it carries some', () => {
    const sent = [{ label: 'leon', patch: { clueing: 'Who?', chains_to: 'nantes' } }, { label: 'nantes', patch: {} }]
    expect(ImportValidators.importedQuestions(sent)).to.deep.eq(sent.map((question) => ({ ...question, bottings: [] })))
  })

  it('takes the replies an entry carries, and refuses one from a bot not put that text', () => {
    const reply: ImportedBottingT = { bot_label: 'dumdum', textkind: 'clueing', reply_text: 'Leon', items: [], truncated: false, model_tier_applied: null, approx_tokens: null }
    expect(ImportValidators.importedQuestions([{ label: 'leon', patch: {}, bottings: [reply] }])[0]?.bottings).to.deep.eq([reply])
    expect(() => ImportValidators.importedQuestions([{ label: 'leon', patch: {}, bottings: [{ ...reply, textkind: 'hint' }] }])).to.throw(Z.ZodError)
  })

  it('refuses two entries naming one label', () => {
    expect(() => ImportValidators.importedQuestions([{ label: 'leon', patch: {} }, { label: 'leon', patch: {} }])).to.throw(Z.ZodError)
  })
})

describe('ClearedValueFor', () => {
  it('says what "clear it" means for every importable field', () => {
    expect(ClearedValueFor).to.have.all.keys(...ImportableFieldnames)
  })
})
