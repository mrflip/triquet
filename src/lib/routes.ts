/**
 * The addresses this app answers to.
 *
 * One place writes the shape of a URL, so a route that moves moves once. What a hunt holds is
 * addressed as `Addresses` names it (`notes/decisions/urls.md`): the path names a resource by
 * label, in its org and hunt, and a last `!mode` segment how it is opened, so a link one person
 * pastes to another opens the same screen for whoever opens it. The app's own pages (the front
 * door, signing in, the hunts and the profile, About, Privacy and Terms) sit at the root beside
 * the orgs.
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

/** Who the visitor is: for now the same page as their hunts (`huntsPath`), linked to as their profile */
export function profilePath(): string {
  return '/my/profile'
}

/**
 * Verifying an account: offered to a standalone account, beside what that account cannot do,
 * and sending the visitor on to `then` once they have.
 *
 * @example signInPath()             // => '/signin'
 * @example signInPath('/my/hunts')  // => '/signin?then=%2Fmy%2Fhunts'
 */
export function signInPath(then?: string): string {
  return then === undefined ? '/signin' : `/signin?${new URLSearchParams([['then', then]]).toString()}`
}

/** What Triquet is, with its brand assets to download */
export function aboutPath(): string {
  return '/about'
}

/**
 * How Triquet is used, a section by its anchor: the whole page, or `account-benefits`, what a verified
 * account has that a standalone one does not.
 *
 * @example helpPath()                    // => '/help'
 * @example helpPath('account-benefits')  // => '/help#account-benefits'
 */
export function helpPath(section?: HelpSectionT): string {
  return section === undefined ? '/help' : `/help#${section}`
}

/** The help page's sections a link may go straight to, by their anchors */
export type HelpSectionT = 'account-benefits'

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
  ['my', 'profile'],
  ['signin'],
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
  const url = onSite(path)
  if (url === null) { return false }
  const { pathname } = url
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
 * `raw` read as a browser would read it, when it is a path on this site: it begins with one `/`,
 * holds no backslash (which a browser reads as a slash), and, read against an origin of our own,
 * stays on it, its path as read beginning with one `/` too. A browser drops tabs and newlines from
 * an address before it reads it, so `/<tab>/elsewhere.example` is `//elsewhere.example`, another
 * site: reading it as the browser will, rather than by its first characters, is what refuses it.
 * And it resolves dot segments, so `/.//elsewhere.example` reads as the path
 * `//elsewhere.example`, which, written out again, names another site. Null for anything else,
 * an address no browser could read among it (`/<tab>/[`, a host that is no host): what `thenFrom`
 * and `isSyncedPath` both read a path by.
 */
function onSite(raw: string): URL | null {
  if (! raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) { return null }
  let url: URL
  try {
    url = new URL(raw, PathBase)
  } catch {
    return null
  }
  return url.origin === PathBase && ! url.pathname.startsWith('//') ? url : null
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
 * trap, so anything with a scheme or a host is refused, judged as the browser will read it
 * (`onSite`): `/<tab>/elsewhere.example` is another site once the browser drops the tab. The path
 * is answered as read, so what is followed is what was judged.
 *
 * @example thenFrom('/~pat_smith/quiet_otter/quizzes/home/loud_heron/!playtest')  // => '/~pat_smith/quiet_otter/quizzes/home/loud_heron/!playtest'
 * @example thenFrom('https://elsewhere.example/')  // => null
 * @example thenFrom('//elsewhere.example/')  // => null
 * @example thenFrom('/\t/elsewhere.example/')  // => null
 */
export function thenFrom(raw: string | null): string | null {
  const url = raw === null ? null : onSite(raw)
  return url && `${url.pathname}${url.search}${url.hash}`
}

/** The first segment of an old address (`/h/…`, `/c/…`), which names a hunt, as an org's address (`/~…`) does */
const OldHuntSegs: ReadonlySet<string> = new Set(['h', 'c'])

/**
 * Whether `path` is worth coming back to after signing up, over the new user's own sandbox: a page
 * of this app's that opens the database (`isSyncedPath`) and has work on it, which is an org's
 * address (an org's hunts, a hunt, its quizzes or categories, a quiz) or an old address of a hunt
 * or quiz. The app's own pages are not, with nothing on them yet for someone who has just said who
 * they are: the front door, their hunts and profile (the Coach, 2026-10-13), the sign-in page and
 * the stats page; nor is anything `isSyncedPath` refuses.
 *
 * @example isCompelling('/~pat_smith/quiet_otter')  // => true
 * @example isCompelling('/h/quiet_otter')           // => true
 * @example isCompelling('/my/hunts')                // => false
 * @example isCompelling('/')                        // => false
 * @example isCompelling('/privacy')                 // => false
 */
export function isCompelling(path: string): boolean {
  if (! isSyncedPath(path)) { return false }
  const [first = ''] = new URL(path, PathBase).pathname.slice(1).split('/', 1)
  return first.startsWith('~') || OldHuntSegs.has(first)
}

/**
 * Where a visitor who has just taken the handle `userlabel` lands: `then`, the page a link sent
 * them to the front door from, when it is on this site (`thenFrom`) and compelling
 * (`isCompelling`); their sandbox otherwise (`~userlabel/userlabel`), made as they took the handle.
 *
 * @param then - The front door's `?then=`, as it stands in the address; null for none.
 * @param userlabel - The handle just taken.
 *
 * @example signedUpPath(null, 'flip_kromer')                       // => '/~flip_kromer/flip_kromer'
 * @example signedUpPath('/my/hunts', 'flip_kromer')                // => '/~flip_kromer/flip_kromer'
 * @example signedUpPath('/~pat_smith/quiet_otter', 'flip_kromer')  // => '/~pat_smith/quiet_otter'
 */
export function signedUpPath(then: string | null, userlabel: string): string {
  const onward = thenFrom(then)
  return onward !== null && isCompelling(onward) ? onward : huntPath({ org: userlabel, hunt: userlabel })
}
