import type { Locator, Page } from '@playwright/test'
import * as Labelmaker from '../src/lib/labelmaker'
import { AppNotices, RefusalNotices, userUnknownNotice } from '../src/lib/notices'
import * as Routes from '../src/lib/routes'
import { putOnHunt, vouchFor } from './admin'
import { addMember, answerRemoval, assumeUserlabel, closeManage, expect, forgetSession, freshUserlabel, grid, huntLabelOf, huntOf, loadAfresh, manageDialog, newHunt, NewHuntUrl, newQuiz, openManage, openUserMenu, openPanel, openQuiz, otherVisitor, quizPathOf, startHunt, test, valuesOf, waitUntilSaved } from './support'

// The tests about the front door, the hunts list, or making a hunt go in by themselves
// (`startAt: null`); the rest begin at the fixture's fresh hunt, with the fixture's friend for a
// second visitor, put on it by the backend unless the Members panel is what the test is about.

/** A title no other spec gives a quiz, so a spec finds its own quiz by title */
function freshTitle(stem: string): string {
  return `${stem} ${crypto.randomUUID().slice(0, 8)}`
}

/** Make the user holding the userlabel `label` a smith of the hunt `page` has open, and open the same quiz for editing in their browser, `friend` */
async function smithBeside(page: Page, friend: Page, label: string): Promise<void> {
  await putOnHunt(huntOf(page), label, 'smith')
  await friend.goto(page.url())
  await expect(grid(friend)).toBeVisible()
}

/** Every question's field `fieldname` in the grid, top to bottom */
function fieldsOf(page: Page, fieldname: string): Locator {
  return grid(page).getByRole('textbox', { name: fieldname, exact: true })
}

test('every page and route answers with the security headers: framed by no other site, sniffed for no other type, its address kept from other sites', async ({ request }) => {
  const Expected = {
    'x-frame-options':        'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy':        'strict-origin-when-cross-origin',
    'permissions-policy':     'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  }
  for (const address of ['/', '/my/hunts', '/api/ask']) {
    const response = await request.get(address)
    expect(response.headers(), address).toMatchObject(Expected)
  }
})

test.describe('the front door', () => {
  test.use({ startAt: null })

  test('asks a visitor who has not said who they are', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: AppNotices.userlabelGateTitle })).toBeVisible()
  })

  test('sends a visitor who has said on to their hunts', async ({ page }) => {
    const label = await assumeUserlabel(page)
    await loadAfresh(page, '/')
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`(@${label})`)).toBeVisible()
  })

  test('will not log in as a userlabel too short to be one, saying so once the field is left', async ({ page }) => {
    await page.goto('/')
    const name = page.getByRole('textbox', { name: 'Your name' })
    const box = page.getByRole('textbox', { name: 'Handle', exact: true })
    await expect(page.getByRole('button', { name: AppNotices.signUp, exact: true })).toBeDisabled()
    await name.fill('Flo')
    await expect(box).toHaveValue('flo')
    await expect(page.getByRole('button', { name: AppNotices.signUp, exact: true })).toBeDisabled()
    // Not yet: the render that holds 'flo' has said nothing, while the name is still being typed.
    await expect(page.getByText(AppNotices.userlabelUnfinished)).toBeHidden()
    await name.blur()
    await expect(page.getByText(AppNotices.userlabelUnfinished)).toBeVisible()
    await expect(box).toHaveAttribute('aria-invalid', 'true')
  })

  test('takes any name, and says at once of a userlabel no typing on would mend', async ({ page }) => {
    await page.goto('/')
    const box = page.getByRole('textbox', { name: 'Handle', exact: true })
    await page.getByRole('textbox', { name: 'Your name' }).fill('Flip (the) Kromer!')
    await expect(box).toHaveValue('flip_the_kromer')
    await expect(page.getByRole('button', { name: AppNotices.signUp, exact: true })).toBeEnabled()
    await box.fill('Flip_Kromer')
    await expect(page.getByText(AppNotices.userlabelShape)).toBeVisible()
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('button', { name: AppNotices.signUp, exact: true })).toBeDisabled()
  })

  test('makes the userlabel follow the name until it is typed in itself, and again once it is emptied', async ({ page }) => {
    await page.goto('/')
    const name = page.getByRole('textbox', { name: 'Your name' })
    const box = page.getByRole('textbox', { name: 'Handle', exact: true })
    await name.fill('Flip Kromer')
    await expect(box).toHaveValue('flip_kromer')
    await box.fill('mrflip')
    await name.fill('Philip Kromer')
    await expect(box).toHaveValue('mrflip')
    await box.fill('')
    // Emptied, it follows again: blank while it is being cleared, the name's userlabel once the name changes or the field is left.
    await expect(box).toHaveAttribute('placeholder', 'philip_kromer')
    await box.blur()
    await expect(box).toHaveValue('philip_kromer')
    await name.fill('Phil Kromer')
    await expect(box).toHaveValue('phil_kromer')
  })

  test("gives the visitor's user the userlabel, titled with the name typed", async ({ page }) => {
    const label = freshUserlabel()
    await page.goto('/')
    await expect(page.getByRole('heading', { name: AppNotices.userlabelGateTitle })).toBeVisible()
    await page.getByRole('textbox', { name: 'Your name' }).fill('Flip (the) Kromer!')
    await page.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    await page.getByRole('textbox', { name: 'Handle', exact: true }).press('Enter') // the form goes on Enter, as on its button
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByText(`(@${label})`)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Flip (the) Kromer!')
  })

  test("titles the visitor's user after its userlabel when no name is typed", async ({ page }) => {
    const label = freshUserlabel()
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    await page.getByRole('button', { name: AppNotices.signUp, exact: true }).click()
    await expect(page).toHaveURL(/\/my\/hunts$/)
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue(Labelmaker.titleize(label))
  })

  test("names the visitor in the header's user menu, which retitles them", async ({ page }) => {
    const label = await assumeUserlabel(page)
    let menu = await openUserMenu(page)
    await expect(menu).toContainText(`@${label}`)
    await menu.getByRole('textbox', { name: 'Your name' }).fill('Menu Named')
    await menu.getByRole('textbox', { name: 'Your name' }).blur()
    // Said to the menu itself: the blur leaves focus on the page's body, which the menu does not hear.
    await menu.press('Escape')
    await expect(menu).toBeHidden()
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Menu Named')
    await expect(page.getByRole('banner').getByRole('button', { name: 'You', exact: true })).toHaveText('M')

    // A handle is chosen once: there is no becoming someone else. (Signing in follows, where the backend has Google's keys: `google-sign-in.spec`.)
    menu = await openUserMenu(page)
    await expect(menu.getByRole('menuitem')).toHaveText([AppNotices.profile])
  })

  test('tells a second browser, in place of its button, that a userlabel the first holds is taken, and lets it choose another', async ({ page, browser }) => {
    const label = await assumeUserlabel(page)
    await page.getByRole('textbox', { name: 'Your name' }).fill('The First')
    await page.getByRole('textbox', { name: 'Your name' }).blur()
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('The First')

    const elsewhere = await otherVisitor(browser)
    await elsewhere.goto('/')
    await elsewhere.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    // A standalone account holds it, which no sign-in reaches: taken, whether or not Google is offered
    const gate = elsewhere.getByRole('region', { name: AppNotices.userlabelGateTitle })
    await expect(gate.getByRole('status')).toHaveText(AppNotices.heldOtherwise)
    await expect(elsewhere.getByRole('button', { name: AppNotices.signUp, exact: true })).toHaveCount(0)
    await elsewhere.getByRole('textbox', { name: 'Handle', exact: true }).press('Enter') // nor does the form go on Enter
    await expect(elsewhere).toHaveURL((url) => url.pathname === '/')

    const other = freshUserlabel()
    await elsewhere.getByRole('textbox', { name: 'Handle', exact: true }).fill(other)
    await elsewhere.getByRole('button', { name: AppNotices.signUp, exact: true }).click()
    await expect(elsewhere).toHaveURL(/\/my\/hunts$/)
    await expect(elsewhere.getByText(`(@${other})`)).toBeVisible()
    await loadAfresh(page, '/my/hunts')
    await expect(page.getByText(`(@${label})`)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('The First')
  })
})

test.describe('the hunts', () => {
  test.use({ startAt: null })

  test('are shown only to someone who has said who they are, who is brought back after', async ({ page }) => {
    await page.goto('/my/hunts')
    await expect(page).toHaveURL(/\/\?then=%2Fmy%2Fhunts$/)
    const label = freshUserlabel()
    await page.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    await page.getByRole('button', { name: AppNotices.signUp, exact: true }).click()
    await expect(page).toHaveURL(/\/my\/hunts$/)
  })

  test("are shown on the profile too, which the user menu leads to, and which brings a visitor back after they have said who they are", async ({ page }) => {
    await page.goto(Routes.profilePath())
    await expect(page).toHaveURL(/\/\?then=%2Fmy%2Fprofile$/)
    const label = freshUserlabel()
    await page.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    await page.getByRole('button', { name: AppNotices.signUp, exact: true }).click()
    await expect(page).toHaveURL(/\/my\/profile$/)
    await expect(page.getByText(`(@${label})`)).toBeVisible()
    await expect(page.getByRole('region', { name: 'Hunts' })).toBeVisible()
    await page.goto(Routes.huntsPath())
    const menu = await openUserMenu(page)
    await menu.getByRole('menuitem', { name: AppNotices.profile }).click()
    await expect(page).toHaveURL(/\/my\/profile$/)
    await expect(page.getByRole('region', { name: 'Hunts' })).toBeVisible()
  })

  test('make a new one under their own org, whose quiz shares its label and title, open for work', async ({ page }) => {
    const userlabel = await startHunt(page)
    await vouchFor(userlabel)
    await loadAfresh(page, '/my/hunts')
    await newHunt(page)
    const label = huntLabelOf(page)
    expect(label).not.toBe(userlabel)
    await expect(page).toHaveURL(Routes.quizPath({ org: userlabel, hunt: label, realm: 'home', quiz: label }, 'edit'))
    await expect(page.getByLabel('Quiz name')).toHaveValue(/^[A-Z]/)
  })

  test("offer an anonymous visitor one hunt, its sandbox, under its own handle, and then say that signing in with Google makes more", async ({ page }) => {
    const userlabel = await startHunt(page)
    await expect(page).toHaveURL(Routes.quizPath({ org: userlabel, hunt: userlabel, realm: 'home', quiz: userlabel }, 'edit'))
    await loadAfresh(page, '/my/hunts')
    await expect(page.getByRole('rowheader')).toHaveCount(1)
    await expect(page.getByText(RefusalNotices.sealedHunts)).toBeVisible()
    await expect(page.getByRole('button', { name: '+ New hunt' })).toHaveCount(0)
  })

  test("keep an anonymous visitor's sandbox its own: the Members panel says signing in with Google brings others on", async ({ page, friendLabel }) => {
    await startHunt(page)
    const members = await openPanel(page, 'Members')
    await members.getByLabel('Their handle').fill(friendLabel)
    await members.getByRole('button', { name: 'Add' }).click()
    await expect(members.getByText(RefusalNotices.sealedMembers)).toBeVisible()
    await expect(members.getByRole('row').filter({ hasText: friendLabel })).toHaveCount(0)
  })

  test("offer an anonymous smith neither relabelling nor deleting its sandbox, in the gear beside it or the quiz's own, saying why", async ({ page }) => {
    await startHunt(page)
    await openManage(page)
    const manage = manageDialog(page)
    await expect(manage.getByText(RefusalNotices.sealedRelabel)).toBeVisible()
    await expect(manage.getByText(RefusalNotices.sealedDelete)).toBeVisible()
    await expect(manage.getByRole('textbox', { name: 'Hunt label' })).toHaveCount(0)
    await expect(manage.getByRole('button', { name: 'Delete this quiz and its hunt' })).toHaveCount(0)
    await expect(manage.getByRole('textbox', { name: 'Hunt name' })).toBeVisible()
    await closeManage(page)
    await loadAfresh(page, '/my/hunts')
    await page.getByRole('button', { name: /^Edit hunt / }).click()
    const gear = page.getByRole('dialog', { name: 'Edit hunt' })
    await expect(gear.getByText(RefusalNotices.sealedRelabel)).toBeVisible()
    await expect(gear.getByRole('textbox', { name: 'Label', exact: true })).toHaveCount(0)
    await expect(gear.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible()
  })

  test("tell an anonymous smith asking to review its sandbox's quiz that reviewing comes with Google, and lead it back to working on it", async ({ page }) => {
    const label = await startHunt(page)
    const edit = page.url()
    await page.goto(Routes.quizPath({ org: label, hunt: label, realm: 'home', quiz: label }, 'playtest'))
    await expect(page.getByRole('heading', { name: AppNotices.reviewingSealedTitle })).toBeVisible()
    await page.getByRole('link', { name: 'Work on this quiz' }).click()
    await expect(page).toHaveURL(edit)
    await expect(grid(page)).toBeVisible()
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
    await expect(page).toHaveURL(path)
    await expect(page.getByLabel('Quiz name')).toHaveValue(title)
  })

  test('line up in a table, each quiz marked locked or still being worked on', async ({ page }) => {
    await vouchFor(await startHunt(page))
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
    // Signed in with Google, as it were: an anonymous smith may not relabel its sandbox.
    await vouchFor(await startHunt(page))
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
    await expect(page).toHaveURL(new RegExp(`/${huntLabel}/quizzes/home/`))
    await expect(page.getByLabel('Quiz name')).toHaveValue(title)
  })
})

/** The strip across the top of the page, where the logo and the hunt the page is about sit */
function whereYouAre(page: Page) {
  return page.getByRole('navigation', { name: 'Where you are' })
}

test.describe('a hunt', () => {
  test('is named in the header on its quiz and its categories, and opens its own page from there', async ({ page }) => {
    const hunt = huntOf(page)
    const { org: userlabel, hunt: label } = hunt
    const huntTitle = freshTitle('Headed hunt')
    await openManage(page)
    await manageDialog(page).getByRole('textbox', { name: 'Hunt name' }).fill(huntTitle)
    await manageDialog(page).getByRole('button', { name: 'Rename' }).click()
    await waitUntilSaved(page)
    await expect(whereYouAre(page).getByRole('link', { name: huntTitle })).toBeVisible()
    // On a quiz, the crumbs go on to its realm, which opens the hunt's quizzes, and the quiz itself.
    await expect(whereYouAre(page).getByRole('link', { name: 'home', exact: true })).toHaveAttribute('href', Routes.quizzesPath(hunt))
    await page.getByLabel('Quiz name').fill('Crumbed quiz')
    await expect(whereYouAre(page).getByRole('button', { name: 'Crumbed quiz' })).toHaveAttribute('aria-current', 'page')

    await page.goto(Routes.categoriesPath(hunt))
    await whereYouAre(page).getByRole('link', { name: huntTitle }).click()
    await expect(page).toHaveURL(Routes.huntPath(hunt))
    await expect(whereYouAre(page).getByRole('link', { name: huntTitle })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: 'Quizzes' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Members of this hunt' }).getByRole('row').filter({ hasText: userlabel })).toContainText('Smith')

    await page.getByRole('link', { name: 'The category wheel' }).click()
    await expect(page).toHaveURL(Routes.categoriesPath(hunt))
    await page.goto(Routes.huntPath(hunt))
    await page.getByRole('region', { name: 'Quizzes' }).getByRole('link').first().click()
    await expect(page).toHaveURL(Routes.quizPath({ ...hunt, realm: 'home', quiz: label }, 'edit'))

    // The org beside the hunt opens the org's hunts.
    await whereYouAre(page).getByRole('link', { name: `~${userlabel}` }).click()
    await expect(page).toHaveURL(Routes.orgPath(userlabel))
    await expect(page.getByRole('heading', { name: `Hunts of ~${userlabel}` })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Your hunts' }).getByRole('rowheader', { name: huntTitle })).toBeVisible()

    // A page about no hunt names none. Followed from the keyboard: the dev server's badge sits over the footer's corner.
    await page.getByRole('contentinfo').getByRole('link', { name: 'About' }).press('Enter')
    await expect(page).toHaveURL('/about')
    await expect(whereYouAre(page).getByRole('link')).toHaveCount(1)
  })

  // About the hunts list of a user on this hunt alone.
  test.describe(() => {
    test.use({ startAt: null })

    test('opens its own page from its title in the hunts list', async ({ page }) => {
      await startHunt(page)
      const hunt = huntOf(page)
      await loadAfresh(page, '/my/hunts')
      // A fresh user is on this hunt alone.
      await page.getByRole('rowheader').getByRole('link').click()
      await expect(page).toHaveURL(Routes.huntPath(hunt))
      await expect(page.getByRole('heading', { name: 'Quizzes' })).toBeVisible()
    })
  })

  test('says so for a hunt there is not, and tells a stranger who to ask', async ({ page, friend }) => {
    const hunt = huntOf(page)
    await page.goto(Routes.huntPath({ org: 'nobody_here', hunt: 'no_such_hunt_here' }))
    await expect(page.getByRole('heading', { name: 'No such hunt' })).toBeVisible()
    await expect(whereYouAre(page).getByRole('link')).toHaveCount(1)

    // The friend is on no hunt of this test's: a stranger to it.
    await friend.goto(Routes.huntPath(hunt))
    await expect(friend.getByRole('heading', { name: 'Not yet on this hunt' })).toBeVisible()
  })
})

test.describe('an address naming a quiz', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
  })

  test('opens in the mode the visitor works in when it names none: a smith to edit, a reviewer to playtest, anyone else told whom to ask', async ({ page, friend, friendLabel }) => {
    const path = quizPathOf(page)
    await loadAfresh(page, path)
    await expect(page).toHaveURL(`${path}/!edit`)
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')

    // The friend, on no hunt of this test's yet, is anyone else.
    await friend.goto(path)
    await expect(friend.getByRole('region', { name: 'Not yet on this hunt' })).toContainText('To be invited, contact its smith')
    await expect(friend).toHaveURL(path)

    await putOnHunt(huntOf(page), friendLabel, 'reviewer')
    await loadAfresh(friend, path)
    await expect(friend).toHaveURL(`${path}/!playtest`)
    await expect(friend.getByRole('button', { name: 'Share with the smiths' })).toBeVisible()
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
    await page.getByRole('button', { name: 'Relabel quiz' }).click()
    await expect(manageDialog(page)).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`/${hunt}/quizzes/home/leon_s_quiz/!edit$`))
  })

  test('refuses a label another quiz of the realm uses, with the field left open to fix', async ({ page }) => {
    await openManage(page)
    await page.getByLabel('Label', { exact: true }).fill('leon')
    await page.getByRole('button', { name: 'Relabel quiz' }).click()
    await expect(manageDialog(page)).toBeHidden()
    await expect(page).toHaveURL(/\/home\/leon\/!edit$/)
    await waitUntilSaved(page)

    await newQuiz(page)
    await waitUntilSaved(page)
    await openManage(page)
    await page.getByLabel('Label', { exact: true }).fill('leon')
    await page.getByRole('button', { name: 'Relabel quiz' }).click()
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
    await page.goto(Routes.quizPath({ ...huntOf(page), realm: 'home', quiz: 'asdf' }, 'edit'))
    await expect(page.getByRole('heading', { name: 'No such quiz' })).toBeVisible()
    await page.goBack()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
    await expect(page).toHaveURL(before)
  })
})

test.describe('an address naming a quiz that is not there', () => {
  test('says which quiz of which hunt it looked for, and lists the hunt\'s quizzes', async ({ page }) => {
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    const hunt = huntLabelOf(page)
    await loadAfresh(page, Routes.quizPath({ ...huntOf(page), realm: 'home', quiz: 'asdf' }, 'edit'))
    await expect(page.getByRole('heading', { name: 'No such quiz' })).toBeVisible()
    await expect(page.getByText(`has no quiz at “${hunt}/home/asdf”.`)).toBeVisible()
    await page.getByRole('link', { name: 'Quiz one' }).click()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  })

  // About what one browser holds for each visitor it has been: a browser of its own, then, not the worker's.
  test.describe(() => {
    test.use({ startAt: null })

    test('lists every hunt history this browser holds: a hunt the visitor is on linked to its page, any other by its label alone', async ({ page }) => {
      await startHunt(page)
      const first = huntOf(page)
      // The milestone proves the hunt committed, so there is a repository to list.
      await openManage(page)
      await page.getByRole('button', { name: 'Mark a milestone' }).click()
      await expect(page.getByRole('status')).toHaveText(/^main_/)
      await closeManage(page)

      await loadAfresh(page, Routes.quizPath({ ...first, realm: 'home', quiz: 'nothing' }, 'edit'))
      const repos = page.getByRole('list', { name: 'History repositories' })
      await expect(repos.getByRole('link', { name: first.hunt })).toHaveAttribute('href', Routes.huntPath(first))
      await expect(repos.getByRole('button', { name: `Download ${first.hunt}` })).toBeVisible()

      // Another visitor of this browser, who is not on the hunt, finds it folded away on their hunts page.
      await forgetSession(page)
      await page.goto('/')
      const other = freshUserlabel()
      await page.getByRole('textbox', { name: 'Handle', exact: true }).fill(other)
      await page.getByRole('button', { name: AppNotices.signUp, exact: true }).click()
      await expect(page.getByText(`(@${other})`)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Orphaned histories (1)' })).toBeVisible()

      // And by its label alone where a quiz is not found: there is no page of it they could open.
      await page.goto(Routes.quizPath({ org: 'nobody_here', hunt: 'no_such_hunt_here', realm: 'home', quiz: 'asdf' }, 'edit'))
      const theirs = page.getByRole('list', { name: 'History repositories' })
      await expect(theirs.getByRole('listitem').filter({ hasText: first.hunt })).toContainText('main')
      await expect(theirs.getByRole('link')).toHaveCount(0)
      await expect(theirs.getByRole('button', { name: `Download ${first.hunt}` })).toBeVisible()
    })
  })

  test('says there is no such hunt, once the server has had its say', async ({ page }) => {
    await page.goto(Routes.quizPath({ org: 'nobody_here', hunt: 'no_such_hunt_here', realm: 'home', quiz: 'asdf' }, 'edit'))
    await expect(page.getByText('There is no hunt labelled “no_such_hunt_here” in ~nobody_here.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Your hunts' })).toBeVisible()
  })
})

test.describe('an address in another form than its own', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
  })

  test("moves from a quiz's old address to its own, in the mode its act asked for", async ({ page }) => {
    const hunt = huntOf(page)
    await loadAfresh(page, `/h/${hunt.hunt}/home/${hunt.hunt}?act=smith#elsewhere`)
    await expect(page).toHaveURL(`${Routes.quizPath({ ...hunt, realm: 'home', quiz: hunt.hunt }, 'edit')}#elsewhere`)
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')

    await loadAfresh(page, `/h/${hunt.hunt}/home/${hunt.hunt}?act=review`)
    await expect(page).toHaveURL(Routes.quizPath({ ...hunt, realm: 'home', quiz: hunt.hunt }, 'playtest'))
    await expect(page.getByRole('button', { name: 'Share with the smiths' })).toBeVisible()
  })

  test("moves from a hunt's old addresses, and its categories', to their own", async ({ page }) => {
    const hunt = huntOf(page)
    await loadAfresh(page, `/h/${hunt.hunt}`)
    await expect(page).toHaveURL(Routes.huntPath(hunt))
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()
    await loadAfresh(page, `/c/${hunt.hunt}/categories`)
    await expect(page).toHaveURL(Routes.categoriesPath(hunt))
    await expect(page.getByRole('heading', { name: /^Categories of / })).toBeVisible()
  })

  test("moves to a quiz's own realm from a stale one, and finds no hunt of its label in another org", async ({ page }) => {
    const hunt = huntOf(page)
    const own = Routes.quizPath({ ...hunt, realm: 'home', quiz: hunt.hunt }, 'edit')
    await loadAfresh(page, Routes.quizPath({ ...hunt, realm: 'gone_away', quiz: hunt.hunt }, 'edit'))
    await expect(page).toHaveURL(own)
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
    await loadAfresh(page, Routes.quizPath({ ...hunt, org: 'nobody_here', realm: 'home', quiz: hunt.hunt }, 'edit'))
    await expect(page.getByText(`There is no hunt labelled “${hunt.hunt}” in ~nobody_here.`)).toBeVisible()
    await loadAfresh(page, Routes.categoriesPath({ ...hunt, org: 'nobody_here' }))
    await expect(page.getByRole('heading', { name: 'No such hunt' })).toBeVisible()
    await expect(page).toHaveURL(Routes.categoriesPath({ ...hunt, org: 'nobody_here' }))
  })

  test("lists a hunt's quizzes at its quizzes' address", async ({ page }) => {
    const hunt = huntOf(page)
    await loadAfresh(page, Routes.quizzesPath(hunt))
    await page.getByRole('region', { name: /^Quizzes of / }).getByRole('link', { name: /Quiz one/ }).click()
    await expect(page).toHaveURL(Routes.quizPath({ ...hunt, realm: 'home', quiz: hunt.hunt }, 'edit'))
  })

  test("is not found when it names nothing the app holds", async ({ page }) => {
    const hunt = huntOf(page)
    for (const path of [`/${hunt.org}/${hunt.hunt}`, `${Routes.quizPath({ ...hunt, realm: 'home', quiz: hunt.hunt })}/!admin`, `/~${hunt.org.toUpperCase()}/${hunt.hunt}`]) {
      await page.goto(path)
      await expect(page.getByText('This page could not be found.')).toBeVisible()
    }
  })
})

test.describe('a link handed to a friend', () => {
  test('brings a friend who has not said who they are through the front door and back, to be told which smith to ask, at the same address', async ({ page, browser }) => {
    const author = huntOf(page).org
    await page.getByLabel('Quiz name').fill('For my friends')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    const link = page.url()

    const friend = await otherVisitor(browser)
    const label = freshUserlabel()
    await friend.goto(link)
    await expect(friend.getByRole('heading', { name: AppNotices.userlabelGateTitle })).toBeVisible()
    await friend.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    await friend.getByRole('button', { name: AppNotices.signUp, exact: true }).click()
    await expect(friend).toHaveURL(link)
    const notice = friend.getByRole('region', { name: 'Not yet on this hunt' })
    // Still anonymous: no smith can put them on until they sign in with Google, and they are told so
    await expect(notice).toContainText('You are not yet a member of this hunt. Verify your account first')
    await expect(notice).toContainText(`(${author}), and give them your handle`)
    await expect(notice).toContainText(`your handle, “${label}”`)
    await expect(friend.getByLabel('Quiz name')).toBeHidden()
    await expect(friend).toHaveURL(link)
  })

  test('opens the quiz for the friend the moment a smith adds them', async ({ page, friend, friendLabel }) => {
    await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which prince was Danish?')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)

    const link = page.url()
    await friend.goto(link)
    await expect(friend.getByRole('heading', { name: 'Not yet on this hunt' })).toBeVisible()

    await addMember(page, friendLabel, 'Smith')
    await expect(friend).toHaveURL(link)
    await expect(friend.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Which prince was Danish?')
  })

  test('sends a reviewer who asks for the smiths\' mode to review instead', async ({ page, friend, friendLabel: label }) => {
    const author = huntOf(page).org
    await putOnHunt(huntOf(page), label, 'reviewer')

    await friend.goto(page.url())
    await expect(friend).toHaveURL(/\/!edit$/)
    const notice = friend.getByRole('region', { name: 'Not a smith here' })
    await expect(notice).toContainText('You are a reviewer on this hunt, not a smith.')
    await expect(notice).toContainText(`(${author}) to make you one`)
    await expect(notice).toContainText(`your handle, “${label}”`)
    await expect(friend.getByLabel('Quiz name')).toBeHidden()
    await friend.getByRole('link', { name: 'Review this quiz' }).click()
    await expect(friend).toHaveURL(/\/!playtest$/)
    await expect(friend.getByRole('button', { name: 'Share with the smiths' })).toBeVisible()
  })

  test('lets a friend made a smith make edits that reach the author', { tag: '@smoke' }, async ({ page, friend, friendLabel }) => {
    await putOnHunt(huntOf(page), friendLabel, 'smith')

    await friend.goto(page.url())
    await expect(friend).toHaveURL(NewHuntUrl)
    await friend.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Written by a friend')
    await friend.getByLabel('Quiz name').click()
    await waitUntilSaved(friend)

    await expect(page.getByRole('textbox', { name: 'Clueing', exact: true }).first()).toHaveValue('Written by a friend')
  })

  test('takes the author\'s address along when the friend relabels the quiz they both have open', async ({ page, friend, friendLabel }) => {
    await putOnHunt(huntOf(page), friendLabel, 'smith')

    await friend.goto(page.url())
    await expect(friend).toHaveURL(NewHuntUrl)
    await openManage(friend)
    await friend.getByLabel('Label', { exact: true }).fill('renamed_by_a_friend')
    await friend.getByRole('button', { name: 'Relabel quiz' }).click()

    await expect(page).toHaveURL(new RegExp(`/${huntLabelOf(page)}/quizzes/home/renamed_by_a_friend/!edit$`))
    await expect(grid(page)).toBeVisible()
  })

  test('lists the author\'s hunt among the friend\'s once they are on it, with their role', async ({ page, friend, friendLabel }) => {
    const title = freshTitle('A hunt to find')
    await page.getByLabel('Quiz name').fill(title)
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)

    await friend.goto(Routes.huntsPath())
    await expect(friend.getByRole('heading', { name: 'Hunts' })).toBeVisible()
    await expect(friend.getByRole('link', { name: title })).toBeHidden()

    await putOnHunt(huntOf(page), friendLabel, 'reviewer')
    const listed = friend.getByRole('row').filter({ hasText: title })
    await expect(listed).toContainText('Reviewer')
    // Drawn in the same render as the role beside it: a reviewer is offered no gear to edit the hunt.
    await expect(listed.getByRole('button', { name: /^Edit hunt / })).toHaveCount(0)
    await friend.getByRole('link', { name: title }).click()
    await expect(friend).toHaveURL(/\/!playtest$/)
  })

  test("tells a smith who adds a handle nobody has chosen what the friend must do first", async ({ page }) => {
    const members = await openPanel(page, 'Members')
    const label = freshUserlabel()
    await members.getByLabel('Their handle').fill(label)
    await members.getByRole('button', { name: 'Add' }).click()
    await expect(members.getByText(userUnknownNotice(label))).toBeVisible()
  })

  test("tells a smith who adds a standalone account that it cannot be put on a hunt until it becomes a verified account", async ({ page, browser }) => {
    const stranger = await otherVisitor(browser)
    const label = await assumeUserlabel(stranger)
    const members = await openPanel(page, 'Members')
    await members.getByLabel('Their handle').fill(label)
    await members.getByRole('button', { name: 'Add' }).click()
    await expect(members.getByText(RefusalNotices.sealedJoin)).toBeVisible()
    await expect(members.getByRole('row').filter({ hasText: label })).toHaveCount(0)
  })

  test("checks the handle a smith types as the front door checks a userlabel", async ({ page }) => {
    const members = await openPanel(page, 'Members')
    const box = members.getByLabel('Their handle')
    await box.fill('Flip Kromer')
    await expect(members.getByText(AppNotices.memberLabelShape)).toBeVisible()
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    await box.fill('flo')
    await expect(members.getByText(AppNotices.memberLabelUnfinished)).toBeHidden()
    await members.getByRole('button', { name: 'Add' }).click()
    await expect(members.getByText(AppNotices.memberLabelUnfinished)).toBeVisible()
    await expect(box).toHaveAttribute('aria-invalid', 'true')
  })

  test('offers a smith no way to take themselves off, and says why beside the field when they try to put themselves on', async ({ page }) => {
    const label = huntOf(page).org
    const members = await openPanel(page, 'Members')
    const own = members.getByRole('row').filter({ hasText: label })
    await expect(own).toContainText('you')
    // Drawn in the same render as "you": one's own row is offered no Remove.
    await expect(own.getByRole('button', { name: `Remove ${label}` })).toHaveCount(0)

    await members.getByLabel('Their handle').fill(label)
    await members.getByRole('button', { name: 'Add' }).click()
    await expect(members.getByText(RefusalNotices.ownHuntship)).toBeVisible()
    // Said beside the field without asking the server, in the same moment an alarm would be raised, were one.
    await expect(page.getByRole('alert').filter({ hasText: RefusalNotices.ownHuntship })).toHaveCount(0)
  })

  test('lets a smith take a member off, who is then told they are not on the hunt', async ({ page, friend, friendLabel: label }) => {
    await putOnHunt(huntOf(page), label, 'smith')
    await friend.goto(page.url())
    await expect(friend.getByLabel('Quiz name')).toBeVisible()

    const members = await openPanel(page, 'Members')
    await members.getByRole('button', { name: `Remove ${label}` }).click()
    await answerRemoval(page, 'Yes, remove')
    await expect(friend.getByRole('heading', { name: 'Not yet on this hunt' })).toBeVisible()
    await expect(friend.getByLabel('Quiz name')).toBeHidden()
  })

  test('makes a reviewer a smith by taking them off and putting them back on as one', async ({ page, friend, friendLabel: label }) => {
    const path = quizPathOf(page)
    const members = await openPanel(page, 'Members')
    await addMember(page, label, 'Reviewer')
    await friend.goto(path)
    await expect(friend).toHaveURL(`${path}/!playtest`)

    await members.getByRole('button', { name: `Remove ${label}` }).click()
    await answerRemoval(page, 'Yes, remove')
    await expect(friend.getByRole('heading', { name: 'Not yet on this hunt' })).toBeVisible()
    await addMember(page, label, 'Smith')
    await expect(members.getByRole('row').filter({ hasText: label })).toHaveCount(1)

    await friend.goto(path)
    await expect(friend).toHaveURL(`${path}/!edit`)
    await expect(friend.getByLabel('Quiz name')).toBeEditable()
  })
})

test.describe('two smiths on one quiz', () => {
  test('lets the author make edits that reach a friend made a smith', async ({ page, friend, friendLabel }) => {
    await smithBeside(page, friend, friendLabel)
    await fieldsOf(page, 'Clueing').first().fill('Written by the author')
    await page.getByLabel('Quiz name').click()
    await expect(fieldsOf(friend, 'Clueing').first()).toHaveValue('Written by the author')
  })

  test('keeps the later of two edits to one cell on both pages, loses nothing beside it, and alarms neither', async ({ page, friend, friendLabel }) => {
    await smithBeside(page, friend, friendLabel)
    await fieldsOf(page, 'Title').first().fill('titled by the author')
    await page.getByLabel('Quiz name').click()
    await fieldsOf(friend, 'Clueing').nth(1).fill('clued by the friend')
    await friend.getByLabel('Quiz name').click()

    // Both type into the first clueing; the author leaves it first, and so is the earlier edit.
    await fieldsOf(page, 'Clueing').first().fill('the earlier edit')
    await fieldsOf(friend, 'Clueing').first().fill('the later edit')
    await page.getByLabel('Quiz name').click()
    await waitUntilSaved(page)
    // An edit the author makes after it reaches the friend after it, so once this one is there, the earlier edit is too.
    await fieldsOf(page, 'Title').nth(2).fill('a sign the earlier edit has arrived')
    await page.getByLabel('Quiz name').click()
    await expect(fieldsOf(friend, 'Title').nth(2)).toHaveValue('a sign the earlier edit has arrived')
    // The friend is still typing, so their box keeps what they typed rather than taking the author's.
    await expect(fieldsOf(friend, 'Clueing').first()).toHaveValue('the later edit')
    await friend.getByLabel('Quiz name').click()
    await waitUntilSaved(friend)

    for (const smith of [page, friend]) {
      await expect.poll(() => valuesOf(fieldsOf(smith, 'Clueing'))).toEqual(['the later edit', 'clued by the friend', '', '', ''])
      await expect(fieldsOf(smith, 'Title').first()).toHaveValue('titled by the author')
      await expect(fieldsOf(smith, 'Title').nth(2)).toHaveValue('a sign the earlier edit has arrived')
    }
    // Every change either page made has come back from the server by now, so an alarm over any of them would be up.
    // (Not every alert: Next keeps one of its own to announce a change of page.)
    await expect(page.getByRole('alert').filter({ hasText: AppNotices.changeNotKept })).toHaveCount(0)
    await expect(friend.getByRole('alert').filter({ hasText: AppNotices.changeNotKept })).toHaveCount(0)
  })
})
