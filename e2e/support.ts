import { test as base, expect, type Browser, type BrowserContext, type BrowserContextOptions, type Locator, type Page } from '@playwright/test'
import * as Labelmaker from '../src/lib/labelmaker'
import type * as Routes from '../src/lib/routes'
import { namesFor, type QuestionField, type QuestionView } from '../src/models/column'
import * as Z from 'zod'
import { runAsAdmin } from './admin'

/** Where the fixture's page begins by default: its worker's ident's fresh hunt, open on its quiz */
export const FreshHunt = 'fresh hunt'

/**
 * How the fresh hunt's quiz is laid out before the page first opens it: the library's widgets to
 * put to work, each with the column it brings (as `addWidgetings` would), then the question's own
 * fields and views to show (as `addColumns` would), in the order given. A new quiz starts lean.
 */
export type LayoutT = {
  widgetings?: readonly string[]
  columns?:    readonly (QuestionField | QuestionView)[]
}

/**
 * Browser storage holding nothing: no session. A context the suite makes takes the test's options,
 * the kept session among them, unless it is given storage of its own.
 */
const NoStorage = { cookies: [], origins: [] }

/**
 * The session a worker's fresh hunts are made under: the ident it said it was at the front door,
 * and the browser storage that holds it as the worker's last test left it.
 *
 * The storage is handed on from test to test, not copied from the front door each time. A page
 * opening on a session it already holds exchanges its refresh token for a new one, and Convex
 * Auth honours a refresh token once (or again within ten seconds); one used later than that is
 * taken for a stolen one, and every token descended from it is revoked, the session with them. A
 * worker runs one test at a time, so each begins with the token the one before it was handed.
 */
type KeptSessionT = { label: string, storageState: StorageT }

/** Browser storage as a context is handed it, or hands it back: cookies, and each origin's local storage */
type StorageT = Exclude<BrowserContextOptions['storageState'], undefined>

/** What Convex Auth's key for a session's refresh token begins with, in local storage: `__convexAuthRefreshToken_<backend>` */
const RefreshTokenKey = '__convexAuthRefreshToken'

/** How long a context's teardown waits for a page that opened the app to exchange the refresh token it began with */
const TokenExchangeMs = 5000

/**
 * The suite's `test`: Playwright's, with the page already at the workbench.
 *
 * Every spec imports `test` and `expect` from here. `page` has a hunt of its own, made a moment
 * ago, open on its quiz with its grid on screen (`startAt` is `FreshHunt` unless a spec says
 * otherwise), so a spec begins with the thing it is about rather than with a way in. The hunt is
 * made by the backend (`testing:makeHunt`) rather than through the hunts list, laid out as the
 * spec asks (`test.use({ layout })`), for an ident each worker says it is once, at the front door;
 * every page of that worker's begins in that session. Specs share one database, and a worker's
 * tests share one ident, so each finds its rows by its own labels and titles, never by the hunts
 * an ident is on.
 *
 * `startAt` as a path goes there instead, in a session of its own, and waits for the grid. A spec
 * that must stub a route before the first load, or is about the way in itself, says
 * `test.use({ startAt: null })` and goes there itself, in a fresh anonymous session
 * (`startHunt(page)` is the way in through the front door and the hunts list).
 *
 * `friend` is a second visitor kept the same way: a page in a browser of its own, open on nothing
 * yet, signed in as a second ident each worker says it is once (`friendLabel`), on no hunt of the
 * test's until a spec puts it on one (`putOnHunt`, in admin). A spec about a second visitor's way
 * in, or that needs a visitor nobody has seen, walks the front door with `otherVisitor`.
 */
export const test = base.extend<{ startAt: string | null, layout: LayoutT, friend: Page, friendLabel: string }, { keptSession: KeptSessionT, keptFriend: KeptSessionT }>({
  startAt:     [FreshHunt, { option: true }],
  layout:      [{}, { option: true }],
  keptSession: [async ({ browser }, use, workerInfo) => {
    await use(await sessionMadeAtFrontDoor(browser, workerInfo.project.use.baseURL))
  }, { scope: 'worker' }],
  keptFriend: [async ({ browser }, use, workerInfo) => {
    await use(await sessionMadeAtFrontDoor(browser, workerInfo.project.use.baseURL))
  }, { scope: 'worker' }],
  storageState: async ({ startAt, keptSession, storageState }, use) => {
    await use(startAt === FreshHunt ? keptSession.storageState : storageState)
  },
  page: async ({ page, startAt, layout, keptSession }, use) => {
    await laggedBy(page, Number(process.env.TQ_E2E_LAG_MS ?? 0))
    if (startAt === FreshHunt) {
      await enterFreshHunt(page, keptSession.label, layout)
    } else if (startAt !== null) {
      await page.goto(startAt)
      await expect(grid(page)).toBeVisible()
    }
    await use(page)
    // The session as this test leaves it, its refresh token the one now current, for the next test.
    if (startAt === FreshHunt) { keptSession.storageState = await sessionLeftBy(page.context(), keptSession.storageState) }
  },
  friend: async ({ browser, keptFriend }, use) => {
    const context = await browser.newContext({ storageState: keptFriend.storageState })
    await use(await context.newPage())
    keptFriend.storageState = await sessionLeftBy(context, keptFriend.storageState)
    await context.close()
  },
  friendLabel: async ({ keptFriend }, use) => {
    await use(keptFriend.label)
  },
})
export { expect } from '@playwright/test'

/**
 * Hand `page` what the Convex backend tells it as a loaded machine would, `lagMs` late and each
 * message at least `lagMs` after the one before, in order: a mutation's result and the queries
 * it changes reach the page late, and the moments between two writes' results (a widgeting
 * made, its column not yet) last long enough to be acted in. What the page sends goes at once.
 * Nothing at 0.
 */
async function laggedBy(page: Page, lagMs: number): Promise<void> {
  if (lagMs <= 0) { return }
  await page.routeWebSocket(/\/sync$/, (socket) => {
    const server = socket.connectToServer()
    let lastAt = 0
    socket.onMessage((message) => { server.send(message) })
    server.onMessage((message) => {
      lastAt = Math.max(Date.now(), lastAt) + lagMs
      setTimeout(() => { socket.send(message) }, lastAt - Date.now())
    })
  })
}

/** The browser contexts `otherVisitor` opened for this test, closed once it is done */
const Others: BrowserContext[] = []

// eslint-disable-next-line unicorn/no-top-level-side-effects -- registering the fixture's own cleanup hook, the way `test.extend` above does
test.afterEach(async () => {
  await Promise.all(Others.splice(0).map(async (context) => { await context.close() }))
})

/**
 * Say who a browser of the worker's own is at the front door, once, and keep the session it is
 * left holding: what a worker's kept sessions begin as (`KeptSessionT`).
 */
async function sessionMadeAtFrontDoor(browser: Browser, baseURL: string | undefined): Promise<KeptSessionT> {
  const context = await browser.newContext({ baseURL, storageState: NoStorage })
  const label = await assumeIdent(await context.newPage())
  const storageState = await context.storageState()
  await context.close()
  return { label, storageState }
}

/**
 * The storage `context` leaves its session in, for the next test: once a page of it that opened
 * the app on the refresh token `began` holds has exchanged that token for its own, should it have
 * opened one. Belt and braces: a test that ends a moment after its page first loads would hand on
 * a token the server has already spent, which Convex Auth still answers with the child it issued,
 * so long as that child was never used (`KeptSessionT`). One that never turns over within the
 * wait (a page that opened only a page of no session's) is handed on as it stands.
 */
async function sessionLeftBy(context: BrowserContext, began: StorageT): Promise<StorageT> {
  const before = refreshTokenIn(began)
  if (before !== null) {
    const opened = context.pages().filter((page) => page.url().startsWith('http'))
    await Promise.all(opened.map(async (page) => { await tokenExchanged(page, before) }))
  }
  return await context.storageState()
}

/** Wait a while for `page` to keep a refresh token other than `before`, and go on regardless once the wait is up */
async function tokenExchanged(page: Page, before: string): Promise<void> {
  try {
    await page.waitForFunction(({ spent, prefix }) => Object.keys(localStorage).every((key) => ! key.startsWith(prefix) || localStorage.getItem(key) !== spent), { spent: before, prefix: RefreshTokenKey }, { timeout: TokenExchangeMs })
  } catch {
    // Never exchanged: a page that opened only a page of no session's, which is handed on as it stands.
  }
}

/** The refresh token Convex Auth keeps in `storage`, should it keep one */
function refreshTokenIn(storage: StorageT): string | null {
  if (typeof storage === 'string') { return null }
  const entries = storage.origins.flatMap((origin) => origin.localStorage)
  return entries.find((entry) => entry.name.startsWith(RefreshTokenKey))?.value ?? null
}

/**
 * A page in a browser of its own: another visitor, signed in as nobody until they say who they are
 * (`assumeIdent`), on the same database. For a spec about a visitor's own way in, or that needs one
 * no other test has seen; `friend` is quicker where neither matters.
 */
export async function otherVisitor(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: NoStorage })
  Others.push(context)
  return await context.newPage()
}

/** The grid of questions: the quiz on screen */
export function grid(page: Page): Locator {
  return page.getByRole('table', { name: 'Questions' })
}

/** The row at `rowIdx` of the grid, counting from the top */
export function rowAt(page: Page, rowIdx: number): Locator {
  return grid(page).locator('tbody').getByRole('row').nth(rowIdx)
}

/** The grid's rows folded to one line */
export function foldedRows(page: Page): Locator {
  return grid(page).locator('tbody tr[data-folded]')
}

/** The cell of column `colname` in the row at `rowIdx`; the column's label is its own name */
export function cellOf(page: Page, rowIdx: number, colname: string): Locator {
  return rowAt(page, rowIdx).locator(`td[data-colname="${colname}"]`)
}

/** The rendered face drawn over a text box within `within`, while the box is not being typed into */
export function faceOf(within: Locator): Locator {
  return within.locator('[data-face]')
}

/** The element a text box sits in, which holds whatever is drawn over it: its rendered face, for one */
export function holderOf(field: Locator): Locator {
  return field.locator('..')
}

/**
 * The values of every field `fields` resolves to, top to bottom, at this instant.
 *
 * No locator matcher reads the values of several textboxes (`toHaveValues` is for a multiple
 * select), so this is read inside `expect.poll`, which retries it until the list matches.
 */
export async function valuesOf(fields: Locator): Promise<string[]> {
  return await fields.evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value))
}

/**
 * Fill the grid's first rows, one object per row naming each field by its label, and commit
 * by moving focus off the grid: `fillRows(page, [{ 'Q#': '1', Title: 'apple' }])`.
 */
export async function fillRows(page: Page, rows: Record<string, string>[]): Promise<void> {
  for (const [rowIdx, row] of rows.entries()) {
    for (const [fieldname, val] of Object.entries(row)) {
      await page.getByRole('textbox', { name: fieldname, exact: true }).nth(rowIdx).fill(val)
    }
  }
  await page.getByLabel('Quiz name').click()
}

/** The head's `<link>` elements of one `rel`, such as the icons, which have no role to find them by */
export function headLinks(page: Page, rel: string): Locator {
  return page.locator(`head link[rel="${rel}"]`)
}

/** The gear's dialog, where a quiz's label, version, columns and widgets live */
export function manageDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Manage this quiz' })
}

/** Open the gear's dialog */
export async function openManage(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await expect(manageDialog(page)).toBeVisible()
}

/**
 * Take the danger zone's act `actname` ("Delete this quiz") from the gear's dialog, which must be
 * open, typing `label` to confirm it.
 */
export async function actDangerously(page: Page, actname: string, label: string): Promise<void> {
  await manageDialog(page).getByRole('region', { name: 'Danger Zone' }).getByRole('button', { name: actname }).click()
  const confirming = page.getByRole('dialog', { name: `${actname}?` })
  await confirming.getByRole('textbox').fill(label)
  await confirming.getByRole('button', { name: actname }).click()
}

/**
 * Answer the question a remove button (`ConfirmRemove`) asks once it is pressed: its yes, *Keep it*,
 * or Escape, which keeps the thing as *Keep it* does; and wait until the question is gone.
 */
export async function answerRemoval(page: Page, answer: 'Yes, remove' | 'Yes, delete' | 'Keep it' | 'Escape'): Promise<void> {
  const asking = page.getByRole('alertdialog')
  if (answer === 'Escape') {
    await expect(asking).toBeVisible()
    await page.keyboard.press('Escape')
  } else {
    await asking.getByRole('button', { name: answer }).click()
  }
  await expect(asking).toHaveCount(0)
}

/** Close the gear's dialog, whose every change is kept as it is made */
export async function closeManage(page: Page): Promise<void> {
  await manageDialog(page).getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/**
 * Pick the library's widget labelled `widget_label` from the catalogue `picker` (a combobox,
 * opened by a *+ New ...* button): typed into it, and chosen from what that finds by the label it
 * shows. The widgeting is made as it is picked.
 */
export async function pickWidget(page: Page, picker: Locator, widget_label: string): Promise<void> {
  await picker.fill(widget_label)
  await page.getByRole('option').filter({ has: page.getByText(widget_label, { exact: true }) }).click()
}

/** The Widgets panel below the grid, where the quiz's widgetings are put to work and edited, in run order */
export function widgetsPanel(page: Page): Locator {
  return page.getByRole('region', { name: 'Widgets', exact: true })
}

/**
 * A widgeting's panel in the Widgets panel's run order (rather than its copy beneath a column, or
 * its line in the manage dialog's run order), which must be open (`openPanel`)
 */
export function widgetingPanel(page: Page, label: string): Locator {
  return widgetsPanel(page).getByRole('list', { name: /^(Entries|Widgetings)$/ }).getByRole('group', { name: `Widgeting ${label}`, exact: true })
}

/** A column's panel in the manage dialog's columns editor, by its title: the last, where two share it */
export function columnPanel(page: Page, title: string): Locator {
  return manageDialog(page).getByRole('list', { name: 'Columns' }).getByRole('group', { name: `Column ${title}`, exact: true }).last()
}

/** Unfold a panel by its triangle, named `foldname` ("Column Remarks in full"), unless it is open already */
export async function unfoldBy(scope: Locator, foldname: string): Promise<void> {
  await foldTo(scope, foldname, true)
}

/** Fold a panel by its triangle, named `foldname`, unless it is folded already: a new column's arrives open */
export async function foldBy(scope: Locator, foldname: string): Promise<void> {
  await foldTo(scope, foldname, false)
}

/**
 * Set a panel's triangle, named `foldname`, to `open`; folding, wait until what it folds away is
 * hidden, so nothing it held is still found while it closes.
 */
async function foldTo(scope: Locator, foldname: string, open: boolean): Promise<void> {
  const fold = scope.getByRole('button', { name: foldname, exact: true }).first()
  if (await fold.getAttribute('aria-expanded') !== String(open)) { await fold.click() }
  await expect(fold).toHaveAttribute('aria-expanded', String(open))
  const controls = await fold.getAttribute('aria-controls')
  if (! open && controls !== null) { await expect(scope.page().locator(`[id="${controls}"]`)).toBeHidden() }
}

/**
 * Relabel the widgeting labelled `from` to `onto` through its panel in the Widgets panel's run
 * order, opening the Widgets panel first if it is folded.
 */
export async function relabelWidgeting(page: Page, from: string, onto: string): Promise<void> {
  await openPanel(page, 'Widgets')
  const panel = widgetingPanel(page, from)
  await unfoldBy(panel, `Widgeting ${from} in full`)
  await panel.getByRole('textbox', { name: 'Widgeting label' }).fill(onto)
  await panel.getByRole('button', { name: `Relabel widgeting ${from}` }).click()
  await expect(widgetingPanel(page, onto)).toBeVisible()
}

/**
 * Put the library's widget `widget_label` to work in the open quiz, under `label` (blank takes the
 * widget's), with the column it brings, through the Widgets panel, folded again afterwards.
 */
export async function addWidgeting(page: Page, widget_label: string, label = ''): Promise<void> {
  await openPanel(page, 'Widgets')
  await widgetingAdded(page, widget_label, label)
  await closePanel(page, 'Widgets')
}

/**
 * Put each of the library's widgets `widget_labels` to work in the open quiz, in the order given,
 * each under its own label with the column it brings, headed after it (`clueing_full` brings
 * *Clueing Full*), through the Widgets panel, folded again afterwards. A new quiz starts lean: a
 * spec about the bots or the sums adds what it is about, the widgets a widget reads before it.
 */
export async function addWidgetings(page: Page, widget_labels: readonly string[]): Promise<void> {
  await openPanel(page, 'Widgets')
  for (const widget_label of widget_labels) { await widgetingAdded(page, widget_label) }
  await closePanel(page, 'Widgets')
}

/**
 * Through the Widgets panel, which must be open: a new widgeting of `widget_label`, made as it is
 * picked with the column it brings (headed after the widget), then relabelled `label` if one is given.
 */
export async function widgetingAdded(page: Page, widget_label: string, label = ''): Promise<void> {
  await widgetsPanel(page).getByRole('button', { name: '+ New widgeting…' }).click()
  await pickWidget(page, widgetsPanel(page).getByRole('combobox', { name: 'A new widgeting, for each question' }), widget_label)
  await expect(grid(page).getByRole('columnheader', { name: Labelmaker.titleize(widget_label), exact: true })).toBeVisible()
  if (label !== '') { await relabelWidgeting(page, widget_label, label) }
}

/**
 * Show each of the question's own `fields` (and views) in a column of its own at the grid's end,
 * through the columns editor, and close the gear's dialog: the way a lean quiz opts into its hint
 * (*Hint*), its chain (*Chains to*), the chained-to hint (*BUT NOT*) and its alt text (*Alt Text*).
 */
export async function addColumns(page: Page, fields: readonly (QuestionField | QuestionView)[]): Promise<void> {
  await openManage(page)
  for (const field of fields) { await columnAdded(page, field) }
  await closeManage(page)
}

/**
 * Through the gear's dialog, which must be open: a new column showing `source`, made as it is
 * picked from *+ New column…*'s first item, and headed after what it shows.
 */
export async function columnAdded(page: Page, source: string): Promise<void> {
  await manageDialog(page).getByRole('button', { name: '+ New column…' }).click()
  await page.getByRole('menuitem', { name: 'Showing something the quiz has…' }).click()
  await manageDialog(page).getByRole('combobox', { name: 'The new column shows' }).fill(source)
  await page.getByRole('option', { name: new RegExp(`^${source} `) }).click()
  await expect(columnPanel(page, namesFor(source).title)).toBeVisible()
}

/** How Convex's HTTP API names a mutation that collided with others on every one of its own retries */
const CollisionCode = 'OptimisticConcurrencyControlFailure'

/**
 * Have the backend make a hunt for the ident labelled `label`, laid out as `layout` says, and open
 * its quiz: the fixture's way in, for a page whose session already holds that ident.
 *
 * Making a hunt reads every hunt (the app caps how many it holds), so two made at once collide,
 * and Convex gives up on one after retrying it a few times; with every worker making a hunt a
 * test, that happens. A write that collided wrote nothing, so it is tried again, for a while. Any
 * other refusal (a widget the library lacks, say) fails the test at once.
 */
async function enterFreshHunt(page: Page, label: string, layout: LayoutT): Promise<void> {
  const made: { address: string, refusal: Error | null } = { address: '', refusal: null }
  await expect(async () => {
    try {
      made.address = Z.string().startsWith('/').parse(await runAsAdmin('testing:makeHunt', { ident: label, widgetings: layout.widgetings ?? [], columns: layout.columns ?? [] }))
    } catch (err) {
      if (! String(err).includes(CollisionCode)) {
        made.refusal = err as Error
        return
      }
      throw err
    }
  }, 'the backend should make a hunt').toPass({ intervals: [100, 250, 500, 1000], timeout: 10_000 })
  if (made.refusal !== null) { throw made.refusal }
  await page.goto(made.address)
  await expect(grid(page)).toBeVisible()
}

/**
 * Stand in for the ask route with `reply`, replacing any earlier stand-in, so no spec can ever
 * spend real model usage.
 */
export async function stubAsk(page: Page, reply: unknown, status = 200): Promise<void> {
  await page.unroute('**/api/ask')
  await page.route('**/api/ask', async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(reply) })
  })
}

/** A fresh ident label no other spec will use: specs share one database, and every ident in it */
export function freshIdentLabel(): string {
  return `tester_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
}

/**
 * A label for a widget of the calling spec's own. The library is every hunt's, and every spec
 * shares one database, so a spec that changes the library changes only widgets it made. Letters
 * only after the stem, so the column a widgeting of it brings is titled word by word.
 *
 * @example freshWidgetLabel('spare')  // => 'spare_dkgbhfae', say
 */
export function freshWidgetLabel(stem: string): string {
  const tail = crypto.randomUUID().replaceAll('-', '').slice(0, 8).replaceAll(/\d/g, (digit) => 'ghijklmnop'.charAt(Number(digit)))
  return `${stem}_${tail}`
}

/**
 * Say who this browser is at the front door, and wait to be sent on to the hunts.
 *
 * @param label - The ident to become; a fresh one when omitted.
 * @returns The ident's label.
 */
export async function assumeIdent(page: Page, label = freshIdentLabel()): Promise<string> {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(label)
  await page.getByRole('button', { name: `Log in as ${label}` }).click()
  await expect(page).toHaveURL(/\/my\/hunts$/)
  return label
}

/** Where a new hunt's quiz is worked on: under its maker's org, its hunt and quiz share a label, in the realm `home` */
export const NewHuntUrl = /\/~[a-z0-9_]+\/([a-z0-9_]+)\/quizzes\/home\/\1\/!edit$/

/** Make a hunt from the hunts list, and wait until its quiz is on screen */
export async function newHunt(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ New hunt' }).click()
  await expect(page).toHaveURL(NewHuntUrl)
  await expect(grid(page)).toBeVisible()
}

/**
 * A fresh browser's way in to a quiz: say who it is, make a hunt, and open the hunt's quiz.
 * What every spec about the grid starts from.
 *
 * @returns The ident's label.
 */
export async function startHunt(page: Page): Promise<string> {
  const label = await assumeIdent(page)
  await newHunt(page)
  return label
}

/**
 * As a smith with the hunt's quiz on screen, put the ident labelled `label` on the hunt as
 * `role`, through the members panel, and wait until the panel lists them.
 */
export async function addMember(page: Page, label: string, role: 'Smith' | 'Reviewer'): Promise<void> {
  const members = await openPanel(page, 'Members')
  await members.getByLabel('Ident label').fill(label)
  await members.getByRole('combobox', { name: 'Role' }).click()
  await page.getByRole('option', { name: role }).click()
  await members.getByRole('button', { name: 'Add' }).click()
  await expect(members.getByRole('row').filter({ hasText: label })).toContainText(role)
}

/** The label of the hunt `page`'s address names: its second segment, as in `/~<org>/<hunt>/...` */
export function huntLabelOf(page: Page): string {
  return huntOf(page).hunt
}

/** The hunt `page`'s address names, by its org and label: its first two segments, as in `/~<org>/<hunt>/...` */
export function huntOf(page: Page): Routes.HuntLabels {
  const [, org = '', hunt = ''] = new URL(page.url()).pathname.split('/', 3)
  return { org: org.replace(/^~/, ''), hunt }
}

/** The address of the quiz `page` is at, naming no mode: it opens playtested, for anyone */
export function quizPathOf(page: Page): string {
  return new URL(page.url()).pathname.replace(/\/![a-z]+$/, '')
}

/**
 * Reload once every change on screen has been saved, as a person who paused a moment would.
 *
 * Saving happens behind the screen, so a reload the instant after an edit races it. Specs about
 * what survives a reload use this; a spec about committing on the way out reloads directly.
 */
export async function reloadOnceSaved(page: Page): Promise<void> {
  await waitUntilSaved(page)
  await page.reload()
}

/** Wait until every change on screen has been saved, so leaving the page cannot lose one */
export async function waitUntilSaved(page: Page): Promise<void> {
  await expect(page.locator('main[data-unsaved="false"]')).toBeAttached()
}

/**
 * Bring the panel tab named `tabname` to the front: a hidden tab's contents cannot be found.
 *
 * @returns The tab's section, now showing.
 */
export async function showTab(page: Page, tabname: string): Promise<Locator> {
  await unfold(page.getByRole('region').filter({ has: page.getByRole('tab', { name: tabname, exact: true, includeHidden: true }) }))
  await page.getByRole('tab', { name: tabname, exact: true }).click()
  const section = page.getByRole('tabpanel', { name: tabname, exact: true })
  await expect(section).toBeVisible()
  return section
}

/**
 * The panel titled `title`, unfolded: a panel in the row under the quiz starts folded to its title bar.
 *
 * @returns The panel's region, open.
 */
export async function openPanel(page: Page, title: string): Promise<Locator> {
  const panel = page.getByRole('region', { name: title, exact: true })
  await unfold(panel)
  return panel
}

/** Fold the panel titled `title` below the grid to its title bar, if it is open */
export async function closePanel(page: Page, title: string): Promise<void> {
  await foldBy(page.getByRole('region', { name: title, exact: true }), 'Show this panel')
}

/** Open `panel` by its fold triangle, if it is folded */
async function unfold(panel: Locator): Promise<void> {
  await unfoldBy(panel, 'Show this panel')
}

/**
 * Ask the Raw Export box for the hunt once every change on screen has landed, and read what it holds.
 *
 * The box reads the hunt only when asked, and is withdrawn again at the next change on screen, so
 * an export read before an edit has landed would be withdrawn by it.
 *
 * @returns The export, as the box holds it.
 */
export async function preparedExport(page: Page): Promise<string> {
  await waitUntilSaved(page)
  const section = await showTab(page, 'Raw Export')
  await section.getByRole('button', { name: 'Prepare export' }).click()
  const exportBox = section.getByRole('textbox', { name: 'Raw Export' })
  await expect(exportBox).not.toHaveValue('')
  return await exportBox.inputValue()
}

/** One quiz as Raw Export holds it, flattened for a spec to read: its realm and label, its title, and its questions in order, each with its label */
export type ExportedQuizT = {
  realm:     string
  label:     string
  title:     string
  questions: (Record<string, unknown> & { label: string })[]
}

/**
 * Every quiz of a Raw Export, realm by realm, each with its questions put in order by their
 * `position`: the merged hunt's `quizzes`, keyed by realm and label, read as a list.
 *
 * @param exported - The export, as the box holds it.
 */
export function exportedQuizzes(exported: string): ExportedQuizT[] {
  type Body = { title: string, questions: Record<string, Record<string, unknown> & { position: number }> }
  const hunt = JSON.parse(exported) as { quizzes: Record<string, Record<string, Body>> }
  return Object.entries(hunt.quizzes).flatMap(([realm, quizzes]) => Object.entries(quizzes).map(([label, quiz]) => ({
    realm,
    label,
    title:     quiz.title,
    questions: Object.entries(quiz.questions).map(([qnlabel, question]) => ({ ...question, label: qnlabel })).toSorted((aa, bb) => aa.position - bb.position),
  })))
}

/**
 * Make a new quiz and wait until the browser has arrived at it.
 *
 * A quiz is addressed by its label, so making one is a navigation, and a navigation is a router
 * transition rather than an instant rewrite of the address. Anything that types into the new
 * quiz has to wait for it, or it types into the old one.
 */
export async function newQuiz(page: Page): Promise<void> {
  const before = new URL(page.url()).pathname
  const title = await page.getByLabel('Quiz name').inputValue()
  await page.getByRole('banner').getByRole('button', { name: 'New quiz', exact: true }).click()
  await expect.poll(() => new URL(page.url()).pathname).not.toBe(before)
  // The address moves a moment before the screen does; a fresh quiz's generated title never
  // matches the one it was made from.
  await expect(page.getByLabel('Quiz name')).not.toHaveValue(title)
}

/**
 * The quizzes the header's switcher lists, each a menu item named by its title, a locked one
 * marked: the switcher opened to list them. Close it with Escape, or pick one.
 */
export async function switcherQuizzes(page: Page): Promise<Locator> {
  await page.getByRole('navigation', { name: 'Where you are' }).locator('[aria-haspopup="menu"]').click()
  return page.getByRole('menu', { name: 'Open quiz' }).getByRole('menuitem')
}

/** Switch to the quiz titled `title` from the switcher, and wait until the browser is there */
export async function openQuiz(page: Page, title: string): Promise<void> {
  const before = new URL(page.url()).pathname
  await switcherQuizzes(page)
  await page.getByRole('menu', { name: 'Open quiz' }).getByRole('menuitem', { name: title, exact: true }).click()
  await expect.poll(() => new URL(page.url()).pathname).not.toBe(before)
  await expect(page.getByLabel('Quiz name')).toHaveValue(title)
}

/** Load `url` afresh, even when it differs from the current address only by its hash */
export async function loadAfresh(page: Page, url: string): Promise<void> {
  await page.goto('about:blank')
  await page.goto(url)
}

/**
 * Drag the row `source` grips and drop it against the named edge of the row `target` grips.
 *
 * Chromium under Playwright will not begin a native drag from a real mouse press -- neither
 * `dragTo` nor a hand-driven press and move raises so much as a `dragstart` -- so the events a
 * drag makes are sent directly, carrying the coordinates that decide the outcome. Which half of
 * the target row the pointer rests in is the whole of what the author is saying, so the drop is
 * aimed three pixels inside the edge being named. What this proves is that the page reorders
 * correctly on those events, not that a browser sends them.
 */
export async function dragOnto(page: Page, source: Locator, target: Locator, edge: 'top' | 'bottom' = 'top'): Promise<void> {
  const row = rowOf(target)
  await source.scrollIntoViewIfNeeded()
  await row.scrollIntoViewIfNeeded()
  const from = await source.boundingBox()
  const onto = await row.boundingBox()
  if (! from || ! onto) { throw new Error('Cannot drag something that is not on screen') }

  const clientX = Math.round(onto.x + Math.min(onto.width / 2, 80))
  const clientY = Math.round(edge === 'top' ? onto.y + 3 : onto.y + onto.height - 3)
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await source.dispatchEvent('dragstart', { dataTransfer, clientX: Math.round(from.x + 5), clientY: Math.round(from.y + 5) })
  await row.dispatchEvent('dragenter', { dataTransfer, clientX, clientY })
  await row.dispatchEvent('dragover', { dataTransfer, clientX, clientY })
  await row.dispatchEvent('drop', { dataTransfer, clientX, clientY })
  await source.dispatchEvent('dragend', { dataTransfer, clientX, clientY })
}

/** The row a grip belongs to: what a drop lands against, rather than the grip itself */
function rowOf(handle: Locator): Locator {
  return handle.locator('xpath=ancestor-or-self::*[self::tr or @role="listitem"][1]')
}

/** Move the row `handle` belongs to by `steps` places, up when negative, with the arrow keys */
export async function stepBy(handle: Locator, steps: number): Promise<void> {
  await handle.focus()
  for (let ii = 0; ii < Math.abs(steps); ii += 1) {
    await handle.press(steps < 0 ? 'ArrowUp' : 'ArrowDown')
  }
}

/** What `failQuery` has made of a query's answers, and the way to let them through again */
export type FailedQueryT = {
  /** The request id every failed answer names, as the deployment's logs would file it */
  request_id: string
  /** Let the query's answers through from now on, as a server that has recovered sends them */
  heal:       () => void
}

/** Where the Convex client keeps its socket to the backend: `ws://…/api/<version>/sync` */
const ConvexSyncUrl = /\/api\/[^/]+\/sync$/

/** A frame of the Convex sync protocol, as far as `failQuery` reads one: a change to the client's queries, or the server's answers to them */
type SyncFrameT = { type: string, modifications?: SyncChangeT[] }
type SyncChangeT = { type: string, queryId: number, udfPath?: string, journal?: unknown }

/**
 * Make every answer the server gives the query function `fnpath` (`hunts:open`) a failure, as a
 * query that throws on the server reaches the browser, until `heal` is called.
 *
 * The page's socket to Convex is routed through the spec: each subscription to `fnpath` is noted
 * as the client sends it, and each answer to one is rewritten into a failure saying `reason`,
 * under one request id. `Server Error` alone, the default, is what a production deployment says
 * of an unplanned throw, keeping the reason to itself. A transition the server splits into chunks,
 * as it does only for a large one, passes through as it is. Only a socket opened after this call
 * is routed, so a spec calls it, then loads the page.
 *
 * @param fnpath - The query function, as Convex names it: `hunts:list`.
 * @param reason - What the failure says, after its request id.
 * @param data - What a `ConvexError` the query threw carries, as the server sends it (a refusal's `{ ZodError: [...] }`); none for a plain throw.
 * @returns The request id the failures name, and `heal`.
 */
export async function failQuery(page: Page, fnpath: string, reason = 'Server Error', data?: unknown): Promise<FailedQueryT> {
  const request_id = crypto.randomUUID().replaceAll('-', '').slice(0, 16)
  const failure = { errorMessage: `[Request ID: ${request_id}] ${reason}`, logLines: [], ...(data !== undefined && { errorData: data }) }
  let healed = false
  await page.routeWebSocket(ConvexSyncUrl, (socket) => {
    const server = socket.connectToServer()
    const watched = new Set<number>()
    socket.onMessage((message) => {
      for (const queryId of subscriptionsIn(message, fnpath)) { watched.add(queryId) }
      server.send(message)
    })
    server.onMessage((message) => {
      const frame = typeof message === 'string' ? JSON.parse(message) as SyncFrameT : null
      if (healed || frame?.type !== 'Transition') {
        socket.send(message)
        return
      }
      const modifications = frame.modifications?.map((change) => (
        change.type === 'QueryUpdated' && watched.has(change.queryId) ? { type: 'QueryFailed', queryId: change.queryId, journal: change.journal, ...failure } : change
      ))
      socket.send(JSON.stringify({ ...frame, modifications }))
    })
  })
  return { request_id, heal: () => { healed = true } }
}

/** The queries to `fnpath` a frame from the client subscribes to, by the ids it gives them */
function subscriptionsIn(message: string | Buffer, fnpath: string): number[] {
  const frame = typeof message === 'string' ? JSON.parse(message) as SyncFrameT : null
  if (frame?.type !== 'ModifyQuerySet') { return [] }
  return (frame.modifications ?? []).filter((change) => change.type === 'Add' && change.udfPath === fnpath).map((change) => change.queryId)
}
