import { expect, type Page } from '@playwright/test'

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

/** Load `url` afresh, even when it differs from the current address only by its hash */
export async function loadAfresh(page: Page, url: string): Promise<void> {
  await page.goto('about:blank')
  await page.goto(url)
}
