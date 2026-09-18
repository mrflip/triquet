import { monotonicFactory } from 'ulid'

const nextUlid = monotonicFactory()

/**
 * Fresh identifier for a quiz or a question: a lowercase ULID.
 *
 * Lexically sortable by mint time, including within a single millisecond, so a burst of
 * records -- the five blank questions a new round opens with -- keeps its creation order.
 *
 * @returns 26 lowercase Crockford-base32 characters.
 *
 * @example mintId()  // => '01k5f9n3ktq7wzc8x2r4m0vaeh'
 */
export function mintId(): string {
  return nextUlid().toLowerCase()
}
