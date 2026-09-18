import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
})

/** Open the gear modal, which is where everything about a quiz's history lives */
async function openManage(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await expect(page.getByText('Manage this quiz')).toBeVisible()
}

test('a quiz starts on the main version, and the author can move it to another', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await openManage(page)
  await expect(page.getByLabel('Version')).toHaveValue('main')

  await page.getByLabel('Version').fill('draft two')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Manage this quiz')).toBeHidden()

  await openManage(page)
  await expect(page.getByLabel('Version')).toHaveValue('drafttwo')
})

test('editing a quiz builds a history that a save can tag', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await openManage(page)
  await page.getByRole('button', { name: 'Save a version' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-\d{4}-\d{2}-\d{2}t\d{6}z$/)
})

test('a save names the version it saved', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await openManage(page)
  await page.getByLabel('Version').fill('playtest')
  await page.getByRole('button', { name: 'Apply' }).click()

  await openManage(page)
  await page.getByRole('button', { name: 'Save a version' }).click()
  await expect(page.getByRole('status')).toHaveText(/^playtest-/)
})

test('the quiz downloads as a zip named for the quiz', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await openManage(page)
  await page.getByLabel('Label').fill('princes')
  await page.getByRole('button', { name: 'Apply' }).click()

  await openManage(page)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download as git' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('princes.zip')
})

test('the history survives a reload, because it lives in the browser and not in the page', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  // Saving first both proves the edit was committed and gives the reload something to survive.
  await openManage(page)
  await page.getByRole('button', { name: 'Save a version' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-/)

  await page.reload()
  await page.waitForSelector('table')
  await openManage(page)
  await page.getByRole('button', { name: 'Save a version' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-/)
})
