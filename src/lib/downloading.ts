/**
 * Hand `bytes` to the browser as a file the author is downloading.
 *
 * A temporary object URL behind a synthetic click is the only way to name a downloaded file from
 * a page, and the URL is revoked immediately afterwards so the bytes are not held for the life
 * of the tab.
 *
 * @param filename - What the file should be called once it lands.
 * @param bytes - The file's contents.
 * @param mimetype - What the file is; a generic binary stream when omitted.
 *
 * @example offerDownload('quiet_otter.zip', zipped, 'application/zip')
 */
export function offerDownload(filename: string, bytes: Uint8Array, mimetype = 'application/octet-stream'): void {
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: mimetype }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
