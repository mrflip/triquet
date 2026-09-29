import type { Browser, Page } from '@playwright/test'
import { addMember, assumeIdent, expect, otherVisitor, quizPathOf, startHunt, test, waitUntilSaved } from './support'

// These are about a second visitor reviewing the first's hunt, so each goes in by itself.
test.use({ startAt: null })

/**
 * A second visitor, put on the hunt `smith` has open as a reviewer, who follows a link naming
 * no presentation and lands on the review.
 */
async function enterReview(smith: Page, browser: Browser): Promise<Page> {
  const reviewer = await otherVisitor(browser)
  const label = await assumeIdent(reviewer)
  await addMember(smith, label, 'Reviewer')
  await reviewer.goto(quizPathOf(smith))
  await expect(reviewer).toHaveURL(/\?act=review$/)
  return reviewer
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

    const reviewer = await enterReview(page, browser)
    await expect(reviewer.getByRole('heading', { name: 'For review — PLAYTESTING' })).toBeVisible()
    await expect(reviewer.getByText('Which prince was Danish?')).toBeVisible()
    await expect(reviewer.getByText('Oops: no hint is attached').first()).toBeVisible()

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

  test("shows a reviewer the other reviewers' shared reviews only once their own is shared", async ({ page, browser }) => {
    await startHunt(page)
    await waitUntilSaved(page)
    const first = await enterReview(page, browser)
    await first.getByLabel('Overall').fill('The first reviewer liked it.')
    await first.getByLabel('Overall').blur()
    await first.getByRole('button', { name: 'Share with the smiths' }).click()
    await expect(first.getByText('Shared with the smiths.')).toBeVisible()

    const second = await enterReview(page, browser)
    await expect(second.getByText('Share your review to see what the other reviewers have shared.')).toBeVisible()
    await expect(second.getByText('The first reviewer liked it.')).toBeHidden()

    await second.getByRole('button', { name: 'Share with the smiths' }).click()
    const others = second.getByRole('region', { name: 'Other reviews' })
    await expect(others).toContainText('The first reviewer liked it.')
    await second.getByRole('button', { name: 'Withdraw' }).click()
    await expect(second.getByText('The first reviewer liked it.')).toBeHidden()
  })

  test("opens a first review for a reviewer who arrives straight at the review's address", async ({ page, browser }) => {
    await startHunt(page)
    await waitUntilSaved(page)
    const reviewer = await otherVisitor(browser)
    const label = await assumeIdent(reviewer)
    await addMember(page, label, 'Reviewer')
    await reviewer.goto(`${quizPathOf(page)}?act=review`)

    await reviewer.getByLabel('Overall').fill('Arrived by a pasted link.')
    await reviewer.getByLabel('Overall').blur()
    await waitUntilSaved(reviewer)
    await expect(reviewer.getByText('Open your review of this quiz first.')).toBeHidden()
    await reviewer.reload()
    await expect(reviewer.getByLabel('Overall')).toHaveValue('Arrived by a pasted link.')
  })

  test('asks before revealing the answer, and hides it again without asking', async ({ page, browser }) => {
    await startHunt(page)
    await page.getByRole('textbox', { name: 'Full Answer', exact: true }).first().fill('Hamlet')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const reviewer = await enterReview(page, browser)
    await expect(reviewer.getByRole('button', { name: 'Reveal answer' }).first()).toBeVisible()
    await expect(reviewer.getByText('Hamlet')).toBeHidden()

    await reviewer.getByRole('button', { name: 'Reveal answer' }).first().click()
    await expect(reviewer.getByRole('heading', { name: 'Reveal the answer?' })).toBeVisible()
    await reviewer.getByRole('button', { name: 'Reveal' }).click()
    await expect(reviewer.getByText('Hamlet')).toBeVisible()

    await reviewer.getByRole('button', { name: 'Hide answer' }).first().click()
    await expect(reviewer.getByText('Hamlet')).toBeHidden()
  })

  test('carries a reviewer\'s verdict on a question to the smith once shared', async ({ page, browser }) => {
    await startHunt(page)
    await page.getByRole('textbox', { name: 'Title', exact: true }).first().fill('Danish prince')
    await page.getByRole('textbox', { name: 'Full Answer', exact: true }).first().fill('Hamlet')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const reviewer = await enterReview(page, browser)
    const row = reviewer.getByRole('region', { name: 'Danish prince' })
    await row.getByRole('button', { name: 'Reveal answer' }).click()
    await reviewer.getByRole('button', { name: 'Reveal', exact: true }).click()
    await expect(row.getByText('Hamlet')).toBeVisible()
    await row.getByRole('button', { name: 'Hide answer' }).click()
    await expect(row.getByText('Seen before')).toBeVisible()

    const guesses = row.getByRole('textbox', { name: 'Guesses' })
    const comments = row.getByRole('textbox', { name: 'Comments' })
    // Given the room, the fields fill the height of their row, well past their two-line floor,
    // and scroll past it rather than making the row taller
    const lineHt = await row.getByRole('textbox', { name: 'Get rate' }).evaluate((input) => input.clientHeight)
    await expect.poll(() => guesses.evaluate((area) => area.clientHeight)).toBeGreaterThan(3 * lineHt)
    const rowHt = await row.evaluate((region) => region.clientHeight)
    await guesses.fill(manyLines('guess'))
    await expect.poll(() => guesses.evaluate((area) => area.scrollHeight > area.clientHeight)).toBe(true)
    // Not grown: the scroll above has established the text is in
    expect(await row.evaluate((region) => region.clientHeight)).toBe(rowHt)
    await row.getByRole('textbox', { name: 'Get rate' }).fill('40')
    await row.getByRole('textbox', { name: 'Minutes' }).fill('2.5')
    await expect(row.getByRole('button', { name: 'top 3' })).toHaveAttribute('aria-pressed', 'false')
    await row.getByRole('button', { name: 'meh 3' }).click()
    await expect(row.getByRole('button', { name: 'meh 3' })).toHaveAttribute('aria-pressed', 'true')
    await row.getByRole('button', { name: 'top 3' }).click()
    await expect(row.getByRole('button', { name: 'top 3' })).toHaveAttribute('aria-pressed', 'true')
    await expect(row.getByRole('button', { name: 'meh 3' })).toHaveAttribute('aria-pressed', 'false')
    await comments.fill(manyLines('comment'))
    await comments.blur()
    await waitUntilSaved(reviewer)

    await reviewer.getByRole('button', { name: 'Share with the smiths' }).click()
    await expect(reviewer.getByText('Shared with the smiths.')).toBeVisible()

    const verdict = page.getByRole('table', { name: 'Verdicts by question' }).getByRole('row', { name: /Danish prince/ })
    await expect(verdict).toContainText('40%')
    await expect(verdict.getByRole('img', { name: 'Keep it: one of the top picks' })).toBeVisible()
    await expect(verdict).toContainText('2.5')
    await expect(verdict).toContainText('line 11 of a long comment')
  })
})
