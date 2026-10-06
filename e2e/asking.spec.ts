import type { Page } from '@playwright/test'
import { addWidgetings, expect, reloadOnceSaved, stubAsk, test } from './support'

/** The guess cell of the row at `rowIdx`: dumdum's column */
function guessCell(page: Page, rowIdx: number) {
  return page.getByRole('button', { name: 'Ask Dumdum' }).nth(rowIdx)
}

test.beforeEach(async ({ page }) => {
  await addWidgetings(page, ['dumdum'])
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region gave its name to Leon?')
  await page.getByLabel('Quiz name').click()
})

test('a never-asked cell invites the author to ask', async ({ page }) => {
  await expect(guessCell(page, 0)).toHaveText('Double-click to ask')
  await expect(guessCell(page, 0)).toBeEnabled()
})

test('double-clicking asks, and the answer lands with its tier and cost', async ({ page }) => {
  await stubAsk(page, { ok: true, value: { guess: 'Leon', explanation: 'The lion.' }, truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
  await guessCell(page, 0).dblclick()
  await expect(guessCell(page, 0)).toContainText('Leon')
  await expect(guessCell(page, 0)).toContainText('~84 tok')
  await expect(guessCell(page, 0)).toContainText('quick')
})

test("the cell's prompt goes to the route filled in, with its widget's service, tier and room", async ({ page }) => {
  await stubAsk(page, { ok: true, value: { guess: 'Leon', explanation: 'The lion.' }, truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
  const sent = page.waitForRequest('**/api/ask')
  await guessCell(page, 0).dblclick()
  const request = await sent
  const body = request.postDataJSON() as { prompt: string, servicelabel: string, model_tier: string, max_tokens: number }
  expect(body.prompt).toContain('Question: Which region gave its name to Leon?')
  expect(body).toMatchObject({ servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 })
})

test('the keyboard asks too', async ({ page }) => {
  await stubAsk(page, { ok: true, value: { guess: 'Leon', explanation: 'The lion.' }, truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
  // Focusing, unlike a click, does not wait for the cell to take asks: it does once the clueing lands.
  await expect(guessCell(page, 0)).toBeEnabled()
  await guessCell(page, 0).focus()
  await page.keyboard.press('Enter')
  await expect(guessCell(page, 0)).toContainText('Leon')
})

test('a question with no text is not asked about at all', async ({ page }) => {
  // The second question is still blank, so there is nothing to spend usage on.
  await expect(guessCell(page, 1)).toBeDisabled()
  await expect(guessCell(page, 0)).toBeEnabled()
})

test('an answer survives a reload', { tag: '@smoke' }, async ({ page }) => {
  await stubAsk(page, { ok: true, value: { guess: 'Leon', explanation: 'The lion.' }, truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
  await guessCell(page, 0).dblclick()
  await expect(guessCell(page, 0)).toContainText('Leon')
  await reloadOnceSaved(page)
  await expect(guessCell(page, 0)).toContainText('Leon')
})
