import { addColumns, expect, faceOf, fillRows, holderOf, openPanel, reloadOnceSaved, test } from './support'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

/** The recap note the spec's quiz comes to */
const Recapped = [
  'Thanks for playing [i]Quiz one[/i]!',
  '----------------------------------------',
  '',
  '[quote="Q1"]1. Who wrote [b]this[/b]?[/quote]',
  '',
  'Answer: [spoiler][b]HAMILTON[/b][/spoiler]',
  'Correct Answer %:',
  'Everyone got it.',
  '',
  '[quote="Q2"]2. Which ship?[/quote]',
  '',
  'Answer: [spoiler][b]ENTERPRISE[/b][/spoiler]',
  'Correct Answer %:',
  '',
  'See you next season.',
].join('\n')

test('the Recap panel writes its head, each question with its answer and recap, and its tail, in bbjank, to copy', { tag: '@smoke' }, async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await addColumns(page, ['recap'])
  await fillRows(page, [
    { 'Q#': '2', 'Clueing': 'Which ship?', 'Full Answer': 'ENTERPRISE' },
    { 'Q#': '1', 'Clueing': 'Who wrote **this**?', 'Full Answer': 'HAMILTON', 'Recap': 'Everyone got it.' },
  ])
  const panel = await openPanel(page, 'Recap')
  const head = panel.getByRole('textbox', { name: 'Recap head', exact: true })
  await head.fill('Thanks for playing *{{quiz.title}}*!')
  await panel.getByRole('textbox', { name: 'Recap tail', exact: true }).fill('See you next season.')
  await page.getByLabel('Quiz name').click()

  const note = panel.getByRole('textbox', { name: 'Recap note', exact: true })
  await expect(note).toHaveValue(Recapped)
  // The head is a template: its face shows it filled in.
  await expect(faceOf(holderOf(head))).toHaveText('Thanks for playing Quiz one!')

  await panel.getByRole('button', { name: 'Copy' }).click()
  await expect(panel.getByText('Copied')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(Recapped)

  await reloadOnceSaved(page)
  const reloaded = await openPanel(page, 'Recap')
  await expect(reloaded.getByRole('textbox', { name: 'Recap note', exact: true })).toHaveValue(Recapped)
})

test("a recap head that will not fill in says why, and the note carries it as typed", async ({ page }) => {
  const panel = await openPanel(page, 'Recap')
  const head = panel.getByRole('textbox', { name: 'Recap head', exact: true })
  await head.fill('Thanks {{#qns}}')
  await page.getByLabel('Quiz name').click()
  await expect(head).toHaveAttribute('aria-invalid', 'true')
  await expect(holderOf(head).locator('[data-template-issue]')).toContainText('Unclosed section')
  await expect(panel.getByRole('textbox', { name: 'Recap note', exact: true })).toHaveValue('Thanks {{#qns}}')
})

test("the recap template lays the note out, keeps it across a reload, says why when it will not fill in, and goes back to the default when emptied", async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') { errors.push(message.text()) } })
  await fillRows(page, [{ 'Q#': '1', 'Clueing': 'Who wrote **this**?', 'Full Answer': 'HAMILTON' }])
  const panel = await openPanel(page, 'Recap')
  const note = panel.getByRole('textbox', { name: 'Recap note', exact: true })
  const byDefault = '[quote="Q1"]1. Who wrote [b]this[/b]?[/quote]\n\nAnswer: [spoiler][b]HAMILTON[/b][/spoiler]\nCorrect Answer %:'
  await expect(note).toHaveValue(byDefault)

  await panel.getByRole('button', { name: /^Recap template/ }).click()
  await expect(panel.getByRole('button', { name: /^Recap template/ })).toContainText('(the default)')
  const template = panel.getByRole('textbox', { name: 'Recap template', exact: true })
  await expect(template).toHaveValue(/^\{\{#recap_head\}\}/)
  await template.fill('{{#played}}- **Q{{number}}**: {{oneline.full_answer}}\n{{/played}}')
  await page.getByLabel('Quiz name').click()
  await expect(note).toHaveValue('[list]\n[*] [b]Q1[/b]: HAMILTON[/list]')
  await expect(panel.getByRole('button', { name: /^Recap template/ })).toContainText("(the quiz's own)")

  await reloadOnceSaved(page)
  const reloaded = await openPanel(page, 'Recap')
  await expect(reloaded.getByRole('textbox', { name: 'Recap note', exact: true })).toHaveValue('[list]\n[*] [b]Q1[/b]: HAMILTON[/list]')
  await reloaded.getByRole('button', { name: /^Recap template/ }).click()
  const kept = reloaded.getByRole('textbox', { name: 'Recap template', exact: true })
  await kept.fill('{{#played}}{{number}}')
  await page.getByLabel('Quiz name').click()
  await expect(kept).toHaveAttribute('aria-invalid', 'true')
  await expect(reloaded.getByText('Unclosed section "played"')).toBeVisible()
  await expect.poll(() => errors.some((text) => text.includes('could not fill in the template in Recap template'))).toBe(true)

  await kept.fill('')
  await page.getByLabel('Quiz name').click()
  await expect(kept).toHaveValue(/^\{\{#recap_head\}\}/)
  await expect(reloaded.getByRole('textbox', { name: 'Recap note', exact: true })).toHaveValue(byDefault)
  await expect(reloaded.getByRole('button', { name: /^Recap template/ })).toContainText('(the default)')
})
