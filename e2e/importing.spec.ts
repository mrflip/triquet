import type { Page } from '@playwright/test'
import { expect, grid, preparedExport, showTab, test, waitUntilSaved } from './support'

/** The Import box, its tab brought to the front */
async function importBox(page: Page) {
  const section = await showTab(page, 'Import')
  return section.getByRole('textbox', { name: 'Import' })
}

/** Type `text` into the Import box, its tab brought to the front */
async function fillImport(page: Page, text: string) {
  const box = await importBox(page)
  await box.fill(text)
}

/** Paste `payload` into the Import box and run it */
async function runImport(page: Page, payload: unknown) {
  await fillImport(page, JSON.stringify(payload))
  await page.getByRole('button', { name: 'Import', exact: true }).click()
}

/** The value of the field `name` in the row at `rowIdx` */
function fieldAt(page: Page, name: string, rowIdx: number) {
  return grid(page).locator('tbody').getByRole('textbox', { name, exact: true }).nth(rowIdx)
}

/** The label of the question at `rowIdx` of the quiz titled "Quiz one", as the Raw Export box has the hunt */
async function labelAt(page: Page, rowIdx: number): Promise<string> {
  const exported = JSON.parse(await preparedExport(page)) as {
    realms: { quizzes: { title: string, questions: { label: string }[] }[] }[]
  }
  const quiz = exported.realms.flatMap((realm) => realm.quizzes).find((each) => each.title === 'Quiz one')
  return quiz?.questions[rowIdx]?.label ?? ''
}

test.beforeEach(async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await fieldAt(page, 'Title', 0).fill('Leon')
  await fieldAt(page, 'Clueing', 0).fill('Which region?')
  await fieldAt(page, 'Notes', 0).fill('keep me')
  await page.getByLabel('Quiz name').click()
  await waitUntilSaved(page)
})

test('a partial paste changes exactly what it names and nothing else', async ({ page }) => {
  await runImport(page, [{ label: await labelAt(page, 0), clueing: 'Reworded' }])
  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('Reworded')
  await expect(fieldAt(page, 'Notes', 0)).toHaveValue('keep me')
})

test('an explicit null clears the field', async ({ page }) => {
  await runImport(page, [{ label: await labelAt(page, 0), notes: null }])
  await expect(fieldAt(page, 'Notes', 0)).toHaveValue('')
})

test('a label nothing here holds is appended, and a chain names its target by label', async ({ page }) => {
  await runImport(page, [
    { label: await labelAt(page, 0), chains_to: 'nantes_one' },
    { label: 'nantes_one', title: 'Nantes', hint: 'BUT NOT the edict' },
  ])
  await expect(grid(page).locator('tbody tr')).toHaveCount(6)
  await expect(grid(page).locator('tbody tr').first().locator('td[data-colname="BUT NOT"] > div'))
    .toHaveText('BUT NOT the edict')
})

test('a question that fails validation is skipped whole, and logged with the field and code', async ({ page }) => {
  await runImport(page, [
    { label: await labelAt(page, 0), qnum: 'three', clueing: 'Should not land' },
    { label: 'nantes_one', clueing: 'Should land' },
  ])
  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('Which region?')
  await expect(page.getByText(/0 merged, 1 added, 1 skipped/)).toBeVisible()
  await expect(page.getByText(/qnum: .*\[invalid_format\]/)).toBeVisible()
})

test('a run that merged something clears the box; one that failed keeps the text', async ({ page }) => {
  await runImport(page, [{ label: await labelAt(page, 0), clueing: 'Reworded' }])
  await expect(await importBox(page)).toHaveValue('')

  await fillImport(page, '{"quizzes":[')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(await importBox(page)).toHaveValue('{"quizzes":[')
  await expect(page.getByText(/still here/)).toBeVisible()
})

test('a quiz exported and pasted straight back is unchanged', async ({ page }) => {
  await fieldAt(page, 'Title', 1).fill('Nantes')
  await fieldAt(page, 'Clueing', 1).fill('Another one')
  await page.getByLabel('Quiz name').click()

  const exported = await preparedExport(page)
  await fillImport(page, exported)
  await page.getByRole('button', { name: 'Import', exact: true }).click()

  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('Which region?')
  await expect(fieldAt(page, 'Clueing', 1)).toHaveValue('Another one')
  await expect(grid(page).locator('tbody tr')).toHaveCount(5)
})

test('importing is refused while the quiz is locked', async ({ page }) => {
  await fillImport(page, '[{"label":"anyone","clueing":"Sneaked in"}]')
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
})
