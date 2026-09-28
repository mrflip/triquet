import type { Page } from '@playwright/test'
import { cellOf, closeManage, dragOnto, expect, grid, manageDialog, openManage, reloadOnceSaved, stepBy, test, valuesOf, waitUntilSaved } from './support'

/** Put an expressing widget working the existing expression `expression_label` on the open quiz, with the column it brings, and close the gear's dialog */
async function addColumn(page: Page, expression_label: string) {
  await openManage(page)
  await page.getByRole('button', { name: '+ New expressing…' }).click()
  const editor = page.getByRole('dialog', { name: 'New expressing' })
  await editor.getByRole('combobox', { name: 'Expression' }).click()
  await page.getByRole('option', { name: expression_label, exact: true }).click()
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toHaveCount(0)
  await closeManage(page)
}

/** Open the hunt's expressions, and then one of them */
async function openExpression(page: Page, label: string) {
  await page.getByRole('button', { name: 'Edit expressions' }).click()
  await expect(page.getByRole('dialog', { name: 'Expressions' })).toBeVisible()
  await page.getByRole('button', { name: `Edit expression ${label}` }).click()
  await expect(page.getByRole('dialog', { name: `Expression: ${label}` })).toBeVisible()
}

/** Replace the formula in whichever editor is open */
async function setFormula(page: Page, formula: string) {
  await page.getByRole('textbox', { name: 'Formula', exact: true }).fill(formula)
}

/** Apply the open expression editor, and close the list behind it */
async function applyExpression(page: Page, label: string) {
  await page.getByRole('dialog', { name: `Expression: ${label}` }).getByRole('button', { name: 'Apply' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/** Type a full answer into the first row */
async function answerFirstRow(page: Page, full_answer: string) {
  await grid(page).locator('tbody tr').first().getByRole('textbox', { name: 'Full Answer' }).fill(full_answer)
  await page.getByLabel('Quiz name').click()
}

test('a fresh quiz shows its computed columns between Q# and Alt Text', async ({ page }) => {
  await expect(page.getByRole('columnheader', { name: 'Alt Text' })).toBeVisible()
  await expect.poll(async () => {
    const headers = await grid(page).getByRole('columnheader').allTextContents()
    const titles = headers.map((title) => title.replaceAll(/\s+/g, ' ').trim())
    return titles.slice(titles.indexOf('Q#') + 1, titles.indexOf('Alt Text'))
  }).toEqual([
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

test('changing an expression\'s formula changes every column that works it, and survives a reload', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await answerFirstRow(page, 'Hello')
  await openExpression(page, 'answer_letter_count')
  await setFormula(page, '$length(qn.full_answer) * 3')
  await applyExpression(page, 'answer_letter_count')
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('15')
  await reloadOnceSaved(page)
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('15')
})

test('nothing is applied until Apply', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await answerFirstRow(page, 'Hello')
  await openExpression(page, 'answer_letter_count')
  await setFormula(page, '$length(qn.full_answer) * 3')
  await page.getByRole('dialog', { name: 'Expression: answer_letter_count' }).getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('5')
})

test('the preview shows what the draft formula comes to for a real question, as it is typed', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Q#' }).first().fill('1')
  await grid(page).locator('tbody tr').first().getByRole('textbox', { name: 'Full Answer' }).fill('Hello')
  await page.getByLabel('Quiz name').click()
  await openExpression(page, 'answer_reversed')
  const preview = page.getByRole('status', { name: 'Preview result' })
  await expect(preview).toContainText('olleH')
  await setFormula(page, '$length(qn.full_answer)')
  await expect(preview).toContainText('5')
  await setFormula(page, '$sum(')
  await expect(preview).toContainText('Fails')
})

test('the preview starts on the lowest Q# and can be pointed at any question of any quiz', async ({ page }) => {
  for (const [idx, [qnum, answer]] of ([['3', 'three'], ['1', 'one'], ['2', 'two']] as const).entries()) {
    await page.getByRole('textbox', { name: 'Q#' }).nth(idx).fill(qnum)
    await grid(page).locator('tbody tr').nth(idx).getByRole('textbox', { name: 'Full Answer' }).fill(answer)
  }
  await page.getByLabel('Quiz name').click()
  await openExpression(page, 'answer_reversed')
  const preview = page.getByRole('status', { name: 'Preview result' })
  await expect(preview).toContainText('eno')
  await page.getByRole('combobox', { name: 'Preview question' }).click()
  await page.getByRole('option', { name: /^3 ·/ }).click()
  await expect(preview).toContainText('eerht')
})

test('a formula that does not parse is named as it is typed, and its column says something is wrong once applied', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await openExpression(page, 'answer_letter_count')
  await setFormula(page, '$sum(')
  await expect(page.getByRole('dialog', { name: 'Expression: answer_letter_count' })).toContainText(/at \d+/)
  await applyExpression(page, 'answer_letter_count')
  await expect(cellOf(page, 0, 'Answer Letter Count').getByRole('img')).toHaveAttribute('aria-label', /The formula failed/)
})

test('a formula that would never end is stopped, and the page stays usable', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  await openExpression(page, 'answer_letter_count')
  await setFormula(page, '( $spin := function() { $spin() }; $spin() )')
  await applyExpression(page, 'answer_letter_count')
  await expect(cellOf(page, 0, 'Answer Letter Count').getByRole('img')).toHaveAttribute('aria-label', /took too long/)
  await page.getByRole('textbox', { name: 'Title' }).first().fill('Still typing')
  await expect(page.getByRole('textbox', { name: 'Title' }).first()).toHaveValue('Still typing')
})

test('a new expression is written and put to work in the same editor', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New expressing…' }).click()
  const editor = page.getByRole('dialog', { name: 'New expressing' })
  await editor.getByRole('textbox', { name: 'Expression label' }).fill('title_length')
  await setFormula(page, '$length(qn.title)')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await closeManage(page)
  await page.getByRole('textbox', { name: 'Title' }).first().fill('Leon')
  await page.getByLabel('Quiz name').click()
  await expect(cellOf(page, 0, 'Title Length')).toHaveText('4')
})

test('a new widget keeps its label and description, and brings a column titled after it', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New expressing…' }).click()
  const editor = page.getByRole('dialog', { name: 'New expressing' })
  await editor.getByRole('textbox', { name: 'Widget label' }).fill('backward')
  await editor.getByRole('textbox', { name: 'Widget description' }).fill('For the palindrome round.')
  await editor.getByRole('combobox', { name: 'Expression' }).click()
  await page.getByRole('option', { name: 'answer_reversed', exact: true }).click()
  await editor.getByRole('button', { name: 'Apply' }).click()
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Backward' })).toBeVisible()
  await reloadOnceSaved(page)
  await openManage(page)
  await page.getByRole('button', { name: 'Edit widget backward' }).click()
  await expect(page.getByRole('textbox', { name: 'Widget description' })).toHaveValue('For the palindrome round.')
})

test('a column can be added for anything the quiz can show, with its own title and width', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New column…' }).click()
  const editor = page.getByRole('dialog', { name: 'New column' })
  await editor.getByRole('textbox', { name: 'Column title' }).fill('More notes')
  await editor.getByRole('textbox', { name: 'Column label' }).fill('more_notes')
  await editor.getByRole('combobox', { name: 'Shows' }).click()
  await page.getByRole('option', { name: /^question\.notes/ }).click()
  await editor.getByRole('spinbutton', { name: 'Width (px)' }).fill('200')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'More notes' })).toBeVisible()
  await reloadOnceSaved(page)
  await expect(page.getByRole('columnheader', { name: 'More notes' })).toBeVisible()
})

test('an expression a column works cannot be removed, and one nobody works asks first', async ({ page }) => {
  await openExpression(page, 'clueing_full')
  const used = page.getByRole('dialog', { name: 'Expression: clueing_full' })
  await expect(used).toContainText('cannot be removed')
  await expect(used.getByRole('button', { name: /Remove expression/ })).toHaveCount(0)
  await used.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Edit expression answer_reversed' }).click()
  const spare = page.getByRole('dialog', { name: 'Expression: answer_reversed' })
  await spare.getByRole('button', { name: 'Remove expression' }).click()
  await spare.getByRole('button', { name: 'Keep it' }).click()
  await spare.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('group', { name: 'Expression answer_reversed' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit expression answer_reversed' }).click()
  await spare.getByRole('button', { name: 'Remove expression' }).click()
  await spare.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(page.getByRole('group', { name: 'Expression answer_reversed' })).toHaveCount(0)
})

test('a label already in use is refused with a reason', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New expressing…' }).click()
  const editor = page.getByRole('dialog', { name: 'New expressing' })
  await editor.getByRole('textbox', { name: 'Expression label' }).fill('clueing_full')
  await setFormula(page, '1')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toContainText('already has that label')
})

test('a column is retitled in place, and everything else is behind its gear', async ({ page }) => {
  await openManage(page)
  await page.getByRole('group', { name: 'Column Hint Full Sum' }).getByRole('textbox', { name: 'Column title' }).fill('Hint total')
  await page.getByRole('button', { name: 'Edit column Hint Numeral Sum' }).focus()
  await expect(page.getByRole('group', { name: 'Column Hint total' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit column Hint total' }).click()
  const editor = page.getByRole('dialog', { name: 'Column: Hint total' })
  await editor.getByRole('spinbutton', { name: 'Width (px)' }).fill('200')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Hint total' })).toBeVisible()
})

test('removing a column asks first, and leaves the widget it showed', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: 'Edit column Hint Numeral Sum' }).click()
  const editor = page.getByRole('dialog', { name: 'Column: Hint Numeral Sum' })
  await editor.getByRole('button', { name: 'Remove column' }).click()
  await editor.getByRole('button', { name: 'Keep it' }).click()
  await editor.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('group', { name: 'Column Hint Numeral Sum' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit column Hint Numeral Sum' }).click()
  await editor.getByRole('button', { name: 'Remove column' }).click()
  await editor.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(page.getByRole('group', { name: 'Column Hint Numeral Sum' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Widget hint_numeral' })).toBeVisible()
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Hint Numeral Sum' })).toHaveCount(0)
})

test('removing a widget asks first, and takes the columns that showed it', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: 'Edit widget hint_numeral' }).click()
  const editor = page.getByRole('dialog', { name: 'Expressing: hint_numeral' })
  await editor.getByRole('button', { name: 'Remove widget' }).click()
  await editor.getByRole('button', { name: 'Keep it' }).click()
  await editor.getByRole('button', { name: 'Remove widget' }).click()
  await editor.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(page.getByRole('group', { name: 'Column Hint Numeral Sum' })).toHaveCount(0)
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Hint Numeral Sum' })).toHaveCount(0)
})

/** The grid's first `count` column titles, left to right, with the blank grip column dropped */
async function headersShown(page: Page, count: number): Promise<string[]> {
  const headers = await grid(page).getByRole('columnheader').allTextContents()
  const titles = headers.map((title) => title.replaceAll(/\s+/g, ' ').trim()).filter((title) => title !== '')
  return titles.slice(0, count)
}

/** One column's grip, named exactly: several widgets' labels begin with a column's label */
function columnGrip(page: Page, label: string) {
  return manageDialog(page).getByRole('list', { name: 'Columns' }).getByRole('button', { name: `Reorder ${label}`, exact: true })
}

test('a column is dragged into a new place by its handle', async ({ page }) => {
  await openManage(page)
  await dragOnto(page, columnGrip(page, 'notes'), columnGrip(page, 'title'))
  await closeManage(page)
  await expect.poll(() => headersShown(page, 3)).toEqual(['Notes', 'Title', 'Clueing'])
})

// A quiz starts with Title, Clueing and Hint as its first three columns. Dropping Title onto
// the same row from the two directions has to put it on the two sides of that row: which half
// of the row the pointer came to rest in is the whole of what the author is saying.
test('a column dropped against the upper edge of a row lands above it', async ({ page }) => {
  await openManage(page)
  await dragOnto(page, columnGrip(page, 'title'), columnGrip(page, 'hint'), 'top')
  await closeManage(page)
  await expect.poll(() => headersShown(page, 3)).toEqual(['Clueing', 'Title', 'Hint'])
})

test('a column dropped against the lower edge of the same row lands below it', async ({ page }) => {
  await openManage(page)
  await dragOnto(page, columnGrip(page, 'title'), columnGrip(page, 'hint'), 'bottom')
  await closeManage(page)
  await expect.poll(() => headersShown(page, 3)).toEqual(['Clueing', 'Hint', 'Title'])
})

test('a column is moved by the arrow keys once its handle has focus', async ({ page }) => {
  await openManage(page)
  await stepBy(columnGrip(page, 'title'), 2)
  await closeManage(page)
  await expect.poll(() => headersShown(page, 3)).toEqual(['Clueing', 'Hint', 'Title'])
})

test('the widgets are listed in their order, and can be dragged too', async ({ page }) => {
  await openManage(page)
  const list = manageDialog(page).getByRole('list', { name: 'Widgets' })
  await dragOnto(page, list.getByRole('button', { name: 'Reorder hint_full' }), list.getByRole('button', { name: 'Reorder dumdum' }))
  await expect.poll(async () => {
    const labels = await manageDialog(page).getByRole('group', { name: /^Widget / }).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label')))
    return labels[0]
  }).toBe('Widget hint_full')
})

test('every dialog has a close button, and an editor is not dismissed by clicking behind it', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: 'Edit widget hint_full' }).click()
  const editor = page.getByRole('dialog', { name: 'Expressing: hint_full' })
  await page.mouse.click(4, 4)
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: 'Close' }).click()
  await expect(editor).toHaveCount(0)
  await manageDialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('the columns list shows each label beside its title where there is room, and not on a narrow screen', async ({ page }) => {
  await openManage(page)
  const label = page.getByRole('group', { name: 'Column Hint Full Sum' }).getByText('hint_full', { exact: true })
  // The source is also written under the title, so the label is the second of two.
  await expect(label).toHaveCount(2)
  await expect(label.last()).toBeVisible()
  await page.setViewportSize({ width: 600, height: 900 })
  await expect(label.last()).toBeHidden()
})

test('the input a formula reads is folded to one line each, and opens to a pretty-printed box', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Q#' }).first().fill('1')
  await page.getByLabel('Quiz name').click()
  await openExpression(page, 'answer_reversed')
  const editor = page.getByRole('dialog', { name: 'Expression: answer_reversed' })
  for (const name of ['quiz', 'qn']) { await expect(editor.getByText(name, { exact: true })).toBeVisible() }
  await expect(editor.getByLabel('Input: qn')).toHaveCount(0)
  await editor.getByText('qn', { exact: true }).click()
  await expect(editor.getByLabel('Input: qn')).toContainText('"clueing"')
  await editor.getByText(/^qns \(/).click()
  await expect(editor.getByLabel(/^Input: qns/)).toBeVisible()
})

test('the prompt for a chatbot is copied with the formula, the schemas and a real input', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await grid(page).locator('tbody tr').first().getByRole('textbox', { name: 'Full Answer' }).fill('stressed')
  await page.getByLabel('Quiz name').click()
  await openExpression(page, 'answer_reversed')
  await page.getByRole('button', { name: 'Copy a prompt for a chatbot' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('Here is what we have now')
  expect(copied).toContain('$reverse')
  expect(copied).toContain('"qns"')
  expect(copied).toContain('"stale"')
  expect(copied).toContain('"full_answer": "stressed"')
  expect(copied).toContain('send the formula alone')
})

test('a blank formula makes a prompt that asks for one', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openManage(page)
  await page.getByRole('button', { name: '+ New expressing…' }).click()
  await page.getByRole('button', { name: 'Copy a prompt for a chatbot' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('There is no formula yet. Please write one.')
  expect(copied).not.toContain('Here is what we have now')
})

test('sorting by a computed column orders the questions by what it came to', async ({ page }) => {
  await addColumn(page, 'answer_letter_count')
  for (const [idx, answer] of ['ccc', 'a', 'bb'].entries()) {
    await grid(page).locator('tbody tr').nth(idx).getByRole('textbox', { name: 'Full Answer' }).fill(answer)
  }
  await page.getByLabel('Quiz name').click()
  await page.getByRole('button', { name: 'Answer Letter Count' }).click()
  const answers = grid(page).locator('tbody tr').getByRole('textbox', { name: 'Full Answer' })
  // The two blank rows have no letters, which is nought and sorts first.
  await expect.poll(() => valuesOf(answers)).toEqual(['', '', 'a', 'bb', 'ccc'])
  await waitUntilSaved(page)
})

test('a locked quiz keeps its columns fixed, but its expressions can still be read and revised', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await openManage(page)
  await expect(page.getByRole('button', { name: '+ New column…' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '+ New expressing…' })).toBeDisabled()
  await closeManage(page)
  await openExpression(page, 'answer_reversed')
  await expect(page.getByRole('textbox', { name: 'Formula', exact: true })).toBeEditable()
})
