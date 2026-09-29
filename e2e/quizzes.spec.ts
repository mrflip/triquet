import type { Page } from '@playwright/test'
import { actDangerously, expect, manageDialog, newQuiz, openManage, openQuiz, reloadOnceSaved, test, waitUntilSaved } from './support'

/** The label the open quiz answers to, as the gear's dialog has it; the dialog must be open */
async function quizLabelOf(page: Page): Promise<string> {
  const field = manageDialog(page).getByRole('textbox', { name: 'Label', exact: true })
  await expect(field).not.toHaveValue('')
  // Read once the field has settled above; it does not change while the dialog is open.
  return await field.inputValue()
}

test.beforeEach(async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region?')
  await page.getByLabel('Quiz name').click()
})

test('each quiz is wholly independent', async ({ page }) => {
  await newQuiz(page)
  // A fresh quiz is titled from its own generated label, distinct from any other quiz's.
  await expect(page.getByLabel('Quiz name')).not.toHaveValue('Quiz one')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('')

  await page.getByLabel('Quiz name').fill('Quiz two')
  await openQuiz(page, 'Quiz one')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
})

test('a quiz with its title cleared shows as Untitled quiz in the switcher', async ({ page }) => {
  await newQuiz(page)
  await page.getByLabel('Quiz name').fill('')
  await page.getByLabel('Quiz name').blur()
  await expect(page.getByLabel('Open quiz').locator('option')).toHaveText(['Quiz one', 'Untitled quiz'])
})

test('deleting is the gear\'s, asks for the quiz\'s label, and the neighbouring quiz opens', async ({ page }) => {
  await newQuiz(page)
  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Quiz name').blur()
  await expect(page.getByRole('button', { name: /Delete/ })).toHaveCount(0)

  await openManage(page)
  const label = await quizLabelOf(page)
  await manageDialog(page).getByRole('button', { name: 'Delete this quiz' }).click()
  const confirming = page.getByRole('dialog', { name: 'Delete this quiz?' })
  await confirming.getByRole('textbox').fill('not the label')
  await expect(confirming.getByRole('button', { name: 'Delete this quiz' })).toBeDisabled()
  await confirming.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz two')

  await actDangerously(page, 'Delete this quiz', label)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  await expect(page.getByLabel('Open quiz').locator('option')).toHaveText(['Quiz one'])
})

test('the last remaining quiz cannot be deleted', async ({ page }) => {
  await openManage(page)
  const zone = manageDialog(page).getByRole('region', { name: 'Danger Zone' })
  await expect(zone.getByRole('button', { name: 'Delete this quiz' })).toBeDisabled()
  await expect(zone).toContainText("A realm's last quiz can't be deleted")
})

test('a smith relabels the hunt, and the address follows', async ({ page }) => {
  await waitUntilSaved(page)
  await openManage(page)
  await manageDialog(page).getByRole('textbox', { name: 'Hunt label' }).fill('Renamed Hunt')
  await manageDialog(page).getByRole('button', { name: 'Rename' }).click()
  await expect(page).toHaveURL(/^[^?]*\/renamed_hunt\//)
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
})

test('a smith deletes the hunt, typing its label, and is taken to their hunts, without it', async ({ page }) => {
  await waitUntilSaved(page)
  await openManage(page)
  const huntLabel = manageDialog(page).getByRole('textbox', { name: 'Hunt label' })
  await expect(huntLabel).not.toHaveValue('')
  // Read once the field has settled above; it does not change while the dialog is open.
  const label = await huntLabel.inputValue()
  await actDangerously(page, 'Delete this hunt', label)
  await expect(page).toHaveURL(/\/my\/hunts$/)
  await expect(page.getByText(label)).toHaveCount(0)
})

test('a locked quiz accepts no edits, but stays readable and copyable', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByText('Locked', { exact: true })).toBeVisible()

  const clueing = page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
  await expect(clueing).toHaveAttribute('readonly', '')
  // Read-only rather than disabled, so a frozen quiz can still be selected and copied out.
  await expect(clueing).toBeEnabled()
  await expect(page.getByRole('combobox', { name: 'Chains to' }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Renumber Q#' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Recalculate all ishes' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ask Quick-model guess' }).first()).toBeDisabled()

  // Exporting still works.
  await expect(page.getByRole('textbox', { name: 'Copy for Sheets' })).toHaveValue(/Which region\?/)
})

test('the lock holds even when an edit is forced past the disabled controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  // Forced only once the lock has landed, or the page would put the attribute straight back.
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveAttribute('readonly', '')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().evaluate((node) => {
    const field = node as HTMLTextAreaElement
    field.removeAttribute('readonly')
  })
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Sneaked in')
  await page.getByLabel('Quiz name').click()
  await reloadOnceSaved(page)
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
})

test('unlocking finds the quiz exactly as it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await page.getByRole('button', { name: 'Unlock quiz' }).click()
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).not.toHaveAttribute('readonly', '')
})

test('the switcher marks a locked quiz', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByLabel('Open quiz').locator('option')).toHaveText(['🔒 Quiz one'])
})
