import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region?')
  await page.getByLabel('Quiz name').click()
})

test('each quiz is wholly independent', async ({ page }) => {
  await page.getByRole('button', { name: '+ New quiz' }).click()
  await expect(page.getByLabel('Quiz name')).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('')

  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Open quiz').selectOption({ label: 'Quiz one' })
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
})

test('an unnamed quiz shows as Untitled quiz in the switcher', async ({ page }) => {
  await page.getByRole('button', { name: '+ New quiz' }).click()
  const labels = await page.getByLabel('Open quiz').locator('option').evaluateAll((nodes) => nodes.map((node) => node.textContent))
  expect(labels).toEqual(['Quiz one', 'Untitled quiz'])
})

test('deleting asks inline, and the neighbouring quiz opens', async ({ page }) => {
  await page.getByRole('button', { name: '+ New quiz' }).click()
  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Quiz name').blur()

  await page.getByRole('button', { name: 'Delete quiz' }).click()
  await expect(page.getByText('Delete “Quiz two”?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz two')

  await page.getByRole('button', { name: 'Delete quiz' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
})

test('the last remaining quiz cannot be deleted', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Delete quiz' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Delete quiz' })).toHaveAttribute('title', 'The last quiz cannot be deleted')
})

test('a locked quiz accepts no edits, but stays readable and copyable', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByText('Locked', { exact: true })).toBeVisible()

  const clueing = page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
  await expect(clueing).toHaveAttribute('readonly', '')
  // Read-only rather than disabled, so a frozen quiz can still be selected and copied out.
  await expect(clueing).toBeEnabled()
  await expect(page.getByRole('combobox', { name: 'Chains to' }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Renumber Q#' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Recalculate all ishes' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ask Quick-model guess' }).first()).toBeDisabled()

  // Exporting still works.
  await expect(page.getByRole('textbox', { name: 'Copy for Sheets' })).toHaveValue(/Which region\?/)
})

test('the lock holds even when an edit is forced past the disabled controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().evaluate((node) => {
    const field = node as HTMLTextAreaElement
    field.removeAttribute('readonly')
  })
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Sneaked in')
  await page.getByLabel('Quiz name').click()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
})

test('unlocking finds the quiz exactly as it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await page.getByRole('button', { name: 'Unlock quiz' }).click()
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).not.toHaveAttribute('readonly', '')
})

test('the switcher marks a locked quiz', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  const labels = await page.getByLabel('Open quiz').locator('option').evaluateAll((nodes) => nodes.map((node) => node.textContent))
  expect(labels).toEqual(['🔒 Quiz one'])
})
