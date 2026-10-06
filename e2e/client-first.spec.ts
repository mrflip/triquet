import { addWidgetings, expect, reloadOnceSaved, startHunt, test, valuesOf } from './support'

// The client-first rule (notes/decisions/2026-09-client-first.md) as a test: with nothing reachable
// but the page itself and its database -- no bots route, no other host -- the app still opens,
// edits and keeps what it is given, and asking a bot is the only server function it needs.

test.use({ startAt: null })

test('with every host but the app\'s and its database\'s blocked, and the bots route too, the app opens, edits and keeps its changes', async ({ page, baseURL }) => {
  const reachable = new Set([new URL(String(baseURL)).host, new URL(String(process.env.NEXT_PUBLIC_CONVEX_URL)).host])
  await page.route((url) => ! reachable.has(url.host), (route) => route.abort())
  await page.routeWebSocket((url) => ! reachable.has(url.host), (socket) => { void socket.close() })
  await page.route('**/api/bots', (route) => route.abort())

  await startHunt(page)
  await page.getByLabel('Quiz name').fill('Client-first quiz')
  await page.getByLabel('Quiz name').blur()
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Written with only the database to hand')
  await page.getByLabel('Quiz name').click()
  await reloadOnceSaved(page)

  await expect(page.getByLabel('Quiz name')).toHaveValue('Client-first quiz')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Written with only the database to hand')
})

test('asking is the one server function, and with it blocked the cell says so and nothing else stops: the page still edits, sorts and saves', async ({ page }) => {
  await page.route('**/api/ask', (route) => route.abort())
  await startHunt(page)
  await addWidgetings(page, ['dumdum'])
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which prince was Danish?')
  await page.getByLabel('Quiz name').click()

  const guess = page.getByRole('button', { name: 'Ask Dumdum' }).first()
  await guess.dblclick()
  await expect(guess).toContainText('A connection hiccup — try again.')
  // A title that sorts ahead of every generated one, so the sort is seen to put it first.
  await page.getByRole('textbox', { name: 'Title' }).nth(2).fill('aaa hamlet')
  await page.getByRole('button', { name: 'Title', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Title' }).first()).toHaveValue('aaa hamlet')
  await page.getByLabel('Quiz name').fill('Still editing')
  await page.getByLabel('Quiz name').blur()
  await reloadOnceSaved(page)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Still editing')
  await expect.poll(() => valuesOf(page.getByRole('textbox', { name: 'Title' }))).toContain('aaa hamlet')
})
