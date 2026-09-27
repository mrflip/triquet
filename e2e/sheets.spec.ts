import { type Page } from '@playwright/test'
import { closeManage, expect, fillRows, openManage, test, waitUntilSaved } from './support'

/** Whatever the Copy for Sheets box currently holds */
async function sheetsText(page: Page): Promise<string> {
  const box = page.getByRole('textbox', { name: 'Copy for Sheets' })
  await expect(box).toBeVisible()
  return box.inputValue()
}

test.beforeEach(async ({ page }) => {
  await fillRows(page, [
    { 'Q#': '3', Clueing: 'third' },
    { 'Q#': '1', Clueing: 'first' },
    { 'Q#': '2', Clueing: 'second' },
  ])
  await waitUntilSaved(page)
})

test('a header row of column labels in alphabetical order, then a line per question in rank order', async ({ page }) => {
  const text = await sheetsText(page)
  const lines = text.split('\n')
  const header = lines[0]?.split('\t') ?? []
  expect(header).toEqual(header.toSorted((aa, bb) => aa.localeCompare(bb)))
  expect(header).toContain('clueing_full')
  expect(header).toContain('guess')
  const clueingCol = header.indexOf('clueing')
  expect(lines.slice(1, 4).map((line) => line.split('\t')[clueingCol])).toEqual(['first', 'second', 'third'])
  expect(new Set(lines.map((line) => line.split('\t').length))).toEqual(new Set([header.length]))
})

test('a column added to the quiz is in the export, under its label', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New expressing…' }).click()
  const editor = page.getByRole('dialog', { name: 'New expressing' })
  await editor.getByRole('combobox', { name: 'Expression' }).click()
  await page.getByRole('option', { name: 'answer_reversed', exact: true }).click()
  await editor.getByRole('button', { name: 'Apply' }).click()
  await closeManage(page)
  const text = await sheetsText(page)
  expect(text.split('\n', 1)[0]?.split('\t')).toContain('answer_reversed')
})

test('the export is the same however the grid is sorted', async ({ page }) => {
  const wasText = await sheetsText(page)
  const qnumHeader = page.getByRole('button', { name: 'Q#', exact: true })
  await qnumHeader.click()
  await qnumHeader.click()
  await expect.poll(() => sheetsText(page)).toEqual(wasText)
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
