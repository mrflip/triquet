/**
 * Fresh identifier for a quiz or a question the tool holds but has not written yet.
 *
 * A random UUID, the same shape as the row ids Jazz mints, so an unwritten thing and a written
 * one are named alike. Writing it gives it a row id of Jazz's own; this one only has to be
 * unique until then.
 *
 * @returns A lowercase UUID.
 *
 * @example mintId()  // => '3f0c9b1e-5d7a-4c2e-9f3b-8a1d6e2c4b70', say
 */
export function mintId(): string {
  return crypto.randomUUID()
}
