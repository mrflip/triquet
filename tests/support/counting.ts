/*
 * A database that counts what is read through it: how a test measures a query function's or a
 * write's reads (documents, and index ranges opened), and which tables it reached, so that a test
 * can hold a read to its bound, and say which writes could rerun it. Everything else (writes, and
 * whatever the database offers beyond reads) passes straight through.
 */

/** What a counting database has read: documents read, index ranges opened (a `get` is one), and the tables reached */
export type ReadsT = {
  docs:   number
  ranges: number
  tables: Set<string>
}

/** The methods of a query that hand back another query, still to be read */
const Narrowing = new Set(['withIndex', 'withSearchIndex', 'fullTableScan', 'order', 'filter'])

/** The methods of a query that read it and hand back one document, or none */
const ReadingOne = new Set(['first', 'unique'])

/** The methods of a query that read it and hand back its documents */
const ReadingMany = new Set(['take', 'collect'])

/** Any method, as the proxies call one: on what it was taken from, with whatever it was handed */
type MethodT = (...args: unknown[]) => unknown

/** `reads`, with one range of `docs` documents of `tablename` read */
function tally(reads: ReadsT, tablename: string, docs: number): void {
  reads.ranges += 1
  reads.docs += docs
  reads.tables.add(tablename)
}

/** The query `inner`, of `tablename`, counting into `reads` whatever it reads */
function countingQuery(inner: object, tablename: string, reads: ReadsT): object {
  return new Proxy(inner, {
    get(target, prop) {
      const member: unknown = Reflect.get(target, prop)
      if (typeof member !== 'function') { return member }
      if (prop === Symbol.asyncIterator) {
        return () => {
          const iterator = (member as () => AsyncIterator<unknown>).call(target)
          tally(reads, tablename, 0)
          return {
            next: async () => {
              const step = await iterator.next()
              if (! step.done) { reads.docs += 1 }
              return step
            },
          }
        }
      }
      if (typeof prop !== 'string') { return (member as MethodT).bind(target) }
      if (Narrowing.has(prop)) { return (...args: unknown[]) => countingQuery((member as (...args: unknown[]) => object).apply(target, args), tablename, reads) }
      if (ReadingOne.has(prop)) {
        return async (...args: unknown[]) => {
          const found: unknown = await (member as (...args: unknown[]) => Promise<unknown>).apply(target, args)
          tally(reads, tablename, found === null ? 0 : 1)
          return found
        }
      }
      if (ReadingMany.has(prop)) {
        return async (...args: unknown[]) => {
          const found = await (member as (...args: unknown[]) => Promise<unknown[]>).apply(target, args)
          tally(reads, tablename, found.length)
          return found
        }
      }
      return (member as MethodT).bind(target)
    },
  })
}

/**
 * `db`, counting what is read through it into the `reads` handed back beside it. A `get` names its
 * table first, as every `get` here does (`db.get('questions', question_id)`).
 *
 * @example
 *   const { db, reads } = counting(ctx.db)
 *   await storedFor(db, question_id)
 *   expect(reads).to.deep.include({ docs: 2, ranges: 2 })
 */
export function counting<DT extends object>(db: DT): { db: DT, reads: ReadsT } {
  const reads: ReadsT = { docs: 0, ranges: 0, tables: new Set() }
  const wrapped = new Proxy(db, {
    get(target, prop) {
      const member: unknown = Reflect.get(target, prop)
      if (typeof member !== 'function') { return member }
      if (prop === 'query') { return (tablename: string) => countingQuery((member as (tablename: string) => object).call(target, tablename), tablename, reads) }
      if (prop === 'get') {
        return async (tablename: string, id: string) => {
          const found: unknown = await (member as (tablename: string, id: string) => Promise<unknown>).call(target, tablename, id)
          tally(reads, tablename, found === null ? 0 : 1)
          return found
        }
      }
      return (member as MethodT).bind(target)
    },
  })
  return { db: wrapped, reads }
}

/**
 * `reads` as plain values, its tables in alphabetical order: what a test hands back out of a
 * transaction (`tt.run`), which takes no `Set`.
 *
 * @example plainReads({ docs: 2, ranges: 1, tables: new Set(['widgeteds']) })  // => { docs: 2, ranges: 1, tables: ['widgeteds'] }
 */
export function plainReads(reads: ReadsT): { docs: number, ranges: number, tables: string[] } {
  return { docs: reads.docs, ranges: reads.ranges, tables: [...reads.tables].toSorted((aa, bb) => aa.localeCompare(bb)) }
}
