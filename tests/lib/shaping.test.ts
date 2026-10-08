import { describe, expect, it } from 'vitest'
import * as Shaping from '../../src/lib/shaping'

describe('Shaping.quotedOf', () => {
  it("writes the doc block's examples", () => {
    expect(Shaping.quotedOf('Who?\n\nNot him')).to.eq('Who?\n>\n> Not him')
    expect(Shaping.quotedOf('Who wrote\n    *verse*')).to.eq('Who wrote\n> > *verse*')
  })

  it('drops blank lines at either end, and a carriage return', () => {
    expect(Shaping.quotedOf('\n\nWho?\r\nWhen?\n\n')).to.eq('Who?\n> When?')
  })

  it('starts a text opening with a quote of its own on the line below', () => {
    expect(Shaping.quotedOf('> Said he\nWho?')).to.eq('\n> > Said he\n> Who?')
  })
})

describe('Shaping.oneLineOf', () => {
  it("writes the doc block's example", () => {
    expect(Shaping.oneLineOf('HAMILTON\n\n(accept ROWAN)\n')).to.eq('HAMILTON (accept ROWAN)')
  })
})

describe('Shaping.belowOf', () => {
  it("writes the doc block's examples", () => {
    expect(Shaping.belowOf('Aced.\n')).to.eq('Aced.')
    expect(Shaping.belowOf('---\nAfter.')).to.eq('\n---\nAfter.')
  })

  it('sets an underline of equals signs apart too, and leaves a blank text blank', () => {
    expect(Shaping.belowOf('===')).to.eq('\n===')
    expect(Shaping.belowOf('  \n')).to.eq('')
  })
})
