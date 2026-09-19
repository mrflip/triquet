import { expect, type Page } from '@playwright/test'

/**
 * Reload once every change on screen has been saved, as a person who paused a moment would.
 *
 * Saving happens behind the screen, so a reload the instant after an edit races it. Specs about
 * what survives a reload use this; a spec about committing on the way out reloads directly.
 */
export async function reloadOnceSaved(page: Page): Promise<void> {
  await expect(page.locator('main[data-unsaved="false"]')).toBeAttached()
  await page.reload()
}
