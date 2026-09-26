import { describe, expect, it } from 'vitest'
import { mintId } from '../../src/lib/ids'
import { ValidatorKit } from '../../src/lib/validator'

describe('mintId', () => {
  it('mints an id shaped like a row id, which the tree accepts', () => {
    const id = mintId()
    expect(ValidatorKit.rowid.safeParse(id).success).to.eq(true)
    expect(ValidatorKit.treeid.safeParse(id).success).to.eq(true)
  })

  it('mints a distinct id every call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => mintId()))
    expect(ids.size).to.eq(100)
  })
})
