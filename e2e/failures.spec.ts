import { expect, test, type Page } from '@playwright/test'
import { reloadOnceSaved } from './support'

const RateLimited = 'Too many requests right now — try again shortly.'

/** Stand in for the ask route, so these tests never spend real model usage */
async function stubAsk(page: Page, reply: unknown) {
  await page.unroute('**/api/ask')
  await page.route('**/api/ask', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) })
  })
}

const guessReply = (text: string) => ({ ok: true, job: 'guess', text, truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
const failure = { ok: false, failurekind: 'rateLimited', detail: { name: 'RateLimitError', status: 429, message: 'slow down' } }

/** The Quick-model guess cell of the first row */
const guessCell = (page: Page) => page.getByRole('button', { name: 'Ask Quick-model guess' }).first()

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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
  await expect(badge).toHaveAttribute('title', RateLimited)
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

test('a failed combined run is shown by its button and touches no cell', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Hint', exact: true }).first().fill('BUT NOT the film')
  await page.getByLabel('Quiz name').click()
  await stubAsk(page, failure)
  await page.getByRole('button', { name: 'Recalculate all ishes' }).click()
  const badges = page.getByRole('button', { name: /The last ask failed/ })
  await expect(page.getByText(/Couldn't recalculate: .* Nothing was changed\./)).toBeVisible()
  // The one badge there is belongs to the toolbar, not to any of the cells.
  await expect(badges).toHaveCount(1)
  await expect(page.locator('tbody').getByRole('button', { name: /The last ask failed/ })).toHaveCount(0)
})
