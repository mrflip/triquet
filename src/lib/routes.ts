/**
 * The addresses this app answers to.
 *
 * One place writes the shape of a URL, so a route that moves moves once. What a hunt holds is
 * addressed as `Addresses` names it (`notes/decisions/urls.md`): the path names a resource by
 * label, in its org and hunt, and a last `!mode` segment how it is opened, so a link one person
 * pastes to another opens the same screen for whoever opens it. The app's own pages (the front
 * door, the hunts, About, Privacy and Terms) sit at the root beside the orgs.
 *
 * Addresses from before (`/h/<hunt>/<realm>/<quiz>?act=smith`, `/h/<hunt>`, `/c/<hunt>/categories`)
 * still open, and move to their present form once the hunt they name says its org.
 */
import * as Addresses from './addresses'
import * as CK from './vv/checks/strings'

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

/** The hunts the visitor is on, whosever they are */
export function huntsPath(): string {
  return '/my/hunts'
}

/** What Triquet is, with its brand assets to download */
export function aboutPath(): string {
  return '/about'
}

/** What Triquet keeps about the people who use it, who sees it, and how to have it deleted */
export function privacyPath(): string {
  return '/privacy'
}

/** The terms Triquet is offered on */
export function termsPath(): string {
  return '/terms'
}

/** Stands in a page's shape (`SyncedShapes`) for any one label in that place */
const AnyLabel = Symbol('any label')

/**
 * The app's own pages that open the database (`src/app/(synced)/`), but the front door and an
 * org's: each the segments of its path, a word for itself and `AnyLabel` for a hunt's, realm's or
 * quiz's label, as an old address names them. Exactly these: a path one segment short or long of
 * one is no page, and is not found.
 */
const SyncedShapes: readonly (readonly (string | typeof AnyLabel)[])[] = [
  ['my', 'hunts'],
  ['stats'],
  ['h', AnyLabel],                        // an old address of a hunt
  ['h', AnyLabel, AnyLabel, AnyLabel],    // of a quiz
  ['c', AnyLabel, 'categories'],          // of a hunt's categories
]

/** What an org's address (`/~<org>/…`) names that a page shows (`src/app/(synced)/[org]/`): each page reads its address with `Addresses.locationFrom`, and finds any other kind not found */
const OrgPageKinds: ReadonlySet<Addresses.AddressKind> = new Set(['org', 'hunt', 'quizzes', 'categories', 'quiz'])

/** Which of those a page shows in a mode, from a last `!edit` or `!playtest`: a quiz alone */
const ModedKinds: ReadonlySet<Addresses.AddressKind> = new Set(['quiz'])

/**
 * Whether `path` names a page of this app that opens the database (`src/app/(synced)/`), and so
 * spends a sign-in's code the moment a browser is sent back to it: the front door; an org's
 * address (`/~…`, written as the app writes it, nothing escaped) naming what one of its pages shows, read by `Addresses.locationFrom` as those pages read
 * it; or one of the app's other synced pages, shape for shape. A path that reaches no page
 * (`/h/quiet_otter/home`, `/~pat_smith/quiet_otter/nothing`) is not, since a page not found opens
 * no database; nor is a page that never opens one (`/privacy`), an address of another site, one
 * beginning `//` or ending `/`, or anything not a path.
 *
 * @param path - Where a sign-in is to come back to.
 *
 * @example isSyncedPath('/~pat_smith/quiet_otter?x=1')  // => true
 * @example isSyncedPath('/')                            // => true
 * @example isSyncedPath('/h/quiet_otter')               // => true
 * @example isSyncedPath('/h/quiet_otter/home')          // => false
 * @example isSyncedPath('/privacy')                     // => false
 * @example isSyncedPath('https://example.com/my/hunts') // => false
 * @example isSyncedPath('//example.com/my/hunts')       // => false
 */
export function isSyncedPath(path: string): boolean {
  if (! path.startsWith('/') || path.startsWith('//') || path.includes('\\')) { return false }
  const { origin, pathname } = new URL(path, PathBase)
  if (origin !== PathBase) { return false }
  if (pathname === '/') { return true }
  if (pathname.endsWith('/')) { return false }
  const segs = pathname.slice(1).split('/')
  return segs[0]?.startsWith('~') ? isOrgPage(pathname) : SyncedShapes.some((shape) => fitsShape(segs, shape))
}

/**
 * Whether an org's address names what one of its pages shows, in a mode only where that page takes
 * one, written as the app writes it (`Addresses.urlOf`): the router matches a page's own words
 * (`quizzes`, `categories`) unescaped, so `quizze%73`, which the reader would take for them, is
 * not found.
 */
function isOrgPage(pathname: string): boolean {
  const location = Addresses.locationFrom(pathname)
  if (location === null || location.raw) { return false }
  const { address, mode } = location
  return OrgPageKinds.has(address.kind) && (mode === null || ModedKinds.has(address.kind)) && Addresses.urlOf(address, mode ?? undefined) === pathname
}

/** Whether a path's segments are a page's shape: as many, each the word the shape names, or a label where it takes any */
function fitsShape(segs: readonly string[], shape: readonly (string | typeof AnyLabel)[]): boolean {
  return segs.length === shape.length && shape.every((want, idx) => (want === AnyLabel ? CK.label.safeParse(segs[idx]).success : want === segs[idx]))
}

/** An origin no path of ours could name, to read a path against */
const PathBase = 'https://app.invalid'

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
 * mode the visitor's role works in (`Huntship.modeFor`).
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
