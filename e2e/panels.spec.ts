import type { Locator } from '@playwright/test'
import { addWidgetings, expect, exportedQuizzes, freshWidgetLabel, grid, openPanel, preparedExport, reloadOnceSaved, showTab, test, unfoldBy, widgetingPanel } from './support'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

/** Whether the text box `box` has the whole of its text selected, and holds some to select */
async function selectsAll(box: Locator): Promise<boolean> {
  return await box.evaluate((node) => {
    const { selectionStart, selectionEnd, value } = node as HTMLTextAreaElement
    return value !== '' && selectionStart === 0 && selectionEnd === value.length
  })
}

test.beforeEach(async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region?')
  await page.getByLabel('Quiz name').click()
  // Leaves the Raw Export tab showing.
  await preparedExport(page)
  await expect(page.getByRole('textbox', { name: 'Raw Export' })).toHaveValue(/"title":"Quiz one"/)
})

test('the export and import tabs come in order, Spreadsheet first and showing', async ({ page }) => {
  await openPanel(page, 'Export / Import')
  const tabs = page.getByRole('tablist', { name: 'Export / Import' }).getByRole('tab')
  await expect(tabs).toHaveText(['Spreadsheet', 'Raw Export', 'Import', 'Library', 'Full History', 'LL Export'])
  await page.reload()
  await openPanel(page, 'Export / Import')
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

test('a refused clipboard falls back to selecting the whole text, never to silence, as a click on the box does', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('refused')) },
      configurable: true,
    })
  })
  const section = page.getByRole('tabpanel', { name: 'Raw Export' })
  const exportBox = section.getByRole('textbox', { name: 'Raw Export' })
  await section.getByRole('button', { name: 'Copy' }).click()
  await expect(section.getByText('Selected — press Ctrl/Cmd+C')).toBeVisible()
  await expect.poll(() => selectsAll(exportBox)).toBe(true)

  await exportBox.evaluate((node) => { (node as HTMLTextAreaElement).setSelectionRange(0, 0) })
  await exportBox.click()
  await expect.poll(() => selectsAll(exportBox)).toBe(true)
})

test('the Widgets panel lists the quiz\'s widgetings in run order, each with its counts, and opens to its prompt verbatim', async ({ page }) => {
  const panel = await openPanel(page, 'Widgets')
  // A fresh quiz starts lean, and the panel says so.
  await expect(panel).toContainText('This quiz puts no widgets to work yet')
  await addWidgetings(page, ['dumdum', 'numnum_clueing', 'numnum_hint', 'butnot_ishes'])
  await openPanel(page, 'Widgets')
  await expect.poll(() => runOrderShown(panel)).toEqual(['Widgeting dumdum', 'Widgeting numnum_clueing', 'Widgeting numnum_hint', 'Widgeting butnot_ishes'])
  // A fresh quiz's questions are blank: nothing asked, every formula's sum missing.
  await expect(panel.getByRole('group', { name: 'Cells of dumdum' })).toHaveText(/^\d+ blank$/)
  const dumdum = widgetingPanel(page, 'dumdum')
  await unfoldBy(dumdum, 'Widgeting dumdum in full')
  await expect(dumdum.getByRole('textbox', { name: 'Prompt: dumdum' })).toHaveValue(/\{\{clueing\}\}/)
  await expect(dumdum.getByRole('textbox', { name: 'Input formula: dumdum' })).toHaveValue(/qn\.clueing/)
  await expect(dumdum.getByRole('button', { name: 'Copy a prompt for a chatbot' })).toBeVisible()
})

/** The widgetings of the Widgets panel's run order, as their rows are named, in order */
async function runOrderShown(panel: Locator): Promise<(string | null)[]> {
  return await panel.getByRole('list', { name: 'Widgetings' }).getByRole('group', { name: /^Widgeting / }).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label')))
}

test.describe('with answer_reversed at work', () => {
  test.use({ layout: { widgetings: ['answer_reversed'] } })

  test('a formula\'s counts follow what its cells come to', async ({ page }) => {
    const panel = await openPanel(page, 'Widgets')
    const counts = panel.getByRole('group', { name: 'Cells of answer_reversed' })
    await expect(counts).toHaveText(/^\d+ blank$/)
    await grid(page).locator('tbody tr').first().getByRole('textbox', { name: 'Full Answer' }).fill('stressed')
    await page.getByLabel('Quiz name').click()
    await expect(counts).toHaveText(/^1 current • \d+ blank$/)
    await unfoldBy(widgetingPanel(page, 'answer_reversed'), 'Widgeting answer_reversed in full')
    await expect(panel.getByRole('textbox', { name: 'Formula: answer_reversed' })).toHaveValue(/\$reverse/)
  })

  test('a folded widgeting keeps its label, what it works and its line, and gives up how its cells stand as the list narrows', async ({ page }) => {
    await openPanel(page, 'Widgets')
    const row = widgetingPanel(page, 'answer_reversed')
    const counts = row.getByRole('group', { name: 'Cells of answer_reversed' })
    await expect(counts).toBeVisible()
    await page.setViewportSize({ width: 420, height: 900 })
    await expect(counts).toBeHidden()
    await expect(row).toContainText('answer_reversed formula answer_reversed')
    await expect(row.getByRole('textbox', { name: 'Formula', exact: true })).toHaveValue(/\$reverse/)
  })

  test('a widgeting is edited in the Widgets panel, as it would be beneath its column: its description, and the widget it works', async ({ page }) => {
    await openPanel(page, 'Widgets')
    const panel = widgetingPanel(page, 'answer_reversed')
    await unfoldBy(panel, 'Widgeting answer_reversed in full')
    await expect(panel).toContainText('The full answer written backward.')
    await panel.getByRole('textbox', { name: 'Widgeting description' }).fill('For the palindrome round.')
    await panel.getByRole('textbox', { name: 'Widgeting label' }).focus()
    await reloadOnceSaved(page)
    await openPanel(page, 'Widgets')
    await unfoldBy(widgetingPanel(page, 'answer_reversed'), 'Widgeting answer_reversed in full')
    await expect(widgetingPanel(page, 'answer_reversed').getByRole('textbox', { name: 'Widgeting description' })).toHaveValue('For the palindrome round.')
  })
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
  // The preamble is kept with the quiz; the mode is not, and goes live again. The export above is
  // drawn from the screen, not the server, so wait for the preamble to be saved before reloading.
  await reloadOnceSaved(page)
  const reloaded = await showTab(page, 'LL Export')
  await expect(reloaded.getByRole('combobox', { name: 'LL Export mode' })).toHaveValue('go_live')
  await expect(reloaded.getByLabel('Q1 preamble')).toHaveValue('See the note![br]')
})

test('Download Full History hands over the hunt\'s history as a zip, from its own tab alone', async ({ page }) => {
  const rawSection = await showTab(page, 'Raw Export')
  await expect(rawSection.getByRole('button', { name: 'Download Full History' })).toHaveCount(0)
  const section = await showTab(page, 'Full History')
  const downloading = page.waitForEvent('download')
  await section.getByRole('button', { name: 'Download Full History' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
})

test('the library is handed out on its own, and a pasted library is merged into it by label', { tag: '@smoke' }, async ({ page }) => {
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
  const panel = await openPanel(page, 'Category spread')
  await expect(panel).toContainText('This quiz has no category estimate entry yet.')
  await expect(panel.getByRole('button', { name: 'As a table' })).toHaveCount(0)
})

test('a panel under the quiz starts folded to its title bar, opens, and folds again, and one beside others widens to the whole row', async ({ page }) => {
  const panel = page.getByRole('region', { name: 'Members' })
  const fold = panel.getByRole('button', { name: 'Show this panel' })
  const blurb = panel.getByText('Who is on this hunt.')
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect(blurb).toBeHidden()
  await fold.click()
  await expect(blurb).toBeVisible()
  await fold.click()
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect(blurb).toBeHidden()
  await expect(panel.getByRole('heading', { name: 'Members' })).toBeVisible()
  await fold.click()
  await expect(blurb).toBeVisible()

  const widthOf = async () => {
    const box = await panel.boundingBox()
    return box?.width ?? 0
  }
  const restingWidth = await widthOf()
  const arrow = panel.getByRole('button', { name: 'Widen this panel to the whole row' })
  await arrow.click()
  await expect(arrow).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(widthOf).toBeGreaterThan(restingWidth)
  await arrow.click()
  await expect.poll(widthOf).toBe(restingWidth)
  // A panel the whole row wide already has no arrow to widen it.
  await expect(page.getByRole('region', { name: 'Widgets' }).getByRole('button', { name: 'Widen this panel to the whole row' })).toHaveCount(0)
})
