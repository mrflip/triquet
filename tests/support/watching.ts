import { getFunctionName, type FunctionReference } from 'convex/server'
import type { WatcherT } from '../../src/state/hunt-feed'
import type { SessionTester, Tester } from './convex'

/*
 * A stand-in for the Convex client's watches, over a convex-test deployment, as one session: what
 * the browser's watching code is handed in place of the client, to drive it against the real query
 * functions. Watches of one query with the same arguments share one subscription, as the client's
 * do. Nothing arrives on its own: `settle` runs every subscribed query, as the server would after a
 * change, tells each watch whose result changed, all of one moment together, and goes on until
 * nothing new is subscribed and nothing changes; and it counts what the server would have sent.
 */

/** One subscription: its query and arguments, who listens, and its last result, with that result's JSON (null until it has one) */
type HeldT = {
  query:     FunctionReference<'query'>
  args:      Record<string, unknown>
  listeners: Set<() => void>
  result:    unknown
  json:      string | null
}

/** What settling sent: how many results, and their bytes as JSON, in all and by query function */
export type SentT = {
  results: number
  bytes:   number
  byQuery: Record<string, { results: number, bytes: number }>
}

/** The stand-in: the watcher to hand the code under test, and what it holds and sent */
export type StandInT = {
  watcher: WatcherT
  /** Run every subscribed query and tell the watches of what changed, until nothing more does; what would have been sent */
  settle:  () => Promise<SentT>
  /** The subscriptions held now, by query function's name, one per subscription */
  held:    () => string[]
}

/** Nothing sent */
function noneSent(): SentT {
  return { results: 0, bytes: 0, byQuery: {} }
}

/** `sent` with one result of `bytes` from `fnname` added */
function addSent(sent: SentT, fnname: string, bytes: number): void {
  const counted = sent.byQuery[fnname] ?? { results: 0, bytes: 0 }
  sent.byQuery[fnname] = { results: counted.results + 1, bytes: counted.bytes + bytes }
  sent.results += 1
  sent.bytes += bytes
}

/**
 * A stand-in for the Convex client's watches, calling the query functions as `caller`: a session's
 * tester (`identified(tt, label).as`), or the bare tester.
 *
 * @example const standIn = standInFor(smith.as); watchHunt(standIn.watcher, setup, onReading); await standIn.settle()
 */
export function standInFor(caller: SessionTester | Tester): StandInT {
  const subscribed = new Map<string, HeldT>()

  const watchQuery = (query: FunctionReference<'query'>, args: Record<string, unknown> = {}) => {
    const token = `${getFunctionName(query)}:${JSON.stringify(args)}`
    return {
      localQueryResult: () => subscribed.get(token)?.result,
      onUpdate:         (callback: () => void) => {
        const held = subscribed.get(token) ?? { query, args, listeners: new Set<() => void>(), result: undefined, json: null }
        subscribed.set(token, held)
        held.listeners.add(callback)
        return () => {
          held.listeners.delete(callback)
          if (held.listeners.size === 0) { subscribed.delete(token) }
        }
      },
    }
  }

  // Run one subscription's query again: whether its result changed, counted in `sent` when it did.
  const rerun = async (held: HeldT, sent: SentT): Promise<boolean> => {
    const result: unknown = await caller.query(held.query, held.args)
    const json = JSON.stringify(result ?? null)
    if (json === held.json) { return false }
    held.result = result
    held.json = json
    addSent(sent, getFunctionName(held.query), json.length)
    return true
  }

  const settle = async (): Promise<SentT> => {
    const sent = noneSent()
    for (;;) {
      const changed: HeldT[] = []
      for (const held of subscribed.values()) {
        if (await rerun(held, sent)) { changed.push(held) }
      }
      if (changed.length === 0) { return sent }
      const listeners = changed.flatMap((held) => [...held.listeners])
      for (const listener of listeners) { listener() }
      // What a listener put off to a microtask (a reading, and the watches it opens) runs before the next round.
      await new Promise((resolve) => { setTimeout(resolve, 0) })
    }
  }

  const held = () => subscribed.values().map((each) => getFunctionName(each.query)).toArray().toSorted((aa, bb) => aa.localeCompare(bb))
  // The client's watches carry more than this code reads (logs, a journal); a stand-in need not.
  return { watcher: { watchQuery } as unknown as WatcherT, settle, held }
}
