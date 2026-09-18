import { describe, expect, it } from 'vitest'
import { greet } from '../../src/lib/greeting'

describe('greet', () => {
  it('defaults to greeting the world', () => {
    expect(greet()).to.eq('Hello, World!')
  })
  it('greets the given name, capitalized', () => {
    expect(greet({ name: 'triquet' })).to.eq('Hello, Triquet!')
  })
  it('rejects an empty name', () => {
    expect(() => greet({ name: '' })).to.throw()
  })
})
