import type { Page } from '@playwright/test'
import { addWidgeting, cellOf, closeManage, dragOnto, expect, freshWidgetLabel, grid, manageDialog, newWidgetingDialog, openManage, pickWidget, reloadOnceSaved, stepBy, test, valuesOf, waitUntilSaved } from './support'

/** The widget editor writing a new widget, open over whichever dialog opened it */
function newWidgetDialog(page: Page) {
  return page.getByRole('dialog', { name: /^New widget(?!ing)/ })
}

/**
 * Write a new formula into the library, labelled `widget_label`, through the widgeting editor's
 * door, and put it to work in the open quiz under `label`; close the gear's dialog
 */
async function addNewFormula(page: Page, widget_label: string, formula: string, label: string) {
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  const editor = newWidgetingDialog(page)
  await editor.getByRole('textbox', { name: 'Widgeting label' }).fill(label)
  await editor.getByRole('button', { name: 'New widget…' }).click()
  await newWidgetDialog(page).getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await setFormula(page, formula)
  await newWidgetDialog(page).getByRole('button', { name: 'Apply' }).click()
  await expect(newWidgetDialog(page)).toHaveCount(0)
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toHaveCount(0)
  await closeManage(page)
}

/** Open the library, and then one of its formulas */
async function openWidget(page: Page, label: string) {
  await page.getByRole('button', { name: 'Widget library' }).click()
  await expect(page.getByRole('dialog', { name: 'Widget library' })).toBeVisible()
  await page.getByRole('button', { name: `Edit widget ${label}` }).click()
  await expect(page.getByRole('dialog', { name: `Widget: ${label}` })).toBeVisible()
}

/** Replace the formula in whichever editor is open */
async function setFormula(page: Page, formula: string) {
  await page.getByRole('textbox', { name: 'Formula', exact: true }).fill(formula)
}

/** Apply the open widget editor, and close the library behind it */
async function applyWidget(page: Page, label: string) {
  await page.getByRole('dialog', { name: `Widget: ${label}` }).getByRole('button', { name: 'Apply' }).click()
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

test('a widgeting added from the gear works out its formula for every question', async ({ page }) => {
  await addWidgeting(page, 'answer_letter_count')
  await expect(page.getByRole('columnheader', { name: 'Answer Letter Count' })).toBeVisible()
  await answerFirstRow(page, 'Hello, World')
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('10')
})

test('a text column shows text', async ({ page }) => {
  await addWidgeting(page, 'answer_reversed')
  await answerFirstRow(page, 'stressed')
  await expect(cellOf(page, 0, 'Answer Reversed')).toHaveText('desserts')
})

test('a column keeps what it shows after a reload, and where it was put', async ({ page }) => {
  await addWidgeting(page, 'answer_letter_count')
  await answerFirstRow(page, 'Hello')
  await reloadOnceSaved(page)
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('5')
})

test('changing a widget\'s formula changes every column that works it, and survives a reload', async ({ page }) => {
  const widget_label = freshWidgetLabel('length')
  await addNewFormula(page, widget_label, '$length(qn.full_answer)', 'letters')
  await addWidgeting(page, widget_label, 'letters_again')
  await answerFirstRow(page, 'Hello')
  await expect(cellOf(page, 0, 'Letters')).toHaveText('5')
  await openWidget(page, widget_label)
  await setFormula(page, '$length(qn.full_answer) * 3')
  await applyWidget(page, widget_label)
  await expect(cellOf(page, 0, 'Letters')).toHaveText('15')
  await expect(cellOf(page, 0, 'Letters Again')).toHaveText('15')
  await reloadOnceSaved(page)
  await expect(cellOf(page, 0, 'Letters')).toHaveText('15')
})

test('nothing is applied until Apply', async ({ page }) => {
  await addWidgeting(page, 'answer_letter_count')
  await answerFirstRow(page, 'Hello')
  await openWidget(page, 'answer_letter_count')
  await setFormula(page, '$length(qn.full_answer) * 3')
  await page.getByRole('dialog', { name: 'Widget: answer_letter_count' }).getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('5')
})

test('the preview shows what the draft formula comes to for a real question, as it is typed', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Q#' }).first().fill('1')
  await grid(page).locator('tbody tr').first().getByRole('textbox', { name: 'Full Answer' }).fill('Hello')
  await page.getByLabel('Quiz name').click()
  await openWidget(page, 'answer_reversed')
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
  await openWidget(page, 'answer_reversed')
  const preview = page.getByRole('status', { name: 'Preview result' })
  await expect(preview).toContainText('eno')
  await page.getByRole('combobox', { name: 'Preview question' }).click()
  await page.getByRole('option', { name: /^3 ·/ }).click()
  await expect(preview).toContainText('eerht')
})

test('a formula that does not parse is named as it is typed, and its column says something is wrong once applied', async ({ page }) => {
  const widget_label = freshWidgetLabel('broken')
  await addNewFormula(page, widget_label, '$length(qn.full_answer)', 'letters')
  await openWidget(page, widget_label)
  await setFormula(page, '$sum(')
  await expect(page.getByRole('dialog', { name: `Widget: ${widget_label}` })).toContainText(/at \d+/)
  await applyWidget(page, widget_label)
  await expect(cellOf(page, 0, 'Letters').getByRole('img')).toHaveAttribute('aria-label', /The formula failed/)
})

test('a formula that would never end is stopped, and the page stays usable', async ({ page }) => {
  const widget_label = freshWidgetLabel('spin')
  await addNewFormula(page, widget_label, '( $spin := function() { $spin() }; $spin() )', 'spinning')
  await expect(cellOf(page, 0, 'Spinning').getByRole('img')).toHaveAttribute('aria-label', /took too long/)
  await page.getByRole('textbox', { name: 'Title' }).first().fill('Still typing')
  await expect(page.getByRole('textbox', { name: 'Title' }).first()).toHaveValue('Still typing')
})

test('a new widget is written through the widgeting editor\'s door, and put to work at once', async ({ page }) => {
  const widget_label = freshWidgetLabel('title_length')
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  const editor = newWidgetingDialog(page)
  // The widgeting editor writes no formula itself: that is the widget editor's.
  await expect(editor.getByRole('textbox', { name: 'Formula', exact: true })).toHaveCount(0)
  await editor.getByRole('button', { name: 'New widget…' }).click()
  await newWidgetDialog(page).getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await setFormula(page, '$length(qn.title)')
  await newWidgetDialog(page).getByRole('button', { name: 'Apply' }).click()
  // Back in the widgeting editor, the new widget is the one picked.
  await expect(editor.getByRole('combobox', { name: 'Widget' })).toHaveValue(/^Title Length/)
  await editor.getByRole('button', { name: 'Apply' }).click()
  // Blank, the widgeting's label is the new widget's.
  await expect(manageDialog(page).getByRole('group', { name: `Widgeting ${widget_label}` })).toBeVisible()
  await page.getByRole('button', { name: `Edit widgeting ${widget_label}` }).click()
  const widgeting = page.getByRole('dialog', { name: `Widgeting: ${widget_label}` })
  await widgeting.getByRole('textbox', { name: 'Widgeting label' }).fill('title_length')
  await widgeting.getByRole('button', { name: 'Apply' }).click()
  await closeManage(page)
  await page.getByRole('textbox', { name: 'Title' }).first().fill('Leon')
  await page.getByLabel('Quiz name').click()
  // The column came with the widgeting, titled after its first label, and followed its rename.
  await expect(cellOf(page, 0, widget_label.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))).toHaveText('4')
})

test('a new widgeting keeps its label and description, and brings a column titled after it', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  const editor = newWidgetingDialog(page)
  await pickWidget(page, editor, 'answer_reversed')
  await editor.getByRole('textbox', { name: 'Widgeting label' }).fill('backward')
  await editor.getByRole('textbox', { name: 'Widgeting description' }).fill('For the palindrome round.')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Backward' })).toBeVisible()
  await reloadOnceSaved(page)
  await openManage(page)
  await page.getByRole('button', { name: 'Edit widgeting backward' }).click()
  await expect(page.getByRole('textbox', { name: 'Widgeting description' })).toHaveValue('For the palindrome round.')
})

test('a label the questions already answer to is refused for a widgeting, with a reason', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  const editor = newWidgetingDialog(page)
  await pickWidget(page, editor, 'answer_reversed')
  await editor.getByRole('textbox', { name: 'Widgeting label' }).fill('title')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toContainText('which the questions already use')
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

test('a widget says how far it is put to work, in every hunt, and cannot be removed while anything works it', async ({ page }) => {
  await openWidget(page, 'clueing_full')
  const used = page.getByRole('dialog', { name: 'Widget: clueing_full' })
  // Every spec's hunt works it, so the counts depend on what else has run: at least this hunt's.
  await expect(used.getByRole('status', { name: 'Usage' })).toContainText(/Worked by \d+ widgetings? across \d+ quizz(es)?, in \d+ hunts?\./)
  await expect(used).toContainText('It cannot be removed while a widgeting works it.')
  await expect(used.getByRole('button', { name: 'Remove widget' })).toHaveCount(0)
})

test('a widget nobody works asks first, and is removed', async ({ page }) => {
  const widget_label = freshWidgetLabel('spare')
  await addNewFormula(page, widget_label, '1', 'spare')
  await openManage(page)
  await page.getByRole('button', { name: 'Edit widgeting spare' }).click()
  const widgeting = page.getByRole('dialog', { name: 'Widgeting: spare' })
  await widgeting.getByRole('button', { name: 'Remove widgeting' }).click()
  await widgeting.getByRole('button', { name: 'Yes, remove' }).click()
  await closeManage(page)

  await openWidget(page, widget_label)
  const spare = page.getByRole('dialog', { name: `Widget: ${widget_label}` })
  await expect(spare.getByRole('status', { name: 'Usage' })).toContainText('No widgeting works it, in any hunt.')
  await spare.getByRole('button', { name: 'Remove widget' }).click()
  await spare.getByRole('button', { name: 'Keep it' }).click()
  await spare.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('group', { name: `Widget ${widget_label}` })).toBeVisible()
  await page.getByRole('button', { name: `Edit widget ${widget_label}` }).click()
  await spare.getByRole('button', { name: 'Remove widget' }).click()
  await spare.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(page.getByRole('group', { name: `Widget ${widget_label}` })).toHaveCount(0)
})

test('a widget label the library already has is refused with a reason', async ({ page }) => {
  await page.getByRole('button', { name: 'Widget library' }).click()
  await page.getByRole('button', { name: '+ New widget…' }).click()
  const editor = newWidgetDialog(page)
  await editor.getByRole('textbox', { name: 'Widget label' }).fill('clueing_full')
  await setFormula(page, '1')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toContainText('already has that label')
})

test('the widgeting editor picks from the whole library, grouped by formulary, and finds a widget by what is typed', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  const editor = newWidgetingDialog(page)
  await editor.getByRole('combobox', { name: 'Widget' }).click()
  const listbox = page.getByRole('listbox')
  for (const group of ['Formulas', 'Prompts']) { await expect(listbox.getByText(group, { exact: true })).toBeVisible() }
  await editor.getByRole('combobox', { name: 'Widget' }).fill('reversed')
  await expect(listbox.getByRole('option')).toHaveCount(1)
  await expect(listbox.getByRole('option')).toContainText('answer_reversed')
})

test('a widget written in the library itself chooses its formulary first', async ({ page }) => {
  const widget_label = freshWidgetLabel('riddler')
  await page.getByRole('button', { name: 'Widget library' }).click()
  await page.getByRole('button', { name: '+ New widget…' }).click()
  const editor = newWidgetDialog(page)
  await editor.getByRole('combobox', { name: 'Formulary' }).click()
  await page.getByRole('option', { name: /^A prompt/ }).click()
  await editor.getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await expect(editor.getByRole('textbox', { name: 'Input formula' })).toHaveValue("{ 'clueing': qn.clueing }")
  await editor.getByRole('textbox', { name: 'Prompt', exact: true }).fill('Riddle me {{clueing}}. Reply as {"answer": string}.')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.getByRole('group', { name: `Widget ${widget_label}` })).toContainText('prompt')
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

test('removing a column asks first, and leaves the widgeting it showed', async ({ page }) => {
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
  await expect(page.getByRole('group', { name: 'Widgeting hint_numeral' })).toBeVisible()
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Hint Numeral Sum' })).toHaveCount(0)
})

test('removing a widgeting asks first, and takes the columns that showed it', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: 'Edit widgeting hint_numeral' }).click()
  const editor = page.getByRole('dialog', { name: 'Widgeting: hint_numeral' })
  await editor.getByRole('button', { name: 'Remove widgeting' }).click()
  await editor.getByRole('button', { name: 'Keep it' }).click()
  await editor.getByRole('button', { name: 'Remove widgeting' }).click()
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

/** One column's grip, named exactly: several widgetings' labels begin with a column's label */
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

test('the widgetings are listed in run order, and can be dragged too', async ({ page }) => {
  await openManage(page)
  const list = manageDialog(page).getByRole('list', { name: 'Widgetings' })
  await dragOnto(page, list.getByRole('button', { name: 'Reorder hint_full' }), list.getByRole('button', { name: 'Reorder dumdum' }))
  await expect.poll(async () => {
    const labels = await manageDialog(page).getByRole('group', { name: /^Widgeting / }).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label')))
    return labels[0]
  }).toBe('Widgeting hint_full')
})

test('every dialog has a close button, and an editor is not dismissed by clicking behind it', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: 'Edit widgeting hint_full' }).click()
  const editor = page.getByRole('dialog', { name: 'Widgeting: hint_full' })
  await page.mouse.click(4, 4)
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: 'Close' }).click()
  await expect(editor).toHaveCount(0)
  await manageDialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a column row gives up its label, then what it shows, then its width, as the dialog narrows', async ({ page }) => {
  await openManage(page)
  const row = page.getByRole('group', { name: 'Column Hint Full Sum' })
  // The widget is labelled as the column is, so the picked source says it too: the label is the last.
  const label = row.getByText('hint_full', { exact: true }).last()
  const shows = row.getByRole('combobox', { name: 'Shows' })
  const width = row.getByRole('textbox', { name: 'Width (px)' })
  const title = row.getByRole('textbox', { name: 'Column title' })
  const visibleAt = async (viewport: number, expected: [boolean, boolean, boolean]) => {
    await page.setViewportSize({ width: viewport, height: 900 })
    for (const [field, shown] of [[label, expected[0]], [shows, expected[1]], [width, expected[2]]] as const) {
      await expect(field).toBeVisible({ visible: shown })
    }
    await expect(title).toBeVisible()
  }
  await visibleAt(1280, [true, true, true])
  await visibleAt(900, [false, true, true])
  await visibleAt(600, [false, false, true])
  await visibleAt(400, [false, false, false])
})

test('what a column shows and its width are changed in place, and kept', async ({ page }) => {
  await openManage(page)
  const row = page.getByRole('group', { name: 'Column Hint Full Sum' })
  await row.getByRole('combobox', { name: 'Shows' }).click()
  await page.getByRole('option', { name: 'question.notes', exact: false }).first().click()
  await row.getByRole('textbox', { name: 'Width (px)' }).fill('250')
  await row.getByRole('textbox', { name: 'Column title' }).focus()
  await closeManage(page)
  await reloadOnceSaved(page)
  await openManage(page)
  await expect(row.getByRole('combobox', { name: 'Shows' })).toHaveText('question.notes')
  await expect(row.getByRole('textbox', { name: 'Width (px)' })).toHaveValue('250')
})

test('the input a formula reads is folded to one line each, and opens to a pretty-printed box', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Q#' }).first().fill('1')
  await page.getByLabel('Quiz name').click()
  await openWidget(page, 'answer_reversed')
  const editor = page.getByRole('dialog', { name: 'Widget: answer_reversed' })
  for (const name of ['quiz', 'qn']) { await expect(editor.getByText(name, { exact: true })).toBeVisible() }
  await expect(editor.getByLabel('Input: qn')).toHaveCount(0)
  await editor.getByText('qn', { exact: true }).click()
  await expect(editor.getByLabel('Input: qn')).toContainText('"clueing"')
  await editor.getByText(/^qns \(/).click()
  await expect(editor.getByLabel(/^Input: qns/)).toBeVisible()
})

test("a formula reads the smith's note, and the hunt and realm the quiz sits in", async ({ page }) => {
  await page.getByRole('textbox', { name: 'Smith\'s note', exact: true }).fill('Meta: their initials.')
  await page.getByLabel('Quiz name').click()
  await waitUntilSaved(page)
  await openWidget(page, 'answer_reversed')
  const editor = page.getByRole('dialog', { name: 'Widget: answer_reversed' })
  for (const name of ['hunt', 'realm']) { await expect(editor.getByText(name, { exact: true })).toBeVisible() }
  // A new hunt's quiz shares the hunt's label, so the two labels match.
  await setFormula(page, "quiz.smiths_note & ' | ' & realm.title & ' | ' & $string(hunt.label = quiz_label)")
  await expect(page.getByRole('status', { name: 'Preview result' })).toContainText('Meta: their initials. | Home | true')
})

test('the prompt for a chatbot is copied with the formula, the schemas and a real input', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await grid(page).locator('tbody tr').first().getByRole('textbox', { name: 'Full Answer' }).fill('stressed')
  await page.getByLabel('Quiz name').click()
  await openWidget(page, 'answer_reversed')
  await page.getByRole('button', { name: 'Copy a prompt for a chatbot' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('Here is what we have now')
  expect(copied).toContain('$reverse')
  expect(copied).toContain('"qns"')
  expect(copied).toContain('"numnum_clueing"')
  expect(copied).toContain('"full_answer": "stressed"')
  expect(copied).toContain('send the formula alone')
})

test('a blank formula makes a prompt that asks for one', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  await newWidgetingDialog(page).getByRole('button', { name: 'New widget…' }).click()
  await page.getByRole('button', { name: 'Copy a prompt for a chatbot' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('There is no formula yet. Please write one.')
  expect(copied).not.toContain('Here is what we have now')
})

test('sorting by a computed column orders the questions by what it came to', async ({ page }) => {
  await addWidgeting(page, 'answer_letter_count')
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

test('a locked quiz keeps its columns fixed, but the library can still be read and revised', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await openManage(page)
  await expect(page.getByRole('button', { name: '+ New column…' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '+ New widgeting…' })).toBeDisabled()
  await closeManage(page)
  await openWidget(page, 'answer_reversed')
  await expect(page.getByRole('textbox', { name: 'Formula', exact: true })).toBeEditable()
})
