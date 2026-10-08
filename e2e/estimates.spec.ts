import type { Page } from '@playwright/test'
import { cellOf, closeManage, expect, manageDialog, openManage, openPanel, reloadOnceSaved, test } from './support'

/** The list of categories of the pill numbered `nth` (from 1) in the Category Data cell of the row at `rowIdx` */
function categoryList(page: Page, rowIdx: number, nth: number) {
  return cellOf(page, rowIdx, 'Category Data').getByRole('combobox', { name: `Category Data, ${String(nth)}: category` })
}

/** The difficulty face of the pill numbered `nth` in the Category Data cell of the row at `rowIdx`: its name ends with the difficulty */
function difficultyFace(page: Page, rowIdx: number, nth: number) {
  return cellOf(page, rowIdx, 'Category Data').getByRole('button', { name: `Category Data, ${String(nth)}: difficulty` })
}

/** The "+" of the Category Data cell of the row at `rowIdx` */
function addButton(page: Page, rowIdx: number) {
  return cellOf(page, rowIdx, 'Category Data').getByRole('button', { name: 'Category Data: add a category' })
}

/** Open `list` and pick the choice named `choice` */
async function pick(page: Page, list: ReturnType<typeof categoryList>, choice: string) {
  await list.click()
  await page.getByRole('listbox').getByRole('option', { name: choice, exact: true }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
}

/** Through the columns editor, a column showing the part `part` of the widgeting `category_data`, by the formula picking it, and close the gear's dialog */
async function addPartColumn(page: Page, part: string, title: string) {
  await openManage(page)
  await page.getByRole('button', { name: '+ New column…' }).click()
  const editor = page.getByRole('dialog', { name: /^New column/ })
  await editor.getByRole('combobox', { name: 'Shows' }).click()
  await page.getByRole('option', { name: new RegExp(String.raw`^category_data, \$\.${part} `) }).click()
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toHaveCount(0)
  await expect(manageDialog(page).getByRole('group', { name: `Column ${title}`, exact: true })).toBeVisible()
  await closeManage(page)
}

test.use({ layout: { widgetings: ['category_data'] } })

test('a category estimate is pills, each picked from a list, kept as they are picked', { tag: '@smoke' }, async ({ page }) => {
  // A question nobody has placed shows one blank pill, and no "+" while it is blank.
  await expect(categoryList(page, 0, 1)).toHaveText('(blank)')
  await expect(difficultyFace(page, 0, 1)).toHaveAccessibleName('Category Data, 1: difficulty, medium')
  await expect(addButton(page, 0)).toHaveCount(0)

  // The difficulty is a face, which a click moves on round the three.
  const face = difficultyFace(page, 0, 1)
  await expect(face).toHaveText('🤔')
  await face.click()
  await expect(face).toHaveText('😈')
  await expect(face).toHaveAccessibleName('Category Data, 1: difficulty, hard')
  await face.click()
  await expect(face).toHaveText('🍰')
  await face.click()
  await expect(face).toHaveText('🤔')

  // The categories are listed alphabetically.
  await categoryList(page, 0, 1).click()
  await expect(page.getByRole('listbox').getByRole('option').nth(1)).toHaveText('Art')
  await expect(page.getByRole('listbox').getByRole('option').nth(2)).toHaveText('Biz & Tech')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)

  await pick(page, categoryList(page, 0, 1), 'Art')
  await addButton(page, 0).click()
  await expect(categoryList(page, 0, 2)).toHaveText('(blank)')
  await expect(addButton(page, 0)).toHaveCount(0)
  // The second pill cannot take what the first holds, and either can now be removed.
  await categoryList(page, 0, 2).click()
  const choices = page.getByRole('listbox').getByRole('option')
  await expect(choices.filter({ hasText: /^Art$/ })).toHaveCount(0)
  await expect(choices.last()).toHaveText('(remove)')
  await choices.filter({ hasText: /^TV$/ }).click()
  await difficultyFace(page, 0, 2).click()
  await expect(difficultyFace(page, 0, 2)).toHaveAccessibleName('Category Data, 2: difficulty, hard')

  await reloadOnceSaved(page)
  await expect(categoryList(page, 0, 1)).toHaveText('Art')
  await expect(categoryList(page, 0, 2)).toHaveText('TV')
  await expect(difficultyFace(page, 0, 2)).toHaveText('😈')
  await expect(categoryList(page, 1, 1)).toHaveText('(blank)')

  // "(remove)" takes a pill away; a lone pill made blank is no category in particular, at its difficulty.
  await pick(page, categoryList(page, 0, 1), '(remove)')
  await expect(categoryList(page, 0, 1)).toHaveText('TV')
  await expect(categoryList(page, 0, 2)).toHaveCount(0)
  await categoryList(page, 0, 1).click()
  await expect(page.getByRole('listbox').getByRole('option', { name: '(remove)' })).toHaveCount(0)
  await page.getByRole('listbox').getByRole('option', { name: '(blank)' }).click()
  await reloadOnceSaved(page)
  await expect(categoryList(page, 0, 1)).toHaveText('(blank)')
  await expect(difficultyFace(page, 0, 1)).toHaveAccessibleName('Category Data, 1: difficulty, hard')
})

test("columns can show Masie's chance and the personas' average, worked out from the pills", async ({ page }) => {
  await addPartColumn(page, 'masie', 'Masie')
  await addPartColumn(page, 'average', 'Average')
  // Nobody placed it: everyone is halfway, at medium.
  await expect(cellOf(page, 0, 'Masie')).toHaveText('53%')
  await pick(page, categoryList(page, 0, 1), 'Art')
  // From medium, round past hard to easy.
  await difficultyFace(page, 0, 1).click()
  await difficultyFace(page, 0, 1).click()
  await expect(difficultyFace(page, 0, 1)).toHaveText('🍰')
  await expect(cellOf(page, 0, 'Masie')).toHaveText('69%')
  await expect(cellOf(page, 0, 'Average')).toHaveText('76%')
})

test("the category spread counts the questions round the wheel, smoothed beside them, and its chart widens with the panel", async ({ page }) => {
  const panel = await openPanel(page, 'Category spread')
  await expect(panel).toContainText('0 questions placed, from the estimates under category_data.')
  await pick(page, categoryList(page, 0, 1), 'Art')
  await pick(page, categoryList(page, 1, 1), 'Art')
  await addButton(page, 1).click()
  await pick(page, categoryList(page, 1, 2), 'TV')
  await expect(panel).toContainText('2 questions placed')
  await expect(panel).toContainText(/draws? on no category in particular/)

  // Art has one question and half of another; smoothed, it keeps half of that, and lends Classical Music 16%.
  await panel.getByRole('button', { name: 'As a table' }).click()
  const table = panel.getByRole('table', { name: 'Category spread' })
  const cellsOf = (category: string) => table.locator(`tr[data-category="${category}"]`).getByRole('cell')
  const leadingCells = (category: string) => async () => {
    const texts = await cellsOf(category).allTextContents()
    return texts.slice(0, 4)
  }
  // Each category with a face for each of its questions, at medium as nobody changed them.
  await expect.poll(leadingCells('art')).toEqual(['9', 'Art🤔🤔', '1.5', '0.75'])
  await expect.poll(leadingCells('tv')).toEqual(['16', 'TV🤔', '0.5', '0.25'])
  await expect(cellsOf('art').nth(1).getByRole('img', { name: '2 medium' })).toBeVisible()
  await expect.poll(leadingCells('classical_music')).toEqual(['10', 'Classical Music', '0', '0.24'])
  // Each persona's chance at the questions drawing on a category, and the three's average; a dash where none does.
  await expect(cellsOf('art').nth(4)).toHaveText(/^\d+%$/)
  await expect(cellsOf('classical_music').nth(4)).toHaveText('—')
  await expect(cellsOf('classical_music').nth(7)).toHaveText('—')
  await expect(table.getByRole('row', { name: /^Whole quiz/ })).toContainText('%')

  // Sorted by portion, most first; again, least first, the categories no question draws on in the wheel's order.
  await table.getByRole('button', { name: 'Portion' }).click()
  await expect(table.getByRole('columnheader', { name: 'Portion' })).toHaveAttribute('aria-sort', 'descending')
  await expect(table.locator('tbody tr').first()).toHaveAttribute('data-category', 'art')
  await expect(table.locator('tbody tr').nth(1)).toHaveAttribute('data-category', 'tv')
  await table.getByRole('button', { name: 'Portion' }).click()
  await expect(table.locator('tbody tr').first()).toHaveAttribute('data-category', 'math_econ')
  // By category is by how many questions draw on it, most first.
  await table.getByRole('button', { name: 'Category' }).click()
  await expect(table.locator('tbody tr').first()).toHaveAttribute('data-category', 'art')
  await expect(table.locator('tbody tr').nth(1)).toHaveAttribute('data-category', 'tv')

  // The panel's arrow widens it to the whole row of panels, and the chart with it; again narrows it back.
  const arrow = panel.getByRole('button', { name: 'Widen this panel to the whole row' })
  await expect(arrow).toHaveAttribute('aria-pressed', 'false')
  const widthOf = async () => {
    const box = await panel.boundingBox()
    return box?.width ?? 0
  }
  const restingWidth = await widthOf()
  await arrow.click()
  await expect(arrow).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(widthOf).toBeGreaterThan(restingWidth)
  await arrow.click()
  await expect(arrow).toHaveAttribute('aria-pressed', 'false')
})
