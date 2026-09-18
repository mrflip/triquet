import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await page.getByLabel('Round name').fill('Round one')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region?')
  await page.getByLabel('Round name').click()
})

test('each round is wholly independent', async ({ page }) => {
  await page.getByRole('button', { name: '+ New quiz' }).click()
  await expect(page.getByLabel('Round name')).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('')

  await page.getByLabel('Round name').fill('Round two')
  await page.getByLabel('Open round').selectOption({ label: 'Round one' })
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
})

test('an unnamed round shows as Untitled quiz in the switcher', async ({ page }) => {
  await page.getByRole('button', { name: '+ New quiz' }).click()
  const labels = await page.getByLabel('Open round').locator('option').evaluateAll((nodes) => nodes.map((node) => node.textContent))
  expect(labels).toEqual(['Round one', 'Untitled quiz'])
})

test('deleting asks inline, and the neighbouring round opens', async ({ page }) => {
  await page.getByRole('button', { name: '+ New quiz' }).click()
  await page.getByLabel('Round name').fill('Round two')
  await page.getByLabel('Round name').blur()

  await page.getByRole('button', { name: 'Delete quiz' }).click()
  await expect(page.getByText('Delete “Round two”?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByLabel('Round name')).toHaveValue('Round two')

  await page.getByRole('button', { name: 'Delete quiz' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByLabel('Round name')).toHaveValue('Round one')
})

test('the last remaining round cannot be deleted', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Delete quiz' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Delete quiz' })).toHaveAttribute('title', 'The last round cannot be deleted')
})

test('a locked round accepts no edits, but stays readable and copyable', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock round' }).click()
  await expect(page.getByText('Locked', { exact: true })).toBeVisible()

  const clueing = page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
  await expect(clueing).toHaveAttribute('readonly', '')
  // Read-only rather than disabled, so a frozen round can still be selected and copied out.
  await expect(clueing).toBeEnabled()
  await expect(page.getByRole('combobox', { name: 'Chains to' }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Renumber Q#' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Recalculate all ishes' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ask Quick-model guess' }).first()).toBeDisabled()

  // Exporting still works.
  await expect(page.getByRole('textbox', { name: 'Copy for Sheets' })).toHaveValue(/Which region\?/)
})

test('the lock holds even when an edit is forced past the disabled controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock round' }).click()
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().evaluate((node) => {
    const field = node as HTMLTextAreaElement
    field.removeAttribute('readonly')
  })
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Sneaked in')
  await page.getByLabel('Round name').click()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
})

test('unlocking finds the round exactly as it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock round' }).click()
  await page.getByRole('button', { name: 'Unlock round' }).click()
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).not.toHaveAttribute('readonly', '')
})

test('the switcher marks a locked round', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock round' }).click()
  const labels = await page.getByLabel('Open round').locator('option').evaluateAll((nodes) => nodes.map((node) => node.textContent))
  expect(labels).toEqual(['🔒 Round one'])
})
