import { expect, test, type Page } from '@playwright/test'
import { reloadOnceSaved, waitUntilSaved } from './support'

/** Fill the first questions with a Q#, a title and a hint */
async function fillQuiz(page: Page, rows: [string, string, string][]) {
  for (const [ii, [qnum, answer, hint]] of rows.entries()) {
    await page.getByRole('textbox', { name: 'Q#' }).nth(ii).fill(qnum)
    await page.getByRole('textbox', { name: 'Title' }).nth(ii).fill(answer)
    await page.getByRole('textbox', { name: 'Hint', exact: true }).nth(ii).fill(hint)
  }
  await page.getByLabel('Quiz name').click()
}

/** Chain the question at `rowIdx` to the one labelled `answer` */
async function chainTo(page: Page, rowIdx: number, answer: string) {
  await page.getByRole('combobox', { name: 'Chains to' }).nth(rowIdx).selectOption({ label: answer })
}

/** The titles, top to bottom, once the grid is on screen */
async function answersShown(page: Page): Promise<string[]> {
  const fields = page.getByRole('textbox', { name: 'Title' })
  await expect(fields.first()).toBeVisible()
  return fields.evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value))
}

/** The BUT NOT cell of the row at `rowIdx` */
function butnotCell(page: Page, rowIdx: number) {
  return page.locator('tbody tr').nth(rowIdx).locator('td[data-colname="BUT NOT"] > div')
}

/** The first four titles, top to bottom */
async function firstFourShown(page: Page): Promise<string[]> {
  const shown = await answersShown(page)
  return shown.slice(0, 4)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await fillQuiz(page, [
    ['3', 'cherry', 'BUT NOT the fruit-flavoured one'],
    ['1', 'apple',  'BUT NOT the company from Cupertino, founded in 1976'],
    ['4', 'damson', 'BUT NOT anything at all'],
    ['2', 'banana', 'BUT NOT the republic'],
  ])
  // A fresh question is titled from its generated label rather than left blank; the fifth
  // question needs to stay genuinely unnamed for the "(no title yet)" tests below.
  await page.getByRole('textbox', { name: 'Title' }).nth(4).fill('')
  await page.getByLabel('Quiz name').click()
})

test('the chain dropdown offers every other question, never this one', async ({ page }) => {
  const picker = page.getByRole('combobox', { name: 'Chains to' }).first()
  await expect(picker.locator('option')).toHaveText(['— pick —', 'apple', 'damson', 'banana', '(no title yet)'])
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
  await chainTo(page, 0, '(no title yet)')
  await expect(butnotCell(page, 0)).toHaveText('No hint entered yet')
})

test('sort by chain order reads the quiz in presentation order, and backward', async ({ page }) => {
  await chainTo(page, 1, 'banana')
  await chainTo(page, 3, 'cherry')
  await chainTo(page, 0, 'damson')

  await page.getByRole('button', { name: 'Sort by chain order' }).click()
  await expect.poll(async () => await firstFourShown(page)).toEqual(['apple', 'banana', 'cherry', 'damson'])

  await page.getByRole('button', { name: 'Sort by chain order' }).click()
  await expect.poll(async () => await firstFourShown(page)).toEqual(['damson', 'cherry', 'banana', 'apple'])
})

test('a chain order survives a reload', async ({ page }) => {
  await chainTo(page, 1, 'banana')
  await chainTo(page, 3, 'cherry')
  await page.getByRole('button', { name: 'Sort by chain order' }).click()
  await waitUntilSaved(page)
  const wasShown = await answersShown(page)
  await reloadOnceSaved(page)
  await expect.poll(async () => await answersShown(page)).toEqual(wasShown)
})
