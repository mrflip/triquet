import { describe, expect, it } from 'vitest'
import { BrowserKeyStorageKey, keyIn, type KeyStore } from '../../src/state/browser-key'

const Kept = '0f8e6a4c-1f7b-4c2e-9d3a-5b6c7d8e9f01'
const UuidShape = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/

/** A store holding `held`, as localStorage would */
function storeOf(held: Record<string, string> = {}): KeyStore & { held: Record<string, string> } {
  return {
    held,
    getItem: (key) => held[key] ?? null,
    setItem: (key, val) => { held[key] = val },
  }
}

/** A store every call to which throws, as a browser refusing site data does */
const Refusing: KeyStore = {
  getItem: () => { throw new Error('SecurityError') },
  setItem: () => { throw new Error('SecurityError') },
}

describe('keyIn', () => {
  it('is the key the store already keeps', () => {
    expect(keyIn(storeOf({ [BrowserKeyStorageKey]: Kept }))).to.eq(Kept)
  })

  it('mints a key into a store that keeps none, and is that key from then on', () => {
    const store = storeOf()
    const minted = keyIn(store)
    expect([UuidShape.test(minted), store.held[BrowserKeyStorageKey], keyIn(store)]).to.deep.eq([true, minted, minted])
  })

  it('mints afresh over something kept that is not a key', () => {
    const store = storeOf({ [BrowserKeyStorageKey]: 'not-a-key' })
    const minted = keyIn(store)
    expect([minted === 'not-a-key', UuidShape.test(minted), store.held[BrowserKeyStorageKey]]).to.deep.eq([false, true, minted])
  })

  it('still gives a key where nothing can be kept, a new one each time', () => {
    const [first, second] = [keyIn(Refusing), keyIn(null)]
    expect([UuidShape.test(first), UuidShape.test(second), first === second]).to.deep.eq([true, true, false])
  })
})
