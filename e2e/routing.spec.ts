import { closeManage, expect, loadAfresh, newQuiz, openManage, openQuiz, test, waitUntilSaved } from './support'

test('the root page sends the author to their quiz, named in the path', async ({ page }) => {
  await expect(page).toHaveURL(/\/my\/quiz\/[a-z]+_[a-z]+$/)
})

test('a bare /my/quiz sends the author on to the quiz they were last using', async ({ page }) => {
  await expect(page).toHaveURL(/\/my\/quiz\//)
  const opened = new URL(page.url()).pathname
  await loadAfresh(page, '/my/quiz')
  await expect(page).toHaveURL(opened)
})

test('a #label from when quizzes were addressed by hash still lands where it meant to', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()
  const firstLabel = new URL(page.url()).pathname.split('/').pop()
  await newQuiz(page)
  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Quiz name').blur()
  await waitUntilSaved(page)

  await loadAfresh(page, `/my/quiz#${String(firstLabel)}`)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  await expect(page).toHaveURL(`/my/quiz/${String(firstLabel)}`)
})

test('the root page redirects once, not once per save', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()
  await newQuiz(page)
  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Quiz name').blur()
  await waitUntilSaved(page)

  // The workspace is a fresh object after every save and every refetch. A redirect that watched
  // it would fire again on each, sending the browser somewhere new each time -- and the page it
  // lands on dispatches as it opens, which announces another workspace, which fires it again.
  const landings: string[] = []
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) { landings.push(frame.url()) } })
  await loadAfresh(page, '/')
  // Settling is the observable condition: a redirect that kept firing would keep dispatching,
  // and the page would never report itself saved.
  await waitUntilSaved(page)

  const quizLandings = landings.filter((url) => url.includes('/my/quiz'))
  expect(quizLandings.length).toBeLessThanOrEqual(2)
  expect(new Set(quizLandings).size).toBe(1)
})

test('a pasted address wins over whichever quiz the workspace last had open', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()
  const firstUrl = page.url()
  await newQuiz(page)
  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Quiz name').blur()
  await waitUntilSaved(page)

  // Quiz two is the open one, so the address and the workspace disagree on arrival. The address
  // is the request and must be honoured; rewriting it to the open quiz would throw the request
  // away, and the two would then take turns undoing each other.
  await loadAfresh(page, firstUrl)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  await waitUntilSaved(page)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
  await expect(page).toHaveURL(firstUrl)
})

test('an address naming a quiz opens straight to it', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()
  await newQuiz(page)
  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Quiz name').blur()
  const secondUrl = page.url()

  await page.goto(secondUrl)
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz two')
})

test('switching quizzes moves the address to match', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()
  const firstUrl = page.url()

  await newQuiz(page)
  await page.getByLabel('Quiz name').blur()
  await expect(page).not.toHaveURL(firstUrl)

  await openQuiz(page, 'Quiz one')
  await expect(page).toHaveURL(firstUrl)
})

test('the gear icon opens a modal for managing the label, and for opening any other quiz', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()

  await openManage(page)
  await expect(page.getByLabel('Label', { exact: true })).toHaveValue(/^[a-z]+_[a-z]+$/)

  await page.getByLabel('Label', { exact: true }).fill('Leon\'s Quiz!!')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Manage this quiz')).toBeHidden()

  await expect(page).toHaveURL(/\/my\/quiz\/leon_s_quiz$/)
})

test('a label already used by another quiz is refused, with the field left open to fix', async ({ page }) => {
  await openManage(page)
  await page.getByLabel('Label', { exact: true }).fill('leon')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Manage this quiz')).toBeHidden()
  // A relabel is a move, so this settles a navigation as well as a save.
  await expect(page).toHaveURL(/\/my\/quiz\/leon$/)
  await waitUntilSaved(page)

  await newQuiz(page)
  await waitUntilSaved(page)
  await openManage(page)
  await page.getByLabel('Label', { exact: true }).fill('leon')
  await page.getByRole('button', { name: 'Apply' }).click()

  await expect(page.getByText('Another quiz already uses that label.')).toBeVisible()
  await expect(page.getByText('Manage this quiz')).toBeVisible()
})

test('the "All quizzes" list opens another quiz and closes the modal', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()

  await newQuiz(page)
  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Quiz name').blur()

  await openManage(page)
  await page.getByRole('button', { name: 'Quiz one' }).click()
  await expect(page.getByText('Manage this quiz')).toBeHidden()
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
})

test.describe('an address naming a quiz that is not here', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    await loadAfresh(page, '/my/quiz/asdf')
    await expect(page.getByRole('heading', { name: 'No such quiz' })).toBeVisible()
  })

  test('says which label it looked for, and lists the quizzes there are', async ({ page }) => {
    await expect(page.getByText('Nothing here is labelled “asdf”.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quiz one' })).toBeVisible()
    await expect(page).toHaveURL('/my/quiz/asdf')
  })

  test('offers to make a quiz under that label', async ({ page }) => {
    await page.getByRole('button', { name: /Make a quiz called .asdf./ }).click()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Asdf')
    await expect(page).toHaveURL('/my/quiz/asdf')
  })

  test('opens an existing quiz from the list, and moves the address to it', async ({ page }) => {
    await page.getByRole('button', { name: 'Quiz one' }).click()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
    await expect(page).not.toHaveURL('/my/quiz/asdf')
  })
})

test('the history repositories are listed on their own, including those of deleted quizzes', async ({ page }) => {
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()
  const label = String(new URL(page.url()).pathname.split('/').pop())
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

  await loadAfresh(page, '/my/quiz/nothing')
  const repo = page.getByRole('listitem').filter({ hasText: label })
  await expect(repo).toContainText('main')
  await expect(repo).toContainText('quiz deleted')
})

test.describe('editing the address of a page that is already open', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await newQuiz(page)
    await page.getByLabel('Quiz name').fill('Quiz two')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
  })

  test('moves to another quiz when its label is put in the address', async ({ page }) => {
    await openQuiz(page, 'Quiz one')
    const firstPath = new URL(page.url()).pathname
    await openQuiz(page, 'Quiz two')
    await page.goto(firstPath)
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
    await expect(page).toHaveURL(firstPath)
  })

  test('says so when the label put in the address is not a quiz, and the back button returns', async ({ page }) => {
    const before = new URL(page.url()).pathname
    await page.goto('/my/quiz/asdf')
    await expect(page.getByRole('heading', { name: 'No such quiz' })).toBeVisible()
    await page.goBack()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz two')
    await expect(page).toHaveURL(before)
  })
})
