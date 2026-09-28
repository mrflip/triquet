import { test as base, expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'

/** Where the fixture's page begins by default: a fresh ident's fresh hunt, open on its quiz */
export const FreshHunt = 'fresh hunt'

/**
 * The suite's `test`: Playwright's, with the page already at the workbench.
 *
 * Every spec imports `test` and `expect` from here. `page` has said who it is, made a hunt of its
 * own and opened the hunt's quiz (`startAt` is `FreshHunt` unless a spec says otherwise), and has
 * its grid on screen, so a spec begins with the thing it is about rather than with a way in.
 * Specs share one Jazz server and every hunt on it, so each begins in a hunt no other can name.
 * `startAt` as a path goes there instead, and waits for the grid. A spec that must stub a route
 * before the first load, or is about the way in itself, says `test.use({ startAt: null })` and
 * goes there itself.
 */
export const test = base.extend<{ startAt: string | null }>({
  startAt: [FreshHunt, { option: true }],
  page:    async ({ page, startAt }, use) => {
    if (startAt === FreshHunt) {
      await startHunt(page)
    } else if (startAt !== null) {
      await page.goto(startAt)
      await expect(page.getByRole('table')).toBeVisible()
    }
    await use(page)
  },
})
export { expect } from '@playwright/test'

/** The browser contexts `otherVisitor` opened for this test, closed once it is done */
const Others: BrowserContext[] = []

// eslint-disable-next-line unicorn/no-top-level-side-effects -- registering the fixture's own cleanup hook, the way `test.extend` above does
test.afterEach(async () => {
  await Promise.all(Others.splice(0).map(async (context) => { await context.close() }))
})

/** A page in a browser of its own: another visitor, with an account of their own, on the same Jazz server */
export async function otherVisitor(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  Others.push(context)
  return await context.newPage()
}

/** The row at `rowIdx` of the grid, counting from the top */
export function rowAt(page: Page, rowIdx: number): Locator {
  return page.locator('tbody').getByRole('row').nth(rowIdx)
}

/** The cell of column `colname` in the row at `rowIdx`; the column's label is its own name */
export function cellOf(page: Page, rowIdx: number, colname: string): Locator {
  return rowAt(page, rowIdx).locator(`td[data-colname="${colname}"]`)
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

/** Close the gear's dialog without applying anything */
export async function closeManage(page: Page): Promise<void> {
  await manageDialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
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

/** A fresh ident label no other spec will use: specs share one Jazz server, and every ident on it */
export function freshIdentLabel(): string {
  return `tester_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
}

/**
 * Say who this browser is at the front door, and wait to be sent on to the hunts.
 *
 * @param label - The ident to become; a fresh one when omitted.
 * @returns The ident's label.
 */
export async function assumeIdent(page: Page, label = freshIdentLabel()): Promise<string> {
  await page.goto('/')
  await page.getByLabel('Ident label').fill(label)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/my\/hunts$/)
  return label
}

/** Where a new hunt's quiz is worked on: its hunt and quiz share a label, in the realm `home` */
export const NewHuntUrl = /\/h\/([a-z0-9_]+)\/home\/\1\?act=smith$/

/** Make a hunt from the hunts list, and wait until its quiz is on screen */
export async function newHunt(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ New hunt' }).click()
  await expect(page).toHaveURL(NewHuntUrl)
  await expect(page.getByRole('table')).toBeVisible()
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
 * Make a new quiz and wait until the browser has arrived at it.
 *
 * A quiz is addressed by its label, so making one is a navigation, and a navigation is a router
 * transition rather than an instant rewrite of the address. Anything that types into the new
 * quiz has to wait for it, or it types into the old one.
 */
export async function newQuiz(page: Page): Promise<void> {
  const before = new URL(page.url()).pathname
  const title = await page.getByLabel('Quiz name').inputValue()
  await page.getByRole('button', { name: '+ New quiz' }).click()
  await expect.poll(() => new URL(page.url()).pathname).not.toBe(before)
  // The address moves a moment before the screen does; a fresh quiz's generated title never
  // matches the one it was made from.
  await expect(page.getByLabel('Quiz name')).not.toHaveValue(title)
}

/** Switch to the quiz titled `title` from the switcher, and wait until the browser is there */
export async function openQuiz(page: Page, title: string): Promise<void> {
  const before = new URL(page.url()).pathname
  await page.getByLabel('Open quiz').selectOption({ label: title })
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
