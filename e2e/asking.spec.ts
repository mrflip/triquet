import type { Page } from '@playwright/test'
import { expect, reloadOnceSaved, stubAsk, test, valuesOf } from './support'

/** The Quick-model guess cell of the row at `rowIdx` */
function guessCell(page: Page, rowIdx: number) {
  return page.getByRole('button', { name: 'Ask Quick-model guess' }).nth(rowIdx)
}

test.beforeEach(async ({ page }) => {
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region gave its name to Leon?')
  await page.getByLabel('Quiz name').click()
})

test('a never-asked cell invites the author to ask', async ({ page }) => {
  await expect(guessCell(page, 0)).toHaveText('Double-click to ask')
})

test('double-clicking asks, and the answer lands with its tier and cost', async ({ page }) => {
  await stubAsk(page, { ok: true, job: 'guess', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
  await guessCell(page, 0).dblclick()
  await expect(guessCell(page, 0)).toContainText('Leon')
  await expect(guessCell(page, 0)).toContainText('~84 tok')
  await expect(guessCell(page, 0)).toContainText('quick')
})

test('the keyboard asks too', async ({ page }) => {
  await stubAsk(page, { ok: true, job: 'guess', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
  // Focusing, unlike a click, does not wait for the cell to take asks: it does once the clueing lands.
  await expect(guessCell(page, 0)).toBeEnabled()
  await guessCell(page, 0).focus()
  await page.keyboard.press('Enter')
  await expect(guessCell(page, 0)).toContainText('Leon')
})

test('a failure reads as a sentence and invites a retry, never as a code', async ({ page }) => {
  await stubAsk(page, { ok: false, failurekind: 'rateLimited' })
  await guessCell(page, 0).dblclick()
  await expect(guessCell(page, 0)).toContainText('Too many requests right now — try again shortly.')
  await expect(guessCell(page, 0)).toContainText('Double-click to try again')
})

test('a question with no text is not asked about at all', async ({ page }) => {
  // The second question is still blank, so there is nothing to spend usage on.
  await expect(guessCell(page, 1)).toBeDisabled()
  await expect(guessCell(page, 0)).toBeEnabled()
})

test('an answer survives a reload', async ({ page }) => {
  await stubAsk(page, { ok: true, job: 'guess', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
  await guessCell(page, 0).dblclick()
  await expect(guessCell(page, 0)).toContainText('Leon')
  await reloadOnceSaved(page)
  await expect(guessCell(page, 0)).toContainText('Leon')
})

test('with the network off the rest of the page still edits, sorts and saves', async ({ page }) => {
  await page.route('**/api/ask', (route) => route.abort())
  await guessCell(page, 0).dblclick()
  await expect(guessCell(page, 0)).toContainText('A connection hiccup — try again.')

  await page.getByRole('textbox', { name: 'Title' }).first().fill('Leon')
  await page.getByRole('button', { name: 'Title' }).click()
  await page.getByLabel('Quiz name').fill('Still working')
  await page.getByLabel('Quiz name').blur()
  await reloadOnceSaved(page)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Still working')
  // Sorting by title moves 'Leon' among the other questions' own generated titles, so it is
  // found by its value rather than assumed to stay first.
  const titles = page.getByRole('textbox', { name: 'Title' })
  await expect(titles.first()).toBeVisible()
  await expect.poll(() => valuesOf(titles)).toContain('Leon')
})
