import { expect, test, type Page } from '@playwright/test'

/** Whatever the Copy for Sheets box currently holds */
async function sheetsText(page: Page): Promise<string> {
  const box = page.getByRole('textbox', { name: 'Copy for Sheets' })
  await expect(box).toBeVisible()
  return box.inputValue()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.context().clearCookies()
  await page.goto('/')
  for (const [ii, [qnum, clueing]] of ([['3', 'third'], ['1', 'first'], ['2', 'second']] as const).entries()) {
    await page.getByRole('textbox', { name: 'Q#' }).nth(ii).fill(qnum)
    await page.getByRole('textbox', { name: 'Clueing', exact: true }).nth(ii).fill(clueing)
  }
  await page.getByLabel('Quiz name').click()
})

test('a header row, then every column of the grid, in rank order', async ({ page }) => {
  const text = await sheetsText(page)
  const lines = text.split('\n')
  const header = lines[0]?.split('\t') ?? []
  expect(header.slice(0, 4)).toEqual(['title', 'clueing', 'hint', 'chains_to'])
  expect(header).toContain('clueing_full')
  expect(header).toContain('dumdum')
  expect(lines.slice(1, 4).map((line) => line.split('\t', 2)[1])).toEqual(['first', 'second', 'third'])
  expect(new Set(lines.map((line) => line.split('\t').length))).toEqual(new Set([header.length]))
})

test('a column added to the quiz is in the export, under its label', async ({ page }) => {
  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await page.getByRole('button', { name: '+ New column…' }).click()
  const editor = page.getByRole('dialog', { name: 'New column' })
  await editor.getByRole('combobox', { name: 'Expression' }).click()
  await page.getByRole('option', { name: 'answer_reversed', exact: true }).click()
  await editor.getByRole('button', { name: 'Apply' }).click()
  await page.getByRole('button', { name: 'Cancel' }).first().click()
  const text = await sheetsText(page)
  expect(text.split('\n', 1)[0]?.split('\t')).toContain('answer_reversed')
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
  expect(text.split('\n')).toHaveLength(6)
})

test('clicking the box selects the lot', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Copy for Sheets' }).click()
  const selected = await page.getByRole('textbox', { name: 'Copy for Sheets' }).evaluate(
    (node) => (node as HTMLTextAreaElement).selectionEnd - (node as HTMLTextAreaElement).selectionStart,
  )
  expect(selected).toBeGreaterThan(0)
})
