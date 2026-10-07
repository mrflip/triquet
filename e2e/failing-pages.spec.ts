import type { Locator, Page } from '@playwright/test'
import { AppNotices } from '../src/lib/notices'
import * as PA from '../src/lib/vv/patterns'
import { expect, failQuery, grid, huntOf, test } from './support'

/**
 * A refusal at the server's Zod door, as `hunts:open` sends one: its one issue, about the org.
 * Addresses refuse every label the server would, so no address provokes a real one; `failQuery`
 * stands it in, data and all.
 */
const Refusal = { ZodError: [{ code: 'custom', path: ['orglabel'], message: PA.Unreserved.msg, input: 'ghost_id' }] }

/** What the page says of `Refusal`: its one issue, with the field it was about */
const RefusedSummary = `refused (invalid): orglabel: ${PA.Unreserved.msg}`

/** Make every answer to `hunts:open` the refusal above */
async function refuseOpening(page: Page): Promise<void> {
  await failQuery(page, 'hunts:open', `Server Error\nUncaught ConvexError: ${JSON.stringify(Refusal)}`, Refusal)
}

/** How the console's report of a page that failed to draw begins */
const ReportOpening = 'Triquet: could not show this page — '

/** The alert a page that failed to draw shows in its place */
function failure(page: Page): Locator {
  return page.getByRole('alert').filter({ hasText: AppNotices.pageFailed })
}

/** The console's reports of a page that failed to draw, gathered from now on as they come: a list that fills, read inside `expect.poll` */
function reportsOf(page: Page): string[] {
  const reports: string[] = []
  page.on('console', (message) => {
    if (message.text().startsWith(ReportOpening)) { reports.push(message.text()) }
  })
  return reports
}

test('a page that throws says so, with the request to look up, and tells the console the same', async ({ page }) => {
  const reports = reportsOf(page)
  const failed = await failQuery(page, 'hunts:open')
  await page.reload()
  const summary = `failed on the server, which keeps the reason to itself: find request ${failed.request_id} in the Convex logs`
  const alert = failure(page)
  await expect(alert.getByText(summary, { exact: true })).toBeVisible()
  await expect(alert.getByText(`Request ${failed.request_id} · hunts:open`, { exact: true })).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(grid(page)).toHaveCount(0)
  await expect.poll(() => reports.map((report) => report.startsWith(`${ReportOpening}${summary}`))).toEqual([true])
})

test('trying again draws the page afresh, reporting each failure once, and a page whose cause is gone comes back whole', { tag: '@smoke' }, async ({ page }) => {
  const title = await page.getByLabel('Quiz name').inputValue()
  const reports = reportsOf(page)
  const failed = await failQuery(page, 'hunts:open')
  await page.reload()
  const retry = failure(page).getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible()
  await expect.poll(() => reports.length).toBe(1)

  // The cause still there: the page is drawn again, fails again, and says so again.
  await retry.click()
  await expect.poll(() => reports.length).toBe(2)
  await expect(retry).toBeVisible()

  failed.heal()
  await retry.click()
  await expect(grid(page)).toBeVisible()
  await expect(page.getByLabel('Quiz name')).toHaveValue(title)
  await expect(page.getByRole('banner').getByRole('link', { name: title })).toBeVisible()
  await expect(failure(page)).toHaveCount(0)
  // Not yet: drawn whole, the page has had every chance to report a third time.
  expect(reports).toHaveLength(2)
})

test('the site header stands above the failure, and its way home still works', async ({ page }) => {
  const { org, hunt } = huntOf(page)
  await refuseOpening(page)
  await page.goto(`/~${org}/${hunt}`)
  await expect(failure(page)).toBeVisible()
  const header = page.getByRole('banner')
  await expect(header.getByRole('link', { name: 'About' })).toBeVisible()
  await header.getByRole('link', { name: 'Triquet' }).click()
  await expect(page).toHaveURL(/\/my\/hunts$/)
  await expect(failure(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ New hunt' })).toBeVisible()
})

test('the hunt, its quiz, its categories and the hunts list each fail into the same boundary', async ({ page }) => {
  const { org, hunt } = huntOf(page)
  await refuseOpening(page)
  for (const path of [`/~${org}/${hunt}`, `/~${org}/${hunt}/quizzes/home/${hunt}`, `/~${org}/${hunt}/categories`]) {
    await page.goto(path)
    await expect(failure(page).getByText(RefusedSummary, { exact: true })).toBeVisible()
    await expect(failure(page).getByText(/^Request [0-9a-f]+ · hunts:open$/)).toBeVisible()
  }
  // The hunts list names no hunt, so no address can make the server refuse it.
  const failed = await failQuery(page, 'hunts:list')
  for (const path of ['/my/hunts', `/~${org}`]) {
    await page.goto(path)
    await expect(failure(page).getByText(`Request ${failed.request_id} · hunts:list`, { exact: true })).toBeVisible()
  }
})

test('nothing a failure says leaks onto the page: no stack, no row id, no key', async ({ page }) => {
  const quizAddress = page.url()
  const shown = page.locator('body')
  const { org, hunt } = huntOf(page)
  await refuseOpening(page)
  await page.goto(`/~${org}/${hunt}`)
  await expect(failure(page).getByText(RefusedSummary, { exact: true })).toBeVisible()
  // The server's whole message names the error's kind and Zod's own report of the issue.
  await expect(shown).not.toContainText(/ConvexError|ZodError|Called by client/, { useInnerText: true })

  // An unplanned throw, as a deployment that shows its reasons words one: the reason, then the stack.
  const rowId = 'k57d3qyvaz8gq4h1bmbxv1kx7d7rpz2m'
  const key = 'convex-self-hosted|01f9c2a8e6b4d0c7a3e5f1b9d2c8a6e4f0b3d7c9a1e5'
  await failQuery(page, 'hunts:open', ['Server Error', `Uncaught Error: no hunt ${rowId} for ${key}`, '    at handler (../convex/hunts.ts:48:9)'].join('\n'))
  await page.goto(quizAddress)
  await expect(failure(page).getByText('Error: Server Error', { exact: true })).toBeVisible()
  for (const leak of [rowId, key, 'hunts.ts', 'Uncaught', ' at handler']) {
    await expect(shown).not.toContainText(leak, { useInnerText: true })
  }
})
