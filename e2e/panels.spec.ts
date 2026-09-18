import { expect, test } from '@playwright/test'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await page.getByLabel('Round name').fill('Round one')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region?')
  await page.getByLabel('Round name').click()
})

test('Export emits the whole workspace as compact JSON', async ({ page }) => {
  const text = await page.getByRole('textbox', { name: 'Export' }).inputValue()
  const workspace = JSON.parse(text) as { quizzes: { title: string }[], active_quiz_id: string }
  expect(workspace.quizzes[0]?.title).toBe('Round one')
  expect(workspace.active_quiz_id).toBeTruthy()
  // Compact, not pretty-printed: backup material, not prose.
  expect(text).not.toContain('\n')
})

test('the Copy button copies and says so', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const exportPanel = page.getByRole('region', { name: 'Export' })
  await exportPanel.getByRole('button', { name: 'Copy' }).click()
  await expect(exportPanel.getByText('Copied')).toBeVisible()
  const onClipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(onClipboard).toContain('Round one')
})

test('a refused clipboard falls back to selecting the text, never to silence', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('refused')) },
      configurable: true,
    })
  })
  const exportPanel = page.getByRole('region', { name: 'Export' })
  await exportPanel.getByRole('button', { name: 'Copy' }).click()
  await expect(exportPanel.getByText('Selected — press Ctrl/Cmd+C')).toBeVisible()
  const selected = await page.getByRole('textbox', { name: 'Export' }).evaluate(
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

test('every read-only box has a Copy button', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Copy' })).toHaveCount(6)
})
