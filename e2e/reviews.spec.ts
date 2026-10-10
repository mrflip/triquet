import type { Page } from '@playwright/test'
import { putOnHunt } from './admin'
import { addColumns, assumeIdent, expect, fillRows, huntOf, openPanel, otherVisitor, quizPathOf, test, waitUntilSaved } from './support'

// These are about a second visitor reviewing the first's hunt: the smith begins at the fixture's
// fresh hunt, and the reviewer is the fixture's friend, put on it by the backend (the Members
// panel's own way is routing's).

/**
 * The visitor `reviewer`, whose ident is labelled `label`, put on the hunt `smith` has open as a
 * reviewer, following a link naming no mode and landing on the playtest.
 */
async function enterReview(smith: Page, reviewer: Page, label: string): Promise<Page> {
  await putOnHunt(huntOf(smith), label, 'reviewer')
  await reviewer.goto(quizPathOf(smith))
  await expect(reviewer).toHaveURL(/\/!playtest$/)
  return reviewer
}

/** Twelve lines of text, far taller than a row's floor */
function manyLines(what: string): string {
  return Array.from({ length: 12 }, (_ignored, lineIdx) => `line ${String(lineIdx)} of a long ${what}`).join('\n')
}

test.describe('a review', () => {
  test('is written by a second visitor, stays hidden from the smith until shared, and is then seen', { tag: '@smoke' }, async ({ page, friend, friendLabel }) => {
    await page.getByLabel('Quiz name').fill('For review')
    await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which prince was Danish?')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const reviewer = await enterReview(page, friend, friendLabel)
    await expect(reviewer.getByRole('heading', { name: 'For review — PLAYTESTING' })).toBeVisible()
    await expect(reviewer.getByText('Which prince was Danish?')).toBeVisible()
    await expect(reviewer.getByText('Oops: no hint is attached').first()).toBeVisible()

    await reviewer.getByLabel('Overall').fill('Played well, one clue felt loose.')
    await reviewer.getByLabel('Overall').blur()
    await waitUntilSaved(reviewer)
    await expect(reviewer.getByText('Not shared with the smiths yet.')).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()
    await openPanel(page, 'Reviews')
    await expect(page.getByText('No reviews have been shared yet.')).toBeVisible()

    await reviewer.getByRole('button', { name: 'Share with the smiths' }).click()
    await expect(reviewer.getByText('Shared with the smiths.')).toBeVisible()

    await expect(page.getByText('Played well, one clue felt loose.')).toBeVisible()
  })

  test("shows the smith an image in a review as a link to it, never fetching it", async ({ page, friend, friendLabel }) => {
    const reviewer = await enterReview(page, friend, friendLabel)
    await reviewer.getByLabel('Overall').fill('Compare ![the map](https://example.com/map.png) to Q3.')
    await reviewer.getByLabel('Overall').blur()
    await waitUntilSaved(reviewer)
    await reviewer.getByRole('button', { name: 'Share with the smiths' }).click()
    await expect(reviewer.getByText('Shared with the smiths.')).toBeVisible()

    await openPanel(page, 'Reviews')
    const review = page.getByRole('region', { name: /^Review by / })
    await expect(review.getByRole('link', { name: 'the map' })).toHaveAttribute('href', 'https://example.com/map.png')
    await expect(review.locator('img')).toHaveCount(0)
  })

  test("shows a reviewer no archived question, and an alternate marked as one", async ({ page, friend, friendLabel }) => {
    await fillRows(page, [{ Title: 'hamlet', Clueing: 'Which prince was Danish?' }, { Title: 'othello', Clueing: 'Which general was Moorish?' }, { Title: 'macbeth', Clueing: 'Which king was Scottish?' }])
    await page.getByRole('button', { name: 'Batch select' }).click()
    await page.getByRole('button', { name: 'Change how othello is shown', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click()
    await page.getByRole('button', { name: 'Batch select' }).click()
    await page.getByRole('button', { name: 'Change how macbeth is shown', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Make secondary' }).click()
    await waitUntilSaved(page)

    const reviewer = await enterReview(page, friend, friendLabel)
    await expect(reviewer.getByText('Which prince was Danish?')).toBeVisible()
    await expect(reviewer.getByRole('region', { name: 'macbeth (alt)' })).toContainText('Which king was Scottish?')
    await expect(reviewer.getByText('Which general was Moorish?')).toHaveCount(0)
  })

  test("shows the reviewer the smith's note folded to a line, unfolding by its triangle to paragraphs and all, and nothing where there is none", async ({ page, friend, friendLabel }) => {
    const note = page.getByRole('textbox', { name: 'Smith\'s note', exact: true })
    await note.fill('Theme: princes.\n\nMeta: their initials.')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const reviewer = await enterReview(page, friend, friendLabel)
    const shown = reviewer.getByRole('region', { name: 'Smith\'s note' })
    const fold = shown.getByRole('button', { name: 'Show the smith\'s note in full' })
    // Found by what it says, never by the fold's `aria-controls`: a `useId` read once names nothing
    // once the note's section is drawn afresh as the review opens.
    const body = shown.getByText('Theme: princes.')
    const bodyHt = async () => await body.evaluate((para) => para.clientHeight)
    const oneLine = async () => await body.evaluate((para) => Number(getComputedStyle(para).lineHeight.replace(/px$/, '')))

    // Folded to start with: one line, the paragraphs run together and cut short with an ellipsis
    await expect(fold).toHaveAttribute('aria-expanded', 'false')
    await expect(body).toHaveCSS('text-overflow', 'ellipsis')
    await expect.poll(bodyHt).toBe(Math.round(await oneLine()))
    await expect(body).toContainText('Theme: princes. Meta: their initials.', { useInnerText: true })

    // Unfolded by its triangle, the whole note; folded by it again, one line
    await fold.click()
    await expect(fold).toHaveAttribute('aria-expanded', 'true')
    await expect(body).toContainText('Theme: princes.\n\nMeta: their initials.', { useInnerText: true })
    await expect.poll(bodyHt).toBeGreaterThan(2 * await oneLine())
    await fold.click()
    await expect(fold).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(bodyHt).toBe(Math.round(await oneLine()))

    await note.fill('')
    await page.getByLabel('Quiz name').click()
    await expect(shown).toHaveCount(0)
  })

  test("shows a reviewer the other reviewers' shared reviews only once their own is shared", async ({ page, browser, friend, friendLabel }) => {
    await waitUntilSaved(page)
    const first = await enterReview(page, friend, friendLabel)
    await first.getByLabel('Overall').fill('The first reviewer liked it.')
    await first.getByLabel('Overall').blur()
    await first.getByRole('button', { name: 'Share with the smiths' }).click()
    await expect(first.getByText('Shared with the smiths.')).toBeVisible()

    // The second is a visitor nobody has seen, who says who they are at the front door.
    const stranger = await otherVisitor(browser)
    const second = await enterReview(page, stranger, await assumeIdent(stranger))
    await expect(second.getByText('Share your review to see what the other reviewers have shared.')).toBeVisible()
    await expect(second.getByText('The first reviewer liked it.')).toBeHidden()

    await second.getByRole('button', { name: 'Share with the smiths' }).click()
    const others = second.getByRole('region', { name: 'Other reviews' })
    await expect(others).toContainText('The first reviewer liked it.')
    await second.getByRole('button', { name: 'Withdraw' }).click()
    await expect(second.getByText('The first reviewer liked it.')).toBeHidden()
  })

  test("opens a first review for a reviewer who arrives straight at the review's address", async ({ page, friend, friendLabel }) => {
    await waitUntilSaved(page)
    await putOnHunt(huntOf(page), friendLabel, 'reviewer')
    await friend.goto(`${quizPathOf(page)}/!playtest`)

    await friend.getByLabel('Overall').fill('Arrived by a pasted link.')
    await friend.getByLabel('Overall').blur()
    await waitUntilSaved(friend)
    await expect(friend.getByText('Open your review of this quiz first.')).toBeHidden()
    await friend.reload()
    await expect(friend.getByLabel('Overall')).toHaveValue('Arrived by a pasted link.')
  })

  test("shows a reviewer each question as a review needs it, its BUT NOT and its answer behind the lock, through a reload, and never the smiths' notes", async ({ page, friend, friendLabel }) => {
    await addColumns(page, ['hint', 'chains_to'])
    await fillRows(page, [
      { 'Title': 'Danish prince', 'Clueing': 'Which prince was Danish?', 'Full Answer': 'Hamlet', 'Notes': 'Check the folio first.' },
      { 'Title': 'Scottish king', 'Hint': 'Not the one in the play.' },
    ])
    await page.getByRole('combobox', { name: 'Chains to' }).first().selectOption({ label: 'Scottish king' })
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const reviewer = await enterReview(page, friend, friendLabel)
    const row = reviewer.getByRole('region', { name: 'Danish prince' })
    await expect(row.getByText('Which prince was Danish?')).toBeVisible()
    await expect(row.getByText('Not the one in the play.')).toBeVisible()
    await expect(row.getByText('Hamlet')).toBeHidden()
    await expect(reviewer.getByText('Check the folio first.')).toHaveCount(0)

    await row.getByRole('button', { name: 'Reveal answer' }).click()
    await expect(reviewer.getByRole('heading', { name: 'Reveal the answer?' })).toBeVisible()
    await reviewer.getByRole('button', { name: 'Reveal', exact: true }).click()
    await expect(row.getByText('Hamlet')).toBeVisible()
    await waitUntilSaved(reviewer)

    // Peeked or not, the answer is the reviewer's to see: the lock keeps it off the screen, no more
    await reviewer.reload()
    await expect(row.getByText('Seen before')).toBeVisible()
    await expect(row.getByText('Hamlet')).toBeHidden()
    await row.getByRole('button', { name: 'Reveal answer' }).click()
    await reviewer.getByRole('button', { name: 'Reveal', exact: true }).click()
    await expect(row.getByText('Hamlet')).toBeVisible()
  })

  test('carries a reviewer\'s verdict on a question to the smith once shared', async ({ page, friend, friendLabel }) => {
    await page.getByRole('textbox', { name: 'Title', exact: true }).first().fill('Danish prince')
    await page.getByRole('textbox', { name: 'Full Answer', exact: true }).first().fill('Hamlet')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const reviewer = await enterReview(page, friend, friendLabel)
    const row = reviewer.getByRole('region', { name: 'Danish prince' })
    await row.getByRole('button', { name: 'Reveal answer' }).click()
    await reviewer.getByRole('button', { name: 'Reveal', exact: true }).click()
    await expect(row.getByText('Hamlet')).toBeVisible()
    // Hidden again without asking
    await row.getByRole('button', { name: 'Hide answer' }).click()
    await expect(row.getByText('Hamlet')).toBeHidden()
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

    await openPanel(page, 'Reviews')
    const verdict = page.getByRole('table', { name: 'Verdicts by question' }).getByRole('row', { name: /Danish prince/ })
    await expect(verdict).toContainText('40%')
    await expect(verdict.getByRole('img', { name: 'Keep it: one of the top picks' })).toBeVisible()
    await expect(verdict).toContainText('2.5')
    await expect(verdict).toContainText('line 11 of a long comment')
  })
})
