/**
 * The addresses this app answers to.
 *
 * One place writes the shape of a URL, so a route that moves moves once. The path names a
 * resource; the query names how to present it (`act`), so a link one person pastes to another
 * opens the right view for whoever opens it.
 */

/** How a quiz can be presented: worked on by a smith, or reviewed */
export const ActVals = ['smith', 'review'] as const
export type Act = typeof ActVals[number]

/** Which quiz an address names: by hunt, realm and quiz label */
export type QuizLabels = {
  hunt:  string
  realm: string
  quiz:  string
}

/**
 * The login screen, sending the visitor on to `then` once they have said who they are.
 *
 * @example rootPath('/my/hunts')  // => '/?then=%2Fmy%2Fhunts'
 */
export function rootPath(then?: string): string {
  return then === undefined ? '/' : `/?${new URLSearchParams([['then', then]]).toString()}`
}

/** The login screen, kept open for a visitor who has said who they are to become someone else */
export function switchIdentPath(): string {
  return '/?switch'
}

/** The hunts the visitor can open */
export function huntsPath(): string {
  return '/my/hunts'
}

/** What Triquet is, with its brand assets to download */
export function aboutPath(): string {
  return '/about'
}

/**
 * Where the quiz `labels` names lives, presented as `act`; without one, the page picks.
 *
 * @example quizPath({ hunt: 'quiet_otter', realm: 'home', quiz: 'quiet_otter' }, 'smith')  // => '/h/quiet_otter/home/quiet_otter?act=smith'
 */
export function quizPath(labels: QuizLabels, act?: Act): string {
  const path = `/h/${labels.hunt}/${labels.realm}/${labels.quiz}`
  return act === undefined ? path : `${path}?act=${act}`
}

/**
 * Where the hunt labelled `hunt` arranges its subject categories round its wheel.
 *
 * @example categoriesPath('quiet_otter')  // => '/c/quiet_otter/categories'
 */
export function categoriesPath(hunt: string): string {
  return `/c/${hunt}/categories`
}

/**
 * `act` read from an address, or null when it names no presentation.
 *
 * @example actFrom('review')  // => 'review'
 * @example actFrom('admin')  // => null
 */
export function actFrom(raw: string | null): Act | null {
  return ActVals.find((act) => act === raw) ?? null
}

/**
 * Where to send the visitor once they have said who they are: `then`, when it is a path on this
 * site, and nowhere otherwise. A link that could send a visitor off-site after logging in is a
 * trap, so anything with a scheme or a host is refused.
 *
 * @example thenFrom('/h/quiet_otter/home/quiet_otter?act=review')  // => '/h/quiet_otter/home/quiet_otter?act=review'
 * @example thenFrom('https://elsewhere.example/')  // => null
 * @example thenFrom('//elsewhere.example/')  // => null
 */
export function thenFrom(raw: string | null): string | null {
  if (raw === null || ! raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) { return null }
  return raw
}
