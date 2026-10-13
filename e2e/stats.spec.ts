import { createRequire } from 'node:module'
import type { Locator, Page } from '@playwright/test'
import { version as convexVersion } from 'convex'
import { assumeUserlabel, expect, test } from './support'

// The stats page's backfills are an admin's here (a local backend leaves EXPOSE_INTERNAL_STATS_TO_ALL unset), and it is about no hunt, so each test goes there itself.
test.use({ startAt: null, permissions: ['clipboard-read', 'clipboard-write'] })

const require = createRequire(import.meta.url)

/** The version of Next this checkout builds with, as the page reads it from Next's own package */
const nextVersion = (require('next/package.json') as { version: string }).version

/** The version of React the browser runs: the app router's pages run the React Next bundles, not the one the package names */
const reactVersion = (require('next/dist/compiled/react') as { version: string }).version

/** Opens the part of the stats page headed `title`: every part starts folded */
async function unfold(page: Page, title: string | RegExp): Promise<void> {
  const opener = page.getByRole('button', { name: title, exact: typeof title === 'string' })
  await opener.click()
  await expect(opener).toHaveAttribute('aria-expanded', 'true')
}

/** What the stats page says of `label`: the cell beside the row header naming it */
function factOf(page: Page, label: string): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) }).getByRole('cell')
}

test('names the build and what the browser runs, says it is connected, and shows an admin the backfills', { tag: '@smoke' }, async ({ page }) => {
  await assumeUserlabel(page)
  await page.goto('/stats')
  await expect(page).toHaveTitle('Stats — Triquet')
  await expect(page.getByRole('heading', { name: 'Stats', level: 1 })).toBeVisible()
  for (const title of ['This build', 'This browser', 'Backfills']) { await unfold(page, title) }

  // The build's stamp: when it was built, of which commit, on which Node. Every run of the suite is of a git checkout.
  await expect(factOf(page, 'Built')).toHaveText(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/)
  await expect(factOf(page, 'Commit')).toHaveText(/^[0-9a-f]{12}$/)
  await expect(factOf(page, 'Built on Node')).toHaveText(/^v\d+\.\d+\.\d+$/)

  await expect(factOf(page, 'Next')).toHaveText(nextVersion)
  await expect(factOf(page, 'React')).toHaveText(reactVersion)
  await expect(factOf(page, 'Convex')).toHaveText(convexVersion)
  await expect(factOf(page, 'Backend')).toHaveText(/^https?:\/\//)
  await expect(factOf(page, 'Connected')).toHaveText(/^yes, [1-9]\d* times? so far$/)

  const backfills = page.getByRole('table', { name: 'Backfills' })
  await expect(backfills.getByRole('columnheader', { name: 'State' })).toBeVisible()
  // The header, then a row for each backfill this deployment defines.
  await expect(backfills.getByRole('row').nth(1)).toBeVisible()
  // Exact, since the page prints the commit message, which may quote this line
  await expect(page.getByText('Only an admin sees these: choose a handle first.', { exact: true })).toHaveCount(0)
})

test('tells a browser that has not said who it is nothing of the backfills', async ({ page }) => {
  await page.goto('/stats')
  for (const title of ['This browser', 'Backfills']) { await unfold(page, title) }
  await expect(page.getByText('Only an admin sees these: choose a handle first.', { exact: true })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Backfills' })).toHaveCount(0)
  // The rest of the page is anyone's.
  await expect(factOf(page, 'Connected')).toHaveText(/^yes, /)
})

test('offers all of it as compact JSON in a box that can be dragged taller, and copies it from beside the heading too', async ({ page }) => {
  await assumeUserlabel(page)
  await page.goto('/stats')
  await unfold(page, 'Backfills')
  await expect(page.getByRole('table', { name: 'Backfills' })).toBeVisible()
  await unfold(page, 'As JSON')
  const box = page.getByRole('textbox', { name: 'Stats as JSON' })
  expect(await box.inputValue()).not.toContain('\n')
  const shown = JSON.parse(await box.inputValue()) as { build: { sha: string }, next: string, browser: { convex: string, connected: boolean }, backfills: unknown[] }
  expect(shown.next).toBe(nextVersion)
  expect(shown.build.sha).toMatch(/^[0-9a-f]{40}$/)
  expect(shown.browser).toMatchObject({ convex: convexVersion, connected: true })
  expect(shown.backfills.length).toBeGreaterThan(0)
  await expect(box).toHaveCSS('resize', 'vertical')

  await page.getByRole('button', { name: 'Copy stats' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await box.inputValue())
})

test('serves the build\'s part of it at /stats.json', async ({ page }) => {
  const served = await page.request.get('/stats.json')
  expect(served.ok()).toBe(true)
  expect(served.headers()['content-type']).toContain('application/json')
  const body = await served.json() as { build: { sha: string }, next: string }
  expect(body.next).toBe(nextVersion)
  expect(body.build.sha).toMatch(/^[0-9a-f]{40}$/)
})

test('starts with every part folded, and shows the build\'s environment in groups, its values masked but for those it may show', async ({ page }) => {
  await page.goto('/stats')
  for (const title of ['This build', 'What it merged', 'This browser', 'Backfills', 'Build environment', 'As JSON']) {
    await expect(page.getByRole('button', { name: title, exact: true })).toHaveAttribute('aria-expanded', 'false')
  }
  await expect(factOf(page, 'Built')).toBeHidden()
  await unfold(page, 'This build')
  await expect(factOf(page, 'Built')).toBeVisible()

  // Of the environment's groups, main alone starts open.
  await unfold(page, 'Build environment')
  await expect(page.getByRole('button', { name: /^main \(\d+\)$/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /^next \(\d+\)$/ })).toHaveAttribute('aria-expanded', 'false')
  // A dev server's or a built one's, as the suite runs.
  await expect(factOf(page, 'NODE_ENV')).toHaveText(/^(development|production)$/)
  // The suite's build is made under NEXT_DIST_DIR, which the page may show, and with a stand-in key, which it snips.
  await unfold(page, /^next \(\d+\)$/)
  await expect(factOf(page, 'NEXT_DIST_DIR')).toHaveText(/^\.next-e2e/)
  await unfold(page, /^bots \(\d+\)$/)
  await expect(factOf(page, 'ANTHROPIC_API_KEY')).toHaveText('sk**********lkey')
  // Whatever else the machine sets that ENV_VAR_VIZ does not list is unknown, its value not shown.
  await unfold(page, /^unknown \(\d+\)$/)
  await expect(page.getByRole('table', { name: 'Build environment: unknown' }).getByText('(not shown, no def)').first()).toBeVisible()
})
