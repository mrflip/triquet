import type { Locator, Page } from '@playwright/test'
import { addColumns, addWidgeting, cellOf, expect, faceOf, foldedRows, grid, reloadOnceSaved, rowAt, test, valuesOf, waitUntilSaved } from './support'

/** The triangle in the grid's corner, which folds every row or unfolds them all */
function foldAll(page: Page): Locator {
  return grid(page).getByRole('button', { name: 'Show questions in full' })
}

/** Where `located` is drawn on the page */
async function boxOf(located: Locator): Promise<DOMRect> {
  return await located.evaluate((node) => node.getBoundingClientRect())
}

/** How far `located`'s contents sit in from its top and bottom edges: its padding and border, in pixels */
async function insetOf(located: Locator): Promise<{ top: number, bottom: number }> {
  return await located.evaluate((node) => {
    const style = getComputedStyle(node)
    return {
      top:    Number(style.paddingTop.replace(/px$/, '')) + Number(style.borderTopWidth.replace(/px$/, '')),
      bottom: Number(style.paddingBottom.replace(/px$/, '')) + Number(style.borderBottomWidth.replace(/px$/, '')),
    }
  })
}

test('a fresh quiz starts lean: five blank questions, its title, Q#, clueing, full answer and notes, and nothing worked out', async ({ page }) => {
  // The gutter's header, then the five starter columns.
  await expect(grid(page).getByRole('columnheader')).toHaveCount(6)
  for (const colname of ['Title', 'Q#', 'Clueing', 'Full Answer', 'Notes']) {
    await expect(grid(page).getByRole('columnheader', { name: colname, exact: true })).toBeVisible()
  }
  await expect.poll(() => valuesOf(grid(page).locator('tbody').getByRole('textbox', { name: 'Clueing', exact: true }))).toEqual(['', '', '', '', ''])
})

test('what you type survives a reload', { tag: '@smoke' }, async ({ page }) => {
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
  const heightOf = async (rowIdx: number) => await cellOf(page, rowIdx, 'Hint').getByRole('textbox').evaluate((node) => node.getBoundingClientRect().height)
  await expect(foldAll(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(foldedRows(page)).toHaveCount(5)

  await cellOf(page, 0, 'Clueing').getByRole('textbox').fill('Which region?')
  await expect(rowAt(page, 0)).not.toHaveAttribute('data-folded')
  // Open, its boxes stand taller than those of the folded row below it.
  await expect.poll(async () => await heightOf(0) - await heightOf(1)).toBeGreaterThan(0)
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

test('the corner\'s fold sits at its top and batch mode at its foot, however tall the turned headers make it, and the page never scrolls sideways however wide the grid', async ({ page }) => {
  // A narrow widgeting's column turns its header on its side, which makes the header row tall.
  await addWidgeting(page, 'clueing_word_count')
  const corner = grid(page).getByRole('columnheader').first()
  const fold = foldAll(page)
  const batch = grid(page).getByRole('button', { name: 'Batch select' })
  await expect.poll(() => corner.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(100)
  // Each sits against its edge of the corner, inset by no more than the corner's own padding and border.
  await expect.poll(async () => {
    const [cornerBox, foldBox, batchBox, inset] = await Promise.all([boxOf(corner), boxOf(fold), boxOf(batch), insetOf(corner)])
    return [Math.round(foldBox.top - cornerBox.top - inset.top), Math.round(cornerBox.bottom - batchBox.bottom - inset.bottom)]
  }).toEqual([0, 0])

  // Narrower than the grid, the grid scrolls inside its own box and the page stays put.
  await page.setViewportSize({ width: 700, height: 900 })
  await expect.poll(() => grid(page).evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(700)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
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
