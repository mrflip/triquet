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
  // Under the dev server a first visit compiles each page, which on a small runner can take far
  // longer than any spec should wait; the optimized build (CI's) has them compiled already, and
  // this is quick. Every spec opens a quiz, and those about the way in pass through the other two.
  setup.setTimeout(300_000)
  await page.goto('/')
  const label = freshIdentLabel()
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(label)
  await page.getByRole('button', { name: `Log in as ${label}` }).click()
  await expect(page.getByRole('button', { name: '+ New hunt' })).toBeVisible({ timeout: 120_000 })
  await page.getByRole('button', { name: '+ New hunt' }).click()
  await expect(page.getByRole('table', { name: 'Questions' })).toBeVisible({ timeout: 150_000 })
})
