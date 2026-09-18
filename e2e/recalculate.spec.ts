import { expect, test, type Page } from '@playwright/test'

/** The cell of column `colname` in the row at `ii` */
function cellOf(page: Page, ii: number, colname: string) {
  return page.locator('tbody tr').nth(ii).locator(`td[data-colname="${colname}"]`)
}

/** Answer the combined run by giving every key one span worth `value` */
async function stubRun(page: Page, valueOf: (key: string) => number) {
  await page.route('**/api/ask', async (route) => {
    const ask = JSON.parse(route.request().postData() ?? '{}') as { items: { key: string }[] }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true, job: 'bulk_ishes', truncated: false, model_tier_applied: 'careful',
        approx_tokens: 4200, text_count: ask.items.length,
        groups: ask.items.map((item) => ({ key: item.key, items: [{ text: 'one', value: valueOf(item.key), kind: 'wordish' }] })),
      }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  for (const ii of [0, 1, 2]) {
    await page.getByRole('textbox', { name: 'Clueing', exact: true }).nth(ii).fill(`Clueing number ${String(ii)}`)
    await page.getByRole('textbox', { name: 'Hint', exact: true }).nth(ii).fill(`BUT NOT hint ${String(ii)}`)
  }
  await page.getByLabel('Round name').click()
})

test('one run fills every clueing and hint, with a single cost figure for the lot', async ({ page }) => {
  await stubRun(page, () => 7)
  await page.getByRole('button', { name: 'Recalculate all ishes' }).click()

  await expect(cellOf(page, 0, 'Clueing Full Sum')).toHaveText('7')
  await expect(cellOf(page, 2, 'Hint Full Sum')).toHaveText('7')
  await expect(page.getByText('~4,200 tok last time (6 texts)')).toBeVisible()
})

test('a cell filled by a run carries no per-cell token figure', async ({ page }) => {
  await stubRun(page, () => 7)
  await page.getByRole('button', { name: 'Recalculate all ishes' }).click()
  await expect(cellOf(page, 0, 'Clueing ishes')).toContainText('careful')
  await expect(cellOf(page, 0, 'Clueing ishes')).not.toContainText('tok')
})

test('a text the run left out becomes a per-cell error, not a stale value looking fresh', async ({ page }) => {
  await page.route('**/api/ask', async (route) => {
    const ask = JSON.parse(route.request().postData() ?? '{}') as { items: { key: string }[] }
    const kept = ask.items.filter((item) => item.key.startsWith('c:'))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true, job: 'bulk_ishes', truncated: false, model_tier_applied: 'careful',
        approx_tokens: 4200, text_count: ask.items.length,
        groups: kept.map((item) => ({ key: item.key, items: [] })),
      }),
    })
  })
  await page.getByRole('button', { name: 'Recalculate all ishes' }).click()
  await expect(cellOf(page, 0, 'Hint Ishes'))
    .toContainText("The combined response didn't include this one — try refreshing it on its own.")
  await expect(cellOf(page, 0, 'Clueing ishes')).toContainText('None found')
})

test('a failed run changes nothing, and says so', async ({ page }) => {
  await stubRun(page, () => 7)
  await page.getByRole('button', { name: 'Recalculate all ishes' }).click()
  await expect(cellOf(page, 0, 'Clueing Full Sum')).toHaveText('7')

  await page.route('**/api/ask', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, failurekind: 'rateLimited' }) })
  })
  await page.getByRole('button', { name: 'Recalculate all ishes' }).click()

  await expect(page.getByText(/Couldn't recalculate: .* Nothing was changed\./)).toBeVisible()
  await expect(cellOf(page, 0, 'Clueing Full Sum')).toHaveText('7')
})

test('a round with no text at all gets its own notice rather than an empty request', async ({ page }) => {
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await page.route('**/api/ask', (route) => route.abort())
  await page.getByRole('button', { name: 'Recalculate all ishes' }).click()
  await expect(page.getByText('No questions or hints have any text yet — nothing to recalculate.')).toBeVisible()
})

test('the cost figure is kept across reloads', async ({ page }) => {
  await stubRun(page, () => 7)
  await page.getByRole('button', { name: 'Recalculate all ishes' }).click()
  await expect(page.getByText('~4,200 tok last time (6 texts)')).toBeVisible()
  await page.reload()
  await expect(page.getByText('~4,200 tok last time (6 texts)')).toBeVisible()
})
