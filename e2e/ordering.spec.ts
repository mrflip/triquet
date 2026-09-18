import { expect, test, type Page } from '@playwright/test'

/** Fill the first `pairs.length` questions with a Q# and a title */
async function fillRound(page: Page, pairs: [string, string][]) {
  for (const [ii, [qnum, answer]] of pairs.entries()) {
    await page.getByRole('textbox', { name: 'Q#' }).nth(ii).fill(qnum)
    await page.getByRole('textbox', { name: 'Title' }).nth(ii).fill(answer)
  }
  await page.getByLabel('Round name').click()
}

/** The titles, top to bottom, once the grid is on screen */
async function answersShown(page: Page): Promise<string[]> {
  const fields = page.getByRole('textbox', { name: 'Title' })
  await expect(fields.first()).toBeVisible()
  return fields.evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value))
}

/** The Q# values, top to bottom, once the grid is on screen */
async function qnumsShown(page: Page): Promise<string[]> {
  const fields = page.getByRole('textbox', { name: 'Q#' })
  await expect(fields.first()).toBeVisible()
  return fields.evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value))
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
})

test('a decimal Q# leaves the question where it is', async ({ page }) => {
  await fillRound(page, [['4', 'd'], ['3.1', 'c'], ['6', 'f'], ['1', 'a']])
  expect(await answersShown(page)).toEqual(['d', 'c', 'f', 'a', ''])
})

test('Renumber Q# tidies the numbers without moving a question', async ({ page }) => {
  await fillRound(page, [['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a']])
  await page.getByRole('button', { name: 'Renumber Q#' }).click()
  expect(await answersShown(page)).toEqual(['d', 'c', 'f', 'a', ''])
  expect(await qnumsShown(page)).toEqual(['3', '2', '4', '1', ''])
})

test('a sort survives a reload, with its header still bold', async ({ page }) => {
  await fillRound(page, [['3', 'cherry'], ['1', 'apple'], ['2', 'banana']])
  await page.getByRole('button', { name: 'Title' }).click()
  expect(await answersShown(page)).toEqual(['apple', 'banana', 'cherry', '', ''])

  await page.reload()

  expect(await answersShown(page)).toEqual(['apple', 'banana', 'cherry', '', ''])
  await expect(page.getByRole('columnheader', { name: 'Title' })).toHaveClass(/headSorted/)
  // The arrow marks only this session's sort, so it is gone after a reload.
  await expect(page.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('aria-sort', 'none')
})

test('clicking the same header again reverses it', async ({ page }) => {
  await fillRound(page, [['3', 'cherry'], ['1', 'apple'], ['2', 'banana']])
  await page.getByRole('button', { name: 'Title' }).click()
  await page.getByRole('button', { name: 'Title' }).click()
  // Questions with no title sink to the bottom in both directions.
  expect(await answersShown(page)).toEqual(['cherry', 'banana', 'apple', '', ''])
})

test('the grip column collapses once the round is out of Q# order', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Reorder/ }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Title' }).click()
  await expect(page.getByRole('button', { name: /^Reorder/ }).first()).toBeHidden()
  // The cell itself stays in the row, at zero width, so no later cell shifts left.
  const cells = await page.locator('tbody tr').first().locator('td').count()
  expect(cells).toBe(22)
})
