import { describe, expect, it } from 'vitest'
import { SyncUnconfigured } from '../../src/components/SyncNotices'
import { renderedText } from './rendering'

describe('renderedText', () => {
  it("is the text a view draws, without the styles MUI writes beside it", () => {
    expect(renderedText(<SyncUnconfigured />)).to.eq('This build has no database: set NEXT_PUBLIC_CONVEX_URL.')
  })
})
