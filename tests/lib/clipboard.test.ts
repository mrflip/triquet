import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Clipboard from '../../src/lib/clipboard'

afterEach(() => { vi.unstubAllGlobals() })

describe('took', () => {
  it('is true, having written the text, when the clipboard accepts it', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await Clipboard.took('hello')).to.eq(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('is false when the browser refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } })
    expect(await Clipboard.took('hello')).to.eq(false)
  })

  it('is false where there is no clipboard at all', async () => {
    vi.stubGlobal('navigator', {})
    expect(await Clipboard.took('hello')).to.eq(false)
  })
})
