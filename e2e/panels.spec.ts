import { addWidgeting, addWidgetings, expect, exportedQuizzes, freshWidgetLabel, grid, preparedExport, showTab, test } from './support'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test.beforeEach(async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region?')
  await page.getByLabel('Quiz name').click()
  // Leaves the Raw Export tab showing.
  await preparedExport(page)
  await expect(page.getByRole('textbox', { name: 'Raw Export' })).toHaveValue(/"title":"Quiz one"/)
})

test('the export and import tabs come in order, Spreadsheet first and showing', async ({ page }) => {
  const tabs = page.getByRole('tablist', { name: 'Export / Import' }).getByRole('tab')
  await expect(tabs).toHaveText(['Spreadsheet', 'Raw Export', 'Import', 'Library', 'Full History', 'LL Export'])
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Spreadsheet' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', { name: 'Copy for Sheets' })).toBeVisible()
})

test('the export is read only when asked, and a change on screen withdraws it for the Prepare button again', async ({ page }) => {
  const section = page.getByRole('tabpanel', { name: 'Raw Export' })
  await expect(section.getByRole('button', { name: 'Prepare export' })).toBeHidden()
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which county?')
  await page.getByLabel('Quiz name').click()
  await expect(section.getByRole('textbox', { name: 'Raw Export' })).toBeHidden()
  await expect(section.getByRole('button', { name: 'Copy' })).toBeHidden()
  expect(await preparedExport(page)).toContain('Which county?')
})

test('Refresh export, beside Copy, reads the hunt again', async ({ page }) => {
  const section = page.getByRole('tabpanel', { name: 'Raw Export' })
  await section.getByRole('button', { name: 'Refresh export' }).click()
  await expect(section.getByRole('textbox', { name: 'Raw Export' })).toHaveValue(/"title":"Quiz one"/)
  await expect(section.getByRole('button', { name: 'Refresh export' })).toBeEnabled()
})

test('an export prepared on its tab is still there after a visit to another', async ({ page }) => {
  await showTab(page, 'Spreadsheet')
  await showTab(page, 'Raw Export')
  await expect(page.getByRole('textbox', { name: 'Raw Export' })).toHaveValue(/"title":"Quiz one"/)
})

test('Raw Export emits the whole hunt as compact JSON', async ({ page }) => {
  const exportBox = page.getByRole('textbox', { name: 'Raw Export' })
  await expect(exportBox).toHaveValue(/"title":"Quiz one"/)
  const text = await exportBox.inputValue()
  const hunt = JSON.parse(text) as { label: string }
  expect(exportedQuizzes(text).map((quiz) => [quiz.realm, quiz.title])).toEqual([['home', 'Quiz one']])
  await expect(page).toHaveURL(new RegExp(`/~[a-z0-9_]+/${hunt.label}/`))
  // Compact, not pretty-printed: backup material, not prose.
  expect(text).not.toContain('\n')
  // Everything by label: ids are the database's, and mean nothing to a smith.
  expect(text).not.toContain('"id"')
})

test('the Copy button copies and says so', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const section = page.getByRole('tabpanel', { name: 'Raw Export' })
  await section.getByRole('button', { name: 'Copy' }).click()
  await expect(section.getByText('Copied')).toBeVisible()
  const onClipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(onClipboard).toContain('Quiz one')
})

test('a refused clipboard falls back to selecting the text, never to silence', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('refused')) },
      configurable: true,
    })
  })
  const section = page.getByRole('tabpanel', { name: 'Raw Export' })
  await section.getByRole('button', { name: 'Copy' }).click()
  await expect(section.getByText('Selected — press Ctrl/Cmd+C')).toBeVisible()
  const selected = await page.getByRole('textbox', { name: 'Raw Export' }).evaluate(
    (node) => (node as HTMLTextAreaElement).selectionEnd - (node as HTMLTextAreaElement).selectionStart,
  )
  expect(selected).toBeGreaterThan(0)
})

test('the Widgets panel lists the quiz\'s widgetings in run order, each with its counts, and opens to its prompt verbatim', async ({ page }) => {
  const panel = page.getByRole('region', { name: 'Widgets' })
  // A fresh quiz starts lean, and the panel says how to put a widget to work.
  await expect(panel).toContainText('This quiz puts no widgets to work yet')
  await addWidgetings(page, ['dumdum', 'numnum_clueing', 'numnum_hint', 'butnot_ishes'])
  const folds = panel.getByRole('button', { expanded: false })
  await expect(folds.first()).toContainText('dumdum')
  await expect(folds.nth(3)).toContainText('butnot_ishes')
  // A fresh quiz's questions are blank: nothing asked, every formula's sum missing.
  await expect(panel.getByRole('group', { name: 'Cells of dumdum' })).toHaveText(/^\d+ blank$/)
  await panel.getByRole('button', { name: /^dumdum/ }).click()
  await expect(panel.getByRole('textbox', { name: 'Prompt: dumdum' })).toHaveValue(/\{\{clueing\}\}/)
  await expect(panel.getByRole('textbox', { name: 'Input formula: dumdum' })).toHaveValue(/qn\.clueing/)
  await expect(panel.getByRole('button', { name: 'Copy a prompt for a chatbot' })).toBeVisible()
})

test('a formula\'s counts follow what its cells come to', async ({ page }) => {
  await addWidgeting(page, 'answer_reversed')
  const panel = page.getByRole('region', { name: 'Widgets' })
  const counts = panel.getByRole('group', { name: 'Cells of answer_reversed' })
  await expect(counts).toHaveText(/^\d+ blank$/)
  await grid(page).locator('tbody tr').first().getByRole('textbox', { name: 'Full Answer' }).fill('stressed')
  await page.getByLabel('Quiz name').click()
  await expect(counts).toHaveText(/^1 current • \d+ blank$/)
  await panel.getByRole('button', { name: /^answer_reversed/ }).click()
  await expect(panel.getByRole('textbox', { name: 'Formula: answer_reversed' })).toHaveValue(/\$reverse/)
})

test('a folded widgeting gives up its description, then its widget, then how its cells stand, as the list narrows', async ({ page }) => {
  await addWidgeting(page, 'answer_reversed')
  const panel = page.getByRole('region', { name: 'Widgets' })
  const summary = panel.getByRole('button', { name: /^answer_reversed/ })
  const description = summary.getByText('The full answer written backward.')
  const widget = summary.getByText('formula answer_reversed')
  const counts = panel.getByRole('group', { name: 'Cells of answer_reversed' })
  await expect(description).toBeVisible()
  await expect(widget).toBeVisible()
  await expect(counts).toBeVisible()

  await page.setViewportSize({ width: 860, height: 900 })
  await expect(description).toBeHidden()
  await expect(widget).toBeVisible()
  await page.setViewportSize({ width: 640, height: 900 })
  await expect(widget).toBeHidden()
  await expect(counts).toBeVisible()
  await page.setViewportSize({ width: 420, height: 900 })
  await expect(counts).toBeHidden()
  await expect(summary).toContainText('answer_reversed')
})

test('a widgeting\'s description is a snippet while folded, and gives way to the whole of it when open', async ({ page }) => {
  await addWidgeting(page, 'answer_reversed')
  const panel = page.getByRole('region', { name: 'Widgets' })
  const summary = panel.getByRole('button', { name: /^answer_reversed/ })
  const snippet = summary.getByText('The full answer written backward.')
  await expect(snippet).toHaveCSS('text-overflow', 'ellipsis')
  await summary.click()
  await expect(snippet).toBeHidden()
  await expect(panel).toContainText('The widget: The full answer written backward.')
})

test('LL Export holds the quiz in the league\'s format, one record per question', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which **region**?\nOf | Spain')
  await page.getByLabel('Quiz name').click()
  const section = await showTab(page, 'LL Export')
  await section.getByRole('combobox', { name: 'LL Export mode' }).selectOption({ label: 'Plain' })
  await expect(section.getByRole('textbox', { name: 'LL Export' })).toHaveValue(/\|Which \[b\]region\[\/b\]\? \[br\] Of ¦ Spain\|\|\$\$/)
})

test('LL Export also holds the smith\'s note in BBCode, its lines kept and its dollars and pipes as written, in a box of its own', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Smith\'s note', exact: true }).fill('Theme: *princes*.\n\nMeta: $$ | initials.')
  await page.getByLabel('Quiz name').click()
  const section = await showTab(page, 'LL Export')
  await expect(section.getByRole('textbox', { name: 'LL Smith\'s note' })).toHaveValue('Theme: [i]princes[/i].[br]\n[br]\nMeta: $$ | initials.')
})

test('LL Export\'s mode, going live at first, puts the Q1 preamble or the smith\'s note ahead of the first question', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Smith\'s note', exact: true }).fill('Theme: *princes*.')
  await page.getByLabel('Quiz name').click()
  const section = await showTab(page, 'LL Export')
  const records = section.getByRole('textbox', { name: 'LL Export' })
  const mode = section.getByRole('combobox', { name: 'LL Export mode' })
  const preamble = section.getByLabel('Q1 preamble')
  await expect(mode).toHaveValue('go_live')
  await expect(preamble).toHaveValue('Important: Read the smith\'s note before you play![br][br]')
  await expect(records).toHaveValue(/^\|Important: Read the smith's note before you play!\[br\]\[br\]Which region\?\|\|\$\$/)

  await mode.selectOption({ label: 'Playtesting' })
  await expect(records).toHaveValue(/^\|Theme: \[i\]princes\[\/i\]\. \[br\] {2}\[br\] Which region\?\|\|\$\$/)
  await expect(preamble).toBeHidden()

  await mode.selectOption({ label: 'Plain' })
  await expect(records).toHaveValue(/^\|Which region\?\|\|\$\$/)

  await mode.selectOption({ label: 'Go live' })
  await preamble.fill('See the note![br]')
  await page.getByLabel('Quiz name').click()
  await expect(records).toHaveValue(/^\|See the note!\[br\]Which region\?\|\|\$\$/)
  await mode.selectOption({ label: 'Plain' })
  // The preamble is kept with the quiz; the mode is not, and goes live again.
  await page.reload()
  const reloaded = await showTab(page, 'LL Export')
  await expect(reloaded.getByRole('combobox', { name: 'LL Export mode' })).toHaveValue('go_live')
  await expect(reloaded.getByLabel('Q1 preamble')).toHaveValue('See the note![br]')
})

test('the info button beside the LL Export mode explains each mode', async ({ page }) => {
  const section = await showTab(page, 'LL Export')
  await section.getByRole('button', { name: 'About the LL Export modes' }).hover()
  await expect(page.getByRole('tooltip')).toContainText('lowest-ranked Q#')
})

test('every read-only export box has a Copy button', async ({ page }) => {
  for (const [tabname, boxCount] of [['Spreadsheet', 1], ['Raw Export', 1], ['LL Export', 2]] as const) {
    const section = await showTab(page, tabname)
    await expect(section.getByRole('button', { name: 'Copy', exact: true })).toHaveCount(boxCount)
  }
})

test('Download Full History hands over the quiz\'s history as a zip, from its own tab alone', async ({ page }) => {
  const rawSection = await showTab(page, 'Raw Export')
  await expect(rawSection.getByRole('button', { name: 'Download Full History' })).toHaveCount(0)
  const section = await showTab(page, 'Full History')
  const downloading = page.waitForEvent('download')
  await section.getByRole('button', { name: 'Download Full History' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
})

test('the quiet note beside it explains, in a dialog, how to see the history', async ({ page }) => {
  const section = await showTab(page, 'Full History')
  await section.getByRole('button', { name: '(How to see Full History)' }).click()

  const help = page.getByRole('dialog', { name: 'How to see Full History' })
  await expect(help.getByText(/which a computer can expand into a file tree/)).toBeVisible()
  await expect(help.getByText(/I don't know how to install Fork/)).toBeVisible()

  await help.getByRole('button', { name: 'Close' }).click()
  await expect(help).toBeHidden()
})

test('the library is handed out on its own, and a pasted library is merged into it by label', async ({ page }) => {
  const section = await showTab(page, 'Library')
  await expect(section.getByRole('textbox', { name: 'Library export' })).toHaveValue(/"numnum_hint":\{/)
  // A label of this test's own: the library is every hunt's, and the specs share one database.
  const label = freshWidgetLabel('pasted')
  const pasted = JSON.stringify({ widgets: [
    { label, formulary: 'jsonata', formula: '$uppercase(qn.title)' },
    { label: 'numnum_hint', formulary: 'jsonata', formula: '1' },
  ] })
  await section.getByRole('textbox', { name: 'Import library' }).fill(pasted)
  await section.getByRole('button', { name: 'Import library' }).click()
  await expect(section.getByRole('status')).toContainText('1 added, 0 revised, 0 unchanged, 1 skipped')
  await expect(section.getByText(/numnum_hint — skipped: it is a jsonata widget here, and an aibot widget in the library/)).toBeVisible()
  await expect(section.getByRole('textbox', { name: 'Library export' })).toHaveValue(new RegExp(String.raw`"${label}":\{`))
})

test("the Category spread panel says how to begin when the quiz has no category estimate entry", async ({ page }) => {
  const panel = page.getByRole('region', { name: 'Category spread' })
  await expect(panel).toContainText('This quiz has no category estimate entry yet.')
  await expect(panel.getByRole('button', { name: 'Category spread chart, full width' })).toHaveCount(0)
})
