import { readFile } from 'node:fs/promises'
import { type Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import * as Routes from '../src/lib/routes'
import { actDangerously, expect, huntLabelOf, manageDialog, newQuiz, openManage, reloadOnceSaved, showTab, test } from './support'

test('a hunt starts on the main branch, and a smith can switch it from the hunt\'s page', async ({ page }) => {
  await page.goto(Routes.huntPath(huntLabelOf(page)))
  const branch = page.getByRole('textbox', { name: 'Branch' })
  await expect(branch).toHaveValue('main')
  await expect(page.getByRole('button', { name: 'Switch branch' })).toBeDisabled()

  await branch.fill('draft two')
  await page.getByRole('button', { name: 'Switch branch' }).click()
  await expect(branch).toHaveValue('draft_two')
  await expect(page.getByRole('button', { name: 'Switch branch' })).toBeDisabled()

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Branch' })).toHaveValue('draft_two')
})

test('editing a quiz builds a history that a milestone can tag', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-m-\d{14}z$/)
})

test('a milestone names the branch it marks', async ({ page }) => {
  const quizPath = `${new URL(page.url()).pathname}${new URL(page.url()).search}`
  await page.goto(Routes.huntPath(huntLabelOf(page)))
  await page.getByRole('textbox', { name: 'Branch' }).fill('playtest')
  await page.getByRole('button', { name: 'Switch branch' }).click()
  await expect(page.getByRole('button', { name: 'Switch branch' })).toBeDisabled()

  await page.goto(quizPath)
  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^playtest-m-/)
})

test('the quiz downloads as a zip named for the quiz', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await openManage(page)
  await page.getByLabel('Label', { exact: true }).fill('princes')
  await page.getByRole('button', { name: 'Apply' }).click()
  // The address follows the relabel once it has landed.
  await expect(page).toHaveURL(/\/princes\?/)

  await openManage(page)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download as git' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('princes.zip')
})

test('the history survives a reload, because it lives in the browser and not in the page', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  // Marking a milestone first both proves the edit was committed and gives the reload something to survive.
  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-m-/)

  await reloadOnceSaved(page)
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
  // The quiz's creation is committed at once, without waiting out the clock; its writing is let
  // settle before counting, since a count taken mid-write undercounts.
  await expect.poll(() => committedEntryCount(page)).toBeGreaterThan(0)
  const settled = { count: -1 }
  await expect.poll(async () => {
    const was = settled.count
    settled.count = await committedEntryCount(page)
    return settled.count === was
  }, { intervals: [500] }).toBe(true)
  const created = settled.count

  // The page's clock is taken over, so the wait is stepped through rather than waited out: held
  // still from before the edit, moved to a hair short of the two seconds the suite runs with,
  // then across them.
  await page.clock.install()
  await page.clock.pauseAt(Date.now() + 1000)
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()
  // The wait starts when the edit lands and is noted for the history, which the tab's title shows.
  await expect(page).toHaveTitle(/^Danish princes/)

  await page.clock.runFor(1900)
  // A deliberate one-shot: with the clock held short of the wait, "not yet" is the whole claim.
  expect(await committedEntryCount(page)).toBe(created)
  // ...and with nobody asking, the timer alone produces the history.
  await page.clock.runFor(200)
  await expect.poll(() => committedEntryCount(page)).toBeGreaterThan(created)
  await page.clock.resume()

  await reloadOnceSaved(page)
  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-m-\d{14}z$/)
})

test('a milestone marks the edit made a moment ago, without waiting out the clock', async ({ page }) => {
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
  await expect.poll(() => pathsMatching(page, /\.git\/refs\/heads\/main$/)).toHaveLength(1)
})

test('an import is committed on either side, and tagged', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await showTab(page, 'Import')
  await page.getByRole('textbox', { name: 'Import' }).fill('[{"label":"hamlet","clueing":"Imported"}]')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByText(/1 added/)).toBeVisible()

  await expect.poll(() => pathsMatching(page, /\.git\/refs\/tags\/main-import-\d{14}z$/)).toHaveLength(1)
})

test('a deletion is committed on either side, and tagged', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Title' }).first().fill('hamlet')
  await page.getByLabel('Quiz name').click()

  await page.getByRole('button', { name: 'Batch select' }).click()
  await page.getByRole('button', { name: 'Delete hamlet', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

  await expect.poll(() => pathsMatching(page, /\.git\/refs\/tags\/main-delete-\d{14}z$/)).toHaveLength(1)
})

test('a deleted quiz leaves its history on the hunts page, folded away, to download', async ({ page }) => {
  await newQuiz(page)
  // Proven committed before the quiz goes, so the hunts page has a repository to find.
  await expect.poll(() => pathsMatching(page, /\.git\/refs\/heads\/main$/)).toHaveLength(1)
  await openManage(page)
  const label = await manageDialog(page).getByRole('textbox', { name: 'Label', exact: true }).inputValue()
  await actDangerously(page, 'Delete this quiz', label)
  await expect(page.getByLabel('Open quiz').locator('option')).toHaveCount(1)

  await page.goto('/my/hunts')
  const fold = page.getByRole('button', { name: 'Orphaned histories (1)' })
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('list', { name: 'Orphaned histories' })).toHaveCount(0)

  await fold.click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('list', { name: 'Orphaned histories' }).getByRole('button', { name: label }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe(`${label}.zip`)
  const bytes = await readFile(await download.path())
  const entries = unzipSync(new Uint8Array(bytes))
  expect(Object.keys(entries)).toContain(`${label}/.git/HEAD`)
})
