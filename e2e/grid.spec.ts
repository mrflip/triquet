import type { Locator, Page } from '@playwright/test'
import { addColumns, addWidgeting, cellOf, expect, faceOf, foldedRows, grid, reloadOnceSaved, rowAt, test, waitUntilSaved } from './support'

/** The triangle in the grid's corner, which folds every row or unfolds them all */
function foldAll(page: Page): Locator {
  return grid(page).getByRole('button', { name: 'Show questions in full' })
}

/** Where `located` is drawn on the page */
async function boxOf(located: Locator): Promise<DOMRect> {
  return await located.evaluate((node) => node.getBoundingClientRect())
}

test('a fresh hunt\'s quiz opens with blank questions rather than a void', async ({ page }) => {
  await expect(page.getByLabel('Quiz name')).toBeVisible()
  await expect(grid(page).locator('tbody').getByRole('textbox', { name: 'Clueing', exact: true })).toHaveCount(5)
})

test('a fresh quiz starts lean: its title, Q#, clueing, full answer and notes, and nothing worked out', async ({ page }) => {
  // The gutter's header, then the five starter columns.
  await expect(grid(page).getByRole('columnheader')).toHaveCount(6)
  for (const colname of ['Title', 'Q#', 'Clueing', 'Full Answer', 'Notes']) {
    await expect(grid(page).getByRole('columnheader', { name: colname, exact: true })).toBeVisible()
  }
})

test('what you type survives a reload', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Léon and other régions')
  const clueing = page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
  await clueing.fill('Which region gave its name to 千 other things?')
  await page.getByRole('textbox', { name: 'Title' }).first().fill('Leon')
  // Edits commit on blur, so move focus off the field before reloading.
  await page.getByLabel('Quiz name').click()

  await reloadOnceSaved(page)

  await expect(page.getByLabel('Quiz name')).toHaveValue('Léon and other régions')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first())
    .toHaveValue('Which region gave its name to 千 other things?')
  await expect(page.getByRole('textbox', { name: 'Title' }).first()).toHaveValue('Leon')
})

test('a Q# of a lone point means no number, and is left blank rather than refused', async ({ page }) => {
  const qnum = page.getByRole('textbox', { name: 'Q#', exact: true }).first()
  await qnum.pressSequentially('.')
  await page.getByLabel('Quiz name').click()
  await waitUntilSaved(page)
  // Not refused: a refusal's notice is up before the page counts the change as settled.
  await expect(page.getByRole('status')).toHaveCount(0)
  await reloadOnceSaved(page)
  await expect(qnum).toHaveValue('')
})

test('the quiz name reaches the browser tab', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await expect(page).toHaveTitle('Quiz one — Triquet')
})

test('adding a question appends a blank one', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add question' }).click()
  await expect(grid(page).locator('tbody').getByRole('textbox', { name: 'Clueing', exact: true })).toHaveCount(6)
})

test('a long clueing sets the height of its hint box too', async ({ page }) => {
  await addColumns(page, ['hint'])
  const clueing = page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
  const hint = page.getByRole('textbox', { name: 'Hint' }).first()
  await expect(hint).toBeVisible()
  const wasHt = await hint.evaluate((node) => node.clientHeight)
  await clueing.fill(Array.from({ length: 12 }, (_ignored, lineIdx) => `line ${String(lineIdx)} of a long clueing`).join('\n'))
  await expect.poll(() => hint.evaluate((node) => node.clientHeight)).toBeGreaterThan(wasHt)
})

test('a clueing shows its markdown rendered until it is clicked into, and then as typed', async ({ page }) => {
  const clueing = page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
  const face = faceOf(cellOf(page, 0, 'Clueing'))
  await clueing.fill('Which **region**\ngave its name to *Leon*?')
  await page.getByLabel('Quiz name').click()
  await expect(face.locator('strong')).toHaveText('region')
  await expect(face.locator('em')).toHaveText('Leon')

  await cellOf(page, 0, 'Clueing').click()
  await expect(clueing).toBeFocused()
  await expect(face).toBeHidden()
  await expect(clueing).toHaveValue('Which **region**\ngave its name to *Leon*?')
})

test('a clueing taller than the row can grow scrolls its rendered face, and a click on the face goes to the box', async ({ page }) => {
  const clueing = page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
  const face = faceOf(cellOf(page, 0, 'Clueing'))
  await clueing.fill(Array.from({ length: 40 }, (_ignored, lineIdx) => `line **${String(lineIdx)}** of a long clueing`).join('\n'))
  await page.getByLabel('Quiz name').click()
  await expect(face.locator('strong').first()).toHaveText('0')

  await face.hover()
  await page.mouse.wheel(0, 300)
  await expect.poll(() => face.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)

  await face.click()
  await expect(clueing).toBeFocused()
  await expect(face).toBeHidden()
})

test('the grid opens folded, and entering a text box opens its row alone, which stays open', async ({ page }) => {
  await addColumns(page, ['hint'])
  const hint = cellOf(page, 0, 'Hint').getByRole('textbox')
  await expect(foldAll(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(foldedRows(page)).toHaveCount(5)
  await expect(hint).toHaveCSS('height', '30px')

  await cellOf(page, 0, 'Clueing').getByRole('textbox').fill('Which region?')
  await expect(rowAt(page, 0)).not.toHaveAttribute('data-folded')
  await expect(hint).not.toHaveCSS('height', '30px')
  await expect(foldedRows(page)).toHaveCount(4)
  await expect(foldAll(page)).toHaveAttribute('aria-expanded', 'true')

  // Leaving the row, and the edit landing, leave it open: only the corner folds it.
  await page.getByLabel('Quiz name').click()
  await waitUntilSaved(page)
  await expect(rowAt(page, 0)).not.toHaveAttribute('data-folded')
})

test('the corner folds every row while any is open, and unfolds them all when none is', async ({ page }) => {
  await cellOf(page, 2, 'Title').getByRole('textbox').click()
  await expect(foldedRows(page)).toHaveCount(4)
  await expect(foldAll(page)).toHaveAttribute('aria-expanded', 'true')

  await foldAll(page).click()
  await expect(foldedRows(page)).toHaveCount(5)
  await expect(foldAll(page)).toHaveAttribute('aria-expanded', 'false')

  await foldAll(page).click()
  await expect(foldedRows(page)).toHaveCount(0)
  await expect(foldAll(page)).toHaveAttribute('aria-expanded', 'true')

  await foldAll(page).click()
  await expect(foldedRows(page)).toHaveCount(5)
})

test('the corner\'s fold sits at its top and batch mode at its foot, however tall the turned headers make it', async ({ page }) => {
  // A narrow widgeting's column turns its header on its side, which makes the header row tall.
  await addWidgeting(page, 'clueing_word_count')
  const corner = await boxOf(grid(page).getByRole('columnheader').first())
  const fold = await boxOf(foldAll(page))
  const batch = await boxOf(grid(page).getByRole('button', { name: 'Batch select' }))
  expect(corner.height).toBeGreaterThan(100)
  expect(fold.y - corner.y).toBeLessThan(16)
  expect((corner.y + corner.height) - (batch.y + batch.height)).toBeLessThan(16)
})

test('a question added to a folded grid is open', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add question' }).click()
  await expect(grid(page).locator('tbody').getByRole('row')).toHaveCount(6)
  await expect(rowAt(page, 5)).not.toHaveAttribute('data-folded')
  await expect(foldedRows(page)).toHaveCount(5)
  await expect(foldAll(page)).toHaveAttribute('aria-expanded', 'true')
})

test('as cards, below 640px, every question shows in full, and folds again when wide', async ({ page }) => {
  await expect(foldedRows(page)).toHaveCount(5)
  await page.setViewportSize({ width: 400, height: 900 })
  await expect(foldedRows(page)).toHaveCount(0)
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(foldedRows(page)).toHaveCount(5)
})

test('the page never scrolls sideways, however wide the grid is', async ({ page }) => {
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflows).toBe(false)
})
