/**
 * The addresses this app answers to.
 *
 * One place writes the shape of a URL, so a route that moves moves once. What a hunt holds is
 * addressed as `Addresses` names it (`notes/decisions/urls.md`): the path names a resource by
 * label, in its org and hunt, and a last `!mode` segment how it is opened, so a link one person
 * pastes to another opens the same screen for whoever opens it. The app's own pages (the front
 * door, the hunts, About) sit at the root beside the orgs.
 *
 * Addresses from before (`/h/<hunt>/<realm>/<quiz>?act=smith`, `/h/<hunt>`, `/c/<hunt>/categories`)
 * still open, and move to their present form once the hunt they name says its org.
 */
import * as Addresses from './addresses'

/** How a resource is opened: `edit` (a smith works on it) or `playtest` (it is reviewed) */
export type Mode = Addresses.Mode

/** Which hunt an address names: by its org and its label */
export type HuntLabels = Addresses.InHuntT

/**
 * Which quiz an address names within its org: its hunt's label, its realm's and its own. A hunt's
 * label is unique within its org, so an address names the org too (`HuntLabels & QuizLabels`); an
 * old one, which names none, finds the earliest hunt answering to the label.
 */
export type QuizLabels = Omit<Addresses.InQuizT, 'org'>

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

/** The hunts the visitor is on, whosever they are */
export function huntsPath(): string {
  return '/my/hunts'
}

/** What Triquet is, with its brand assets to download */
export function aboutPath(): string {
  return '/about'
}

/**
 * Where an org's hunts are listed: those of them the visitor is on.
 *
 * @example orgPath('pat_smith')  // => '/~pat_smith'
 */
export function orgPath(org: string): string {
  return Addresses.urlOf({ kind: 'org', org })
}

/**
 * Where a hunt lives: its quizzes, its categories and who is on it.
 *
 * @example huntPath({ org: 'pat_smith', hunt: 'quiet_otter' })  // => '/~pat_smith/quiet_otter'
 */
export function huntPath(labels: HuntLabels): string {
  return Addresses.urlOf({ kind: 'hunt', ...labels })
}

/**
 * Where every quiz of a hunt is listed.
 *
 * @example quizzesPath({ org: 'pat_smith', hunt: 'quiet_otter' })  // => '/~pat_smith/quiet_otter/quizzes'
 */
export function quizzesPath(labels: HuntLabels): string {
  return Addresses.urlOf({ kind: 'quizzes', ...labels })
}

/**
 * Where a hunt arranges its subject categories round its wheel.
 *
 * @example categoriesPath({ org: 'pat_smith', hunt: 'quiet_otter' })  // => '/~pat_smith/quiet_otter/categories'
 */
export function categoriesPath(labels: HuntLabels): string {
  return Addresses.urlOf({ kind: 'categories', ...labels })
}

/**
 * Where a quiz lives, opened in `mode`. Without one it names the quiz alone, which opens in the
 * mode the visitor's role works in (`Hunting.modeFor`).
 *
 * @example quizPath({ org: 'pat_smith', hunt: 'quiet_otter', realm: 'home', quiz: 'loud_heron' }, 'edit')  // => '/~pat_smith/quiet_otter/quizzes/home/loud_heron/!edit'
 */
export function quizPath(labels: HuntLabels & QuizLabels, mode?: Mode): string {
  return Addresses.urlOf({ kind: 'quiz', ...labels }, mode)
}

/** The mode each presentation an old address asked for (`?act=`) is now */
const ModeForAct = { smith: 'edit', review: 'playtest' } as const satisfies Record<string, Mode>

/**
 * The mode an old address's `?act=` asked for; null when it asked for none it knew.
 *
 * @example modeFromAct('review')  // => 'playtest'
 * @example modeFromAct('admin')  // => null
 */
export function modeFromAct(raw: string | null): Mode | null {
  return Object.entries(ModeForAct).find(([act]) => act === raw)?.[1] ?? null
}

/**
 * An address moved to `path`, carrying along what the query and fragment it moves from say of
 * the screen (`notes/decisions/urls.md`: neither changes what is addressed), but for an old
 * address's `act`, which `path` now says as its mode.
 *
 * @param path - Where the address moves to.
 * @param from - The query (`?...`, or empty) and fragment (`#...`, or empty) of the address it moves from.
 *
 * @example movedPath('/~pat_smith/quiet_otter/quizzes/home/loud_heron/!edit', { search: '?act=smith', hash: '#q3' })  // => '/~pat_smith/quiet_otter/quizzes/home/loud_heron/!edit#q3'
 */
export function movedPath(path: string, from: { search: string, hash: string }): string {
  const params = new URLSearchParams(from.search)
  params.delete('act')
  const query = params.size === 0 ? '' : `?${params.toString()}`
  return `${path}${query}${from.hash}`
}

/**
 * Where to send the visitor once they have said who they are: `then`, when it is a path on this
 * site, and nowhere otherwise. A link that could send a visitor off-site after logging in is a
 * trap, so anything with a scheme or a host is refused.
 *
 * @example thenFrom('/~pat_smith/quiet_otter/quizzes/home/loud_heron/!playtest')  // => '/~pat_smith/quiet_otter/quizzes/home/loud_heron/!playtest'
 * @example thenFrom('https://elsewhere.example/')  // => null
 * @example thenFrom('//elsewhere.example/')  // => null
 */
export function thenFrom(raw: string | null): string | null {
  if (raw === null || ! raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) { return null }
  return raw
}
