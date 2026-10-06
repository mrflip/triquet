import type { Page } from '@playwright/test'
import { cellOf, closeManage, expect, exportedQuizzes, freshWidgetLabel, newWidgetingDialog, openManage, preparedExport, reloadOnceSaved, showTab, test, waitUntilSaved } from './support'

/** The widget editor writing a new widget, open over the widgeting editor that opened it */
function newWidgetDialog(page: Page) {
  return page.getByRole('dialog', { name: /^New widget(?!ing)/ })
}

/**
 * Write a new entry widget into the library, labelled `widget_label` and taking the kind whose
 * words match `kind`, through the widgeting editor's door, and put it to work in the open quiz
 * under `label`; close the gear's dialog.
 */
async function addNewEntry(page: Page, widget_label: string, kind: RegExp, label: string) {
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  const editor = newWidgetingDialog(page)
  await editor.getByRole('textbox', { name: 'Widgeting label' }).fill(label)
  await editor.getByRole('button', { name: 'New widget…' }).click()
  const maker = newWidgetDialog(page)
  await maker.getByRole('combobox', { name: 'Formulary' }).click()
  await page.getByRole('option', { name: /^An entry/ }).click()
  await maker.getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await maker.getByRole('combobox', { name: 'Entry kind' }).click()
  await page.getByRole('option', { name: kind }).click()
  // An entry has nothing to work out: no formula, and nothing to preview.
  await expect(maker.getByRole('textbox', { name: 'Formula', exact: true })).toHaveCount(0)
  await maker.getByRole('button', { name: 'Apply' }).click()
  await expect(maker).toHaveCount(0)
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toHaveCount(0)
  await closeManage(page)
}

/** The box of the entry column `colname` in the row at `rowIdx` */
function entryBox(page: Page, rowIdx: number, colname: string) {
  return cellOf(page, rowIdx, colname).getByRole('textbox', { name: colname, exact: true })
}

/** Leave whatever box has focus, committing it, as a person clicking elsewhere does */
async function leaveBox(page: Page) {
  await page.getByLabel('Quiz name').click()
}

test('what is typed into an entry is kept, and emptying it empties the cell', async ({ page }) => {
  await addNewEntry(page, freshWidgetLabel('remark'), /^Text/, 'remark')
  await entryBox(page, 0, 'Remark').fill('Ask *Flip*.')
  await leaveBox(page)
  await reloadOnceSaved(page)
  await expect(entryBox(page, 0, 'Remark')).toHaveValue('Ask *Flip*.')
  await expect(entryBox(page, 1, 'Remark')).toHaveValue('')

  await entryBox(page, 0, 'Remark').fill('')
  await leaveBox(page)
  await reloadOnceSaved(page)
  await expect(entryBox(page, 0, 'Remark')).toHaveValue('')
})

test('a label entry is tidied into a label as its box is left', async ({ page }) => {
  await addNewEntry(page, freshWidgetLabel('nickname'), /^A label/, 'nickname')
  await entryBox(page, 0, 'Nickname').fill('Quiet Otter!')
  await leaveBox(page)
  await expect(entryBox(page, 0, 'Nickname')).toHaveValue('quiet_otter')
  await reloadOnceSaved(page)
  await expect(entryBox(page, 0, 'Nickname')).toHaveValue('quiet_otter')
})

test('the Widgets panel counts what has been typed, and says what the entry takes', async ({ page }) => {
  await addNewEntry(page, freshWidgetLabel('points'), /^A number/, 'points')
  await entryBox(page, 0, 'Points').fill('-2.5')
  await leaveBox(page)
  const panel = page.getByRole('region', { name: 'Widgets' })
  await expect(panel.getByRole('group', { name: 'Cells of points' })).toHaveText(/^1 current • \d+ blank$/)
  await panel.getByRole('button', { name: /^points/ }).click()
  await expect(panel).toContainText('Typed into its cells, one value per question. A number.')
  await expect(panel.getByRole('button', { name: 'Copy a prompt for a chatbot' })).toHaveCount(0)
})

test('an entry rides the export, and an import puts it back', { tag: '@smoke' }, async ({ page }) => {
  await addNewEntry(page, freshWidgetLabel('points'), /^A number/, 'points')
  await entryBox(page, 0, 'Points').fill('-2.5')
  await leaveBox(page)
  const exported = await preparedExport(page)
  const question = exportedQuizzes(exported)[0]?.questions[0]
  expect(question?.points).toEqual({ status: 'ok', value: -2.5 })

  await entryBox(page, 0, 'Points').fill('7')
  await leaveBox(page)
  await waitUntilSaved(page)
  const section = await showTab(page, 'Import')
  await section.getByRole('textbox', { name: 'Import' }).fill(exported)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(entryBox(page, 0, 'Points')).toHaveValue('-2.5')
  await reloadOnceSaved(page)
  await expect(entryBox(page, 0, 'Points')).toHaveValue('-2.5')
})
