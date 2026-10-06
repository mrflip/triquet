import type { Page } from '@playwright/test'
import { addColumns, expect, exportedQuizzes, grid, newQuiz, openQuiz, preparedExport, showTab, test, waitUntilSaved } from './support'

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
  const quiz = exportedQuizzes(await preparedExport(page)).find((each) => each.title === 'Quiz one')
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

test('a label nothing here holds is appended, a chain names its target by label, and the untouched blank questions are archived', async ({ page }) => {
  await addColumns(page, ['butnot'])
  await runImport(page, [
    { label: await labelAt(page, 0), chains_to: 'nantes_one' },
    { label: 'nantes_one', title: 'Nantes', hint: 'BUT NOT the edict' },
  ])
  // The quiz's first question was written in; its four untouched blank ones are put away.
  await expect(grid(page).locator('tbody tr')).toHaveCount(2)
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

test('a quiz exported and pasted straight back is unchanged', { tag: '@smoke' }, async ({ page }) => {
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

test("a pasted quiz brings its title, smith's note and columns along, laying the grid out as it was", async ({ page }) => {
  await runImport(page, {
    title:       'Brought along',
    smiths_note: 'Lions and kings.',
    questions:   { [await labelAt(page, 0)]: { position: 0 } },
    columns:     {
      clueing: { position: 0, title: 'Clue', source: 'question.clueing', width_px: 300, align: 'right' },
      title:   { position: 1, title: 'Name', source: 'question.title', width_px: 120 },
    },
  })
  await expect(page.getByLabel('Quiz name')).toHaveValue('Brought along')
  await expect(page.getByRole('textbox', { name: 'Smith\'s note', exact: true })).toHaveValue('Lions and kings.')
  await expect(grid(page).getByRole('columnheader', { name: 'Clue', exact: true })).toBeVisible()
  await expect(grid(page).getByRole('columnheader', { name: 'Hint', exact: true })).toBeHidden()
  await expect(grid(page).getByRole('columnheader')).toHaveCount(3)
})

test("a hunt pasted into a quiz matching none of its quizzes makes the quiz of its first quiz's label, and is read there", async ({ page }) => {
  const from = new URL(page.url()).pathname
  await runImport(page, { label: 'another_hunt', branch: 'main', quizzes: { home: { far_quiz: { title: 'Far quiz', questions: { leon: { position: 0, clueing: 'Sent along' } } } } } })
  await expect(page).toHaveURL(/\/far_quiz\/!edit$/)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Far quiz')
  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('Sent along')
  // The new quiz's own blank questions are put away once the paste has filled it.
  await expect(grid(page).locator('tbody tr')).toHaveCount(1)
  await expect(page.getByRole('status').filter({ hasText: "sent here from another quiz's Import" })).toBeVisible()

  await page.goto(from)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('Which region?')
})

test("a hunt pasted into a quiz matching none of its quizzes goes to the quiz of the hunt already answering to its first quiz's label", async ({ page }) => {
  const from = new URL(page.url()).pathname
  await newQuiz(page)
  const there = new URL(page.url()).pathname
  const label = there.split('/').at(-2) ?? ''
  await page.goto(from)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  await runImport(page, { label: 'another_hunt', quizzes: { home: { [label]: { questions: { leon: { position: 0, clueing: 'Sent along' } } }, other: { questions: {} } } } })
  await expect(page).toHaveURL(new RegExp(`/${label}/!edit$`))
  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('Sent along')
  await expect(grid(page).locator('tbody tr')).toHaveCount(1)
})

test('a hunt sent on to a quiz that is locked is not read there, and not kept to be read once it is unlocked', async ({ page }) => {
  await newQuiz(page)
  const label = new URL(page.url()).pathname.split('/').at(-2) ?? ''
  const title = await page.getByLabel('Quiz name').inputValue()
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByRole('button', { name: 'Unlock quiz' })).toBeVisible()
  await openQuiz(page, 'Quiz one')
  await runImport(page, { label: 'another_hunt', quizzes: { home: { [label]: { questions: { leon: { position: 0, clueing: 'Sent along' } } }, other: { questions: {} } } } })
  await expect(page).toHaveURL(new RegExp(`/${label}/!edit$`))
  await expect(page.getByRole('status').filter({ hasText: 'This quiz is locked' })).toBeVisible()
  await expect(grid(page).locator('tbody tr')).toHaveCount(5)

  await page.getByRole('button', { name: 'Unlock quiz' }).click()
  await expect(page.getByRole('button', { name: 'Lock quiz' })).toBeVisible()
  await openQuiz(page, 'Quiz one')
  await openQuiz(page, title)
  await expect(grid(page).locator('tbody tr')).toHaveCount(5)
  await expect(fieldAt(page, 'Clueing', 0)).toHaveValue('')
})

test('importing is refused while the quiz is locked', async ({ page }) => {
  await fillImport(page, '[{"label":"anyone","clueing":"Sneaked in"}]')
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
})
