import { expect, test } from '@playwright/test'
import { reloadOnceSaved } from './support'

// The client-first rule (notes/decisions/2026-09-client-first.md) as a test: with nothing reachable
// but the page itself -- no sync server, no bots route -- the app still opens, edits and keeps
// what it is given. Only asking a bot needs the network.

test('with the sync server and every route but asking blocked, the app opens, edits and keeps its changes', async ({ page, baseURL }) => {
  const appHost = new URL(String(baseURL)).host
  await page.route((url) => url.host !== appHost, (route) => route.abort())
  await page.routeWebSocket((url) => url.host !== appHost, (socket) => { void socket.close() })
  await page.route('**/api/bots', (route) => route.abort())

  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Offline quiz')
  await page.getByLabel('Quiz name').blur()
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Written with no sync server')
  await page.getByLabel('Quiz name').click()
  await reloadOnceSaved(page)

  await expect(page.getByLabel('Quiz name')).toHaveValue('Offline quiz')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Written with no sync server')
})
