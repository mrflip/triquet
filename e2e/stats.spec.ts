import { createRequire } from 'node:module'
import type { Locator, Page } from '@playwright/test'
import { version as convexVersion } from 'convex'
import { assumeIdent, expect, test } from './support'

// The stats page is an admin's, and about no hunt, so each test goes there itself.
test.use({ startAt: null })

const require = createRequire(import.meta.url)

/** The version of Next this checkout builds with, as the page reads it from Next's own package */
const nextVersion = (require('next/package.json') as { version: string }).version

/** The version of React the browser runs: the app router's pages run the React Next bundles, not the one the package names */
const reactVersion = (require('next/dist/compiled/react') as { version: string }).version

/** What the stats page says of `label`: the cell beside the row header naming it */
function factOf(page: Page, label: string): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) }).getByRole('cell')
}

test('names the build and what the browser runs, says it is connected, and shows an admin the backfills', { tag: '@smoke' }, async ({ page }) => {
  await assumeIdent(page)
  await page.goto('/stats')
  await expect(page).toHaveTitle('Stats — Triquet')
  await expect(page.getByRole('heading', { name: 'Stats', level: 1 })).toBeVisible()

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
  await expect(page.getByText('Only an admin sees these')).toHaveCount(0)
})

test('tells a browser that has not said who it is nothing of the backfills', async ({ page }) => {
  await page.goto('/stats')
  await expect(page.getByText('Only an admin sees these: choose a username first.')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Backfills' })).toHaveCount(0)
  // The rest of the page is anyone's.
  await expect(factOf(page, 'Connected')).toHaveText(/^yes, /)
})
