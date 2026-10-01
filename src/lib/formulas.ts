import jsonata from 'jsonata'
import * as PA from './vv/patterns'

/** Most characters a formula may have */
export const FormulaMax = PA.Formulaish.max

/** How long one evaluation may run before it is stopped */
export const TimeboxMs = 100

/** How deeply one evaluation may nest before it is stopped */
export const DepthMax = 500

/** How a formula failed: it does not parse, it errored while running, or it would not stop */
export type FormulaFailkind = 'syntax' | 'runtime' | 'timeout'

/** What a formula came to: whatever JSONata returned, or the sentence for why it could not */
export type FormulaOutcome =
  | { ok: true, val: unknown }
  | { ok: false, failkind: FormulaFailkind, message: string }

/** The subset of a JSONata error that we read */
type JsonataFailure = { message?: string, position?: number }

/** How many compiled formulas are remembered before the memory is cleared and started over */
const CompiledMax = 200

/** A formula as compiled: ready to run, or with the sentence for why it will not */
type Compilation = { expression: jsonata.Expression } | { message: string }

const Compiled = new Map<string, Compilation>()

/**
 * The problem with `formula`'s syntax, in the author's words, or null when it parses.
 *
 * @param formula - JSONata source.
 * @returns A sentence, or null for a formula that can be run.
 *
 * @example check('$sum(qn.numnum_clueing.value.items.value)')  // => null
 * @example check('$sum(')  // => a sentence naming the problem
 */
export function check(formula: string): string | null {
  const compiled = compile(formula)
  return 'message' in compiled ? compiled.message : null
}

/**
 * `formula` applied to `bag`, never throwing: whatever goes wrong comes back as an outcome.
 *
 * A formula that will not stop -- a recursion that never ends, say -- is halted after
 * `TimeboxMs` (or `DepthMax` levels deep) and reported as a timeout, so a bad formula spoils a
 * cell rather than freezing the page.
 *
 * @param formula - JSONata source.
 * @param input - The JSON document the formula reads: an object's top-level keys are what the formula names directly.
 * @returns The value it came to (undefined when it found nothing), or why it failed.
 *
 * @example evaluate('a + 1', { a: 2 })  // => { ok: true, val: 3 }
 * @example evaluate('nope.nada', {})    // => { ok: true, val: undefined }
 */
export function evaluate(formula: string, input: unknown): FormulaOutcome {
  const compiled = compile(formula)
  if ('message' in compiled) { return { ok: false, failkind: 'syntax', message: compiled.message } }
  boxed(compiled.expression)
  try {
    return { ok: true, val: compiled.expression.evaluate(input) }
  } catch (err) {
    return failureFrom(err)
  }
}

/** The compiled formula, or the sentence for why it will not compile; remembered either way */
function compile(formula: string): Compilation {
  const known = Compiled.get(formula)
  if (known !== undefined) { return known }
  if (Compiled.size >= CompiledMax) { Compiled.clear() }
  try {
    const compiled = { expression: jsonata(formula) }
    Compiled.set(formula, compiled)
    return compiled
  } catch (err) {
    const failed = { message: describe(err) }
    Compiled.set(formula, failed)
    return failed
  }
}

/** Raised from inside the evaluator to stop a runaway formula */
class TimeboxStop extends Error {}

/** `expression` set to be stopped if it runs too long or nests too deep, starting the clock now */
function boxed(expression: jsonata.Expression): void {
  const startedAt = Date.now()
  let depth = 0
  const stopIfRunaway = () => {
    if (depth > DepthMax) { throw new TimeboxStop('The formula nests too deeply -- check for a recursion that never ends') }
    if (Date.now() - startedAt > TimeboxMs) { throw new TimeboxStop('The formula took too long to finish') }
  }
  expression.assign('__evaluate_entry', () => { depth += 1; stopIfRunaway() })
  expression.assign('__evaluate_exit', () => { depth -= 1; stopIfRunaway() })
}

/** An error from the evaluator, as an outcome */
function failureFrom(err: unknown): FormulaOutcome {
  if (err instanceof TimeboxStop) { return { ok: false, failkind: 'timeout', message: err.message } }
  return { ok: false, failkind: 'runtime', message: describe(err) }
}

/** One sentence for whatever the evaluator threw */
function describe(err: unknown): string {
  const failure = (typeof err === 'object' && err !== null ? err : {}) as JsonataFailure
  if (typeof failure.message !== 'string') { return 'The formula could not be read' }
  return failure.position === undefined ? failure.message : `${failure.message} (at ${String(failure.position)})`
}
