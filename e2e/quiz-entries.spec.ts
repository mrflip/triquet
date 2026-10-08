import type { Page } from '@playwright/test'
import { addWidgeting, cellOf, closeManage, expect, faceOf, freshWidgetLabel, manageDialog, openManage, openPanel, reloadOnceSaved, stepBy, test } from './support'

/**
 * Write a new text entry widget into the library, labelled `widget_label`, through the quiz
 * widgetings' own door, and put it to work once for the whole quiz under `label`; close the gear's
 * dialog.
 */
async function addQuizEntry(page: Page, widget_label: string, label: string) {
  await openManage(page)
  await page.getByRole('button', { name: '+ New quiz widgeting…' }).click()
  const editor = page.getByRole('dialog', { name: 'New quiz widgeting' })
  await editor.getByRole('textbox', { name: 'Widgeting label' }).fill(label)
  await editor.getByRole('button', { name: 'New widget…' }).click()
  const maker = page.getByRole('dialog', { name: /^New widget(?!ing)/ })
  await maker.getByRole('combobox', { name: 'Formulary' }).click()
  await page.getByRole('option', { name: /^An entry/ }).click()
  await maker.getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await maker.getByRole('combobox', { name: 'Entry kind' }).click()
  await page.getByRole('option', { name: /^Text/ }).click()
  await maker.getByRole('button', { name: 'Apply' }).click()
  await expect(maker).toHaveCount(0)
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toHaveCount(0)
  await closeManage(page)
}

/** The Quiz entries panel, unfolded */
async function entriesPanel(page: Page) {
  return await openPanel(page, 'Quiz entries')
}

/** Leave whatever box has focus, committing it, as a person clicking elsewhere does */
async function leaveBox(page: Page) {
  await page.getByLabel('Quiz name').click()
}

/** The last two rows of the gear's one list of widgetings, both tiers */
async function lastTwoListed(page: Page): Promise<(string | null)[]> {
  const labels = await manageDialog(page).getByRole('list', { name: 'Widgetings' }).getByRole('group').evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label')))
  return labels.slice(-2)
}

test('a quiz entry is typed into the Quiz entries panel, kept, and filled into a template as quiz.<label>', { tag: '@smoke' }, async ({ page }) => {
  await addQuizEntry(page, freshWidgetLabel('names'), 'playtesters')
  // It runs once for the whole quiz, so it brings no column to the grid.
  await expect(cellOf(page, 0, 'Playtesters')).toHaveCount(0)
  const entries = await entriesPanel(page)
  const box = entries.getByRole('textbox', { name: 'Playtesters' })
  await box.fill('Ada and Grace')
  await leaveBox(page)
  await reloadOnceSaved(page)
  await entriesPanel(page)
  await expect(box).toHaveValue('Ada and Grace')

  await openManage(page)
  const nominated = manageDialog(page).getByRole('group', { name: 'Templated sources' }).getByRole('checkbox', { name: 'Clueing' })
  await nominated.click()
  await expect(nominated).toBeChecked()
  await closeManage(page)
  const clueing = cellOf(page, 0, 'Clueing').getByRole('textbox', { name: 'Clueing', exact: true })
  await clueing.fill('Thanks to {{quiz.playtesters}}')
  await leaveBox(page)
  await expect(faceOf(cellOf(page, 0, 'Clueing'))).toHaveText('Thanks to Ada and Grace')
})

test('quiz and question widgetings share one run order, marked by tier, and one moved among the others stays there', async ({ page }) => {
  await addWidgeting(page, 'hint_full')
  await addQuizEntry(page, freshWidgetLabel('names'), 'playtesters')
  await openManage(page)
  // A new widgeting goes in last, whichever its tier.
  await expect.poll(() => lastTwoListed(page)).toEqual(['Widgeting hint_full', 'Widgeting playtesters'])
  await expect(manageDialog(page).getByRole('group', { name: 'Widgeting playtesters' })).toContainText('whole quiz')
  await expect(manageDialog(page).getByRole('group', { name: 'Widgeting hint_full' })).toContainText('each question')
  await stepBy(manageDialog(page).getByRole('button', { name: 'Reorder playtesters' }), -1)
  await expect.poll(() => lastTwoListed(page)).toEqual(['Widgeting playtesters', 'Widgeting hint_full'])
  await closeManage(page)
  await reloadOnceSaved(page)
  await openManage(page)
  await expect.poll(() => lastTwoListed(page)).toEqual(['Widgeting playtesters', 'Widgeting hint_full'])
  await closeManage(page)
})
