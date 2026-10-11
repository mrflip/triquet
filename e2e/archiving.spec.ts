import type { Page } from '@playwright/test'
import { answerRemoval, expect, fillRows, grid, manageDialog, openManage, reloadOnceSaved, test, valuesOf } from './support'

/** Title the first `titles.length` questions, top to bottom */
async function titleQuiz(page: Page, titles: string[]) {
  await fillRows(page, titles.map((title) => ({ Title: title })))
}

/** The first `qty` titles, top to bottom, once the grid is on screen */
async function titlesShown(page: Page, qty: number): Promise<string[]> {
  const fields = page.getByRole('textbox', { name: 'Title' })
  await expect(fields.first()).toBeVisible()
  const titles = await valuesOf(fields)
  return titles.slice(0, qty)
}

/** How many questions the grid shows */
async function questionCount(page: Page): Promise<number> {
  return page.getByRole('textbox', { name: 'Title' }).count()
}

/** The gear's list of archived questions, the gear open */
function archivedList(page: Page) {
  return manageDialog(page).getByRole('list', { name: 'Archived questions' })
}

test.beforeEach(async ({ page }) => {
  await titleQuiz(page, ['apple', 'banana', 'cherry'])
})

test('a button to change how a question is shown stands only in batch mode, where the grips give way to it, and the corner button leaves it as it entered', async ({ page }) => {
  const corner = page.getByRole('button', { name: 'Batch select' })
  await expect(grid(page).locator('tbody').getByRole('button', { name: /^Change how/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reorder/ }).first()).toBeVisible()
  await corner.click()
  await expect(corner).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('checkbox', { name: 'Select all questions' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Change how banana is shown', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Reorder/ })).toHaveCount(0)
  await expect(grid(page).locator('tbody').getByRole('button', { name: /^Delete/ })).toHaveCount(0)

  await corner.click()
  await expect(corner).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('checkbox', { name: 'Select all questions' })).toHaveCount(0)
  await expect(grid(page).locator('tbody').getByRole('button', { name: /^Change how/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reorder/ }).first()).toBeVisible()
})

test('a row archives its question: it leaves the grid, and the gear lists it, across a reload', async ({ page }) => {
  const before = await questionCount(page)
  await page.getByRole('button', { name: 'Batch select' }).click()
  await page.getByRole('button', { name: 'Change how banana is shown', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'How should this question be shown?' })
  await expect(dialog).toContainText('banana')
  await expect(dialog.getByRole('button', { name: /Delete/ })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Archive' }).click()

  await expect(dialog).toBeHidden()
  await expect.poll(() => titlesShown(page, 2)).toEqual(['apple', 'cherry'])
  await reloadOnceSaved(page)
  await expect.poll(() => titlesShown(page, 2)).toEqual(['apple', 'cherry'])
  await expect.poll(() => questionCount(page)).toBe(before - 1)
  await openManage(page)
  await expect(archivedList(page).getByRole('listitem')).toHaveCount(1)
  await expect(archivedList(page)).toContainText('banana')
})

test('cancelling changes nothing, and so does Enter, which lands on cancelling', async ({ page }) => {
  await page.getByRole('button', { name: 'Batch select' }).click()
  await page.getByRole('button', { name: 'Change how banana is shown', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Change how banana is shown', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect.poll(() => titlesShown(page, 3)).toEqual(['apple', 'banana', 'cherry'])
})

test('a row makes its question an alternate, its title marked (alt), and normal again', async ({ page }) => {
  await page.getByRole('button', { name: 'Batch select' }).click()
  await page.getByRole('button', { name: 'Change how banana is shown', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Make secondary' }).click()
  await expect(grid(page).getByText('(alt)')).toHaveCount(1)
  await page.getByRole('button', { name: 'Change how banana is shown', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Make normal' }).click()
  await expect(grid(page)).not.toContainText('(alt)')
})

test('batch mode archives the checked questions once confirmed, saying where to find them, and leaves batch mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Select questions' }).click()
  await expect(page.getByRole('button', { name: /^Reorder/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Archive selected (0)' })).toBeDisabled()

  await page.getByRole('checkbox', { name: 'Select apple' }).check()
  await page.getByRole('checkbox', { name: 'Select cherry' }).check()
  await page.getByRole('button', { name: 'Archive selected (2)' }).click()
  const dialog = page.getByRole('dialog', { name: 'Archive 2 questions?' })
  await expect(dialog).toContainText('apple')
  await expect(dialog).toContainText('cherry')
  await expect(dialog).toContainText('un-archive it, open the gear')
  await dialog.getByRole('button', { name: 'Archive' }).click()

  await expect.poll(() => titlesShown(page, 1)).toEqual(['banana'])
  // The job done, the grid leaves batch mode.
  await expect(page.getByRole('button', { name: 'Select questions' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Reorder/ }).first()).toBeVisible()
})

test('batch mode makes the checked questions secondary, and normal again, without asking', async ({ page }) => {
  await page.getByRole('button', { name: 'Select questions' }).click()
  await page.getByRole('checkbox', { name: 'Select apple' }).check()
  await page.getByRole('checkbox', { name: 'Select cherry' }).check()
  await page.getByRole('button', { name: 'Make secondary (2)' }).click()
  await expect(grid(page).getByText('(alt)')).toHaveCount(2)
  await page.getByRole('button', { name: 'Make normal (2)' }).click()
  await expect(grid(page).getByText('(alt)')).toHaveCount(0)
})

test('the gear un-archives a question back to the grid, and deletes another at once, for good', { tag: '@smoke' }, async ({ page }) => {
  const before = await questionCount(page)
  await page.getByRole('button', { name: 'Select questions' }).click()
  await page.getByRole('checkbox', { name: 'Select apple' }).check()
  await page.getByRole('checkbox', { name: 'Select cherry' }).check()
  await page.getByRole('button', { name: 'Archive selected (2)' }).click()
  await page.getByRole('dialog', { name: 'Archive 2 questions?' }).getByRole('button', { name: 'Archive' }).click()
  await expect.poll(() => titlesShown(page, 1)).toEqual(['banana'])

  await openManage(page)
  await manageDialog(page).getByRole('button', { name: 'Un-archive apple' }).click()
  await manageDialog(page).getByRole('button', { name: 'Delete cherry' }).click()
  await answerRemoval(page, 'Yes, delete')
  await expect(archivedList(page)).toHaveCount(0)
  await manageDialog(page).getByRole('button', { name: 'Done' }).click()

  await expect.poll(() => titlesShown(page, 2)).toEqual(['apple', 'banana'])
  await reloadOnceSaved(page)
  await expect.poll(() => questionCount(page)).toBe(before - 1)
  await openManage(page)
  await expect(manageDialog(page)).toContainText('No questions are archived.')
})

test('the header checkbox checks every question, or none', async ({ page }) => {
  const count = await questionCount(page)
  await page.getByRole('button', { name: 'Select questions' }).click()
  const all = page.getByRole('checkbox', { name: 'Select all questions' })
  await all.check()
  await expect(page.getByRole('button', { name: `Archive selected (${String(count)})` })).toBeEnabled()
  await all.uncheck()
  await expect(page.getByRole('button', { name: 'Archive selected (0)' })).toBeDisabled()
})

test('leaving batch mode forgets what was checked', async ({ page }) => {
  await page.getByRole('button', { name: 'Select questions' }).click()
  await page.getByRole('checkbox', { name: 'Select apple' }).check()
  await page.getByRole('button', { name: 'Done selecting' }).click()
  await page.getByRole('button', { name: 'Select questions' }).click()
  await expect(page.getByRole('checkbox', { name: 'Select apple' })).not.toBeChecked()
})

test('a locked quiz offers neither batch mode nor its buttons', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByRole('button', { name: 'Batch select' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Select questions' })).toBeDisabled()
  await expect(grid(page).locator('tbody').getByRole('button', { name: /^Change how/ })).toHaveCount(0)
})
