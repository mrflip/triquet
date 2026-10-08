import type { Locator, Page } from '@playwright/test'
import { addWidgeting, cellOf, closeManage, expect, faceOf, freshWidgetLabel, manageDialog, openManage, openPanel, pickWidget, reloadOnceSaved, stepBy, test } from './support'

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

/**
 * Through the gear's dialog, which must be open: the library's widget `widget_label` put to work
 * once for the whole quiz under `label`, its settings said by `settle` when given.
 */
async function quizWidgetingAdded(page: Page, widget_label: string, label: string, settle?: (settings: Locator) => Promise<void>) {
  await page.getByRole('button', { name: '+ New quiz widgeting…' }).click()
  const editor = page.getByRole('dialog', { name: 'New quiz widgeting' })
  await pickWidget(page, editor, widget_label)
  await editor.getByRole('textbox', { name: 'Widgeting label' }).fill(label)
  if (settle) { await settle(editor.getByRole('group', { name: 'Settings' })) }
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toHaveCount(0)
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
  const nominated = manageDialog(page).getByRole('group', { name: 'Templateable sources' }).getByRole('checkbox', { name: 'Clueing' })
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
  await openManage(page)
  await quizWidgetingAdded(page, 'clueing_full', 'quiz_sum')
  // A new widgeting goes in last, whichever its tier.
  await expect.poll(() => lastTwoListed(page)).toEqual(['Widgeting hint_full', 'Widgeting quiz_sum'])
  await expect(manageDialog(page).getByRole('group', { name: 'Widgeting quiz_sum' })).toContainText('whole quiz')
  await expect(manageDialog(page).getByRole('group', { name: 'Widgeting hint_full' })).toContainText('each question')
  await stepBy(manageDialog(page).getByRole('button', { name: 'Reorder quiz_sum' }), -1)
  await expect.poll(() => lastTwoListed(page)).toEqual(['Widgeting quiz_sum', 'Widgeting hint_full'])
  await closeManage(page)
  await reloadOnceSaved(page)
  await openManage(page)
  await expect.poll(() => lastTwoListed(page)).toEqual(['Widgeting quiz_sum', 'Widgeting hint_full'])
  await closeManage(page)
})

test('a quiz entry stands at the head of the run order, among the entries, and is not dragged', async ({ page }) => {
  await addWidgeting(page, 'hint_full')
  await addQuizEntry(page, freshWidgetLabel('names'), 'playtesters')
  await openManage(page)
  const entries = manageDialog(page).getByRole('list', { name: 'Entries' })
  await expect(entries.getByRole('group', { name: 'Widgeting playtesters' })).toContainText('whole quiz')
  await expect(manageDialog(page).getByRole('button', { name: 'Reorder playtesters' })).toHaveCount(0)
  await closeManage(page)
})

test('a yes or no and a choice for the whole quiz are a checkbox and a select in the Quiz entries panel, kept as they are changed', async ({ page }) => {
  await openManage(page)
  await quizWidgetingAdded(page, 'yes_no', 'tested')
  await quizWidgetingAdded(page, 'choice', 'stage', async (settings) => {
    const options = settings.getByRole('textbox', { name: 'Options, one per line' })
    await options.fill('draft\nfinal')
    await options.blur()
  })
  await closeManage(page)
  const entries = await entriesPanel(page)
  await entries.getByRole('checkbox', { name: 'Tested' }).click()
  await entries.getByRole('combobox', { name: 'Stage' }).selectOption('final')
  await reloadOnceSaved(page)
  await entriesPanel(page)
  await expect(entries.getByRole('checkbox', { name: 'Tested' })).toBeChecked()
  await expect(entries.getByRole('combobox', { name: 'Stage' })).toHaveValue('final')
})
