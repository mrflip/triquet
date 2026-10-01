import { describe, expect, it } from 'vitest'
import { renderPrompt } from '../../../src/lib/ask/prompts'

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
