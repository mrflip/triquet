/** Characters per token, roughly, across the scripts a real quiz actually carries */
export const CharsPerToken = 4

/**
 * Rough size of one ask plus its answer, estimated from character count.
 *
 * The page cannot observe real usage, so this is an estimate and is always presented as one:
 * "~N tok", never a billing figure. It exists so the author can see that a habit of refreshing
 * a column of twenty questions is not free.
 *
 * @param texts - Everything that went over the wire in both directions.
 * @returns A whole number of tokens, never negative.
 *
 * @example approxTokensFor('a'.repeat(400), 'b'.repeat(400))  // => 200
 */
export function approxTokensFor(...texts: (string | null | undefined)[]): number {
  const chars = texts.reduce((acc: number, text) => acc + (text?.length ?? 0), 0)
  return Math.ceil(chars / CharsPerToken)
}
