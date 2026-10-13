import type { EnvBag } from './build-stamp'

// How the stats page shows the environment it was built in: every variable by name, and of its
// value only what `ENV_VAR_VIZ` allows. Server-side only: the page masks the environment as it is
// built, and a view takes the result as a prop, so no value it hides ever reaches a browser.

/** How much of a variable's value the stats page shows: all of it, its ends (`snip`), or none */
export type VizKindT = 'show' | 'snip' | 'mask'

/** The environment as the stats page shows it: each variable's name, and what of its value may be seen; null for one not shown */
export type EnvVizT = Record<string, string | null>

/** How much of each variable's value the stats page shows; a variable not listed is masked */
export const ENV_VAR_VIZ: Readonly<Record<string, VizKindT>> = {
  ANTHROPIC_API_KEY:                           'snip',
  AUTH_GOOGLE_ID:                              'snip',
  AUTH_GOOGLE_SECRET:                          'mask',
  CI:                                          'show',
  CONVEX_DEPLOY_KEY:                           'mask',
  CONVEX_SELF_HOSTED_URL:                      'show',
  CONVEX_SITE_URL:                             'show',
  DOPPLER_CONFIG:                              'show',
  DOPPLER_ENVIRONMENT:                         'show',
  DOPPLER_PROJECT:                             'show',
  ENABLE_ANTHROPIC_BOT:                        'show',
  EXPOSE_INTERNAL_STATS_TO_ALL:                'show',
  KILROYWUZHERE:                               'show',
  LOGGING:                                     'show',
  NEXT_DIST_DIR:                               'show',
  NEXT_PUBLIC_CONVEX_URL:                      'show',
  NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS: 'show',
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:           'show',
  NODE_ENV:                                    'show',
  PORT:                                        'show',
  SITE_URL:                                    'show',
  TRIQUET_CLEARABLE:                           'show',
  TRIQUET_ENV:                                 'show',
  TRIQUET_EVERYONE_ADMIN:                      'show',
  TRIQUET_LANE:                                'show',
  VERCEL_ENV:                                  'show',
  VERCEL_GIT_COMMIT_REF:                       'show',
  VERCEL_GIT_COMMIT_SHA:                       'show',
  VERCEL_URL:                                  'show',
}

/** How many characters `snip` keeps at each end of a value at least so long, longest first: never more than half of it */
const SnipEnds: readonly (readonly [minlen: number, head: number, tail: number])[] = [
  [12, 2, 4],
  [8,  0, 4],
  [6,  0, 3],
]

/**
 * A value with all but its ends starred out: the first two and last four characters of one twelve
 * long or longer, the last four of one eight to eleven long, the last three of one six or seven
 * long, and nothing of a shorter one. Never more than half a value is shown, and its length is.
 *
 * @param val - The value to snip.
 * @returns The value, each character not shown replaced by `*`.
 *
 * @example snip('abcdefghijklmn')  // => 'ab********klmn'
 * @example snip('abcdefghij')  // => '******ghij'
 * @example snip('abcdef')  // => '***def'
 * @example snip('abcde')  // => '*****'
 */
export function snip(val: string): string {
  const [, head, tail] = SnipEnds.find(([minlen]) => val.length >= minlen) ?? [0, 0, 0]
  return val.slice(0, head) + '*'.repeat(val.length - head - tail) + val.slice(val.length - tail)
}

/**
 * Every variable set in `env`, in order of name, with as much of its value as `viz` allows: all of
 * it for `show`, its ends for `snip` (`snip`), and null for `mask` or a variable `viz` does not list.
 *
 * @param env - The environment: `process.env`, as the page is built.
 * @param viz - How much of each variable to show (`ENV_VAR_VIZ`).
 *
 * @example visualize({ TRIQUET_ENV: 'dev', AUTH_GOOGLE_SECRET: 'hunter2', HOME: '/root', AUTH_GOOGLE_ID: 'abcdefghij' })
 *   // => { AUTH_GOOGLE_ID: '******ghij', AUTH_GOOGLE_SECRET: null, HOME: null, TRIQUET_ENV: 'dev' }
 */
export function visualize(env: EnvBag, viz: Readonly<Record<string, VizKindT>> = ENV_VAR_VIZ): EnvVizT {
  const set = Object.entries(env).filter((pair): pair is [string, string] => pair[1] !== undefined)
  return Object.fromEntries(set
    .toSorted(([aa], [bb]) => aa.localeCompare(bb))
    .map(([envvar, val]) => [envvar, shownOf(val, viz[envvar] ?? 'mask')]))
}

/** What of `val` may be seen, by `vizkind` */
function shownOf(val: string, vizkind: VizKindT): string | null {
  if (vizkind === 'show') { return val }
  if (vizkind === 'snip') { return snip(val) }
  return null
}
