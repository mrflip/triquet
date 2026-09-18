import * as Rank from './rank'
import type { QuestionT } from '../models/question'

/** About how much of a chained-to hint the BUT NOT column previews */
export const SnippetMax = 50

/**
 * The opening of `text`, cut at a word boundary, with an ellipsis when there is more.
 *
 * @param text - The hint being previewed.
 * @returns At most about `SnippetMax` characters, never cut mid-word.
 *
 * @example chainSnippet('BUT NOT the titular role in an internationally successful 1994 film')
 *   // => 'BUT NOT the titular role in an internationally…'
 * @example chainSnippet('Short enough')  // => 'Short enough'
 */
export function chainSnippet(text: string): string {
  const tidy = text.trim()
  if (tidy.length <= SnippetMax) { return tidy }
  const cut = tidy.slice(0, SnippetMax)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * `questions` with every chain that points nowhere, or at itself, cleared.
 *
 * Run whenever the quiz's membership changes underneath a chain. A dangling chain is cleared
 * rather than kept, because a pointer to a question that is not there is not information.
 *
 * @param questions - The quiz's questions.
 * @returns A new array; questions with sound chains are returned unchanged.
 */
export function clearDanglingChains(questions: readonly QuestionT[]): QuestionT[] {
  const present = new Set(questions.map((question) => question.id))
  return questions.map((question) => {
    if (question.chains_to === null) { return question }
    const sound = question.chains_to !== question.id && present.has(question.chains_to)
    return sound ? question : { ...question, chains_to: null }
  })
}

/**
 * `questions` walked along the chains they form, rather than sorted by any column.
 *
 * Ascending starts at the lowest-Q# question and follows its chain onward, which reads the
 * quiz in the order a player receives it. Descending starts at the highest and steps to
 * whatever chains *into* the current question, which reads the same quiz backward. Where
 * several questions merge into one, the lowest Q# among them goes next. When a path runs out,
 * the walk restarts at the next unplaced question, so every question is placed exactly once
 * however tangled or unchained the quiz is.
 *
 * @param questions - The quiz's questions, in their committed display order.
 * @param descending - Whether to walk the chains backward.
 * @returns A new array holding every question exactly once.
 */
export function chainOrder(questions: readonly QuestionT[], descending: boolean): QuestionT[] {
  const questionForId = new Map(questions.map((question) => [question.id, question]))
  // Rank order is what "lowest Q# first" means. Walking backward reverses the numbered
  // questions but leaves the unnumbered ones at the end, where they belong in either direction:
  // an absent Q# is not a high one.
  const ranked = Rank.inRankOrder(questions)
  const numbered = ranked.filter((question) => Rank.qnumOf(question) !== null)
  const unnumbered = ranked.filter((question) => Rank.qnumOf(question) === null)
  const roots = descending ? [...numbered.toReversed(), ...unnumbered] : ranked
  const chainedInto = chainedIntoLookup(ranked)

  const placed = new Set<string>()
  const order: QuestionT[] = []

  const stepFrom = (question: QuestionT): QuestionT | null => {
    if (descending) {
      return (chainedInto.get(question.id) ?? []).find((into) => ! placed.has(into.id)) ?? null
    }
    return question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
  }

  for (const root of roots) {
    let curr: QuestionT | null = root
    while (curr !== null && ! placed.has(curr.id)) {
      placed.add(curr.id)
      order.push(curr)
      curr = stepFrom(curr)
    }
  }
  return order
}

/**
 * Which questions chain into each question, lowest Q# first.
 *
 * @param ranked - The quiz's questions, already in rank order.
 * @returns For each question's id, the questions pointing at it.
 */
function chainedIntoLookup(ranked: readonly QuestionT[]): Map<string, QuestionT[]> {
  const lookup = new Map<string, QuestionT[]>()
  for (const question of ranked) {
    if (question.chains_to === null) { continue }
    const already = lookup.get(question.chains_to)
    if (already) { already.push(question) } else { lookup.set(question.chains_to, [question]) }
  }
  return lookup
}
