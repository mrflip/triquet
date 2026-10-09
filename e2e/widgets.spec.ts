import type { Page } from '@playwright/test'
import { addColumns, addWidgeting, addWidgetings, cellOf, closeManage, columnAdded, columnPanel, dragOnto, expect, freshWidgetLabel, grid, manageDialog, openManage, pickWidget, relabelWidgeting, reloadOnceSaved, stepBy, test, foldBy, unfoldBy, valuesOf, waitUntilSaved, widgetingPanel } from './support'

/** The widget editor writing a new widget, open over whichever dialog opened it */
function newWidgetDialog(page: Page) {
  return page.getByRole('dialog', { name: /^New widget(?!ing)/ })
}

/**
 * Write a new formula into the library, labelled `widget_label`, through the door beside the
 * catalogue, which puts it to work in the open quiz as it is written; relabel its widgeting
 * `label`, and close the gear's dialog
 */
async function addNewFormula(page: Page, widget_label: string, formula: string, label: string) {
  await openManage(page)
  await writeNewFormula(page, widget_label, formula)
  await relabelWidgeting(page, widget_label, label)
  await closeManage(page)
}

/** Through the gear's dialog, which must be open: write a new formula from *+ New widgeting…*'s door, which puts it to work */
async function writeNewFormula(page: Page, widget_label: string, formula: string) {
  await manageDialog(page).getByRole('button', { name: '+ New widgeting…' }).click()
  await manageDialog(page).getByRole('button', { name: 'New widget…' }).click()
  await newWidgetDialog(page).getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await setFormula(page, formula)
  await newWidgetDialog(page).getByRole('button', { name: 'Apply' }).click()
  await expect(newWidgetDialog(page)).toHaveCount(0)
  await expect(widgetingPanel(page, widget_label)).toBeVisible()
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

/** Through the gear's dialog, which must be open: remove the column titled `title` from its unfolded panel, saying yes when it asks */
async function removeColumn(page: Page, title: string) {
  const panel = columnPanel(page, title)
  await unfoldBy(panel, `Column ${title} in full`)
  await panel.getByRole('button', { name: 'Remove column' }).click()
  await panel.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(columnPanel(page, title)).toHaveCount(0)
}

/** Type a full answer into the first row */
async function answerFirstRow(page: Page, full_answer: string) {
  await grid(page).locator('tbody tr').first().getByRole('textbox', { name: 'Full Answer' }).fill(full_answer)
  await page.getByLabel('Quiz name').click()
}

test('a template fills in for every question, its widgeting giving one of its own or reading one from the bag', async ({ page }) => {
  await addWidgeting(page, 'blurb')
  const firstRow = grid(page).locator('tbody tr').first()
  await firstRow.getByRole('textbox', { name: 'Title' }).fill('Leon')
  await answerFirstRow(page, 'Trotsky')
  await expect(cellOf(page, 0, 'Blurb')).toContainText('Leon')
  await expect(cellOf(page, 0, 'Blurb')).toContainText('Trotsky')

  // Its own template, typed in its panel's folded line, kept as the box is left.
  await openManage(page)
  const widgeting = widgetingPanel(page, 'blurb')
  const template = widgeting.getByRole('textbox', { name: 'Template', exact: true })
  // A template that does not read is named beside its box, and not kept.
  await template.fill('{% if qn.title %}')
  await template.blur()
  await expect(widgeting.getByText(/^Template does not read as Liquid/)).toBeVisible()
  await template.fill('{{ qn.title }} / {{ qn.full_answer | upcase }}')
  await template.blur()
  await closeManage(page)
  await expect(cellOf(page, 0, 'Blurb')).toHaveText('Leon / TROTSKY')

  // One read from the bag, picked where the panel unfolds.
  await firstRow.getByRole('textbox', { name: 'Notes' }).fill('Said by {{ qn.title }}')
  await page.getByLabel('Quiz name').click()
  await openManage(page)
  await unfoldBy(widgeting, 'Widgeting blurb in full')
  await widgeting.getByRole('combobox', { name: 'Its template' }).click()
  await page.getByRole('option', { name: /^Read from the bag/ }).click()
  await widgeting.getByRole('combobox', { name: 'Read from' }).click()
  await page.getByRole('option', { name: 'notes', exact: true }).click()
  await expect(widgeting.getByRole('note', { name: 'Template of blurb' })).toContainText('Read from notes')
  await closeManage(page)
  await expect(cellOf(page, 0, 'Blurb')).toHaveText('Said by Leon')
  await reloadOnceSaved(page)
  await expect(cellOf(page, 0, 'Blurb')).toHaveText('Said by Leon')
})

test('a widgeting brings its column just before Alt Text, where the quiz shows one, and at the end where not', async ({ page }) => {
  await addWidgetings(page, ['clueing_full'])
  await addColumns(page, ['alt_text'])
  await addWidgetings(page, ['hint_full'])
  await expect.poll(() => headersShown(page, 8)).toEqual(['Title', 'Q#', 'Clueing', 'Full Answer', 'Notes', 'Clueing Full', 'Hint Full', 'Alt Text'])
})

test('a widgeting added from the gear works out its formula for every question', async ({ page }) => {
  await addWidgeting(page, 'answer_letter_count')
  await expect(page.getByRole('columnheader', { name: 'Answer Letter Count' })).toBeVisible()
  await answerFirstRow(page, 'Hello, World')
  await expect(cellOf(page, 0, 'Answer Letter Count')).toHaveText('10')
})

test('changing a widget\'s formula changes every column that works it, from a number to text, and survives a reload', async ({ page }) => {
  const widget_label = freshWidgetLabel('length')
  await addNewFormula(page, widget_label, '$length(qn.full_answer)', 'letters')
  await addWidgeting(page, widget_label, 'letters_again')
  await answerFirstRow(page, 'Hello')
  await expect(cellOf(page, 0, 'Letters')).toHaveText('5')
  await openWidget(page, widget_label)
  await setFormula(page, '$uppercase(qn.full_answer)')
  await applyWidget(page, widget_label)
  await expect(cellOf(page, 0, 'Letters')).toHaveText('HELLO')
  await expect(cellOf(page, 0, 'Letters Again')).toHaveText('HELLO')
  await reloadOnceSaved(page)
  await expect(cellOf(page, 0, 'Letters')).toHaveText('HELLO')
  await expect(cellOf(page, 0, 'Letters Again')).toHaveText('HELLO')
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

test('a new widget is written through the door beside the catalogue, and put to work as it is written', { tag: '@smoke' }, async ({ page }) => {
  const widget_label = freshWidgetLabel('title_length')
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  // Putting a widget to work writes no formula itself: that is the widget editor's.
  await expect(manageDialog(page).getByRole('textbox', { name: 'Formula', exact: true })).toHaveCount(0)
  await writeNewFormula(page, widget_label, '$length(qn.title)')
  // Made at once, its label the new widget's, with its column headed after it.
  await expect(columnPanel(page, titleOf(widget_label))).toBeVisible()
  await relabelWidgeting(page, widget_label, 'title_length')
  // A column still headed after the widgeting's label follows its relabel.
  await expect(columnPanel(page, 'Title Length')).toBeVisible()
  await closeManage(page)
  await page.getByRole('textbox', { name: 'Title' }).first().fill('Leon')
  await page.getByLabel('Quiz name').click()
  await expect(cellOf(page, 0, 'Title Length')).toHaveText('4')
})

/** How a label is headed: its words capitalized */
function titleOf(label: string): string {
  return label.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

test('a new widgeting is relabelled and described in its panel, and brings a column headed after it', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  await pickWidget(page, manageDialog(page).getByRole('combobox', { name: 'A new widgeting, for each question' }), 'answer_reversed')
  await relabelWidgeting(page, 'answer_reversed', 'backward')
  const panel = widgetingPanel(page, 'backward')
  await panel.getByRole('textbox', { name: 'Widgeting description' }).fill('For the palindrome round.')
  await panel.getByRole('textbox', { name: 'Widgeting label' }).focus()
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Backward' })).toBeVisible()
  await reloadOnceSaved(page)
  await openManage(page)
  await unfoldBy(widgetingPanel(page, 'backward'), 'Widgeting backward in full')
  await expect(widgetingPanel(page, 'backward').getByRole('textbox', { name: 'Widgeting description' })).toHaveValue('For the palindrome round.')
})

test('a label the questions already answer to is refused for a widgeting, with a reason, and stays to be changed', async ({ page }) => {
  await addWidgeting(page, 'answer_reversed')
  await openManage(page)
  const panel = widgetingPanel(page, 'answer_reversed')
  await unfoldBy(panel, 'Widgeting answer_reversed in full')
  await panel.getByRole('textbox', { name: 'Widgeting label' }).fill('title')
  await expect(panel).toContainText('Not kept yet: Relabel keeps it.')
  await panel.getByRole('button', { name: 'Relabel widgeting answer_reversed' }).click()
  await expect(panel).toContainText('already answer to')
  await expect(panel.getByRole('textbox', { name: 'Widgeting label' })).toHaveValue('title')
})

test('a column can be added for anything the quiz can show, made at once, then titled, labelled and sized in place', async ({ page }) => {
  await openManage(page)
  await columnAdded(page, 'notes')
  // A second column showing the notes, labelled apart from the first, and open for the rest of it.
  const panel = columnPanel(page, 'Notes')
  await expect(panel.getByRole('textbox', { name: 'Column label' })).toHaveValue('notes_2')
  await panel.getByRole('textbox', { name: 'Column label' }).fill('more_notes')
  await panel.getByRole('button', { name: 'Relabel column Notes' }).click()
  await expect(columnPanel(page, 'Notes').getByRole('textbox', { name: 'Column label' })).toHaveValue('more_notes')
  await columnPanel(page, 'Notes').getByRole('textbox', { name: 'Width (px)' }).first().fill('200')
  await columnPanel(page, 'Notes').getByRole('textbox', { name: 'Column title' }).first().fill('More notes')
  await columnPanel(page, 'Notes').getByRole('textbox', { name: 'Column title' }).first().press('Tab')
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'More notes' })).toBeVisible()
  await reloadOnceSaved(page)
  await expect(page.getByRole('columnheader', { name: 'More notes' })).toBeVisible()
})

test("a new column takes the name of what it shows: a lean quiz opts back into its hint", async ({ page }) => {
  await openManage(page)
  await columnAdded(page, 'hint')
  await expect(columnPanel(page, 'Hint')).toContainText('hint')
  await closeManage(page)
  await expect(page.getByRole('textbox', { name: 'Hint', exact: true })).toHaveCount(5)
})

test('a widget says how far it is put to work, in every hunt, and cannot be removed while anything works it', async ({ page }) => {
  // A widget of this test's own, so nothing another spec runs can change its counts.
  const widget_label = freshWidgetLabel('worked')
  await addNewFormula(page, widget_label, '1', 'worked')
  await openWidget(page, widget_label)
  const used = page.getByRole('dialog', { name: `Widget: ${widget_label}` })
  await expect(used.getByRole('status', { name: 'Usage' })).toContainText('Worked by 1 widgeting across 1 quiz, in 1 hunt.')
  await expect(used).toContainText('It cannot be removed while a widgeting works it.')
  await expect(used.getByRole('button', { name: 'Remove widget' })).toHaveCount(0)
})

test('a widget nobody works asks first, and is removed', async ({ page }) => {
  const widget_label = freshWidgetLabel('spare')
  await addNewFormula(page, widget_label, '1', 'spare')
  await openManage(page)
  await removeColumn(page, 'Spare')
  const widgeting = widgetingPanel(page, 'spare')
  await unfoldBy(widgeting, 'Widgeting spare in full')
  await widgeting.getByRole('button', { name: 'Remove widgeting' }).click()
  await widgeting.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(widgeting).toHaveCount(0)
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

test('the catalogue picks from the whole library, grouped by formulary, and finds a widget by what is typed', async ({ page }) => {
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  const picker = manageDialog(page).getByRole('combobox', { name: 'A new widgeting, for each question' })
  await expect(page.getByRole('listbox')).toBeVisible()
  const listbox = page.getByRole('listbox')
  for (const group of ['Formulas', 'Prompts']) { await expect(listbox.getByText(group, { exact: true })).toBeVisible() }
  await picker.fill('reversed')
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

test('a template written in the library is previewed over a real question as it is typed', async ({ page }) => {
  const widget_label = freshWidgetLabel('card')
  await grid(page).locator('tbody tr').first().getByRole('textbox', { name: 'Title' }).fill('Leon')
  await page.getByLabel('Quiz name').click()
  await page.getByRole('button', { name: 'Widget library' }).click()
  await page.getByRole('button', { name: '+ New widget…' }).click()
  const editor = newWidgetDialog(page)
  await editor.getByRole('combobox', { name: 'Formulary' }).click()
  await page.getByRole('option', { name: /^A template/ }).click()
  await editor.getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await expect(editor.getByRole('textbox', { name: 'Input formula' })).toHaveValue('$')
  const template = editor.getByRole('textbox', { name: 'Template', exact: true })
  await template.fill('Q: {{ qn.title | upcase }}')
  await expect(editor.getByRole('status', { name: 'Preview result' })).toContainText('Q: LEON')
  await template.fill('{% if qn.title %}')
  await expect(editor.getByRole('status', { name: 'Preview result' })).toContainText('Fails')
  await template.fill('Q: {{ qn.title }}')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.getByRole('group', { name: `Widget ${widget_label}` })).toContainText('template')
})

test('a column is retitled in place, and the rest of it unfolds beneath its row', async ({ page }) => {
  await openManage(page)
  await columnPanel(page, 'Notes').getByRole('textbox', { name: 'Column title' }).fill('Remarks')
  await page.getByRole('button', { name: 'Column Full Answer in full' }).focus()
  const panel = columnPanel(page, 'Remarks')
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('textbox', { name: 'Column label' })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Column Remarks in full' }).click()
  await expect(panel.getByRole('textbox', { name: 'Column label' })).toHaveValue('notes')
  await expect(panel.getByRole('combobox', { name: 'Formula', exact: true })).toBeVisible()
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Remarks' })).toBeVisible()
  // The panel stays as it was left across a reopen.
  await openManage(page)
  await expect(columnPanel(page, 'Remarks').getByRole('textbox', { name: 'Column label' })).toHaveValue('notes')
})

test('removing a column asks first, and leaves the widgeting it showed', async ({ page }) => {
  await addWidgeting(page, 'hint_numeral')
  await openManage(page)
  const panel = columnPanel(page, 'Hint Numeral')
  await unfoldBy(panel, 'Column Hint Numeral in full')
  await panel.getByRole('button', { name: 'Remove column' }).click()
  await panel.getByRole('button', { name: 'Keep it' }).click()
  await expect(panel.getByRole('button', { name: 'Remove column' })).toBeVisible()
  await panel.getByRole('button', { name: 'Remove column' }).click()
  await panel.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(columnPanel(page, 'Hint Numeral')).toHaveCount(0)
  await expect(widgetingPanel(page, 'hint_numeral')).toBeVisible()
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Hint Numeral' })).toHaveCount(0)
})

test('removing a widgeting waits until no column shows it, saying which does, and then asks first', async ({ page }) => {
  await addWidgeting(page, 'hint_numeral')
  await openManage(page)
  const panel = widgetingPanel(page, 'hint_numeral')
  await unfoldBy(panel, 'Widgeting hint_numeral in full')
  await expect(panel).toContainText('The column “Hint Numeral” still shows that widgeting — remove the column first.')
  await expect(panel.getByRole('button', { name: 'Remove widgeting' })).toHaveCount(0)

  await removeColumn(page, 'Hint Numeral')
  await panel.getByRole('button', { name: 'Remove widgeting' }).click()
  await panel.getByRole('button', { name: 'Keep it' }).click()
  await panel.getByRole('button', { name: 'Remove widgeting' }).click()
  await panel.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(panel).toHaveCount(0)
  await closeManage(page)
  await expect(page.getByRole('columnheader', { name: 'Hint Numeral' })).toHaveCount(0)
})

test("a column showing a widgeting carries the widgeting's folded line beneath it, and the widgeting's panel lists the columns showing it", async ({ page }) => {
  await addWidgeting(page, 'hint_full')
  await openManage(page)
  await columnAdded(page, 'hint_full')
  // Beneath each column showing it, a copy of its panel, folded to its line: a formula's formula.
  const beneath = columnPanel(page, 'Hint Full').getByRole('group', { name: 'Widgeting hint_full', exact: true })
  await expect(beneath.getByRole('textbox', { name: 'Formula', exact: true })).toHaveValue(/numnum_hint/)
  await expect(beneath.getByRole('textbox', { name: 'Formula', exact: true })).not.toBeEditable()
  await unfoldBy(beneath, 'Widgeting hint_full in full')
  // Unfolded beneath one column, it lists the other, which unfolds to its own fields.
  await expect(beneath.getByRole('list', { name: 'Columns showing hint_full' }).getByRole('listitem')).toHaveCount(1)
  await beneath.getByRole('button', { name: 'Shown by column Hint Full' }).click()
  await expect(beneath.getByRole('textbox', { name: 'Column label' })).toHaveValue('hint_full')
  // In the run order it lists both.
  const panel = widgetingPanel(page, 'hint_full')
  await unfoldBy(panel, 'Widgeting hint_full in full')
  await expect(panel.getByRole('list', { name: 'Columns showing hint_full' }).getByRole('listitem')).toHaveCount(2)
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
  await expect.poll(() => headersShown(page, 3)).toEqual(['Notes', 'Title', 'Q#'])
})

// A quiz starts with Title, Q# and Clueing as its first three columns. Dropping Title onto
// the same row from the two directions has to put it on the two sides of that row: which half
// of the row the pointer came to rest in is the whole of what the author is saying.
test('a column dropped against the upper edge of a row lands above it', async ({ page }) => {
  await openManage(page)
  await dragOnto(page, columnGrip(page, 'title'), columnGrip(page, 'clueing'), 'top')
  await closeManage(page)
  await expect.poll(() => headersShown(page, 3)).toEqual(['Q#', 'Title', 'Clueing'])
})

test('a column dropped against the lower edge of the same row lands below it', async ({ page }) => {
  await openManage(page)
  await dragOnto(page, columnGrip(page, 'title'), columnGrip(page, 'clueing'), 'bottom')
  await closeManage(page)
  await expect.poll(() => headersShown(page, 3)).toEqual(['Q#', 'Clueing', 'Title'])
})

test('a column is moved by the arrow keys once its handle has focus', async ({ page }) => {
  await openManage(page)
  await stepBy(columnGrip(page, 'title'), 2)
  await closeManage(page)
  await expect.poll(() => headersShown(page, 3)).toEqual(['Q#', 'Clueing', 'Title'])
})

test('the widgetings are listed in run order, and can be dragged too', async ({ page }) => {
  await addWidgetings(page, ['dumdum', 'hint_full'])
  await openManage(page)
  const list = manageDialog(page).getByRole('list', { name: 'Widgetings' })
  await dragOnto(page, list.getByRole('button', { name: 'Reorder hint_full' }), list.getByRole('button', { name: 'Reorder dumdum' }))
  await expect.poll(async () => {
    const labels = await list.getByRole('group', { name: /^Widgeting / }).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label')))
    return labels[0]
  }).toBe('Widgeting hint_full')
})

test('every dialog has a close button, and an editor is not dismissed by clicking behind it', async ({ page }) => {
  await addWidgeting(page, 'hint_full')
  await openManage(page)
  const panel = widgetingPanel(page, 'hint_full')
  await unfoldBy(panel, 'Widgeting hint_full in full')
  await panel.getByRole('button', { name: 'Edit the widget…' }).click()
  const editor = page.getByRole('dialog', { name: 'Widget: hint_full' })
  await page.mouse.click(4, 4)
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await manageDialog(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a column row gives up its label, then what it shows, then its width, as the dialog narrows', async ({ page }) => {
  await addWidgeting(page, 'hint_full')
  await openManage(page)
  const row = page.getByRole('group', { name: 'Column Hint Full' })
  // The new column arrived open; folded, its row alone has these.
  await foldBy(row, 'Column Hint Full in full')
  // The widget is labelled as the column is, so the picked source says it before the label, and the
  // widgeting's line beneath the row after it.
  const label = row.getByText('hint_full', { exact: true }).nth(1)
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

test('what a column shows and its width are changed in place, and kept; a header still after what it showed follows', async ({ page }) => {
  await addWidgeting(page, 'hint_full')
  await openManage(page)
  await foldBy(columnPanel(page, 'Hint Full'), 'Column Hint Full in full')
  await columnPanel(page, 'Hint Full').getByRole('combobox', { name: 'Shows' }).click()
  await page.getByRole('option', { name: /^hint — / }).click()
  const row = columnPanel(page, 'Hint')
  await row.getByRole('textbox', { name: 'Width (px)' }).fill('250')
  await row.getByRole('textbox', { name: 'Column title' }).focus()
  await closeManage(page)
  await reloadOnceSaved(page)
  await openManage(page)
  await expect(row.getByRole('combobox', { name: 'Shows' })).toHaveText('hint')
  await expect(row.getByRole('textbox', { name: 'Width (px)' })).toHaveValue('250')
})

test('Q# starts centered, and a column\'s alignment steps on from its mark, header and cells alike, and is kept', async ({ page }) => {
  const head = (colname: string) => grid(page).getByRole('columnheader', { name: colname, exact: true })
  const firstBox = (colname: string) => grid(page).getByRole('textbox', { name: colname, exact: true }).first()
  await expect(head('Q#')).toHaveCSS('text-align', 'center')
  await expect(firstBox('Q#')).toHaveCSS('text-align', 'center')
  await expect(firstBox('Title')).toHaveCSS('text-align', 'left')

  await openManage(page)
  const row = manageDialog(page).getByRole('group', { name: 'Column Title' })
  await expect(manageDialog(page).getByRole('group', { name: 'Column Q#' }).getByRole('button', { name: 'Alignment of Q#: center' })).toBeVisible()
  await row.getByRole('button', { name: 'Alignment of Title: left' }).click()
  await row.getByRole('button', { name: 'Alignment of Title: center' }).click()
  await expect(row.getByRole('button', { name: 'Alignment of Title: right' })).toBeVisible()
  await closeManage(page)
  await expect(head('Title')).toHaveCSS('text-align', 'right')
  await expect(firstBox('Title')).toHaveCSS('text-align', 'right')

  await reloadOnceSaved(page)
  await expect(firstBox('Title')).toHaveCSS('text-align', 'right')
  await openManage(page)
  await row.getByRole('button', { name: 'Alignment of Title: right' }).click()
  await expect(row.getByRole('button', { name: 'Alignment of Title: left' })).toBeVisible()
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
  await addWidgeting(page, 'numnum_clueing')
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
  await manageDialog(page).getByRole('button', { name: 'New widget…' }).click()
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
