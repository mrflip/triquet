import { useSyncExternalStore } from 'react'
import { IdentingValidators } from '../models/identing'

/** Where this browser keeps the key it minted for itself */
export const BrowserKeyStorageKey = 'triquet.browser_key'

/** The key once read or minted: it never changes for the life of the page */
const Held: { key: string | null } = { key: null }

/** The storage a key is kept in; only the two calls this module makes */
export type KeyStore = Pick<Storage, 'getItem' | 'setItem'>

/** This browser's localStorage, or null where there is none or it may not be touched */
function localStore(): KeyStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * The key `store` holds, minting and keeping one when it holds none, or holds something that is not
 * a key. A store that cannot be read or written still gets a key, which lasts only as long as the
 * page: that visitor is someone new on every visit.
 *
 * @param store - Where the key is kept; null for nowhere.
 * @returns A UUID.
 *
 * @example keyIn(localStorage)  // => '0f8e6a4c-1f7b-4c2e-9d3a-5b6c7d8e9f01', the same one every visit
 */
export function keyIn(store: KeyStore | null): string {
  try {
    const kept = store?.getItem(BrowserKeyStorageKey) ?? null
    if (kept !== null && IdentingValidators.browserKey.safeParse(kept).success) { return kept }
  } catch {
    // Unreadable is the same as empty: mint one.
  }
  const minted = crypto.randomUUID()
  try {
    store?.setItem(BrowserKeyStorageKey, minted)
  } catch {
    // Unwritable: the key lasts for this page only.
  }
  return minted
}

/**
 * The key this browser minted for itself on its first visit and keeps: who it says it is, for the
 * trial. Read once per page.
 *
 * @returns A UUID.
 */
export function browserKey(): string {
  Held.key ??= keyIn(localStore())
  return Held.key
}

/** Nothing to undo: nothing was subscribed to */
function unsubscribeNothing(): void {
  // The key never changes while the page is open.
}

/** Nothing to subscribe to: the key never changes while the page is open */
function subscribeNever(): () => void {
  return unsubscribeNothing
}

/**
 * This browser's key, for a view: null while the page is rendered on the server or hydrating,
 * which has no browser to ask, and the key from the first render in the browser on.
 */
export function useBrowserKey(): string | null {
  return useSyncExternalStore(subscribeNever, browserKey, () => null)
}
