import { expect, type Locator, type Page } from '@playwright/test'

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
  await page.getByRole('button', { name: '+ New quiz' }).click()
  await expect(page).not.toHaveURL(new RegExp(`${before}$`))
}

/** Switch to the quiz titled `title` from the switcher, and wait until the browser is there */
export async function openQuiz(page: Page, title: string): Promise<void> {
  const before = new URL(page.url()).pathname
  await page.getByLabel('Open quiz').selectOption({ label: title })
  await expect(page).not.toHaveURL(new RegExp(`${before}$`))
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
