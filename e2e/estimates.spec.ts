import type { Page } from '@playwright/test'
import { addWidgeting, cellOf, closeManage, expect, manageDialog, openManage, reloadOnceSaved, test } from './support'

/** The list of categories of the pill numbered `nth` (from 1) in the Categories cell of the row at `rowIdx` */
function categoryList(page: Page, rowIdx: number, nth: number) {
  return cellOf(page, rowIdx, 'Categories').getByRole('combobox', { name: `Categories, ${String(nth)}: category` })
}

/** The difficulty face of the pill numbered `nth` in the Categories cell of the row at `rowIdx`: its name ends with the difficulty */
function difficultyFace(page: Page, rowIdx: number, nth: number) {
  return cellOf(page, rowIdx, 'Categories').getByRole('button', { name: `Categories, ${String(nth)}: difficulty` })
}

/** The "+" of the Categories cell of the row at `rowIdx` */
function addButton(page: Page, rowIdx: number) {
  return cellOf(page, rowIdx, 'Categories').getByRole('button', { name: 'Categories: add a category' })
}

/** Open `list` and pick the choice named `choice` */
async function pick(page: Page, list: ReturnType<typeof categoryList>, choice: string) {
  await list.click()
  await page.getByRole('listbox').getByRole('option', { name: choice, exact: true }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
}

/** Through the columns editor, a column showing the part `part` of the widgeting `categories`, and close the gear's dialog */
async function addPartColumn(page: Page, part: string, title: string) {
  await openManage(page)
  await page.getByRole('button', { name: '+ New column…' }).click()
  const editor = page.getByRole('dialog', { name: /^New column/ })
  await editor.getByRole('combobox', { name: 'Shows' }).click()
  await page.getByRole('option', { name: new RegExp(String.raw`^categories\.${part} `) }).click()
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toHaveCount(0)
  await expect(manageDialog(page).getByRole('group', { name: `Column ${title}`, exact: true })).toBeVisible()
  await closeManage(page)
}

test.beforeEach(async ({ page }) => {
  await addWidgeting(page, 'categories')
})

test('a category estimate is pills, each picked from a list, kept as they are picked', async ({ page }) => {
  // A question nobody has placed shows one blank pill, and no "+" while it is blank.
  await expect(categoryList(page, 0, 1)).toHaveText('(blank)')
  await expect(difficultyFace(page, 0, 1)).toHaveAccessibleName('Categories, 1: difficulty, medium')
  await expect(addButton(page, 0)).toHaveCount(0)

  // The difficulty is a face, which a click moves on round the three.
  const face = difficultyFace(page, 0, 1)
  await expect(face).toHaveText('🤔')
  await face.click()
  await expect(face).toHaveText('😈')
  await expect(face).toHaveAccessibleName('Categories, 1: difficulty, hard')
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
  await expect(difficultyFace(page, 0, 2)).toHaveAccessibleName('Categories, 2: difficulty, hard')

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
  await expect(difficultyFace(page, 0, 1)).toHaveAccessibleName('Categories, 1: difficulty, hard')
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

test("the category spread counts the questions round the wheel, smoothed beside them, and widens when clicked", async ({ page }) => {
  const panel = page.getByRole('region', { name: 'Category spread' })
  await expect(panel).toContainText('0 questions placed, from the estimates under categories.')
  await pick(page, categoryList(page, 0, 1), 'Art')
  await pick(page, categoryList(page, 1, 1), 'Art')
  await addButton(page, 1).click()
  await pick(page, categoryList(page, 1, 2), 'TV')
  await expect(panel).toContainText('2 questions placed')
  await expect(panel).toContainText(/draws? on no category in particular/)

  // Art has one question and half of another; smoothed, it keeps half of that, and lends Classical Music 16%.
  await panel.getByRole('button', { name: 'As a table' }).click()
  const table = panel.getByRole('table', { name: 'Category spread' })
  await expect(table.locator('tr[data-category="art"]').getByRole('cell')).toHaveText(['Art', '1.5', '0.75'])
  await expect(table.locator('tr[data-category="tv"]').getByRole('cell')).toHaveText(['TV', '0.5', '0.25'])
  await expect(table.locator('tr[data-category="classical_music"]').getByRole('cell')).toHaveText(['Classical Music', '0', '0.24'])

  // A click widens the chart to the whole row of panels, in the page; Enter narrows it again.
  const chart = panel.getByRole('button', { name: 'Category spread chart, full width' })
  await expect(chart).toHaveAttribute('aria-pressed', 'false')
  const widthOf = async () => {
    const box = await panel.boundingBox()
    return box?.width ?? 0
  }
  const restingWidth = await widthOf()
  await chart.click()
  await expect(chart).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(widthOf).toBeGreaterThan(restingWidth)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await chart.press('Enter')
  await expect(chart).toHaveAttribute('aria-pressed', 'false')
})
