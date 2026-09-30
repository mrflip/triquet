import type { Page } from '@playwright/test'
import { actDangerously, closeManage, expect, grid, manageDialog, newQuiz, openManage, openQuiz, reloadOnceSaved, test, waitUntilSaved } from './support'

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

test('a hunt goes only with its last quiz', async ({ page }) => {
  await openManage(page)
  await expect(manageDialog(page).getByText('To delete a hunt, please delete its quizzes.')).toBeVisible()
  const zone = manageDialog(page).getByRole('region', { name: 'Danger Zone' })
  await expect(zone.getByRole('button')).toHaveText(['Delete this quiz and its hunt'])
  await closeManage(page)

  await newQuiz(page)
  await openManage(page)
  await expect(zone.getByRole('button')).toHaveText(['Delete this quiz'])
})

test('a smith renames the hunt, and the address stays as it is', async ({ page }) => {
  await waitUntilSaved(page)
  const address = page.url()
  await openManage(page)
  await manageDialog(page).getByRole('textbox', { name: 'Hunt name' }).fill('The Autumn Hunt')
  await manageDialog(page).getByRole('button', { name: 'Rename' }).click()
  await waitUntilSaved(page)
  await openManage(page)
  await expect(manageDialog(page).getByRole('textbox', { name: 'Hunt name' })).toHaveValue('The Autumn Hunt')
  expect(page.url()).toBe(address)
})

test('a smith relabels the hunt, and the address follows', async ({ page }) => {
  await waitUntilSaved(page)
  await openManage(page)
  await manageDialog(page).getByRole('textbox', { name: 'Hunt label' }).fill('Renamed Hunt')
  await manageDialog(page).getByRole('button', { name: 'Relabel' }).click()
  await expect(page).toHaveURL(/^[^?]*\/renamed_hunt\//)
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
})

test('a smith deletes the last quiz and its hunt, typing the hunt\'s label, and is taken to their hunts, without it', async ({ page }) => {
  await waitUntilSaved(page)
  await openManage(page)
  const huntLabel = manageDialog(page).getByRole('textbox', { name: 'Hunt label' })
  await expect(huntLabel).not.toHaveValue('')
  // Read once the field has settled above; it does not change while the dialog is open.
  const label = await huntLabel.inputValue()
  await actDangerously(page, 'Delete this quiz and its hunt', label)
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

test('the smith\'s note grows by paragraphs, pushing the grid down, then scrolls, and survives a reload', async ({ page }) => {
  const note = page.getByRole('textbox', { name: 'Smith\'s note', exact: true })
  // Where the grid starts on the page, wherever the page is scrolled to
  const gridTop = async () => await grid(page).evaluate((table) => table.getBoundingClientRect().top + window.scrollY)
  const emptyTop = await gridTop()
  await note.fill('Theme: princes.\n\nMeta: their initials, in chain order.\n\nTODO: fact-check Q7.')
  await expect.poll(gridTop).toBeGreaterThan(emptyTop)
  // Still growing: every line of three short paragraphs fits without a scrollbar
  await expect.poll(() => note.evaluate((area) => area.scrollHeight > area.clientHeight)).toBe(false)
  const grownTop = await gridTop()
  await note.fill(Array.from({ length: 40 }, (_ignored, lineIdx) => `line ${String(lineIdx)} of a long note`).join('\n'))
  await expect.poll(() => note.evaluate((area) => area.scrollHeight > area.clientHeight)).toBe(true)
  expect(await gridTop()).toBeGreaterThan(grownTop)
  await page.getByLabel('Quiz name').click()
  await reloadOnceSaved(page)
  await expect(note).toHaveValue(/^line 0 of a long note\n.*line 39 of a long note$/s)
})

test('a locked quiz\'s smith\'s note is readable but not editable', async ({ page }) => {
  const note = page.getByRole('textbox', { name: 'Smith\'s note', exact: true })
  await note.fill('Theme: princes.')
  await page.getByLabel('Quiz name').click()
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(note).toHaveAttribute('readonly', '')
  await expect(note).toHaveValue('Theme: princes.')
})
