import type { Page } from '@playwright/test'
import { addWidgeting, cellOf, closeManage, expect, manageDialog, openManage, reloadOnceSaved, test } from './support'

/** The list of categories of the pill numbered `nth` (from 1) in the Categories cell of the row at `rowIdx` */
function categoryList(page: Page, rowIdx: number, nth: number) {
  return cellOf(page, rowIdx, 'Categories').getByRole('combobox', { name: `Categories, ${String(nth)}: category` })
}

/** The list of difficulties of the pill numbered `nth` in the Categories cell of the row at `rowIdx` */
function difficultyList(page: Page, rowIdx: number, nth: number) {
  return cellOf(page, rowIdx, 'Categories').getByRole('combobox', { name: `Categories, ${String(nth)}: difficulty` })
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
  await expect(difficultyList(page, 0, 1)).toHaveText('medium')
  await expect(addButton(page, 0)).toHaveCount(0)

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
  await pick(page, difficultyList(page, 0, 2), 'hard')

  await reloadOnceSaved(page)
  await expect(categoryList(page, 0, 1)).toHaveText('Art')
  await expect(categoryList(page, 0, 2)).toHaveText('TV')
  await expect(difficultyList(page, 0, 2)).toHaveText('hard')
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
  await expect(difficultyList(page, 0, 1)).toHaveText('hard')
})

test("columns can show Masie's chance and the personas' average, worked out from the pills", async ({ page }) => {
  await addPartColumn(page, 'masie', 'Masie')
  await addPartColumn(page, 'average', 'Average')
  // Nobody placed it: everyone is halfway, at medium.
  await expect(cellOf(page, 0, 'Masie')).toHaveText('53%')
  await pick(page, categoryList(page, 0, 1), 'Art')
  await pick(page, difficultyList(page, 0, 1), 'easy')
  await expect(cellOf(page, 0, 'Masie')).toHaveText('69%')
  await expect(cellOf(page, 0, 'Average')).toHaveText('76%')
})
