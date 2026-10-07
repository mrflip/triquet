import type { Page } from '@playwright/test'
import * as Tsv from '../src/lib/tsv'
import { actDangerously, addColumns, addWidgetings, closeManage, expect, faceOf, grid, holderOf, huntOf, manageDialog, newQuiz, openManage, openPanel, openQuiz, quizPathOf, reloadOnceSaved, test, waitUntilSaved } from './support'

/** The label of the quiz `page` is at, from its address */
function quizLabelIn(page: Page): string {
  return quizPathOf(page).split('/').at(-1) ?? ''
}

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

test('a quiz with its title cleared shows as Untitled quiz in the switcher, which lists quizzes by label', async ({ page }) => {
  // The fixture's quiz shares its hunt's label; a new quiz is given a fresh one.
  const first = huntOf(page).hunt
  await newQuiz(page)
  const second = quizLabelIn(page)
  await page.getByLabel('Quiz name').fill('')
  await page.getByLabel('Quiz name').blur()
  const titled = new Map([[first, 'Quiz one'], [second, 'Untitled quiz']])
  await expect(page.getByLabel('Open quiz').locator('option')).toHaveText([first, second].toSorted(Tsv.byCode).map((label) => titled.get(label) ?? ''))
})

test('deleting is the gear\'s, asks for the quiz\'s label, and the neighbouring quiz opens', { tag: '@smoke' }, async ({ page }) => {
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

test('a dangerous act puts its button beside what it costs when the dialog has room, and below it when not', async ({ page }) => {
  await openManage(page)
  const zone = manageDialog(page).getByRole('region', { name: 'Danger Zone' })
  const cost = zone.getByText('Delete this quiz and its hunt', { exact: true }).first()
  const button = zone.getByRole('button', { name: 'Delete this quiz and its hunt' })
  const buttonIsBeside = async () => {
    const [costBox, buttonBox] = [await cost.boundingBox(), await button.boundingBox()]
    return (buttonBox?.x ?? 0) > (costBox?.x ?? 0) + (costBox?.width ?? 0)
  }
  expect(await buttonIsBeside()).toBe(true)
  // A window wide enough for MUI's sm breakpoint, which the zone once went by, with a dialog too narrow for both.
  await page.setViewportSize({ width: 620, height: 900 })
  await expect.poll(buttonIsBeside).toBe(false)
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
  // The rename has landed, above, so an address that followed it would have moved by now.
  await expect(page).toHaveURL(address)
})

test('a smith relabels the hunt, and the address follows', async ({ page }) => {
  await waitUntilSaved(page)
  await openManage(page)
  await manageDialog(page).getByRole('textbox', { name: 'Hunt label' }).fill('Renamed Hunt')
  await manageDialog(page).getByRole('button', { name: 'Relabel' }).click()
  await expect(page).toHaveURL(/\/~[a-z0-9_]+\/renamed_hunt\//)
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
  await addWidgetings(page, ['dumdum'])
  await addColumns(page, ['chains_to'])
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByText('Locked', { exact: true })).toBeVisible()

  const clueing = page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
  await expect(clueing).toHaveAttribute('readonly', '')
  // Read-only rather than disabled, so a frozen quiz can still be selected and copied out.
  await expect(clueing).toBeEnabled()
  await expect(page.getByRole('combobox', { name: 'Chains to' }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Renumber Q#' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ask Dumdum' }).first()).toBeDisabled()

  // Exporting still works.
  await openPanel(page, 'Export / Import')
  await expect(page.getByRole('textbox', { name: 'Copy for Sheets' })).toHaveValue(/Which region\?/)

  // The gear still opens a column to read, with nothing to apply and no way to remove it.
  await openManage(page)
  await manageDialog(page).getByRole('button', { name: /^Edit column / }).first().click()
  const column = page.getByRole('dialog', { name: /^Column: / })
  await expect(column.getByRole('button', { name: 'Apply' })).toBeDisabled()
  // Drawn in the same render as the Apply button beside it.
  await expect(column.getByRole('button', { name: 'Remove column' })).toHaveCount(0)
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

test('the smith\'s note starts folded to its first line, and unfolds by its triangle or by clicking into it, but folds only by its triangle', async ({ page }) => {
  const note = page.getByRole('textbox', { name: 'Smith\'s note', exact: true })
  const fold = page.getByRole('button', { name: 'Show the smith\'s note in full' })
  const noteHt = async () => await note.evaluate((area) => area.clientHeight)
  const face = faceOf(holderOf(note))
  const faceOverflow = async () => await face.evaluate((div) => getComputedStyle(div).overflowY)

  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect(fold).toHaveAttribute('aria-controls', await note.getAttribute('id') ?? 'no id')
  const foldedHt = await noteHt()
  // Typing into it unfolds it, and it stays unfolded once the author moves on
  await note.fill('Theme: princes.\n\nMeta: their initials, in chain order.\n\nTODO: fact-check Q7.')
  await expect(fold).toHaveAttribute('aria-expanded', 'true')
  await page.getByLabel('Quiz name').click()
  await expect(fold).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(noteHt).toBeGreaterThan(foldedHt)
  await expect.poll(faceOverflow).toBe('auto')

  // Folded by its triangle: one line again, its rendered face clipped rather than scrolling
  await fold.click()
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(noteHt).toBe(foldedHt)
  await expect.poll(faceOverflow).toBe('hidden')
  await fold.click()
  await expect(fold).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(noteHt).toBeGreaterThan(foldedHt)

  // A fresh visit starts folded, and a click on the rendered note unfolds it to be typed into
  await reloadOnceSaved(page)
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(noteHt).toBe(foldedHt)
  await face.click()
  await expect(note).toBeFocused()
  await expect(fold).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(noteHt).toBeGreaterThan(foldedHt)
})

test('a locked quiz\'s smith\'s note is readable but not editable', async ({ page }) => {
  const note = page.getByRole('textbox', { name: 'Smith\'s note', exact: true })
  await note.fill('Theme: princes.')
  await page.getByLabel('Quiz name').click()
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(note).toHaveAttribute('readonly', '')
  await expect(note).toHaveValue('Theme: princes.')
})
