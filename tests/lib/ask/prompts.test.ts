import { describe, expect, it } from 'vitest'
import { BulkIshesPrompt, ClueingIshesPrompt, HintIshesPrompt, PromptTemplates, QuickGuessPrompt, bulkItemsBlock, renderPrompt } from '../../../src/lib/ask/prompts'

describe('renderPrompt', () => {
  it('fills a placeholder', () => {
    expect(renderPrompt('Question: {{clueing}}', { clueing: 'Who?' })).to.eq('Question: Who?')
  })

  it('fills every occurrence of a placeholder', () => {
    expect(renderPrompt('{{aa}} then {{aa}}', { aa: 'x' })).to.eq('x then x')
  })

  it('leaves a placeholder it was given nothing for alone', () => {
    expect(renderPrompt('{{clueing}} {{hint}}', { clueing: 'Who?' })).to.eq('Who? {{hint}}')
  })

  it('keeps a dollar-ampersand in the author\'s own text literal', () => {
    expect(renderPrompt('Q: {{clueing}}', { clueing: 'Worth $& more' })).to.eq('Q: Worth $& more')
  })

  it('keeps text that merely looks like a placeholder alone', () => {
    expect(renderPrompt('Q: {{clueing}}', { clueing: 'see {{hint}}' })).to.eq('Q: see {{hint}}')
  })
})

describe('bulkItemsBlock', () => {
  it('tags each text with its key, blank-line separated', () => {
    expect(bulkItemsBlock([{ key: 'c:aa', text: 'Two things' }, { key: 'h:bb', text: 'Three more' }]))
      .to.eq('[c:aa] Two things\n\n[h:bb] Three more')
  })

  it('reads an empty list as an empty block', () => {
    expect(bulkItemsBlock([])).to.eq('')
  })
})

describe('the templates', () => {
  it('asks the quick model for a first-instinct read, not an expert one', () => {
    expect(QuickGuessPrompt).to.include('fast, not-especially-careful player')
    expect(QuickGuessPrompt).to.include('{{clueing}}')
  })

  it('names the two ish kinds and what separates them', () => {
    for (const template of [ClueingIshesPrompt, HintIshesPrompt, BulkIshesPrompt]) {
      expect(template).to.include('"numeral"')
      expect(template).to.include('"wordish"')
      expect(template).to.include('300 million')
    }
  })

  it('rules out the two things a player would not count', () => {
    for (const template of [ClueingIshesPrompt, HintIshesPrompt, BulkIshesPrompt]) {
      expect(template).to.include('indefinite article')
      expect(template).to.include('Roman numerals')
    }
  })

  it('addresses the hint template to the hint', () => {
    expect(HintIshesPrompt).to.include('Hint: {{hint}}')
    expect(HintIshesPrompt).to.not.include('{{clueing}}')
  })

  it('shows every template in the Prompts used panel', () => {
    expect(PromptTemplates.map((template) => template.body))
      .to.deep.eq([QuickGuessPrompt, ClueingIshesPrompt, HintIshesPrompt, BulkIshesPrompt])
  })
})
