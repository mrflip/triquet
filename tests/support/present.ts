/**
 * `val`, having asserted it is there.
 *
 * Keeps tests free of non-null assertions, which `@stylistic/space-unary-ops` reads as an
 * unspaced negation, and which say nothing useful when they turn out to be wrong.
 *
 * @param val - Whatever the test just looked up.
 * @returns The same value, no longer nullable.
 * @throws When it was not there, naming the test's own assumption.
 *
 * @example present(quiz.questions[1]).clueing
 */
export function present<VV>(val: VV | null | undefined, blurb = 'a value'): VV {
  if (val === null || val === undefined) { throw new Error(`Expected ${blurb} to be present, found none`) }
  return val
}
