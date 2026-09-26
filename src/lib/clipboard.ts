/**
 * Whether the clipboard accepted `text`.
 *
 * In an insecure context `navigator.clipboard` is not there at all, and even where it is the
 * browser may refuse; both reach the author as the same fallback rather than as an error.
 *
 * @param text - What to put on the clipboard.
 * @returns True when it landed.
 *
 * @example if (! await took('hello')) { showFallback() }
 */
export async function took(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
