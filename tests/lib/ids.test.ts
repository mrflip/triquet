import { describe, expect, it } from 'vitest'
import { mintId } from '../../src/lib/ids'
import { ValidatorKit } from '../../src/lib/validator'

// Byte order, not locale order: a ULID's sortability is a property of its encoding.
const byCodepoint = (aa: string, bb: string) => (aa < bb ? -1 : 1)

describe('mintId', () => {
  it('mints a lowercase ULID', () => {
    expect(ValidatorKit.ulid.safeParse(mintId()).success).to.eq(true)
  })

  it('mints a distinct id every call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => mintId()))
    expect(ids.size).to.eq(100)
  })

  it('mints ids that sort by mint time', () => {
    const ante = mintId()
    const post = mintId()
    expect([post, ante].toSorted(byCodepoint)).to.deep.eq([ante, post])
  })
})
