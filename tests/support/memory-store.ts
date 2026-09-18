/** An in-memory `Storage`, so storage behaviour can be tested without a browser */
export class MemoryStore implements Storage {
  private bag = new Map<string, string>()

  /** Whether `setItem` should refuse, standing in for a full or disabled store */
  refuses = false

  get length(): number { return this.bag.size }

  getItem(storekey: string): string | null {
    return this.bag.get(storekey) ?? null
  }

  setItem(storekey: string, raw: string): void {
    if (this.refuses) { throw new Error('QuotaExceededError') }
    this.bag.set(storekey, raw)
  }

  removeItem(storekey: string): void { this.bag.delete(storekey) }

  clear(): void { this.bag.clear() }

  key(idx: number): string | null { return this.bag.keys().toArray()[idx] ?? null }
}
