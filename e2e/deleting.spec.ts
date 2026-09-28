import type { Page } from '@playwright/test'
import { expect, fillRows, reloadOnceSaved, test, valuesOf } from './support'

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

test.beforeEach(async ({ page }) => {
  await titleQuiz(page, ['apple', 'banana', 'cherry'])
})

test('a trash can shows only in batch mode, where the grips give way to it', async ({ page }) => {
  await expect(page.locator('tbody').getByRole('button', { name: /^Delete/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reorder/ }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Batch select' }).click()
  await expect(page.getByRole('button', { name: 'Delete banana', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Reorder/ })).toHaveCount(0)
})

test('a trash can deletes its question once the author confirms, and the deletion survives a reload', async ({ page }) => {
  const before = await questionCount(page)
  await page.getByRole('button', { name: 'Batch select' }).click()
  await page.getByRole('button', { name: 'Delete banana', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete this question?' })
  await expect(dialog).toContainText('banana')
  await dialog.getByRole('button', { name: 'Delete' }).click()

  await expect(dialog).toBeHidden()
  await expect.poll(() => titlesShown(page, 2)).toEqual(['apple', 'cherry'])
  await reloadOnceSaved(page)
  await expect.poll(() => titlesShown(page, 2)).toEqual(['apple', 'cherry'])
  await expect.poll(() => questionCount(page)).toBe(before - 1)
})

test('keeping it deletes nothing, and so does Enter, which lands on keeping it', async ({ page }) => {
  await page.getByRole('button', { name: 'Batch select' }).click()
  await page.getByRole('button', { name: 'Delete banana', exact: true }).click()
  await page.getByRole('button', { name: 'Keep it' }).click()
  await page.getByRole('button', { name: 'Delete banana', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Keep it' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect.poll(() => titlesShown(page, 3)).toEqual(['apple', 'banana', 'cherry'])
})

test('batch mode swaps each grip for a checkbox, and deletes the checked questions once confirmed', async ({ page }) => {
  await page.getByRole('button', { name: 'Select questions' }).click()
  await expect(page.getByRole('button', { name: /^Reorder/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete checked (0)' })).toBeDisabled()

  await page.getByRole('checkbox', { name: 'Select apple' }).check()
  await page.getByRole('checkbox', { name: 'Select cherry' }).check()
  await page.getByRole('button', { name: 'Delete checked (2)' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete 2 questions?' })
  await expect(dialog).toContainText('apple')
  await expect(dialog).toContainText('cherry')
  await dialog.getByRole('button', { name: 'Delete' }).click()

  await expect.poll(() => titlesShown(page, 1)).toEqual(['banana'])
  // The job done, the grid leaves batch mode.
  await expect(page.getByRole('button', { name: 'Select questions' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Reorder/ }).first()).toBeVisible()
  await expect(page.locator('tbody').getByRole('button', { name: /^Delete/ })).toHaveCount(0)
})

test('the header checkbox checks every question, or none', async ({ page }) => {
  const count = await questionCount(page)
  await page.getByRole('button', { name: 'Select questions' }).click()
  const all = page.getByRole('checkbox', { name: 'Select all questions' })
  await all.check()
  await expect(page.getByRole('button', { name: `Delete checked (${String(count)})` })).toBeEnabled()
  await all.uncheck()
  await expect(page.getByRole('button', { name: 'Delete checked (0)' })).toBeDisabled()
})

test('leaving batch mode forgets what was checked', async ({ page }) => {
  await page.getByRole('button', { name: 'Select questions' }).click()
  await page.getByRole('checkbox', { name: 'Select apple' }).check()
  await page.getByRole('button', { name: 'Done selecting' }).click()
  await page.getByRole('button', { name: 'Select questions' }).click()
  await expect(page.getByRole('checkbox', { name: 'Select apple' })).not.toBeChecked()
})

test('a locked quiz offers neither the trash cans nor batch mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByRole('button', { name: 'Batch select' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Select questions' })).toBeDisabled()
  await expect(page.locator('tbody').getByRole('button', { name: /^Delete/ })).toHaveCount(0)
})
