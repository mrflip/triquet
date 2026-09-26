import { expect, test, type Page } from '@playwright/test'

/** Paste `payload` into the Import box and run it */
async function runImport(page: Page, payload: unknown) {
  await page.getByRole('textbox', { name: 'Import' }).fill(JSON.stringify(payload))
  await page.getByRole('button', { name: 'Import', exact: true }).click()
}

/** The value of the field `name` in the row at `rowIdx` */
function fieldAt(page: Page, name: string, rowIdx: number) {
  return page.locator('tbody').getByRole('textbox', { name, exact: true }).nth(rowIdx)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Quiz name').fill('Quiz one')
  await fieldAt(page, 'Title', 0).fill('Leon')
  await fieldAt(page, 'Clueing', 0).fill('Which region?')
  await fieldAt(page, 'Notes', 0).fill('keep me')
  await page.getByLabel('Quiz name').click()
})

test('a partial paste changes exactly what it names and nothing else', async ({ page }) => {
  await runImport(page, [{ title: 'Leon', clueing: 'Reworded' }])
  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('Reworded')
  await expect(fieldAt(page, 'Notes', 0)).toHaveValue('keep me')
})

test('an explicit null clears the field', async ({ page }) => {
  await runImport(page, [{ title: 'Leon', notes: null }])
  await expect(fieldAt(page, 'Notes', 0)).toHaveValue('')
})

test('a title nothing here holds is appended, and a chain is remapped', async ({ page }) => {
  await runImport(page, [
    { id: 'theirs-1', title: 'Leon', chains_to: 'theirs-2' },
    { id: 'theirs-2', title: 'Nantes', hint: 'BUT NOT the edict' },
  ])
  await expect(page.locator('tbody tr')).toHaveCount(6)
  await expect(page.locator('tbody tr').first().locator('td[data-colname="BUT NOT"] > div'))
    .toHaveText('BUT NOT the edict')
})

test('a question that fails validation is skipped whole, and logged with the field and code', async ({ page }) => {
  await runImport(page, [
    { title: 'Leon', qnum: 'three', clueing: 'Should not land' },
    { title: 'Nantes', clueing: 'Should land' },
  ])
  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('Which region?')
  await expect(page.getByText(/0 merged, 1 added, 1 skipped/)).toBeVisible()
  await expect(page.getByText(/qnum: .*\[invalid_format\]/)).toBeVisible()
})

test('a run that merged something clears the box; one that failed keeps the text', async ({ page }) => {
  await runImport(page, [{ title: 'Leon', clueing: 'Reworded' }])
  await expect(page.getByRole('textbox', { name: 'Import' })).toHaveValue('')

  await page.getByRole('textbox', { name: 'Import' }).fill('{"quizzes":[')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Import' })).toHaveValue('{"quizzes":[')
  await expect(page.getByText(/still here/)).toBeVisible()
})

test('a quiz exported and pasted straight back is unchanged', async ({ page }) => {
  await fieldAt(page, 'Title', 1).fill('Nantes')
  await fieldAt(page, 'Clueing', 1).fill('Another one')
  await page.getByLabel('Quiz name').click()

  const exported = await page.getByRole('textbox', { name: 'Export' }).inputValue()
  await page.getByRole('textbox', { name: 'Import' }).fill(exported)
  await page.getByRole('button', { name: 'Import', exact: true }).click()

  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('Which region?')
  await expect(fieldAt(page, 'Clueing', 1)).toHaveValue('Another one')
  await expect(page.locator('tbody tr')).toHaveCount(5)
})

test('importing is refused while the quiz is locked', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Import' }).fill('[{"title":"Leon","clueing":"Sneaked in"}]')
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
})
