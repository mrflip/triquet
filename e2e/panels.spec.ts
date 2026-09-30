import { expect, preparedExport, showTab, test } from './support'

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
  await expect(tabs).toHaveText(['Spreadsheet', 'Raw Export', 'Import', 'Full History', 'LL Export'])
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Spreadsheet' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', { name: 'Copy for Sheets' })).toBeVisible()
})

test('the export is read only when asked, and a change on screen empties it again', async ({ page }) => {
  const exportBox = page.getByRole('textbox', { name: 'Raw Export' })
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which county?')
  await page.getByLabel('Quiz name').click()
  await expect(exportBox).toHaveValue('')
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
  const hunt = JSON.parse(text) as { label: string, realms: { label: string, quizzes: { title: string }[] }[] }
  expect(hunt.realms.map((realm) => [realm.label, realm.quizzes.map((quiz) => quiz.title)])).toEqual([['home', ['Quiz one']]])
  await expect(page).toHaveURL(new RegExp(`/h/${hunt.label}/`))
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

test('every prompt is shown verbatim, placeholders and all', async ({ page }) => {
  await expect(page.getByRole('textbox', { name: 'Prompt: Quick-model guess' })).toHaveValue(/\{\{clueing\}\}/)
  await expect(page.getByRole('textbox', { name: 'Prompt: Hint ishes' })).toHaveValue(/\{\{hint\}\}/)
  await expect(page.getByRole('textbox', { name: 'Prompt: Batched ishes (Recalculate all)' })).toHaveValue(/\{\{items\}\}/)
  await expect(page.getByRole('textbox', { name: 'Prompt: Clueing ishes' })).toHaveValue(/fast|number-like/)
})

test('LL Export holds the quiz in the league\'s format, one record per question', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which **region**?\nOf | Spain')
  await page.getByLabel('Quiz name').click()
  await showTab(page, 'LL Export')
  await expect(page.getByRole('textbox', { name: 'LL Export' })).toHaveValue(/\|Which \[b\]region\[\/b\]\? \[br\] Of ¦ Spain\|\|\$\$/)
})

test('every read-only export box has a Copy button', async ({ page }) => {
  for (const tabname of ['Spreadsheet', 'Raw Export', 'LL Export']) {
    const section = await showTab(page, tabname)
    await expect(section.getByRole('button', { name: 'Copy', exact: true })).toHaveCount(1)
  }
})

test('Download Full History hands over the quiz\'s history as a zip, from either tab that offers it', async ({ page }) => {
  for (const tabname of ['Full History', 'Raw Export']) {
    const section = await showTab(page, tabname)
    const downloading = page.waitForEvent('download')
    await section.getByRole('button', { name: 'Download Full History' }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  }
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
