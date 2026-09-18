import { expect, test, type Page } from '@playwright/test'

const ThreeSpans = [
  { text: '#17-19', value: 36, kind: 'numeral' },
  { text: 'douzaine', value: 12, kind: 'wordish' },
  { text: '300 million', value: 300_000_000, kind: 'wordish' },
]

/** Stand in for the ask route, so these tests never spend real model usage */
async function stubIshes(page: Page, items: unknown[]) {
  await page.route('**/api/ask', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, job: 'ishes', items, truncated: false, model_tier_applied: 'careful', approx_tokens: 120 }),
    })
  })
}

/** The cell of column `colname` in the row at `ii` */
function cellOf(page: Page, ii: number, colname: string) {
  return page.locator('tbody tr').nth(ii).locator(`td[data-colname="${colname}"]`)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await page.getByRole('textbox', { name: 'Q#' }).first().fill('1')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
    .fill('Numbers #17-19, a douzaine of them, and 300 million more')
  await page.getByLabel('Round name').click()
})

test('an uncomputed sum reads as a dash, never as a zero', async ({ page }) => {
  await expect(cellOf(page, 0, 'Clueing Full Sum')).toHaveText('–')
})

test('extracting lists every span with its value and kind', async ({ page }) => {
  await stubIshes(page, ThreeSpans)
  await page.getByRole('button', { name: 'Ask Clueing ishes' }).first().dblclick()
  const cell = cellOf(page, 0, 'Clueing ishes')
  await expect(cell).toContainText('#17-19')
  await expect(cell).toContainText('douzaine')
  await expect(cell).toContainText('300,000,000')
})

test('the sums follow from the extraction', async ({ page }) => {
  await stubIshes(page, ThreeSpans)
  await page.getByRole('button', { name: 'Ask Clueing ishes' }).first().dblclick()
  await expect(cellOf(page, 0, 'Clueing Full Sum')).toContainText('300,000,048')
  await expect(cellOf(page, 0, 'Clueing Numeral Sum')).toContainText('36')
  // Clueing Full Sum plus this question's rank, which is 1.
  await expect(cellOf(page, 0, 'Clueing + Rank')).toContainText('300,000,049')
})

test('an extraction that found nothing says so, and sums to nought', async ({ page }) => {
  await stubIshes(page, [])
  await page.getByRole('button', { name: 'Ask Clueing ishes' }).first().dblclick()
  await expect(cellOf(page, 0, 'Clueing ishes')).toContainText('None found')
  await expect(cellOf(page, 0, 'Clueing Full Sum')).toHaveText('0')
})

test('editing the clueing greys the sums without emptying them', async ({ page }) => {
  await stubIshes(page, ThreeSpans)
  await page.getByRole('button', { name: 'Ask Clueing ishes' }).first().dblclick()
  await expect(cellOf(page, 0, 'Clueing Full Sum')).toContainText('300,000,048')

  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Reworded, with no numbers at all')
  await page.getByLabel('Round name').click()

  await expect(cellOf(page, 0, 'Clueing Full Sum')).toContainText('300,000,048')
  await expect(cellOf(page, 0, 'Clueing Full Sum').locator('span').first()).toHaveClass(/stale/)
  await expect(cellOf(page, 0, 'Clueing ishes')).toContainText('· stale')
})

test('BUT NOT ishes mirrors the chained-to hint rather than computing its own', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Short answer' }).nth(1).fill('damson')
  await page.getByRole('textbox', { name: 'Hint', exact: true }).nth(1).fill('BUT NOT the 1994 film')
  await page.getByLabel('Round name').click()
  await page.getByRole('combobox', { name: 'Chains to' }).first().selectOption({ label: 'damson' })

  await expect(cellOf(page, 0, 'BUT NOT ishes'))
    .toContainText("Not computed yet — double-click that question's Hint Ishes")

  await stubIshes(page, [{ text: '1994', value: 1994, kind: 'numeral' }])
  await page.getByRole('button', { name: 'Ask Hint Ishes' }).nth(1).dblclick()

  await expect(cellOf(page, 0, 'BUT NOT ishes')).toContainText('1994')
  await expect(cellOf(page, 0, 'BUT NOT Full Sum')).toContainText('1,994')
  await expect(cellOf(page, 1, 'Hint Full Sum')).toContainText('1,994')
})

test('double-clicking a Full Sum re-extracts what is behind it', async ({ page }) => {
  await stubIshes(page, ThreeSpans)
  await cellOf(page, 0, 'Clueing Full Sum').dblclick()
  await expect(cellOf(page, 0, 'Clueing ishes')).toContainText('douzaine')
})
