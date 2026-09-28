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

/** Twelve lines of text, far taller than a row's floor */
function manyLines(what: string): string {
  return Array.from({ length: 12 }, (_ignored, lineIdx) => `line ${String(lineIdx)} of a long ${what}`).join('\n')
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

  test('carries a reviewer\'s verdict on a question to the smith once shared, marked when the answer was seen', async ({ page, browser }) => {
    await startHunt(page)
    await page.getByRole('textbox', { name: 'Title', exact: true }).first().fill('Danish prince')
    await page.getByRole('textbox', { name: 'Full Answer', exact: true }).first().fill('Hamlet')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const reviewer = await otherVisitor(browser)
    await enterReview(reviewer, reviewUrlOf(page))
    const row = reviewer.getByRole('region', { name: 'Danish prince' })
    await row.getByRole('button', { name: 'Reveal answer' }).click()
    await reviewer.getByRole('button', { name: 'Reveal', exact: true }).click()
    await expect(row.getByText('Hamlet')).toBeVisible()

    const guesses = row.getByRole('textbox', { name: 'Guesses' })
    const comments = row.getByRole('textbox', { name: 'Comments' })
    const wasHt = await guesses.evaluate((area) => area.clientHeight)
    await guesses.fill(manyLines('guess'))
    await row.getByRole('textbox', { name: 'Get rate' }).fill('40')
    await row.getByRole('textbox', { name: 'Minutes' }).fill('2.5')
    await row.getByRole('button', { name: 'Keep it' }).click()
    await expect(row.getByRole('button', { name: 'Keep it' })).toHaveAttribute('aria-pressed', 'true')
    await waitUntilSaved(reviewer)
    // Everything typed so far has landed and been drawn: long guesses have not grown the row.
    expect(await guesses.evaluate((area) => area.clientHeight)).toBe(wasHt)

    await comments.fill(manyLines('comment'))
    await expect.poll(() => guesses.evaluate((area) => area.clientHeight)).toBeGreaterThan(wasHt)
    await comments.blur()
    await waitUntilSaved(reviewer)

    await reviewer.getByRole('button', { name: 'Share with the smiths' }).click()
    await expect(reviewer.getByText('Shared with the smiths.')).toBeVisible()

    const verdict = page.getByRole('table', { name: 'Verdicts by question' }).getByRole('row', { name: /Danish prince/ })
    await expect(verdict).toContainText('40%')
    await expect(verdict.getByRole('img', { name: 'Saw the answer first' })).toBeVisible()
    await expect(verdict.getByRole('img', { name: 'Keep it' })).toBeVisible()
    await expect(verdict).toContainText('2.5')
    await expect(verdict).toContainText('line 11 of a long comment')
  })
})
