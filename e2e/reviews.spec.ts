import type { Page } from '@playwright/test'
import { expect, freshIdentLabel, otherVisitor, startHunt, test, waitUntilSaved } from './support'

// These are about a second visitor reviewing the first's hunt, so each goes in by itself.
test.use({ startAt: null })

/** The address `page` is at, presented for review instead of for smithing */
function reviewUrlOf(page: Page): string {
  return page.url().replace('act=smith', 'act=review')
}

/** A fresh visitor's way in to a review, deep-linked: through the front door and back to it */
async function enterReview(reviewer: Page, link: string): Promise<void> {
  await reviewer.goto(link)
  await expect(reviewer.getByRole('heading', { name: 'Who are you?' })).toBeVisible()
  await reviewer.getByLabel('Ident label').fill(freshIdentLabel())
  await reviewer.getByRole('button', { name: 'Continue' }).click()
  await expect(reviewer).toHaveURL(link)
}

test.describe('a review', () => {
  test('is written by a second visitor, stays hidden from the smith until shared, and is then seen', async ({ page, browser }) => {
    await startHunt(page)
    await page.getByLabel('Quiz name').fill('For review')
    await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which prince was Danish?')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const reviewer = await otherVisitor(browser)
    await enterReview(reviewer, reviewUrlOf(page))
    await expect(reviewer.getByRole('heading', { name: 'For review' })).toBeVisible()
    await expect(reviewer.getByText('Which prince was Danish?')).toBeVisible()

    await reviewer.getByLabel('Overall').fill('Played well, one clue felt loose.')
    await reviewer.getByLabel('Overall').blur()
    await waitUntilSaved(reviewer)
    await expect(reviewer.getByText('Not shared with the smiths yet.')).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()
    await expect(page.getByText('No reviews have been shared yet.')).toBeVisible()

    await reviewer.getByRole('button', { name: 'Share with the smiths' }).click()
    await expect(reviewer.getByText('Shared with the smiths.')).toBeVisible()

    await expect(page.getByText('Played well, one clue felt loose.')).toBeVisible()
  })

  test('asks before revealing the answer, and hides it again without asking', async ({ page, browser }) => {
    await startHunt(page)
    await page.getByRole('textbox', { name: 'Full Answer', exact: true }).first().fill('Hamlet')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const reviewer = await otherVisitor(browser)
    await enterReview(reviewer, reviewUrlOf(page))
    await expect(reviewer.getByRole('button', { name: 'Reveal answer' }).first()).toBeVisible()
    await expect(reviewer.getByText('Hamlet')).toBeHidden()

    await reviewer.getByRole('button', { name: 'Reveal answer' }).first().click()
    await expect(reviewer.getByRole('heading', { name: 'Reveal the answer?' })).toBeVisible()
    await reviewer.getByRole('button', { name: 'Reveal' }).click()
    await expect(reviewer.getByText('Hamlet')).toBeVisible()

    await reviewer.getByRole('button', { name: 'Hide answer' }).first().click()
    await expect(reviewer.getByText('Hamlet')).toBeHidden()
  })
})
