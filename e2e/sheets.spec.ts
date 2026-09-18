import { expect, test, type Page } from '@playwright/test'

/** Whatever the Copy for Sheets box currently holds */
async function sheetsText(page: Page): Promise<string> {
  const box = page.getByRole('textbox', { name: 'Copy for Sheets' })
  await expect(box).toBeVisible()
  return box.inputValue()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  for (const [ii, [qnum, clueing]] of ([['3', 'third'], ['1', 'first'], ['2', 'second']] as const).entries()) {
    await page.getByRole('textbox', { name: 'Q#' }).nth(ii).fill(qnum)
    await page.getByRole('textbox', { name: 'Clueing', exact: true }).nth(ii).fill(clueing)
  }
  await page.getByLabel('Quiz name').click()
})

test('seven clean columns, in rank order', async ({ page }) => {
  const text = await sheetsText(page)
  const lines = text.split('\n')
  expect(lines[0]?.split('\t')).toHaveLength(7)
  expect(lines.slice(0, 3).map((line) => line.split('\t', 2)[1])).toEqual(['first', 'second', 'third'])
})

test('the export is the same however the grid is sorted', async ({ page }) => {
  const wasText = await sheetsText(page)
  const qnumHeader = page.getByRole('button', { name: 'Q#', exact: true })
  await qnumHeader.click()
  await qnumHeader.click()
  expect(await sheetsText(page)).toEqual(wasText)
})

test('a line break in a field never starts a new spreadsheet row', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Notes' }).first().fill('two\nlines')
  await page.getByLabel('Quiz name').click()
  const text = await sheetsText(page)
  expect(text).toContain('two<br/>lines')
  expect(text.split('\n')).toHaveLength(5)
})

test('clicking the box selects the lot', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Copy for Sheets' }).click()
  const selected = await page.getByRole('textbox', { name: 'Copy for Sheets' }).evaluate(
    (node) => (node as HTMLTextAreaElement).selectionEnd - (node as HTMLTextAreaElement).selectionStart,
  )
  expect(selected).toBeGreaterThan(0)
})
