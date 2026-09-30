import { AppNotices, RefusalNotices, identUnknownNotice } from '../src/lib/notices'
import { expect, grid, test } from './support'

// Short enough that the page scrolls, whatever the grid and panels come to.
test.use({ viewport: { width: 1280, height: 480 } })

test('a change the server refuses raises an alarm on screen, far from the field, until it is dismissed', async ({ page }) => {
  const clueing = page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
  await clueing.fill('Which region gave its name to Leon?')
  // The draft is still held in the field, which keeps focus, while the page scrolls to its foot.
  await page.getByRole('region', { name: 'Members' }).scrollIntoViewIfNeeded()
  await expect(page.getByLabel('Quiz name')).not.toBeInViewport()

  // The same smith, in another tab, locks the quiz before the draft is committed.
  const other = await page.context().newPage()
  await other.goto(page.url())
  await expect(grid(other)).toBeVisible()
  await other.getByRole('button', { name: 'Lock quiz' }).click()
  await expect(page.getByText('Locked', { exact: true })).toBeVisible()

  await clueing.blur()
  const alarm = page.getByRole('alert').filter({ hasText: RefusalNotices.quizLocked })
  await expect(alarm).toBeInViewport()
  await expect(alarm).toContainText(AppNotices.changeNotKept)
  await expect(page.getByLabel('Quiz name')).not.toBeInViewport()

  // A click elsewhere on the page leaves it up; only its close button takes it down.
  await page.getByRole('heading', { name: 'Members' }).click()
  await expect(alarm).toBeInViewport()
  await alarm.getByRole('button', { name: 'Close' }).click()
  await expect(alarm).toBeHidden()
})

test('a refusal shown beside the field it was about raises no alarm', async ({ page }) => {
  const members = page.getByRole('region', { name: 'Members' })
  await members.getByLabel('Ident label').fill('nobody_answers_to_this')
  await members.getByRole('button', { name: 'Add' }).click()
  await expect(members.getByText(identUnknownNotice('nobody_answers_to_this'))).toBeVisible()
  // No window is needed: the field's notice and an alarm, were there one, are set in the same
  // moment the refusal arrives, so once the notice shows an alarm would already be up.
  await expect(page.getByRole('alert').filter({ hasText: AppNotices.changeNotKept })).toHaveCount(0)
})
