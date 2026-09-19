import type * as Z from 'zod'
import { inspectify } from '../../src/lib/inspectify'
import { explain } from '../../src/lib/vv/reporting'

/**
 * Assert that `schema` takes `val`, and hand back what it made of it.
 *
 * @param schema - The check under test.
 * @param val - What to feed it.
 * @returns The parsed value, for a caller that wants to assert on the coercion.
 */
export function accepts<SC extends Z.ZodType>(schema: SC, val: unknown): Z.output<SC> {
  const res = schema.safeParse(val)
  if (! res.success) { throw new Error(`should have accepted ${inspectify(val)}, but: ${explain(res.error)}`) }
  return res.data
}

/**
 * Assert that `schema` turns `val` away, and hand back the explanation.
 *
 * The advice is returned rather than asserted, so a caller can check the wording where the
 * wording is the point and ignore it where only the refusal matters.
 *
 * @param schema - The check under test.
 * @param val - What to feed it.
 * @returns The explanation, offending value included.
 */
export function rejects(schema: Z.ZodType, val: unknown): string {
  const res = schema.safeParse(val)
  if (res.success) { throw new Error(`should have refused ${inspectify(val)}, but it passed`) }
  return explain(res.error)
}
