import { expect, test as setup } from '@playwright/test'
import * as UU from '../src/lib/useful'
import * as Environment from './environment'
import { freshIdentLabel } from './support'

/*
 * Before any spec runs: that the suite has what it needs. Playwright runs this file as the
 * `environment` project, which every spec's project depends on, so a failure here is one clear
 * complaint instead of a hundred specs timing out one after another. Whether the variables are
 * fit to start a server with is settled earlier, in `playwright.config.ts`.
 */

setup('reports the environment it runs under, without the values of anything sensitive', () => {
  process.stdout.write(`e2e environment: ${UU.jsonify(Environment.listing(process.env), { pretty: true })}\n`)
  expect(Environment.complaintsAbout(process.env)).toEqual([])
})

setup('finds its local Jazz server healthy', async ({ request }) => {
  const url = `http://127.0.0.1:${String(process.env.JAZZ_DEV_PORT)}/health`
  await expect(async () => {
    const response = await request.get(url)
    expect(response.ok(), `${url} answered ${String(response.status())}`).toBe(true)
    expect(await response.json()).toEqual({ status: 'healthy' })
  }, `the Jazz server the dev server starts should answer at ${url}`).toPass({ timeout: 30_000 })
})

setup('opens the app, so no spec pays for compiling its pages', async ({ page }) => {
  // A first visit compiles each page and opens a Jazz database, which on a small CI runner can
  // take far longer than any spec should wait. Every spec passes through all three pages.
  setup.setTimeout(300_000)
  await page.goto('/')
  await page.getByLabel('Ident label').fill(freshIdentLabel())
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('button', { name: '+ New hunt' })).toBeVisible({ timeout: 120_000 })
  await page.getByRole('button', { name: '+ New hunt' }).click()
  await expect(page.locator('table')).toBeVisible({ timeout: 150_000 })
})
