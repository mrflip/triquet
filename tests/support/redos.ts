import type * as Redos from '../../src/lib/redos'

/**
 * Room enough for recheck to settle any pattern a test writes, however busy the machine: ten
 * seconds a pattern, and for a change. recheck times its check by the wall clock, and its first
 * check in a process (a cold Scala.js program) takes 70 to 120 ms for a pattern it settles in 3 to
 * 25 ms once warm; under a load of 25 that passes `Redos.CheckMs`, and a pattern recheck would
 * call safe, or vulnerable, is refused as one it ran out of time on. A test of a verdict gives it
 * this room; a test of the budget itself hands the budget it means.
 */
export const RoomyMs = 10_000

/**
 * `actual`, the `Redos` module, with every change's patterns checked in `RoomyMs`: what a test file
 * of the mutations that write patterns mocks it with, so a verdict it reads does not hang on the
 * machine's load. The budgets the server keeps are tested in `tests/lib/redos.test.ts`.
 *
 * @example vi.mock('../../src/lib/redos', async (importOriginal) => { const Support = await import('../support/redos'); return Support.roomy(await importOriginal()) })
 */
export function roomy(actual: typeof Redos): typeof Redos {
  return { ...actual, firstRefusalOf: (regexes) => actual.firstRefusalOf(regexes, RoomyMs, RoomyMs) }
}
