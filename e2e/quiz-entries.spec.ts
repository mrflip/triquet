import type { Locator, Page } from '@playwright/test'
import { addWidgeting, cellOf, closeManage, closePanel, expect, faceOf, freshWidgetLabel, manageDialog, openManage, openPanel, pickWidget, relabelWidgeting, reloadOnceSaved, stepBy, test, widgetingPanel, widgetsPanel } from './support'

/**
 * Write a new text entry widget into the library, labelled `widget_label`, through the door
 * beside the Widgets panel's catalogue of *+ New quiz widgeting…*, which puts it to work once for
 * the whole quiz as it is written; relabel it `label`, and fold the Widgets panel again.
 */
async function addQuizEntry(page: Page, widget_label: string, label: string) {
  const panel = await openPanel(page, 'Widgets')
  await panel.getByRole('button', { name: '+ New quiz widgeting…' }).click()
  await panel.getByRole('button', { name: 'New widget…' }).click()
  const maker = page.getByRole('dialog', { name: /^New widget(?!ing)/ })
  await maker.getByRole('combobox', { name: 'Formulary' }).click()
  await page.getByRole('option', { name: /^An entry/ }).click()
  await maker.getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await maker.getByRole('combobox', { name: 'Entry kind' }).click()
  await page.getByRole('option', { name: /^Text/ }).click()
  await maker.getByRole('button', { name: 'Apply' }).click()
  await expect(maker).toHaveCount(0)
  await relabelWidgeting(page, widget_label, label)
  await closePanel(page, 'Widgets')
}

/**
 * Through the Widgets panel, which must be open: the library's widget `widget_label` put to work
 * once for the whole quiz as it is picked, relabelled `label`, its settings said in its folded line
 * by `settle` when given.
 */
async function quizWidgetingAdded(page: Page, widget_label: string, label: string, settle?: (settings: Locator) => Promise<void>) {
  await widgetsPanel(page).getByRole('button', { name: '+ New quiz widgeting…' }).click()
  await pickWidget(page, widgetsPanel(page).getByRole('combobox', { name: 'A new widgeting, for the whole quiz' }), widget_label)
  await relabelWidgeting(page, widget_label, label)
  if (settle) { await settle(widgetingPanel(page, label).getByRole('group', { name: `Settings of ${label}` })) }
}

/** The Quiz entries panel, unfolded */
async function entriesPanel(page: Page) {
  return await openPanel(page, 'Quiz entries')
}

/** Leave whatever box has focus, committing it, as a person clicking elsewhere does */
async function leaveBox(page: Page) {
  await page.getByLabel('Quiz name').click()
}

/** The last two rows of one list of widgetings, both tiers, in `place`: the gear's run order or the Widgets panel's */
async function lastTwoListed(place: Locator): Promise<(string | null)[]> {
  const labels = await place.getByRole('list', { name: 'Widgetings' }).getByRole('group', { name: /^Widgeting / }).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label')))
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
  const panel = await openPanel(page, 'Widgets')
  await quizWidgetingAdded(page, 'clueing_full', 'quiz_sum')
  // A new widgeting goes in last, whichever its tier.
  await expect.poll(() => lastTwoListed(panel)).toEqual(['Widgeting hint_full', 'Widgeting quiz_sum'])
  await expect(widgetingPanel(page, 'quiz_sum')).toContainText('whole quiz')
  await expect(widgetingPanel(page, 'hint_full')).toContainText('each question')
  await stepBy(panel.getByRole('button', { name: 'Reorder quiz_sum' }), -1)
  await expect.poll(() => lastTwoListed(panel)).toEqual(['Widgeting quiz_sum', 'Widgeting hint_full'])
  await reloadOnceSaved(page)
  await openManage(page)
  await expect.poll(() => lastTwoListed(manageDialog(page))).toEqual(['Widgeting quiz_sum', 'Widgeting hint_full'])
  await expect(manageDialog(page).getByRole('group', { name: 'Widgeting quiz_sum' })).toContainText('whole quiz')
  await closeManage(page)
})

test('a quiz entry stands at the head of the run order, among the entries, and is not dragged', async ({ page }) => {
  await addWidgeting(page, 'hint_full')
  await addQuizEntry(page, freshWidgetLabel('names'), 'playtesters')
  const panel = await openPanel(page, 'Widgets')
  const entries = panel.getByRole('list', { name: 'Entries' })
  await expect(entries.getByRole('group', { name: 'Widgeting playtesters' })).toContainText('whole quiz')
  await expect(panel.getByRole('button', { name: 'Reorder playtesters' })).toHaveCount(0)
})

test('a yes or no and a choice for the whole quiz are a checkbox and a select in the Quiz entries panel, kept as they are changed', async ({ page }) => {
  await openPanel(page, 'Widgets')
  await quizWidgetingAdded(page, 'yes_no', 'tested')
  await quizWidgetingAdded(page, 'choice', 'stage', async (settings) => {
    const options = settings.getByRole('textbox', { name: 'Options, one per line' })
    await options.fill('draft\nfinal')
    await options.blur()
  })
  const entries = await entriesPanel(page)
  await entries.getByRole('checkbox', { name: 'Tested' }).click()
  await entries.getByRole('combobox', { name: 'Stage' }).selectOption('final')
  await reloadOnceSaved(page)
  await entriesPanel(page)
  await expect(entries.getByRole('checkbox', { name: 'Tested' })).toBeChecked()
  await expect(entries.getByRole('combobox', { name: 'Stage' })).toHaveValue('final')
})
