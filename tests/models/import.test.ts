import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { ClearedValueFor, ImportValidators, ImportableFieldnames } from '../../src/models/import'

describe('ImportValidators.importQuestion', () => {
  it('tells absent, null and present apart: leave it, clear it, take this', () => {
    const question = ImportValidators.importQuestion({ clueing: 'Who?', hint: null })
    expect(question).to.deep.eq({ clueing: 'Who?', hint: null })
    expect('title' in question).to.eq(false)
  })

  it('takes an id from anywhere, since it only resolves the file\'s own chains', () => {
    expect(ImportValidators.importQuestion({ id: 'q-7', chains_to: 'q-8' })).to.deep.eq({ id: 'q-7', chains_to: 'q-8' })
  })

  it('rejects a blank id, which could name nothing', () => {
    expect(() => ImportValidators.importQuestion({ id: '' })).to.throw(Z.ZodError)
  })

  it('drops keys it does not know', () => {
    expect(ImportValidators.importQuestion({ clueing: 'Who?', difficulty: 9 } as never)).to.deep.eq({ clueing: 'Who?' })
  })
})

describe('ImportValidators.importPayload', () => {
  const PayloadCases = [
    [{ quizzes: [{ title: 'One', questions: [{ clueing: 'Who?' }] }] }, 'a whole workspace'],
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

  it('rejects a workspace holding no quizzes', () => {
    expect(() => ImportValidators.importWorkspace({ quizzes: [] })).to.throw(Z.ZodError)
  })
})

describe('ClearedValueFor', () => {
  it('says what "clear it" means for every importable field', () => {
    expect(ClearedValueFor).to.have.all.keys(...ImportableFieldnames)
  })
})
