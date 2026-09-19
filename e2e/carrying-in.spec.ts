import { expect, test } from '@playwright/test'
import { reloadOnceSaved } from './support'
import { mintId } from '../src/lib/ids'

/** A workspace as this browser kept it before there was a database; fresh ids, as every browser's are its own */
function legacyWorkspace() {
  const quiz_id = mintId()
  return {
    active_quiz_id: quiz_id,
    quizzes:        [{ id: quiz_id, title: 'Kept in the browser', questions: [{ id: mintId(), clueing: 'Which region?', title: 'Leon' }] }],
  }
}

test('a browser\'s quizzes from before the database are carried in, once', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((legacy) => { localStorage.setItem('triquet.workspace.v1', JSON.stringify(legacy)) }, legacyWorkspace())
  await page.context().clearCookies()
  await page.reload()

  await expect(page.getByLabel('Quiz name')).toHaveValue('Kept in the browser')
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true })).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which region?')

  await page.getByLabel('Quiz name').fill('Now in the database')
  await page.getByRole('textbox', { name: 'Title' }).first().click()
  await reloadOnceSaved(page)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Now in the database')
  expect(await page.evaluate(() => localStorage.getItem('triquet.workspace.v1'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('triquet.workspace.v1.retired'))).toContain('Kept in the browser')
})
