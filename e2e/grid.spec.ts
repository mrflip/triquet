import { cellOf, expect, faceOf, grid, reloadOnceSaved, test, waitUntilSaved } from './support'

test('a fresh hunt\'s quiz opens with blank questions rather than a void', async ({ page }) => {
  await expect(page.getByLabel('Quiz name')).toBeVisible()
  await expect(grid(page).locator('tbody').getByRole('textbox', { name: 'Clueing', exact: true })).toHaveCount(5)
})

test('every column is present from the start, so the layout never shifts later', async ({ page }) => {
  await expect(grid(page).getByRole('columnheader')).toHaveCount(22)
  await expect(page.getByRole('columnheader', { name: 'Clueing Full Sum' })).toBeVisible()
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

test('the page never scrolls sideways, however wide the grid is', async ({ page }) => {
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflows).toBe(false)
})
