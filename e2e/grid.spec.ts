import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
})

test('a fresh workspace opens with blank questions rather than a void', async ({ page }) => {
  await expect(page.getByLabel('Round name')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Clueing' })).toHaveCount(5)
})

test('every column is present from the start, so the layout never shifts later', async ({ page }) => {
  await expect(page.getByRole('columnheader')).toHaveCount(22)
  await expect(page.getByRole('columnheader', { name: 'Clueing Full Sum' })).toBeVisible()
})

test('what you type survives a reload', async ({ page }) => {
  await page.getByLabel('Round name').fill('Léon and other régions')
  const clueing = page.getByRole('textbox', { name: 'Clueing' }).first()
  await clueing.fill('Which region gave its name to 千 other things?')
  await page.getByRole('textbox', { name: 'Short answer' }).first().fill('Leon')
  // Edits commit on blur, so move focus off the field before reloading.
  await page.getByLabel('Round name').click()

  await page.reload()

  await expect(page.getByLabel('Round name')).toHaveValue('Léon and other régions')
  await expect(page.getByRole('textbox', { name: 'Clueing' }).first())
    .toHaveValue('Which region gave its name to 千 other things?')
  await expect(page.getByRole('textbox', { name: 'Short answer' }).first()).toHaveValue('Leon')
})

test('the round name reaches the browser tab', async ({ page }) => {
  await page.getByLabel('Round name').fill('Round one')
  await expect(page).toHaveTitle('Round one — Triquet')
})

test('adding a question appends a blank one', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add question' }).click()
  await expect(page.getByRole('textbox', { name: 'Clueing' })).toHaveCount(6)
})

test('a long clueing sets the height of its hint box too', async ({ page }) => {
  const clueing = page.getByRole('textbox', { name: 'Clueing' }).first()
  const hint = page.getByRole('textbox', { name: 'Hint' }).first()
  const wasHt = await hint.evaluate((node) => node.clientHeight)
  await clueing.fill(Array.from({ length: 12 }, (_ignored, ii) => `line ${String(ii)} of a long clueing`).join('\n'))
  await expect.poll(async () => hint.evaluate((node) => node.clientHeight)).toBeGreaterThan(wasHt)
})

test('the page never scrolls sideways, however wide the grid is', async ({ page }) => {
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflows).toBe(false)
})
