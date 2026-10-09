import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import * as PA from '../../src/lib/vv/patterns'
import { ClearedValueFor, ImportValidators, ImportableFieldnames } from '../../src/models/import'

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

describe('ImportValidators.importedQuestions', () => {
  it("takes one entry per label, each with what to change, and nothing typed or replied unless it says", () => {
    const sent = [{ label: 'leon', patch: { clueing: 'Who?', chains_to: 'nantes' } }, { label: 'nantes', patch: {} }]
    expect(ImportValidators.importedQuestions(sent)).to.deep.eq(sent.map((each) => ({ ...each, entered: {}, replied: {} })))
  })

  it('takes what to type into entry cells, by the entry widgeting\'s label, null for emptying one', () => {
    const sent = [{ label: 'leon', patch: {}, entered: { remark: 'Ask Flip.', points: 3, mood: null } }]
    expect(ImportValidators.importedQuestions(sent)).to.deep.eq(sent.map((each) => ({ ...each, replied: {} })))
  })

  it("takes a question's category estimates to type into a category-estimate cell", () => {
    const sent = [{ label: 'leon', patch: {}, entered: { cats: [{ category: 'tv' as const, difficulty: 'hard' as const }] } }]
    expect(ImportValidators.importedQuestions(sent)).to.deep.eq(sent.map((each) => ({ ...each, replied: {} })))
  })

  it("takes the bots' replies to carry into asked cells, by the widgeting's label: any JSON a cell may store", () => {
    const sent = [{ label: 'leon', patch: {}, entered: {}, replied: { dumdum: { guess: 'Leon', explanation: 'a lion' }, numnum_clueing: { items: [] }, tally: 3 } }]
    expect(ImportValidators.importedQuestions(sent)).to.deep.eq(sent)
  })

  it("refuses a reply keyed by what is not a label, or bigger than a cell may store", () => {
    expect(() => ImportValidators.importedQuestions([{ label: 'leon', patch: {}, replied: { 'Not A Label': 'x' } }])).to.throw(Z.ZodError)
    expect(() => ImportValidators.importedQuestions([{ label: 'leon', patch: {}, replied: { dumdum: 'x'.repeat(PA.WidgetedJson.max + 1) } }])).to.throw(Z.ZodError)
  })

  it('refuses what no entry could hold, and a key that is not a label', () => {
    expect(() => ImportValidators.importedQuestions([{ label: 'leon', patch: {}, entered: { remark: { nested: true } as never } }])).to.throw(Z.ZodError)
    expect(() => ImportValidators.importedQuestions([{ label: 'leon', patch: {}, entered: { 'Not A Label': 'x' } }])).to.throw(Z.ZodError)
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
