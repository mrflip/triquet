/**
 * The clock every budget of time is read on: the app's templates, its formulas and its runs, in
 * the browser and on the server alike.
 *
 * Inside a Convex mutation `Date.now()` stands still from the function's start to its end, so a
 * timebox reading it never fires there; `performance.now()` moves (probed on a local backend,
 * 2026-10-08: `whiteboard/20261008-columnwise/thread-7-budgets.md`). Read the time here, never
 * from `Date.now()`, wherever it bounds work.
 */

/**
 * The time now, in milliseconds from an arbitrary start: a reading to measure from, or to set a
 * deadline by, never a date. It moves inside a Convex mutation, where `Date.now()` stands still.
 *
 * @example const deadline = clockNow() + 250
 */
export function clockNow(): number {
  return performance.now()
}

/**
 * The sooner of two deadlines, each a `clockNow()` reading; none (`undefined`) is never.
 *
 * @example soonerOf(100, 250)        // => 100
 * @example soonerOf(undefined, 250)  // => 250
 * @example soonerOf(undefined, undefined)  // => undefined
 */
export function soonerOf(one: number | undefined, other: number | undefined): number | undefined {
  if (one === undefined) { return other }
  if (other === undefined) { return one }
  return Math.min(one, other)
}
