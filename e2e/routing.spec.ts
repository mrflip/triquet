import type { Page } from '@playwright/test'
import { assumeIdent, closeManage, expect, freshIdentLabel, loadAfresh, manageDialog, NewHuntUrl, newQuiz, openManage, openQuiz, otherVisitor, startHunt, test, waitUntilSaved } from './support'

// These are about the way in, so each goes in by itself rather than from the fixture's hunt.
test.use({ startAt: null })

/** The hunt label an address names */
function huntLabelOf(page: Page): string {
  return String(new URL(page.url()).pathname.split('/', 3)[2])
}

/** A title no other spec gives a quiz: specs share one database, and the hunts list shows every hunt in it */
function freshTitle(stem: string): string {
  return `${stem} ${crypto.randomUUID().slice(0, 8)}`
}

test.describe('the front door', () => {
  test('asks a visitor who has not said who they are', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible()
  })

  test('sends a visitor who has said on to their hunts', async ({ page }) => {
    const label = await assumeIdent(page)
    await loadAfresh(page, '/')
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`(${label})`)).toBeVisible()
  })

  test('refuses a label too short to be an ident\'s, saying why', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Ident label').fill('flip')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText(/An ident label is 6 to 24/)).toBeVisible()
    await expect(page).toHaveURL((url) => url.pathname === '/')
  })

  test('makes an ident of what was typed, titled as asked', async ({ page }) => {
    const label = freshIdentLabel()
    await page.goto('/')
    await page.getByLabel('Ident label').fill(label.replaceAll('_', ' ').toUpperCase())
    await page.getByLabel('Title').fill('Flip the Tester')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`You are Flip the Tester (${label}).`)).toBeVisible()
  })

  test('lets a visitor become someone else', async ({ page }) => {
    await assumeIdent(page)
    await page.getByRole('link', { name: 'Be someone else' }).click()
    const other = freshIdentLabel()
    await page.getByLabel('Ident label').fill(other)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`(${other})`)).toBeVisible()
  })

  test('makes one who types an ident someone else made into that ident', async ({ page, browser }) => {
    const label = freshIdentLabel()
    await page.goto('/')
    await page.getByLabel('Ident label').fill(label)
    await page.getByLabel('Title').fill('The First')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/my\/hunts$/)

    const elsewhere = await otherVisitor(browser)
    await elsewhere.goto('/')
    await elsewhere.getByLabel('Ident label').fill(label)
    await elsewhere.getByLabel('Title').fill('The Second')
    await elsewhere.getByRole('button', { name: 'Continue' }).click()
    await expect(elsewhere.getByText(`You are The First (${label}).`)).toBeVisible()
  })
})

test.describe('the hunts', () => {
  test('are shown only to someone who has said who they are, who is brought back after', async ({ page }) => {
    await page.goto('/my/hunts')
    await expect(page).toHaveURL(/\/\?then=%2Fmy%2Fhunts$/)
    await page.getByLabel('Ident label').fill(freshIdentLabel())
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/my\/hunts$/)
  })

  test('make a new one whose quiz shares its label and title, open for work', async ({ page }) => {
    await startHunt(page)
    const label = huntLabelOf(page)
    await expect(page).toHaveURL(new RegExp(String.raw`/h/${label}/home/${label}\?act=smith$`))
    await expect(page.getByLabel('Quiz name')).toHaveValue(/^[A-Z]/)
  })

  test('list each hunt with its quizzes, which open when followed', async ({ page }) => {
    await startHunt(page)
    const title = freshTitle('Listed quiz')
    await page.getByLabel('Quiz name').fill(title)
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    const path = new URL(page.url()).pathname
    await loadAfresh(page, '/my/hunts')
    await page.getByRole('link', { name: title }).click()
    await expect(page).toHaveURL(`${path}?act=smith`)
    await expect(page.getByLabel('Quiz name')).toHaveValue(title)
  })
})

test.describe('an address naming a quiz', () => {
  test.beforeEach(async ({ page }) => {
    await startHunt(page)
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
  })

  test('is presented to a smith when it names no presentation', async ({ page }) => {
    const path = new URL(page.url()).pathname
    await loadAfresh(page, path)
    await expect(page).toHaveURL(`${path}?act=smith`)
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  })

  test('opens straight to the quiz it names', async ({ page }) => {
    await newQuiz(page)
    await page.getByLabel('Quiz name').fill('Quiz two')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    const secondUrl = page.url()
    await openQuiz(page, 'Quiz one')

    await loadAfresh(page, secondUrl)
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz two')
    await expect(page).toHaveURL(secondUrl)
  })

  test('moves when another quiz is picked from the switcher', async ({ page }) => {
    const firstUrl = page.url()
    await newQuiz(page)
    await page.getByLabel('Quiz name').blur()
    await expect(page).not.toHaveURL(firstUrl)
    await openQuiz(page, 'Quiz one')
    await expect(page).toHaveURL(firstUrl)
  })

  test('moves with its quiz when the gear icon relabels it', async ({ page }) => {
    const hunt = huntLabelOf(page)
    await openManage(page)
    await expect(page.getByLabel('Label', { exact: true })).toHaveValue(/^[a-z]+_[a-z]+/)
    await page.getByLabel('Label', { exact: true }).fill('Leon\'s Quiz!!')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(manageDialog(page)).toBeHidden()
    await expect(page).toHaveURL(new RegExp(String.raw`/h/${hunt}/home/leon_s_quiz\?act=smith$`))
  })

  test('refuses a label another quiz of the realm uses, with the field left open to fix', async ({ page }) => {
    await openManage(page)
    await page.getByLabel('Label', { exact: true }).fill('leon')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(manageDialog(page)).toBeHidden()
    await expect(page).toHaveURL(/\/home\/leon\?act=smith$/)
    await waitUntilSaved(page)

    await newQuiz(page)
    await waitUntilSaved(page)
    await openManage(page)
    await page.getByLabel('Label', { exact: true }).fill('leon')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText('Another quiz already uses that label.')).toBeVisible()
    await expect(manageDialog(page)).toBeVisible()
  })

  test('lets the "All quizzes" list open another quiz and close the modal', async ({ page }) => {
    await newQuiz(page)
    await page.getByLabel('Quiz name').fill('Quiz two')
    await page.getByLabel('Quiz name').blur()
    await openManage(page)
    await page.getByRole('button', { name: 'Quiz one' }).click()
    await expect(manageDialog(page)).toBeHidden()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  })

  test('says so when the label put in it is not a quiz, and the back button returns', async ({ page }) => {
    const before = page.url()
    await page.goto(`/h/${huntLabelOf(page)}/home/asdf`)
    await expect(page.getByRole('heading', { name: 'No such quiz' })).toBeVisible()
    await page.goBack()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
    await expect(page).toHaveURL(before)
  })
})

test.describe('an address naming a quiz that is not there', () => {
  test('says which quiz of which hunt it looked for, and lists the hunt\'s quizzes', async ({ page }) => {
    await startHunt(page)
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    const hunt = huntLabelOf(page)
    await loadAfresh(page, `/h/${hunt}/home/asdf?act=smith`)
    await expect(page.getByRole('heading', { name: 'No such quiz' })).toBeVisible()
    await expect(page.getByText(`has no quiz at “${hunt}/home/asdf”.`)).toBeVisible()
    await page.getByRole('link', { name: 'Quiz one' }).click()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  })

  test('says there is no such hunt, once the server has had its say', async ({ page }) => {
    await assumeIdent(page)
    await page.goto('/h/no_such_hunt_here/home/asdf?act=smith')
    await expect(page.getByText('There is no hunt labelled “no_such_hunt_here”.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Your hunts' })).toBeVisible()
  })

  test('lists the history repositories this browser holds, including those of deleted quizzes', async ({ page }) => {
    await startHunt(page)
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await openManage(page)
    await page.getByLabel('Label', { exact: true }).fill('kept_history')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page).toHaveURL(/\/home\/kept_history\?act=smith$/)
    await openManage(page)
    await page.getByRole('button', { name: 'Mark a milestone' }).click()
    await expect(page.getByRole('status')).toHaveText(/^main-m-\d{14}z$/)
    await closeManage(page)

    await newQuiz(page)
    await openQuiz(page, 'Quiz one')
    await page.getByRole('button', { name: 'Delete quiz' }).click()
    await page.getByRole('button', { name: 'Yes' }).click()
    await expect(page.getByLabel('Open quiz').locator('option')).toHaveCount(1)
    await waitUntilSaved(page)

    await loadAfresh(page, `/h/${huntLabelOf(page)}/home/nothing`)
    const repo = page.getByRole('listitem').filter({ hasText: 'kept_history' })
    await expect(repo).toContainText('main')
    await expect(repo).toContainText('not in this hunt')
  })
})

test.describe('a link handed to a friend', () => {
  test('brings a friend who has not said who they are through the front door and back to it', async ({ page, browser }) => {
    await startHunt(page)
    await page.getByLabel('Quiz name').fill('For my friends')
    await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which prince was Danish?')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)
    const link = page.url()

    const friend = await otherVisitor(browser)
    await friend.goto(link)
    await expect(friend.getByRole('heading', { name: 'Who are you?' })).toBeVisible()
    await friend.getByLabel('Ident label').fill(freshIdentLabel())
    await friend.getByRole('button', { name: 'Continue' }).click()
    await expect(friend).toHaveURL(link)
    await expect(friend.getByLabel('Quiz name')).toHaveValue('For my friends')
    await expect(friend.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which prince was Danish?')
  })

  test('lets the friend\'s edits reach the author, for the trial', async ({ page, browser }) => {
    await startHunt(page)
    await waitUntilSaved(page)
    const link = page.url()

    const friend = await otherVisitor(browser)
    await assumeIdent(friend)
    await friend.goto(link)
    await expect(friend).toHaveURL(NewHuntUrl)
    await friend.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Written by a friend')
    await friend.getByLabel('Quiz name').click()
    await waitUntilSaved(friend)

    await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Written by a friend')
  })

  test('takes the author\'s address along when the friend relabels the quiz they both have open', async ({ page, browser }) => {
    await startHunt(page)
    await waitUntilSaved(page)
    const link = page.url()

    const friend = await otherVisitor(browser)
    await assumeIdent(friend)
    await friend.goto(link)
    await expect(friend).toHaveURL(NewHuntUrl)
    await openManage(friend)
    await friend.getByLabel('Label', { exact: true }).fill('renamed_by_a_friend')
    await friend.getByRole('button', { name: 'Apply' }).click()

    await expect(page).toHaveURL(new RegExp(String.raw`/h/${huntLabelOf(page)}/home/renamed_by_a_friend\?act=smith$`))
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('shows the friend the author\'s hunt among the hunts', async ({ page, browser }) => {
    await startHunt(page)
    const title = freshTitle('A hunt to find')
    await page.getByLabel('Quiz name').fill(title)
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)

    const friend = await otherVisitor(browser)
    await assumeIdent(friend)
    await friend.getByRole('link', { name: title }).click()
    await expect(friend.getByLabel('Quiz name')).toHaveValue(title)
  })
})
