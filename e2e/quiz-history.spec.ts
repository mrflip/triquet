import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Download, Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import * as Routes from '../src/lib/routes'
import { actDangerously, expect, huntOf, manageDialog, newQuiz, openManage, reloadOnceSaved, showTab, test, waitUntilSaved } from './support'

/** The label of the quiz `page` is on, from its address */
function quizLabelOf(page: Page): string {
  const segments = new URL(page.url()).pathname.split('/').filter((segment) => ! segment.startsWith('!'))
  return segments.at(-1) ?? ''
}

/** Unzip `bytes` into a fresh directory, as a person downloading it would, and say where */
function unzipped(bytes: Uint8Array): string {
  const into = mkdtempSync(path.join(tmpdir(), 'triquet-history-'))
  const entries = Object.entries(unzipSync(bytes))
  for (const [filepath, content] of entries) {
    const target = path.join(into, filepath)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
  return into
}

/** A downloaded history, unzipped, as the real git sees it: a function asking git about the repository in `folder` */
async function gitOfDownload(download: Download, folder: string): Promise<(...args: string[]) => string> {
  const bytes = readFileSync(await download.path())
  const repo = path.join(unzipped(new Uint8Array(bytes)), folder)
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the git anyone has installed reading what the app wrote is the point
  return (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trimEnd()
}

/**
 * The open hunt's history, downloaded from the gear and unzipped, as the real git sees it: a
 * function asking git about it, with the trailing newline taken off.
 */
async function downloadedHistory(page: Page): Promise<(...args: string[]) => string> {
  await openManage(page)
  const downloading = page.waitForEvent('download')
  await manageDialog(page).getByRole('button', { name: 'Download as git' }).click()
  const download = await downloading
  await page.keyboard.press('Escape')
  return await gitOfDownload(download, huntOf(page).hunt)
}

/** What the real git says about the open hunt's history, downloaded afresh: for `expect.poll` */
async function gitSays(page: Page, ...args: string[]): Promise<string> {
  const git = await downloadedHistory(page)
  return git(...args)
}

/** Mark a milestone from the gear, and the tag it left */
async function milestone(page: Page): Promise<string> {
  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main_/)
  const tag = await page.getByRole('status').textContent() ?? ''
  await page.keyboard.press('Escape')
  return tag
}

test('a hunt starts on the main branch, and a smith can switch it from the hunt\'s page', async ({ page }) => {
  await page.goto(Routes.huntPath(huntOf(page)))
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

test('a milestone names the branch it marks', async ({ page }) => {
  const quizPath = `${new URL(page.url()).pathname}${new URL(page.url()).search}`
  await page.goto(Routes.huntPath(huntOf(page)))
  await page.getByRole('textbox', { name: 'Branch' }).fill('Play Test')
  await page.getByRole('button', { name: 'Switch branch' }).click()
  // The button is disabled while the switch is under way too, so wait for it to land before
  // leaving: the box shows the branch as the hunt now holds it, tidied into a label, only then.
  await expect(page.getByRole('textbox', { name: 'Branch' })).toHaveValue('play_test')

  await page.goto(quizPath)
  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^play_test_/)
})

test("the history downloads from the hunt's own page too, named for the hunt", async ({ page }) => {
  const tag = await milestone(page)
  const labels = huntOf(page)
  await page.goto(Routes.huntPath(labels))
  const downloading = page.waitForEvent('download')
  await page.getByRole('region', { name: 'History' }).getByRole('button', { name: 'Download Full History' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe(`${labels.hunt}.zip`)
  const git = await gitOfDownload(download, labels.hunt)
  expect(git('tag', '--list')).toBe(tag)
})

test('a deleted hunt leaves its history on the hunts page, folded away, to download', async ({ page }) => {
  const { hunt } = huntOf(page)
  // The milestone proves the hunt committed before it goes, so the hunts page has a repository to find.
  const tag = await milestone(page)
  await waitUntilSaved(page)
  await openManage(page)
  await actDangerously(page, 'Delete this quiz and its hunt', hunt)
  await expect(page).toHaveURL(/\/my\/hunts$/)

  const fold = page.getByRole('button', { name: 'Orphaned histories (1)' })
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('list', { name: 'Orphaned histories' })).toHaveCount(0)
  await fold.click()
  const orphans = page.getByRole('list', { name: 'Orphaned histories' })
  // There is no hunt to go to: it is named by its label alone.
  await expect(orphans.getByRole('listitem')).toContainText(hunt)
  await expect(orphans.getByRole('link')).toHaveCount(0)
  // On a phone, the list wraps rather than scrolling sideways.
  await page.setViewportSize({ width: 360, height: 740 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)

  const downloading = page.waitForEvent('download')
  await orphans.getByRole('button', { name: `Download ${hunt}` }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe(`${hunt}.zip`)
  const git = await gitOfDownload(download, hunt)
  expect(git('tag', '--list')).toBe(tag)
})

test('the history survives a reload, because it lives in the browser and not in the page', { tag: '@smoke' }, async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()
  // Marking a milestone first both proves the edit was committed and gives the reload something to survive.
  const tag = await milestone(page)

  await reloadOnceSaved(page)
  await expect.poll(() => gitSays(page, 'tag', '--list')).toBe(tag)
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
  // The hunt's first reading is committed at once, without waiting out the clock; its writing is
  // let settle before counting, since a count taken mid-write undercounts.
  await expect.poll(() => committedEntryCount(page)).toBeGreaterThan(0)
  const settled = { count: -1 }
  await expect.poll(async () => {
    const was = settled.count
    settled.count = await committedEntryCount(page)
    return settled.count === was
  }, { intervals: [500] }).toBe(true)
  const created = settled.count

  // The page's clock is taken over, so the wait is stepped through rather than waited out: held
  // still from before the edit, moved past the moment the edit is read for the history, then to
  // a hair short of the two seconds the suite runs with, then across them.
  await page.clock.install()
  await page.clock.pauseAt(Date.now() + 1000)
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()
  // The edit has landed once the tab's title shows it; it is read for the history when the page is next idle.
  await expect(page).toHaveTitle(/^Danish princes/)
  await page.clock.runFor(100)

  await page.clock.runFor(1800)
  // A deliberate one-shot: with the clock held short of the wait, "not yet" is the whole claim.
  expect(await committedEntryCount(page)).toBe(created)
  // ...and with nobody asking, the timer alone produces the history.
  await page.clock.runFor(300)
  await expect.poll(() => committedEntryCount(page)).toBeGreaterThan(created)
  await page.clock.resume()

  await reloadOnceSaved(page)
  await openManage(page)
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main_.+_m_\d{14}z$/)
})

test('a hunt has a history from the moment it is opened, before any edit: the hunt whole, README and all', async ({ page }) => {
  const git = await downloadedHistory(page)
  expect(git('log', '--format=%s')).toBe('start: the hunt as this browser first read it')
  expect(git('ls-files').split('\n')).toEqual(expect.arrayContaining(['README.md', 'hunt.tqh.json', `quizzes/home/${quizLabelOf(page)}.tqq.json`]))
})

test('an edit commits only the files it changed, its message naming the quiz, and a milestone made a moment later tags it, by its branch and its quiz', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()
  // Marked without waiting out the clock: the milestone commits what is waiting first.
  const tag = await milestone(page)
  const quiz = quizLabelOf(page)
  expect(tag).toMatch(new RegExp(String.raw`^main_${quiz}_m_\d{14}z$`))

  // The history downloads from the gear as a zip named for the hunt.
  const { hunt } = huntOf(page)
  await openManage(page)
  const downloading = page.waitForEvent('download')
  await manageDialog(page).getByRole('button', { name: 'Download as git' }).click()
  const download = await downloading
  await page.keyboard.press('Escape')
  expect(download.suggestedFilename()).toBe(`${hunt}.zip`)

  const git = await gitOfDownload(download, hunt)
  expect(git('show', '--name-only', '--format=%s', tag).split('\n')).toEqual([`${quiz}: quiz ~title`, '', `quizzes/home/${quiz}.tqq.json`, `quizzes/home/${quiz}.tqq.tsv`])
  expect(git('show', `${tag}:quizzes/home/${quiz}.tqq.json`)).toContain('Danish princes')
})

test('a relabelled quiz\'s files move, and the real git follows them', async ({ page }) => {
  await openManage(page)
  await page.getByLabel('Label', { exact: true }).fill('princes')
  await page.getByRole('button', { name: 'Relabel quiz' }).click()
  // The address follows the relabel once it has landed.
  await expect(page).toHaveURL(/\/princes\/!edit$/)

  await expect.poll(() => gitSays(page, 'log', '--follow', '--format=%s', '--', 'quizzes/home/princes.tqq.json')).toMatch(/^princes: quiz ~label\nstart: /)
})

test('a new quiz joins the hunt\'s history', async ({ page }) => {
  await newQuiz(page)
  const filepath = `quizzes/home/${quizLabelOf(page)}.tqq.json`
  await expect.poll(() => gitSays(page, 'ls-files', filepath)).toBe(filepath)
})

test('an import is committed on either side, and tagged', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Danish princes')
  await page.getByLabel('Quiz name').blur()

  await showTab(page, 'Import')
  await page.getByRole('textbox', { name: 'Import' }).fill('[{"label":"hamlet","clueing":"Imported"}]')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByText(/1 added/)).toBeVisible()

  const quiz = quizLabelOf(page)
  await expect.poll(() => gitSays(page, 'tag', '--list')).toMatch(new RegExp(String.raw`^main_${quiz}_import_\d{14}z$`))
  const git = await downloadedHistory(page)
  const tag = git('tag', '--list')
  expect(git('show', `${tag}:quizzes/home/${quiz}/questions.qq.tsv`)).toContain('Imported')
  expect(git('show', `${tag}~1:quizzes/home/${quiz}/questions.qq.tsv`)).not.toContain('Imported')
})

test('a deletion is committed on either side, and tagged', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Title' }).first().fill('hamlet')
  await page.getByLabel('Quiz name').click()

  // A question is deleted from the gear's archived questions, once it has been archived.
  await page.getByRole('button', { name: 'Batch select' }).click()
  await page.getByRole('button', { name: 'Change how hamlet is shown', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click()
  await openManage(page)
  await manageDialog(page).getByRole('button', { name: 'Delete hamlet' }).click()
  await manageDialog(page).getByRole('button', { name: 'Done' }).click()

  await expect.poll(() => gitSays(page, 'tag', '--list')).toMatch(new RegExp(String.raw`^main_${quizLabelOf(page)}_delete_\d{14}z$`))
})

test('a deleted quiz\'s files are removed in a commit, and its history keeps them', async ({ page }) => {
  await newQuiz(page)
  const label = quizLabelOf(page)
  const filepath = `quizzes/home/${label}.tqq.json`
  // Proven committed before the quiz goes, so there is a history for the deletion to leave behind.
  await expect.poll(() => gitSays(page, 'ls-files', filepath)).toBe(filepath)
  await openManage(page)
  await actDangerously(page, 'Delete this quiz', label)
  await expect(page.getByLabel('Open quiz').locator('option')).toHaveCount(1)

  await expect.poll(() => gitSays(page, 'log', '--format=%s', '--', filepath)).toMatch(new RegExp(String.raw`^-${label}\n`))
  const git = await downloadedHistory(page)
  expect(git('ls-files', filepath)).toBe('')
  const deleting = git('rev-list', '-n', '1', 'HEAD', '--', filepath)
  expect(git('show', `${deleting}~1:${filepath}`)).toContain(`"${label}"`)
})
