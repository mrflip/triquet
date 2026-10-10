import jsonata from 'jsonata'
import * as PA from './vv/patterns'
import { clockNow } from './clock'

/** Most characters a formula may have */
export const FormulaMax = PA.Formulaish.max

/** How long one evaluation may run before it is stopped, in milliseconds, on a clock that moves inside a Convex mutation (`clockNow`) */
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
 * @example check('$sum(question.numnum_clueing.value.items.value)')  // => null
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
 * `TimeboxMs` (or at `deadline`, when that is sooner; or `DepthMax` levels deep) and reported as a
 * timeout, so a bad formula spoils a cell rather than freezing the page. The time is read on a
 * clock that moves inside a Convex mutation, so a formula the server works (a sort) is stopped
 * there too.
 *
 * @param formula - JSONata source.
 * @param input - The JSON document the formula reads: an object's top-level keys are what the formula names directly.
 * @param deadline - A `clockNow()` reading by which it must be worked out, as its column's or its run's budget says; none but `TimeboxMs` when absent.
 * @returns The value it came to (undefined when it found nothing), or why it failed.
 *
 * @example evaluate('a + 1', { a: 2 })  // => { ok: true, val: 3 }
 * @example evaluate('nope.nada', {})    // => { ok: true, val: undefined }
 * @example evaluate('a + 1', { a: 2 }, clockNow() - 1)  // => { ok: false, failkind: 'timeout', message: 'The formula took too long to finish' }
 */
export function evaluate(formula: string, input: unknown, deadline = Infinity): FormulaOutcome {
  const compiled = compile(formula)
  if ('message' in compiled) { return { ok: false, failkind: 'syntax', message: compiled.message } }
  // A deadline already past stops the formula before it is begun.
  if (clockNow() >= deadline) { return { ok: false, failkind: 'timeout', message: OverTime } }
  boxed(compiled.expression, deadline)
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

/** Said of a formula stopped for taking longer than it may */
const OverTime = 'The formula took too long to finish'

/**
 * `expression` set to be stopped if it nests too deep, or runs past `TimeboxMs` from now or past
 * `deadline`, whichever is sooner, on a clock that moves inside a Convex mutation
 */
function boxed(expression: jsonata.Expression, deadline: number): void {
  const stopAt = Math.min(deadline, clockNow() + TimeboxMs)
  let depth = 0
  const stopIfRunaway = () => {
    if (depth > DepthMax) { throw new TimeboxStop('The formula nests too deeply -- check for a recursion that never ends') }
    if (clockNow() > stopAt) { throw new TimeboxStop(OverTime) }
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

/**
 * What a formula came to, as plain JSON: JSONata's objects have no prototype, its lists carry
 * markers of their own, and a function -- plain, or JSONata's marked lambda -- is no value at all,
 * so it is left out wherever it sits (and is `undefined` at the top).
 *
 * @param val - What `evaluate` handed back.
 * @returns The same value, as JSON would carry it.
 *
 * @example plainJson({ name: 'x', shout: evaluated('function($x) { $x }') })  // => { name: 'x' }
 */
export function plainJson(val: unknown): unknown {
  if (isFunction(val)) { return undefined }
  const text = JSON.stringify(val, (_key, held: unknown) => (isFunction(held) ? undefined : held)) as string | undefined
  return text === undefined ? undefined : JSON.parse(text) as unknown
}

/**
 * Whether a formula came to a function: JSONata hands one back as a marked object, or as a plain function.
 *
 * @example isFunction(evaluated('function($x) { $x }'))  // => true
 */
export function isFunction(val: unknown): boolean {
  if (typeof val === 'function') { return true }
  return typeof val === 'object' && val !== null && ('_jsonata_function' in val || '_jsonata_lambda' in val)
}
