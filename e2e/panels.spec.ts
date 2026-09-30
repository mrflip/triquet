import { expect, preparedExport, test } from './support'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test.beforeEach(async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region?')
  await page.getByLabel('Quiz name').click()
  await preparedExport(page)
  await expect(page.getByRole('textbox', { name: 'Export', exact: true })).toHaveValue(/"title":"Quiz one"/)
})

test('the export is read only when asked, and a change on screen empties it again', async ({ page }) => {
  const exportBox = page.getByRole('textbox', { name: 'Export', exact: true })
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which county?')
  await page.getByLabel('Quiz name').click()
  await expect(exportBox).toHaveValue('')
  expect(await preparedExport(page)).toContain('Which county?')
})

test('Export emits the whole hunt as compact JSON', async ({ page }) => {
  const exportBox = page.getByRole('textbox', { name: 'Export', exact: true })
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
  const exportPanel = page.getByRole('region', { name: 'Export', exact: true })
  await exportPanel.getByRole('button', { name: 'Copy' }).click()
  await expect(exportPanel.getByText('Copied')).toBeVisible()
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
  const exportPanel = page.getByRole('region', { name: 'Export', exact: true })
  await exportPanel.getByRole('button', { name: 'Copy' }).click()
  await expect(exportPanel.getByText('Selected — press Ctrl/Cmd+C')).toBeVisible()
  const selected = await page.getByRole('textbox', { name: 'Export', exact: true }).evaluate(
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
  await expect(page.getByRole('textbox', { name: 'LL Export' })).toHaveValue(/\|Which \[b\]region\[\/b\]\? \[br\] Of ¦ Spain\|\|\$\$/)
})

test('every read-only box has a Copy button', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toHaveCount(7)
})

test('Download Full History hands over the quiz\'s history as a zip', async ({ page }) => {
  const exportPanel = page.getByRole('region', { name: 'Export', exact: true })
  const downloading = page.waitForEvent('download')
  await exportPanel.getByRole('button', { name: 'Download Full History' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
})

test('the quiet note beside it explains, in a dialog, how to see the history', async ({ page }) => {
  const exportPanel = page.getByRole('region', { name: 'Export', exact: true })
  await exportPanel.getByRole('button', { name: '(How to see Full History)' }).click()

  const help = page.getByRole('dialog', { name: 'How to see Full History' })
  await expect(help.getByText(/which a computer can expand into a file tree/)).toBeVisible()
  await expect(help.getByText(/I don't know how to install Fork/)).toBeVisible()

  await help.getByRole('button', { name: 'Close' }).click()
  await expect(help).toBeHidden()
})
