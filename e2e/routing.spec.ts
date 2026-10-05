import type { Page } from '@playwright/test'
import * as Labelmaker from '../src/lib/labelmaker'
import { AppNotices, RefusalNotices } from '../src/lib/notices'
import * as Routes from '../src/lib/routes'
import { actDangerously, addMember, assumeIdent, closeManage, expect, freshIdentLabel, grid, loadAfresh, manageDialog, newHunt, NewHuntUrl, newQuiz, openManage, openQuiz, otherVisitor, quizPathOf, startHunt, test, waitUntilSaved } from './support'

// These are about the way in, so each goes in by itself rather than from the fixture's hunt.
test.use({ startAt: null })

/** The hunt label an address names */
function huntLabelOf(page: Page): string {
  return String(new URL(page.url()).pathname.split('/', 3)[2])
}

/** A title no other spec gives a quiz, so a spec finds its own quiz by title */
function freshTitle(stem: string): string {
  return `${stem} ${crypto.randomUUID().slice(0, 8)}`
}

test.describe('the front door', () => {
  test('asks a visitor who has not said who they are', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Enter your username (6+ letters, a-z) to join' })).toBeVisible()
  })

  test('sends a visitor who has said on to their hunts', async ({ page }) => {
    const label = await assumeIdent(page)
    await loadAfresh(page, '/')
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`(@${label})`)).toBeVisible()
  })

  test('will not log in as a label too short to be an ident\'s, saying so once the field is left', async ({ page }) => {
    await page.goto('/')
    const box = page.getByRole('textbox', { name: 'Username', exact: true })
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeDisabled()
    await box.fill('flip')
    await expect(box).toHaveValue('flip')
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeDisabled()
    // Not yet: the render that holds 'flip' has said nothing, while the field is still being typed in.
    await expect(page.getByText(AppNotices.usernameLength)).toBeHidden()
    await box.blur()
    await expect(page.getByText(AppNotices.usernameLength)).toBeVisible()
    await expect(box).toHaveAttribute('aria-invalid', 'true')
  })

  test('says at once of a character no username keeps', async ({ page }) => {
    await page.goto('/')
    const box = page.getByRole('textbox', { name: 'Username', exact: true })
    await box.fill('flip_kromer!')
    await expect(page.getByText(AppNotices.usernameShape)).toBeVisible()
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeDisabled()
  })

  test('makes an ident of what was typed, titled after its label', async ({ page }) => {
    const label = freshIdentLabel()
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Enter your username (6+ letters, a-z) to join' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill(label.replaceAll('_', ' ').toUpperCase())
    await page.getByRole('button', { name: `Log in as ${label}` }).click()
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`(@${label})`)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue(Labelmaker.titleize(label))
  })

  test('lets a visitor become someone else', async ({ page }) => {
    await assumeIdent(page)
    await page.getByRole('link', { name: 'Be someone else' }).click()
    const other = freshIdentLabel()
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill(other)
    await page.getByRole('button', { name: `Log in as ${other}` }).click()
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`(@${other})`)).toBeVisible()
  })

  test('lets a visitor about to become someone else keep being who they are', async ({ page }) => {
    const label = await assumeIdent(page)
    await page.getByRole('link', { name: 'Be someone else' }).click()
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill(freshIdentLabel())
    await page.getByRole('button', { name: `Keep being ${Labelmaker.titleize(label)} (@${label})` }).click()
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`(@${label})`)).toBeVisible()
  })

  test('offers a visitor who types their own username to keep being who they are, in place of logging in', async ({ page }) => {
    const label = await assumeIdent(page)
    await page.getByRole('link', { name: 'Be someone else' }).click()
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill(label.replaceAll('_', ' ').toUpperCase())
    const keep = page.getByRole('button', { name: `Keep being ${Labelmaker.titleize(label)} (@${label})` })
    await expect(keep).toHaveCount(1)
    await expect(page.getByRole('button', { name: /^Log in/ })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Username', exact: true }).press('Enter')
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`(@${label})`)).toBeVisible()
  })

  test('turns a second browser away from a username the first holds, saying what to do, and lets it choose another', async ({ page, browser }) => {
    const label = await assumeIdent(page)
    await page.getByRole('textbox', { name: 'Your name' }).fill('The First')
    await page.getByRole('textbox', { name: 'Your name' }).blur()
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('The First')

    const elsewhere = await otherVisitor(browser)
    await elsewhere.goto('/')
    await elsewhere.getByRole('textbox', { name: 'Username', exact: true }).fill(label)
    await elsewhere.getByRole('button', { name: `Log in as ${label}` }).click()
    const gate = elsewhere.getByRole('region', { name: AppNotices.identGateTitle })
    await expect(gate.getByRole('alert')).toHaveText(RefusalNotices.usernameClaimed)
    await expect(elsewhere).toHaveURL((url) => url.pathname === '/')

    const other = freshIdentLabel()
    await elsewhere.getByRole('textbox', { name: 'Username', exact: true }).fill(other)
    await elsewhere.getByRole('button', { name: `Log in as ${other}` }).click()
    await expect(elsewhere).toHaveURL(/\/my\/hunts$/)
    await expect(elsewhere.getByText(`(@${other})`)).toBeVisible()
    await loadAfresh(page, '/my/hunts')
    await expect(page.getByText(`(@${label})`)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('The First')
  })
})

test.describe('the hunts', () => {
  test('are shown only to someone who has said who they are, who is brought back after', async ({ page }) => {
    await page.goto('/my/hunts')
    await expect(page).toHaveURL(/\/\?then=%2Fmy%2Fhunts$/)
    const label = freshIdentLabel()
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill(label)
    await page.getByRole('button', { name: `Log in as ${label}` }).click()
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

  test('line up in a table, each quiz marked locked or still being worked on', async ({ page }) => {
    await startHunt(page)
    const thinking = freshTitle('Thinking quiz')
    await page.getByLabel('Quiz name').fill(thinking)
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    await newQuiz(page)
    const locked = freshTitle('Locked quiz')
    await page.getByLabel('Quiz name').fill(locked)
    await page.getByLabel('Quiz name').blur()
    await page.getByRole('button', { name: 'Lock quiz' }).click()
    await expect(page.getByText('Locked', { exact: true })).toBeVisible()
    await loadAfresh(page, '/my/hunts')
    await newHunt(page)
    await loadAfresh(page, '/my/hunts')

    const hunts = page.getByRole('table', { name: 'Your hunts' })
    await expect(hunts.getByRole('link', { name: `Still being worked on ${thinking}` })).toBeVisible()
    await expect(hunts.getByRole('link', { name: `Locked ${locked}` })).toBeVisible()
    const doors = hunts.getByRole('link', { name: /^Categories of / })
    await expect(doors).toHaveCount(2)
    await expect.poll(() => doors.evaluateAll((links) => new Set(links.map((link) => link.getBoundingClientRect().left)).size)).toBe(1)
  })

  test('are retitled and relabelled by their smith from the gear beside each, and their quizzes follow the label', async ({ page }) => {
    await startHunt(page)
    const title = freshTitle('Relabelled quiz')
    await page.getByLabel('Quiz name').fill(title)
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    const huntTitle = freshTitle('Edited hunt')
    const huntLabel = `edited_${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`
    await loadAfresh(page, '/my/hunts')
    await page.getByRole('button', { name: /^Edit hunt / }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit hunt' })
    await expect(dialog.getByText("Changing this label updates the URL. Old links won't find this page anymore.")).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(huntTitle)
    await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill(huntLabel)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('rowheader', { name: huntTitle })).toBeVisible()
    await page.getByRole('link', { name: title }).click()
    await expect(page).toHaveURL(new RegExp(`/h/${huntLabel}/home/`))
    await expect(page.getByLabel('Quiz name')).toHaveValue(title)
  })
})

/** The strip across the top of the page, where the logo and the hunt the page is about sit */
function whereYouAre(page: Page) {
  return page.getByRole('navigation', { name: 'Where you are' })
}

test.describe('a hunt', () => {
  test('is named in the header on its quiz and its categories, and opens its own page from there', async ({ page }) => {
    const identLabel = await startHunt(page)
    const label = huntLabelOf(page)
    const huntTitle = freshTitle('Headed hunt')
    await openManage(page)
    await manageDialog(page).getByRole('textbox', { name: 'Hunt name' }).fill(huntTitle)
    await manageDialog(page).getByRole('button', { name: 'Rename' }).click()
    await waitUntilSaved(page)
    await expect(whereYouAre(page).getByRole('link', { name: huntTitle })).toBeVisible()

    await page.goto(Routes.categoriesPath(label))
    await whereYouAre(page).getByRole('link', { name: huntTitle }).click()
    await expect(page).toHaveURL(Routes.huntPath(label))
    await expect(whereYouAre(page).getByRole('link', { name: huntTitle })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: 'Quizzes' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Members of this hunt' }).getByRole('row').filter({ hasText: identLabel })).toContainText('Smith')

    await page.getByRole('link', { name: 'The category wheel' }).click()
    await expect(page).toHaveURL(Routes.categoriesPath(label))
    await page.goto(Routes.huntPath(label))
    await page.getByRole('region', { name: 'Quizzes' }).getByRole('link').first().click()
    await expect(page).toHaveURL(new RegExp(String.raw`/h/${label}/home/${label}\?act=smith$`))

    // A page about no hunt names none.
    await page.getByRole('link', { name: 'About' }).click()
    await expect(page).toHaveURL('/about')
    await expect(whereYouAre(page).getByRole('link')).toHaveCount(1)
  })

  test('opens its own page from its title in the hunts list', async ({ page }) => {
    await startHunt(page)
    const label = huntLabelOf(page)
    await loadAfresh(page, '/my/hunts')
    // A fresh ident is on this hunt alone.
    await page.getByRole('rowheader').getByRole('link').click()
    await expect(page).toHaveURL(Routes.huntPath(label))
    await expect(page.getByRole('heading', { name: 'Quizzes' })).toBeVisible()
  })

  test('says so for a hunt there is not, and tells a stranger who to ask', async ({ page, browser }) => {
    await startHunt(page)
    const label = huntLabelOf(page)
    await page.goto(Routes.huntPath('no_such_hunt_here'))
    await expect(page.getByRole('heading', { name: 'No such hunt' })).toBeVisible()
    await expect(whereYouAre(page).getByRole('link')).toHaveCount(1)

    const stranger = await otherVisitor(browser)
    await assumeIdent(stranger)
    await stranger.goto(Routes.huntPath(label))
    await expect(stranger.getByRole('heading', { name: 'Not yet on this hunt' })).toBeVisible()
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
    await openManage(page)
    await actDangerously(page, 'Delete this quiz', 'kept_history')
    await expect(page.getByLabel('Open quiz').locator('option')).toHaveCount(1)
    await waitUntilSaved(page)

    await loadAfresh(page, `/h/${huntLabelOf(page)}/home/nothing`)
    const repo = page.getByRole('listitem').filter({ hasText: 'kept_history' })
    await expect(repo).toContainText('main')
    await expect(repo).toContainText('not in this hunt')
  })
})

test.describe('a link handed to a friend', () => {
  test('brings a friend who has not said who they are through the front door and back, to be told which smith to ask, at the same address', async ({ page, browser }) => {
    const author = await startHunt(page)
    await page.getByLabel('Quiz name').fill('For my friends')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    const link = page.url()

    const friend = await otherVisitor(browser)
    const label = freshIdentLabel()
    await friend.goto(link)
    await expect(friend.getByRole('heading', { name: 'Enter your username (6+ letters, a-z) to join' })).toBeVisible()
    await friend.getByRole('textbox', { name: 'Username', exact: true }).fill(label)
    await friend.getByRole('button', { name: `Log in as ${label}` }).click()
    await expect(friend).toHaveURL(link)
    const notice = friend.getByRole('region', { name: 'Not yet on this hunt' })
    await expect(notice).toContainText('You are not yet a member of this hunt.')
    await expect(notice).toContainText(`(${author}) to please add you`)
    await expect(notice).toContainText(`your ident, “${label}”`)
    await expect(friend.getByLabel('Quiz name')).toBeHidden()
    await expect(friend).toHaveURL(link)
  })

  test('opens the quiz for the friend the moment a smith adds them', async ({ page, browser }) => {
    await startHunt(page)
    await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which prince was Danish?')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const friend = await otherVisitor(browser)
    const label = await assumeIdent(friend)
    const link = page.url()
    await friend.goto(link)
    await expect(friend.getByRole('heading', { name: 'Not yet on this hunt' })).toBeVisible()

    await addMember(page, label, 'Smith')
    await expect(friend).toHaveURL(link)
    await expect(friend.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which prince was Danish?')
  })

  test('sends a reviewer who asks for the smiths\' presentation to review instead', async ({ page, browser }) => {
    const author = await startHunt(page)
    await waitUntilSaved(page)
    const friend = await otherVisitor(browser)
    const label = await assumeIdent(friend)
    await addMember(page, label, 'Reviewer')

    await friend.goto(page.url())
    await expect(friend).toHaveURL(/\?act=smith$/)
    const notice = friend.getByRole('region', { name: 'Not a smith here' })
    await expect(notice).toContainText('You are a reviewer on this hunt, not a smith.')
    await expect(notice).toContainText(`(${author}) to make you one`)
    await expect(notice).toContainText(`your ident, “${label}”`)
    await expect(friend.getByLabel('Quiz name')).toBeHidden()
    await friend.getByRole('link', { name: 'Review this quiz' }).click()
    await expect(friend).toHaveURL(/\?act=review$/)
    await expect(friend.getByRole('button', { name: 'Share with the smiths' })).toBeVisible()
  })

  test('lets a friend made a smith make edits that reach the author', async ({ page, browser }) => {
    await startHunt(page)
    await waitUntilSaved(page)
    const friend = await otherVisitor(browser)
    await addMember(page, await assumeIdent(friend), 'Smith')

    await friend.goto(quizPathOf(page))
    await expect(friend).toHaveURL(NewHuntUrl)
    await friend.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Written by a friend')
    await friend.getByLabel('Quiz name').click()
    await waitUntilSaved(friend)

    await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Written by a friend')
  })

  test('takes the author\'s address along when the friend relabels the quiz they both have open', async ({ page, browser }) => {
    await startHunt(page)
    await waitUntilSaved(page)
    const friend = await otherVisitor(browser)
    await addMember(page, await assumeIdent(friend), 'Smith')

    await friend.goto(page.url())
    await expect(friend).toHaveURL(NewHuntUrl)
    await openManage(friend)
    await friend.getByLabel('Label', { exact: true }).fill('renamed_by_a_friend')
    await friend.getByRole('button', { name: 'Apply' }).click()

    await expect(page).toHaveURL(new RegExp(String.raw`/h/${huntLabelOf(page)}/home/renamed_by_a_friend\?act=smith$`))
    await expect(grid(page)).toBeVisible()
  })

  test('lists the author\'s hunt among the friend\'s once they are on it, with their role', async ({ page, browser }) => {
    await startHunt(page)
    const title = freshTitle('A hunt to find')
    await page.getByLabel('Quiz name').fill(title)
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)

    const friend = await otherVisitor(browser)
    const label = await assumeIdent(friend)
    await expect(friend.getByRole('heading', { name: 'Hunts' })).toBeVisible()
    await expect(friend.getByRole('link', { name: title })).toBeHidden()

    await addMember(page, label, 'Reviewer')
    const listed = friend.getByRole('row').filter({ hasText: title })
    await expect(listed).toContainText('Reviewer')
    // Drawn in the same render as the role beside it: a reviewer is offered no gear to edit the hunt.
    await expect(listed.getByRole('button', { name: /^Edit hunt / })).toHaveCount(0)
    await friend.getByRole('link', { name: title }).click()
    await expect(friend).toHaveURL(/\?act=review$/)
  })

  test('tells a smith who adds a label nobody has chosen what the friend must do first', async ({ page }) => {
    await startHunt(page)
    const members = page.getByRole('region', { name: 'Members' })
    const label = freshIdentLabel()
    await members.getByLabel('Ident label').fill(label)
    await members.getByRole('button', { name: 'Add' }).click()
    await expect(members.getByText(`No ident is labelled "${label}". They need to visit the app and choose it first.`)).toBeVisible()
  })

  test('offers a smith no way to take themselves off, and says why beside the field when they try to put themselves on', async ({ page }) => {
    const label = await startHunt(page)
    const members = page.getByRole('region', { name: 'Members' })
    const own = members.getByRole('row').filter({ hasText: label })
    await expect(own).toContainText('you')
    // Drawn in the same render as "you": one's own row is offered no Remove.
    await expect(own.getByRole('button', { name: `Remove ${label}` })).toHaveCount(0)

    await members.getByLabel('Ident label').fill(label)
    await members.getByRole('button', { name: 'Add' }).click()
    await expect(members.getByText(RefusalNotices.ownHunting)).toBeVisible()
    // Said beside the field without asking the server, in the same moment an alarm would be raised, were one.
    await expect(page.getByRole('alert').filter({ hasText: RefusalNotices.ownHunting })).toHaveCount(0)
  })

  test('lets a smith take a member off, who is then told they are not on the hunt', async ({ page, browser }) => {
    await startHunt(page)
    await waitUntilSaved(page)
    const friend = await otherVisitor(browser)
    const label = await assumeIdent(friend)
    await addMember(page, label, 'Smith')
    await friend.goto(page.url())
    await expect(friend.getByLabel('Quiz name')).toBeVisible()

    await page.getByRole('region', { name: 'Members' }).getByRole('button', { name: `Remove ${label}` }).click()
    await expect(friend.getByRole('heading', { name: 'Not yet on this hunt' })).toBeVisible()
    await expect(friend.getByLabel('Quiz name')).toBeHidden()
  })
})
