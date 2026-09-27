import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import { reloadOnceSaved } from './support'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

/** Open the gear modal, which is where everything about a quiz's history lives */
async function openManage(page: Page) {
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
  await expect(page.getByLabel('Version')).toHaveValue('draft_two')
})

test('editing a quiz builds a history that a milestone can tag', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-m-\d{14}z$/)
})

test('a milestone names the version it marks', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await openManage(page)
  await page.getByLabel('Version').fill('playtest')
  await page.getByRole('button', { name: 'Apply' }).click()

  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^playtest-m-/)
})

test('the quiz downloads as a zip named for the quiz', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await openManage(page)
  await page.getByLabel('Label', { exact: true }).fill('princes')
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

  // Marking a milestone first both proves the edit was committed and gives the reload something to survive.
  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-m-/)

  await reloadOnceSaved(page)
  await page.waitForSelector('table')
  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-m-/)
})

/**
 * How many entries the browser's history filesystem holds: zero until something has been
 * committed. Checks the database exists first, because merely opening a missing one would create
 * it empty and leave the app unable to set it up properly.
 */
async function committedEntryCount(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    const name = 'triquet-quizzes'
    const known = await indexedDB.databases()
    if (known.every((database) => database.name !== name)) { return 0 }
    return await new Promise<number>((resolve) => {
      const opening = indexedDB.open(name)
      opening.addEventListener('error', () => { resolve(0) })
      opening.addEventListener('success', () => {
        const db = opening.result
        const store = `${name}_files`
        if (! db.objectStoreNames.contains(store)) { db.close(); resolve(0); return }
        const counting = db.transaction(store).objectStore(store).count()
        counting.addEventListener('success', () => { db.close(); resolve(counting.result) })
      })
    })
  })
}

test('an edit is committed on its own once the wait is up, and not before', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  // The quiz's creation is committed at once, without waiting out the clock.
  await expect.poll(async () => await committedEntryCount(page)).toBeGreaterThan(0)
  const created = await committedEntryCount(page)

  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  // The suite runs with a two-second wait, so a moment after the edit it is not committed yet...
  expect(await committedEntryCount(page)).toBe(created)
  // ...and with nobody asking, the timer alone produces the history.
  await expect.poll(async () => await committedEntryCount(page), { timeout: 15_000 }).toBeGreaterThan(created)

  await reloadOnceSaved(page)
  await page.waitForSelector('table')
  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-m-\d{14}z$/)
})

test('a milestone marks the edit made a moment ago, without waiting out the clock', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-m-/)
})

/** Every path in the zip of the open quiz's history, which is what a git client would see */
async function historyPaths(page: Page): Promise<string[]> {
  await openManage(page)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download as git' }).click()
  const download = await downloading
  const bytes = await readFile(await download.path())
  await page.keyboard.press('Escape')
  return Object.keys(unzipSync(new Uint8Array(bytes)))
}

/** The paths in the open quiz's history that `pattern` matches */
async function pathsMatching(page: Page, pattern: RegExp): Promise<string[]> {
  const paths = await historyPaths(page)
  return paths.filter((each) => pattern.test(each))
}

test('a new quiz has a history from the moment it is made, before any edit', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await expect.poll(async () => await pathsMatching(page, /\.git\/refs\/heads\/main$/)).toHaveLength(1)
})

test('an import is committed on either side, and tagged', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await page.getByRole('textbox', { name: 'Import' }).fill('[{"label":"hamlet","clueing":"Imported"}]')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByText(/1 added/)).toBeVisible()

  await expect.poll(async () => await pathsMatching(page, /\.git\/refs\/tags\/main-import-\d{14}z$/)).toHaveLength(1)
})

test('a deletion is committed on either side, and tagged', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByRole('textbox', { name: 'Title' }).first().fill('hamlet')
  await page.getByLabel('Quiz name').click()

  await page.getByRole('button', { name: 'Delete hamlet', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

  await expect.poll(async () => await pathsMatching(page, /\.git\/refs\/tags\/main-delete-\d{14}z$/)).toHaveLength(1)
})
