import { afterEach, describe, expect, it, vi } from 'vitest'
import { offerDownload } from '../../src/lib/downloading'

/** A stand-in for the page, recording what was done to the one anchor it hands out */
function stubPage() {
  const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
  const append = vi.fn()
  vi.stubGlobal('document', { createElement: () => anchor, body: { append } })
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stand-in')
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue()
  return { anchor, append, createObjectURL, revokeObjectURL }
}

describe('offerDownload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('clicks an anchor named for the file, then tidies it away', () => {
    const page = stubPage()
    offerDownload('quiet_otter.zip', new Uint8Array([1, 2, 3]), 'application/zip')
    expect(page.anchor).to.include({ href: 'blob:stand-in', download: 'quiet_otter.zip' })
    expect(page.anchor.click).toHaveBeenCalledOnce()
    expect(page.anchor.remove).toHaveBeenCalledOnce()
  })

  it('releases the bytes as soon as the click is made', () => {
    const page = stubPage()
    offerDownload('quiet_otter.zip', new Uint8Array([1, 2, 3]))
    expect(page.revokeObjectURL).toHaveBeenCalledWith('blob:stand-in')
  })

  it('calls the file a generic binary stream unless told what it is', () => {
    const page = stubPage()
    offerDownload('quiet_otter.bin', new Uint8Array([1]))
    const blob = page.createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob.type).to.eq('application/octet-stream')
  })
})
