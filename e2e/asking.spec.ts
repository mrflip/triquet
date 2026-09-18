import { expect, test, type Page } from '@playwright/test'

/** Stand in for the ask route, so these tests never spend real model usage */
async function stubAsk(page: Page, reply: unknown, status = 200) {
  await page.route('**/api/ask', async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(reply) })
  })
}

/** The Quick-model guess cell of the row at `rowIdx` */
function guessCell(page: Page, rowIdx: number) {
  return page.getByRole('button', { name: 'Ask Quick-model guess' }).nth(rowIdx)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region gave its name to Leon?')
  await page.getByLabel('Round name').click()
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
  await page.reload()
  await expect(guessCell(page, 0)).toContainText('Leon')
})

test('with the network off the rest of the page still edits, sorts and saves', async ({ page }) => {
  await page.route('**/api/ask', (route) => route.abort())
  await guessCell(page, 0).dblclick()
  await expect(guessCell(page, 0)).toContainText('A connection hiccup — try again.')

  await page.getByRole('textbox', { name: 'Title' }).first().fill('Leon')
  await page.getByRole('button', { name: 'Title' }).click()
  await page.getByLabel('Round name').fill('Still working')
  await page.reload()
  await expect(page.getByLabel('Round name')).toHaveValue('Still working')
  await expect(page.getByRole('textbox', { name: 'Title' }).first()).toHaveValue('Leon')
})
