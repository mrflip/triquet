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

setup('finds its local Convex backend answering', async ({ request }) => {
  const url = `${String(process.env.NEXT_PUBLIC_CONVEX_URL)}/version`
  await expect(async () => {
    const response = await request.get(url)
    expect(response.ok(), `${url} answered ${String(response.status())}`).toBe(true)
  }, `the Convex backend scripts/convex_dev starts should answer at ${url}`).toPass({ timeout: 30_000 })
})

setup('opens the app, so no spec pays for compiling its pages', async ({ page }) => {
  // A first visit compiles each page, which on a small CI runner can take far longer than any
  // spec should wait. Every spec passes through all three pages.
  setup.setTimeout(300_000)
  await page.goto('/')
  await page.getByLabel('Ident label').fill(freshIdentLabel())
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('button', { name: '+ New hunt' })).toBeVisible({ timeout: 120_000 })
  await page.getByRole('button', { name: '+ New hunt' }).click()
  await expect(page.getByRole('table', { name: 'Questions' })).toBeVisible({ timeout: 150_000 })
})
