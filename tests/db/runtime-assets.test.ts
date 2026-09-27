import { describe, expect, it } from 'vitest'
import { runtimeAssetsBase } from '../../src/db/runtime-assets'

describe('runtimeAssetsBase', () => {
  it('is a path from the site root, named for the version, ending in a slash for Jazz to join files to', () => {
    expect(runtimeAssetsBase('2.0.0-alpha.56-3f9a1c0b2e7d')).to.eq('/jazz/2.0.0-alpha.56-3f9a1c0b2e7d/')
  })
})
