import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { getFunctionName, type FunctionReference } from 'convex/server'

/*
 * A stand-in for `convex/react` for a test that renders a screen in a DOM (`*.dom.test.tsx`):
 * `useQuery`, `useQueries`, `useMutation` and `useConvex` over results the test holds and changes
 * by hand, as the server would send them. A result keeps its identity until the test replaces it,
 * as the client's local store keeps a query's result until a new one arrives; `useQueries` hands
 * back a new record only when one of its results is new. A mutation is answered by the test's
 * `perform`. Install it with
 * `vi.mock('convex/react', async () => (await import('../support/fake-convex-react')).FakeConvexReact)`.
 */

/** What a query function is answered with: its result, by its arguments; undefined while on its way */
type AnswerT = (args: Record<string, unknown>) => unknown

/** The stand-in server: the answers to each query function, by its name, and what a mutation does */
export type FakeServerT = {
  /** Answer the query function `fnname` with this, from now on, and tell every watch */
  answer:  (fnname: string, answer: AnswerT) => void
  /** Carry out a mutation; the test sets it */
  perform: (fnname: string, args: Record<string, unknown>) => Promise<unknown>
  /** Tell every watch that something may have changed: call after changing what an answer reads */
  changed: () => void
}

/** The answers, the watches told when they change, and a count of the changes */
const Held = {
  answers:   new Map<string, AnswerT>(),
  listeners: new Set<() => void>(),
  version:   0,
}

/** The one stand-in server, which the test drives */
export const FakeServer: FakeServerT = {
  answer: (fnname, answer) => {
    Held.answers.set(fnname, answer)
    FakeServer.changed()
  },
  perform: () => Promise.resolve(null),
  changed: () => {
    Held.version += 1
    for (const listener of Held.listeners) { listener() }
  },
}

/** Forget every answer and watch, between tests */
export function resetFakeServer(): void {
  Held.answers.clear()
  Held.listeners.clear()
  Held.version = 0
  FakeServer.perform = () => Promise.resolve(null)
}

/** Watch for a change */
function subscribe(listener: () => void): () => void {
  Held.listeners.add(listener)
  return () => { Held.listeners.delete(listener) }
}

/** What the query `query` answers to `args` now */
function resultOf(query: FunctionReference<'query'>, args: Record<string, unknown>): unknown {
  return Held.answers.get(getFunctionName(query))?.(args)
}

/** `useQuery`: the query's result, followed as the test changes it; undefined when skipped */
function useQuery(query: FunctionReference<'query'>, args: Record<string, unknown> | 'skip'): unknown {
  const snapshot = () => (args === 'skip' ? undefined : resultOf(query, args))
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** The record `useQueries` last handed back, by the queries it was asked */
const Records = new WeakMap<object, Record<string, unknown>>()

/** Whether two records hold the very same results under the same keys */
function isSameRecord(aa: Record<string, unknown>, bb: Record<string, unknown>): boolean {
  return Object.keys(aa).length === Object.keys(bb).length && Object.entries(aa).every(([key, val]) => bb[key] === val)
}

/** `useQueries`: each query's result by its key, a new record only when one of them is new */
function useQueries(queries: Record<string, { query: FunctionReference<'query'>, args: Record<string, unknown> }>): Record<string, unknown> {
  const snapshot = useCallback(() => {
    const read = Object.fromEntries(Object.entries(queries).map(([key, { query, args }]) => [key, resultOf(query, args)]))
    const last = Records.get(queries)
    if (last !== undefined && isSameRecord(last, read)) { return last }
    Records.set(queries, read)
    return read
  }, [queries])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** A mutation as the screen holds it: called with its arguments, and `withOptimisticUpdate` for one that shows its change early, which here shows nothing */
type FakeMutation = ((args: Record<string, unknown>) => Promise<unknown>) & { withOptimisticUpdate: () => FakeMutation }

/** `useMutation`: a function that hands the mutation to the test's `perform` */
function useMutation(mutation: FunctionReference<'mutation'>): FakeMutation {
  const fnname = getFunctionName(mutation)
  return useMemo(() => {
    const perform: FakeMutation = Object.assign((args: Record<string, unknown>) => FakeServer.perform(fnname, args), { withOptimisticUpdate: () => perform })
    return perform
  }, [fnname])
}

/** The client, as far as the screen asks it anything */
const Client = {
  connectionState: () => ({ isWebSocketConnected: true, connectionRetries: 0, inflightMutations: 0 }),
  query:           (query: FunctionReference<'query'>, args: Record<string, unknown>) => Promise.resolve(resultOf(query, args)),
}

/** `useConvex`: the client */
function useConvex(): typeof Client {
  return Client
}

/** What stands in for `convex/react` */
export const FakeConvexReact = { useQuery, useQueries, useMutation, useConvex }
