import type { Page } from '@playwright/test'
import { expect, reloadOnceSaved, stubAsk, test } from './support'

const RateLimited = 'Too many requests right now — try again shortly.'

const guessReply = (guess: string) => ({ ok: true, value: { guess, explanation: '' }, truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
const failure = { ok: false, failurekind: 'rateLimited', detail: { name: 'RateLimitError', status: 429, message: 'slow down' } }

/** The Quick-model guess cell of the first row */
const guessCell = (page: Page) => page.getByRole('button', { name: 'Ask Quick-model guess' }).first()

test.beforeEach(async ({ page }) => {
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region gave its name to Leon?')
  await page.getByLabel('Quiz name').click()
})

test('a failed refresh leaves the answer as it was, and badges it', async ({ page }) => {
  await stubAsk(page, guessReply('Leon'))
  await guessCell(page).dblclick()
  await expect(guessCell(page)).toContainText('Leon')
  await stubAsk(page, failure)
  await guessCell(page).dblclick()
  await expect(page.getByRole('button', { name: /The last ask failed/ })).toBeVisible()
  await expect(guessCell(page)).toContainText('Leon')
  await expect(guessCell(page)).not.toContainText(RateLimited)
})

test('hovering the badge gives the reason, and clicking it shows the response as JSON', async ({ page }) => {
  await stubAsk(page, guessReply('Leon'))
  await guessCell(page).dblclick()
  await stubAsk(page, failure)
  await guessCell(page).dblclick()
  const badge = page.getByRole('button', { name: /The last ask failed/ })
  await expect(badge).toHaveAttribute('title', `${RateLimited} Click for the response as it came back.`)
  await badge.click()
  const shown = page.getByRole('dialog', { name: 'The last ask failed' })
  await expect(shown.getByLabel('The response')).toContainText('"failurekind": "rateLimited"')
  await expect(shown.getByLabel('The response')).toContainText('"status": 429')
})

test('the badge survives a reload, and any success takes it away', async ({ page }) => {
  await stubAsk(page, guessReply('Leon'))
  await guessCell(page).dblclick()
  await stubAsk(page, failure)
  await guessCell(page).dblclick()
  await expect(page.getByRole('button', { name: /The last ask failed/ })).toBeVisible()
  await reloadOnceSaved(page)
  await expect(guessCell(page)).toContainText('Leon')
  await expect(page.getByRole('button', { name: /The last ask failed/ })).toBeVisible()
  await stubAsk(page, guessReply('Lyon'))
  await guessCell(page).dblclick()
  await expect(guessCell(page)).toContainText('Lyon')
  await expect(page.getByRole('button', { name: /The last ask failed/ })).toHaveCount(0)
})

test('a cell that has only ever failed shows the sentence, and is badged too', async ({ page }) => {
  await stubAsk(page, failure)
  await guessCell(page).dblclick()
  await expect(guessCell(page)).toContainText(RateLimited)
  await expect(page.getByRole('button', { name: /The last ask failed/ })).toHaveCount(1)
})
