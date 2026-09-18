import { expect, test, type Page } from '@playwright/test'

/** Fill the first questions with a Q#, a short answer and a hint */
async function fillRound(page: Page, rows: [string, string, string][]) {
  for (const [ii, [qnum, answer, hint]] of rows.entries()) {
    await page.getByRole('textbox', { name: 'Q#' }).nth(ii).fill(qnum)
    await page.getByRole('textbox', { name: 'Short answer' }).nth(ii).fill(answer)
    await page.getByRole('textbox', { name: 'Hint' }).nth(ii).fill(hint)
  }
  await page.getByLabel('Round name').click()
}

/** Chain the question at `ii` to the one labelled `answer` */
async function chainTo(page: Page, ii: number, answer: string) {
  await page.getByRole('combobox', { name: 'Chains to' }).nth(ii).selectOption({ label: answer })
}

/** The short answers, top to bottom, once the grid is on screen */
async function answersShown(page: Page): Promise<string[]> {
  const fields = page.getByRole('textbox', { name: 'Short answer' })
  await expect(fields.first()).toBeVisible()
  return fields.evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value))
}

/** The BUT NOT cell of the row at `ii` */
function butnotCell(page: Page, ii: number) {
  return page.locator('tbody tr').nth(ii).locator('td[data-colname="BUT NOT"] > div')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await fillRound(page, [
    ['3', 'cherry', 'BUT NOT the fruit-flavoured one'],
    ['1', 'apple',  'BUT NOT the company from Cupertino, founded in 1976'],
    ['4', 'damson', 'BUT NOT anything at all'],
    ['2', 'banana', 'BUT NOT the republic'],
  ])
})

test('the chain dropdown offers every other question, never this one', async ({ page }) => {
  const picker = page.getByRole('combobox', { name: 'Chains to' }).first()
  const labels = await picker.locator('option').evaluateAll((nodes) => nodes.map((node) => node.textContent))
  expect(labels).toEqual(['— pick —', 'apple', 'damson', 'banana', '(no short answer yet)'])
})

test('BUT NOT previews the chained-to question\'s hint, not this one\'s', async ({ page }) => {
  await chainTo(page, 0, 'damson')
  await expect(butnotCell(page, 0)).toHaveText('BUT NOT anything at all')
})

test('a long hint is previewed as a snippet, with the whole of it on hover', async ({ page }) => {
  await chainTo(page, 0, 'apple')
  await expect(butnotCell(page, 0)).toHaveText('BUT NOT the company from Cupertino, founded in…')
  await expect(butnotCell(page, 0)).toHaveAttribute('title', 'BUT NOT the company from Cupertino, founded in 1976')
})

test('BUT NOT says so before a chain is picked, and when the target has no hint', async ({ page }) => {
  await expect(page.getByText('Pick a chain target').first()).toBeVisible()
  // The fifth question is still blank, so it has no hint to preview.
  await chainTo(page, 0, '(no short answer yet)')
  await expect(butnotCell(page, 0)).toHaveText('No hint entered yet')
})

test('sort by chain order reads the round in presentation order, and backward', async ({ page }) => {
  await chainTo(page, 1, 'banana')
  await chainTo(page, 3, 'cherry')
  await chainTo(page, 0, 'damson')

  await page.getByRole('button', { name: 'Sort by chain order' }).click()
  const forward = await answersShown(page)
  expect(forward.slice(0, 4)).toEqual(['apple', 'banana', 'cherry', 'damson'])

  await page.getByRole('button', { name: 'Sort by chain order' }).click()
  const backward = await answersShown(page)
  expect(backward.slice(0, 4)).toEqual(['damson', 'cherry', 'banana', 'apple'])
})

test('a chain order survives a reload', async ({ page }) => {
  await chainTo(page, 1, 'banana')
  await chainTo(page, 3, 'cherry')
  await page.getByRole('button', { name: 'Sort by chain order' }).click()
  const wasShown = await answersShown(page)
  await page.reload()
  expect(await answersShown(page)).toEqual(wasShown)
})
