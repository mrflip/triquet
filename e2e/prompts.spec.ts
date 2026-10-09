import type { Page } from '@playwright/test'
import { closeManage, expect, freshWidgetLabel, manageDialog, openManage, relabelWidgeting, stubAsk, test, widgetingPanel } from './support'

// Every widget here is the spec's own (`freshWidgetLabel`): the library is every hunt's, and the
// specs share one database, so a seeded prompt is never edited.

const Riddle = 'Riddle me this: {{clueing}}\n\nReply with only a JSON object {"answer": string}.'

/** What the model is said to have answered, standing in for it */
const Answered = { ok: true, value: { answer: 'Leon' }, truncated: false, model_tier_applied: 'quick', approx_tokens: 40 }

/** The widget editor writing the new prompt */
function promptDialog(page: Page) {
  return page.getByRole('dialog', { name: /^New widget(?!ing)/ })
}

/**
 * Paste `prompt` in as a new widget labelled `widget_label`, written through the door beside the
 * catalogue of *+ New widgeting…*, without applying it
 */
async function pastePrompt(page: Page, widget_label: string, prompt = Riddle) {
  await openManage(page)
  await page.getByRole('button', { name: '+ New widgeting…' }).click()
  await manageDialog(page).getByRole('button', { name: 'New widget…' }).click()
  const editor = promptDialog(page)
  await editor.getByRole('combobox', { name: 'Formulary' }).click()
  await page.getByRole('option', { name: /^A prompt/ }).click()
  await editor.getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await editor.getByRole('textbox', { name: 'Prompt', exact: true }).fill(prompt)
}

/**
 * Apply the new prompt `widget_label`, which puts it to work as it is written, relabel the
 * widgeting that works it `label`, and close the gear's dialog behind them
 */
async function applyPrompt(page: Page, widget_label: string, label: string) {
  await promptDialog(page).getByRole('button', { name: 'Apply' }).click()
  await expect(promptDialog(page)).toHaveCount(0)
  await expect(widgetingPanel(page, widget_label)).toBeVisible()
  await relabelWidgeting(page, widget_label, label)
  await closeManage(page)
}

test.beforeEach(async ({ page }) => {
  await page.getByRole('textbox', { name: 'Q#' }).first().fill('1')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region gave its name to Leon?')
  await page.getByLabel('Quiz name').click()
})

test('a pasted prompt is previewed against a real question as it is typed: the input it distils, and the prompt as it would be sent', async ({ page }) => {
  await pastePrompt(page, freshWidgetLabel('riddler'))
  const editor = promptDialog(page)
  await expect(editor.getByRole('status', { name: 'Preview input' })).toContainText('"clueing":"Which region gave its name to Leon?"')
  await expect(editor.getByLabel('Rendered prompt')).toContainText('Riddle me this: Which region gave its name to Leon?')
  await editor.getByRole('textbox', { name: 'Input formula' }).fill("{ 'clueing': $uppercase(qn.clueing) }")
  await expect(editor.getByLabel('Rendered prompt')).toContainText('Riddle me this: WHICH REGION GAVE ITS NAME TO LEON?')
})

test('the preview names a placeholder the input does not fill, and a template that does not parse', async ({ page }) => {
  await pastePrompt(page, freshWidgetLabel('riddler'), 'Riddle: {{clueing}} and {{hint}}')
  const editor = promptDialog(page)
  await expect(editor.getByRole('note')).toContainText('The input holds nothing for {{hint}}')
  await editor.getByRole('textbox', { name: 'Prompt', exact: true }).fill('Riddle: {% if clueing %}')
  await expect(editor).toContainText('tag {% if clueing %} not closed')
})

test('a question whose input comes to nothing would not be asked, and the preview says so', async ({ page }) => {
  await pastePrompt(page, freshWidgetLabel('riddler'))
  const editor = promptDialog(page)
  await editor.getByRole('textbox', { name: 'Input formula' }).fill("$trim(qn.hint) != '' ? { 'hint': qn.hint }")
  await expect(editor.getByRole('status', { name: 'Preview input' })).toContainText('this question would not be asked')
})

test('a pasted prompt is put to work with a column to ask it from, and asks the route with its own prompt and config', { tag: '@smoke' }, async ({ page }) => {
  const widget_label = freshWidgetLabel('riddler')
  await pastePrompt(page, widget_label)
  await promptDialog(page).getByRole('combobox', { name: 'Model tier' }).click()
  await page.getByRole('option', { name: /^Careful/ }).click()
  await applyPrompt(page, widget_label, 'riddle')

  await stubAsk(page, Answered)
  const cell = page.getByRole('button', { name: 'Ask Riddle' }).first()
  const sent = page.waitForRequest('**/api/ask')
  await cell.dblclick()
  const request = await sent
  expect(request.postDataJSON()).toEqual({
    prompt:       'Riddle me this: Which region gave its name to Leon?\n\nReply with only a JSON object {"answer": string}.',
    servicelabel: 'claude',
    model_tier:   'careful',
    max_tokens:   1024,
  })
  await expect(cell).toContainText('"answer":"Leon"')
})

test('a prompt opened from the library is revised there, its input formula and room with it', async ({ page }) => {
  const widget_label = freshWidgetLabel('riddler')
  await pastePrompt(page, widget_label)
  await applyPrompt(page, widget_label, 'riddle')

  await page.getByRole('button', { name: 'Widget library' }).click()
  await page.getByRole('button', { name: `Edit widget ${widget_label}` }).click()
  const editor = page.getByRole('dialog', { name: `Widget: ${widget_label}` })
  await expect(editor.getByRole('textbox', { name: 'Prompt', exact: true })).toHaveValue(Riddle)
  await editor.getByRole('textbox', { name: 'Input formula' }).fill("{ 'clueing': $uppercase(qn.clueing) }")
  await editor.getByRole('textbox', { name: 'Max tokens' }).fill('300')
  await editor.getByRole('button', { name: 'Apply' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await stubAsk(page, Answered)
  const sent = page.waitForRequest('**/api/ask')
  await page.getByRole('button', { name: 'Ask Riddle' }).first().dblclick()
  const request = await sent
  expect(request.postDataJSON()).toMatchObject({ prompt: expect.stringContaining('WHICH REGION'), max_tokens: 300 })
})

test('the prompt for a chatbot asks for a prompt that names the object it wants', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await pastePrompt(page, freshWidgetLabel('riddler'))
  await promptDialog(page).getByRole('button', { name: 'Copy a prompt for a chatbot' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('Riddle me this: {{clueing}}')
  expect(copied).toContain('"clueing": "Which region gave its name to Leon?"')
  expect(copied).toContain('say in words which object it wants')
  expect(copied).toContain('send the prompt alone')
})
