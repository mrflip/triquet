import { type Page } from '@playwright/test'
import { addWidgeting, closeManage, expect, fillRows, manageDialog, openManage, openPanel, test, waitUntilSaved } from './support'

/** The lines the Copy for Sheets box currently holds */
async function sheetsLines(page: Page): Promise<string[]> {
  const text = await sheetsText(page)
  return text.split('\n')
}

/** Whatever the Copy for Sheets box currently holds */
async function sheetsText(page: Page): Promise<string> {
  await openPanel(page, 'Export / Import')
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

test('a header row of column labels in alphabetical order, then a line per question in rank order', { tag: '@smoke' }, async ({ page }) => {
  await expect.poll(async () => {
    const shown = await sheetsLines(page)
    const lines = shown.map((line) => line.split('\t'))
    const header = lines[0] ?? []
    const clueingCol = header.indexOf('clueing')
    return { header, clueings: lines.slice(1, 4).map((cells) => cells[clueingCol]), widths: [...new Set(lines.map((cells) => cells.length))] }
  }).toEqual({ header: ['clueing', 'full_answer', 'notes', 'qnum', 'title'], clueings: ['first', 'second', 'third'], widths: [5] })
})

test('a column added to the quiz is in the export, under its label', async ({ page }) => {
  await addWidgeting(page, 'answer_reversed')
  await expect.poll(async () => {
    const text = await sheetsText(page)
    return text.split('\n', 1)[0]?.split('\t')
  }).toContain('answer_reversed')
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
  await expect.poll(() => sheetsText(page)).toContain('two<br/>lines')
  // The header and the five questions, and no more.
  await expect.poll(() => sheetsLines(page)).toHaveLength(6)
})

test("a column's formula and template shape its cells in the export, and collapsing it changes nothing there", async ({ page }) => {
  await openManage(page)
  const row = manageDialog(page).getByRole('group', { name: 'Column Clueing', exact: true })
  await row.getByRole('button', { name: 'Formula, template and readout of Clueing' }).click()
  await row.getByRole('combobox', { name: 'Formula' }).fill('$uppercase($)')
  await row.getByRole('textbox', { name: 'Template' }).fill('{{ value }}!')
  await row.getByRole('combobox', { name: 'Formula' }).click()
  // The switch shows what the quiz holds, so it turns once the change is kept.
  const collapsed = row.getByRole('switch', { name: 'Collapsed' })
  await collapsed.click()
  await expect(collapsed).toBeChecked()
  await closeManage(page)
  await expect.poll(async () => {
    const shown = await sheetsLines(page)
    const lines = shown.map((line) => line.split('\t'))
    const clueingCol = (lines[0] ?? []).indexOf('clueing')
    return lines.slice(1, 4).map((cells) => cells[clueingCol])
  }).toEqual(['FIRST!', 'SECOND!', 'THIRD!'])
})
