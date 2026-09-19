import { expect, test, type Page } from '@playwright/test'
import { reloadOnceSaved, waitUntilSaved } from './support'

/** The cell of column `colname` in the row at `rowIdx` */
function cellOf(page: Page, rowIdx: number, colname: string) {
  return page.locator('tbody tr').nth(rowIdx).locator(`td[data-colname="${colname}"]`)
}

/** Open the gear's dialog, where a quiz's computed columns are edited */
async function openManage(page: Page) {
  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await expect(page.getByRole('dialog', { name: 'Manage this quiz' })).toBeVisible()
}

/** Put a column for `expression_label` on the open quiz, through the gear's dialog, and close it */
async function addColumn(page: Page, expression_label: string) {
  await openManage(page)
  await page.getByRole('combobox', { name: 'Add a column' }).click()
  await page.getByRole('option', { name: expression_label }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/** Open the workspace's expressions */
async function openExpressions(page: Page) {
  await page.getByRole('button', { name: 'Edit expressions' }).click()
  await expect(page.getByRole('dialog', { name: 'Expressions' })).toBeVisible()
}

/** Replace `label`'s formula, and move focus off the field so it commits */
async function setFormula(page: Page, label: string, formula: string) {
  const box = page.getByRole('textbox', { name: `Formula of ${label}` })
  await box.fill(formula)
  await page.getByRole('textbox', { name: `Description of ${label}` }).click()
}

/** Type a full answer into the first row */
async function answerFirstRow(page: Page, full_answer: string) {
  await page.locator('tbody tr').first().getByRole('textbox', { name: 'Full Answer' }).fill(full_answer)
  await page.getByLabel('Quiz name').click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.context().clearCookies()
  await page.goto('/')
})

test('a fresh quiz shows its computed columns between Q# and Alt Text', async ({ page }) => {
  await expect(page.getByRole('columnheader', { name: 'Alt Text' })).toBeVisible()
  const headers = await page.getByRole('columnheader').allTextContents()
  const titles = headers.map((title) => title.replaceAll(/\s+/g, ' ').trim())
  const between = titles.slice(titles.indexOf('Q#') + 1, titles.indexOf('Alt Text'))
  expect(between).toEqual([
    'Clueing + Rank', 'Clueing Full Sum', 'Clueing Numeral Sum', 'BUT NOT Full Sum',
    'BUT NOT Numeral Sum', 'Hint Full Sum', 'Hint Numeral Sum', 'Clueing+BUT NOT Full',
  ])
})

test('a column added from the gear works out its expression for every question', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await expect(page.getByRole('columnheader', { name: 'Answer Letter Count' })).toBeVisible()
  await answerFirstRow(page, 'Hello, World')
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('10')
})

test('a text column shows text', async ({ page }) => {
  await addColumn(page, 'answer_reversed')
  await answerFirstRow(page, 'stressed')
  await expect(cellOf(page, 0, 'Answer Reversed')).toHaveText('desserts')
})

test('a column keeps what it shows after a reload, and where it was put', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await answerFirstRow(page, 'Hello')
  await reloadOnceSaved(page)
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('5')
})

test('changing an expression\'s formula changes every column that works it', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await answerFirstRow(page, 'Hello')
  await openExpressions(page)
  await setFormula(page, 'answer_letter_count', '$length(qn.full_answer) * 2')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('10')
})

test('an edited expression, and the columns that work it, survive a reload', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await answerFirstRow(page, 'Hello')
  await openExpressions(page)
  await setFormula(page, 'answer_letter_count', '$length(qn.full_answer) * 3')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('15')
  await reloadOnceSaved(page)
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('15')
})

test('a formula that does not parse is named as it is typed, and its column says something is wrong', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await openExpressions(page)
  await setFormula(page, 'answer_letter_count', '$sum(')
  await expect(page.getByRole('group', { name: 'Expression answer_letter_count' })).toContainText(/at \d+/)
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(cellOf(page, 0, 'Answer Letter Count').getByRole('img')).toHaveAttribute('aria-label', /The formula failed/)
})

test('a formula that would never end is stopped, and the page stays usable', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await openExpressions(page)
  await setFormula(page, 'answer_letter_count', '( $spin := function() { $spin() }; $spin() )')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(cellOf(page, 0, 'Answer Letter Count').getByRole('img')).toHaveAttribute('aria-label', /took too long/)
  await page.getByRole('textbox', { name: 'Title' }).first().fill('Still typing')
  await expect(page.getByRole('textbox', { name: 'Title' }).first()).toHaveValue('Still typing')
})

test('a new expression can be written and put to work', async ({ page }) => {
  await openExpressions(page)
  const form = page.getByRole('group', { name: 'New expression' })
  await form.getByRole('textbox', { name: 'Label' }).fill('title_length')
  await form.getByRole('textbox', { name: 'New formula' }).fill('$length(qn.title)')
  await form.getByRole('button', { name: 'Add expression' }).click()
  await expect(page.getByRole('group', { name: 'Expression title_length' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await addColumn(page, 'title_length')
  await page.getByRole('textbox', { name: 'Title' }).first().fill('Leon')
  await page.getByLabel('Quiz name').click()
  await expect(cellOf(page, 0, 'Title Length')).toHaveText('4')
})

test('an expression a column works cannot be removed, and one nobody works can', async ({ page }) => {
  await openExpressions(page)
  await expect(page.getByRole('button', { name: 'Remove expression clueing_full' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Remove expression answer_reversed' })).toBeEnabled()
  await page.getByRole('button', { name: 'Remove expression answer_reversed' }).click()
  await expect(page.getByRole('group', { name: 'Expression answer_reversed' })).toHaveCount(0)
})

test('a label already in use is refused with a reason', async ({ page }) => {
  await openExpressions(page)
  const form = page.getByRole('group', { name: 'New expression' })
  await form.getByRole('textbox', { name: 'Label' }).fill('clueing_full')
  await form.getByRole('textbox', { name: 'New formula' }).fill('1')
  await form.getByRole('button', { name: 'Add expression' }).click()
  await expect(form.getByRole('alert')).toContainText('already has that label')
})

test('a column can be retitled, made medium, and removed', async ({ page }) => {
  await openManage(page)
  const column = page.getByRole('group', { name: 'Column Hint Full Sum' })
  const title = column.getByRole('textbox', { name: 'Column title' })
  await title.fill('Hint total')
  await column.getByRole('textbox', { name: 'Column label' }).click()
  await expect(page.getByRole('group', { name: 'Column Hint total' })).toBeVisible()
  await page.getByRole('group', { name: 'Column Hint total' }).getByRole('combobox', { name: 'Width' }).click()
  await page.getByRole('option', { name: 'medium' }).click()
  await page.getByRole('button', { name: 'Remove column Hint Numeral Sum' }).click()
  // The button that had focus is gone, so Escape would have nowhere to be heard.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('columnheader', { name: 'Hint total' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Hint Numeral Sum' })).toHaveCount(0)
})

test('sorting by a computed column orders the questions by what it came to', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  for (const [idx, answer] of ['ccc', 'a', 'bb'].entries()) {
    await page.locator('tbody tr').nth(idx).getByRole('textbox', { name: 'Full Answer' }).fill(answer)
  }
  await page.getByLabel('Quiz name').click()
  await page.getByRole('button', { name: 'Answer Letter Count' }).click()
  const answers = await page.locator('tbody tr').getByRole('textbox', { name: 'Full Answer' }).evaluateAll((boxes) => boxes.map((box) => (box as HTMLTextAreaElement).value))
  // The two blank rows have no letters, which is nought and sorts first.
  expect(answers).toEqual(['', '', 'a', 'bb', 'ccc'])
  await waitUntilSaved(page)
})

test('a locked quiz keeps its columns fixed, but its expressions can still be read and revised', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await openManage(page)
  await expect(page.getByRole('combobox', { name: 'Add a column' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await openExpressions(page)
  await expect(page.getByRole('textbox', { name: 'Formula of answer_reversed' })).toBeEditable()
})
