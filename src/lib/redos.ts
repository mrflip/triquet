import { check, checkSync, type Diagnostics } from 'recheck/lib/browser.js'
import * as Regexes from './regexes'
import type { RegexT } from './regexes'

/**
 * Whether an author's regular expression could take too long to match some text (ReDoS), asked of
 * recheck where a pattern is written: by the server, whose verdict counts, as a mutation writes
 * one; and by the browser beside the field, as a courtesy. The one importer of recheck, and of its
 * pure build: a Scala.js program, the same in the browser, under vitest and in Convex's runtime,
 * which has no worker threads and no native binaries. It is 3 MB, so the browser reaches this
 * module only by `import()`.
 */

/**
 * The longest recheck may take over one pattern, in milliseconds. A pattern it cannot settle in
 * that time is refused, as one it finds could take too long to match: well within a mutation's
 * second, with room for a few patterns and the writing.
 */
export const CheckMs = 200

/** The longest the checks of one change may take together, in milliseconds: what a library import of several new patterns shares */
export const BudgetMs = 500

/**
 * Why `regex` will not do, as recheck's verdict on it says it, or null when recheck finds it
 * safe: it takes time in step with the text's length, or less, on any text. A verdict of
 * `vulnerable` or `unknown` (recheck ran out of time, or met something it cannot read) is refused
 * alike, so that a pattern stored can be trusted.
 *
 * @param regex - The pattern, already compiled once (`Regexes.compileIssueOf`).
 * @param timeoutMs - The longest recheck may take over it, in whole milliseconds.
 * @returns The refusal, a phrase said of the pattern; null for a safe one.
 *
 * @example refusalOf({ source: '^[a-z]+$', flags: '' })  // => null
 * @example refusalOf({ source: '^(a+)+$', flags: '' })   // => 'could take far too long to match some texts (twice as long for each character more), around «(a+)+»: ...'
 */
export function refusalOf(regex: RegexT, timeoutMs = CheckMs): string | null {
  return refusalFor(checkSync(regex.source, regex.flags, { timeout: timeoutMs }))
}

/**
 * The first of `regexes` that will not do, said as the author is told it, or null when each is
 * safe; all of them checked within `budgetMs` together, a pattern named twice checked once. Once
 * the budget is spent, a pattern still to check is refused, as one recheck ran out of time on.
 * What a mutation writing patterns asks: it is synchronous, as Convex's runtime needs.
 *
 * @param regexes - The patterns being written.
 * @param budgetMs - The longest the checks may take together.
 * @param checkMs - The longest one check may take.
 * @returns The sentence for the first refused, naming it; null when none is.
 *
 * @example firstRefusalOf([{ source: '^[a-z]+$', flags: '' }])  // => null
 * @example firstRefusalOf([{ source: '(x+x+)+y', flags: '' }])  // => 'The pattern «/(x+x+)+y/» could take far too long ...'
 */
export function firstRefusalOf(regexes: readonly RegexT[], budgetMs = BudgetMs, checkMs = CheckMs): string | null {
  // Convex's runtime holds `Date.now()` still through a function; `performance.now()` moves on.
  const beg = performance.now()
  const each = new Map(regexes.map((regex) => [Regexes.shown(regex), regex]))
  for (const [shownAs, regex] of each) {
    // recheck takes its timeout in whole milliseconds only.
    const leftMs = Math.floor(Math.min(checkMs, budgetMs - (performance.now() - beg)))
    const refusal = leftMs <= 0 ? OutOfBudget : refusalOf(regex, leftMs)
    if (refusal !== null) { return `The pattern «${shownAs}» ${refusal}.` }
  }
  return null
}

/**
 * Why `regex` will not do, or null when recheck finds it safe, worked out on a worker so the page
 * keeps answering: the browser's courtesy, telling the author beside the field before the server
 * refuses it. The server's verdict is the one that counts; on a slower or a busier machine the
 * two may differ over a pattern recheck takes nearly `CheckMs` to settle.
 *
 * @returns The refusal, a phrase said of the pattern; null for a safe one.
 *
 * @example await courtesyRefusalOf({ source: '^(a+)+$', flags: '' })  // => 'could take far too long to match some texts ...'
 */
export async function courtesyRefusalOf(regex: RegexT): Promise<string | null> {
  return refusalFor(await check(regex.source, regex.flags, { timeout: CheckMs }))
}

/** What a pattern left unchecked when the budget ran out is told */
const OutOfBudget = 'could not be checked in the time left: send fewer new patterns at once'

/** How a pattern could take too long, by how its time grows with the text's length */
const GrowthWords = {
  exponential: 'twice as long for each character more',
  polynomial:  'as the square of its length, or worse',
} as const

/** recheck's verdict on a pattern, as a phrase said of it; null for a safe one */
function refusalFor(diagnostics: Diagnostics): string | null {
  switch (diagnostics.status) {
  case 'safe': { return null }
  case 'vulnerable': {
    const growth = GrowthWords[diagnostics.complexity.type]
    const around = hotOf(diagnostics)
    const where = around === '' ? '' : `, around «${around}»`
    return `could take far too long to match some texts (${growth})${where}: let no part of it match the same text in more than one way`
  }
  case 'unknown': {
    const { error } = diagnostics
    switch (error.kind) {
    case 'timeout':     { return 'took too long to check for safety: make it simpler' }
    case 'unsupported': { return `uses what the safety check cannot read (${error.message}): say it another way` }
    case 'invalid':     { return `will not compile: ${error.message}` }
    case 'cancel':      { return 'was not checked for safety: try again' }
    case 'unexpected':  { return `could not be checked for safety (${error.message}): say it another way` }
    }
  }
  }
}

/** The stretch of a vulnerable pattern recheck found the trouble in: from its first hot spot to its last, or nothing when it names none */
function hotOf({ source, hotspot }: Extract<Diagnostics, { status: 'vulnerable' }>): string {
  const hot = hotspot.filter((spot) => spot.temperature === 'heat')
  if (hot.length === 0) { return '' }
  return source.slice(Math.min(...hot.map((spot) => spot.start)), Math.max(...hot.map((spot) => spot.end)))
}
