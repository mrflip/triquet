import { expect, test } from '@playwright/test'
import { loadAfresh, waitUntilSaved } from './support'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.context().clearCookies()
})

test('the root page sends the author to their quiz, labelled in the hash', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  const url = new URL(page.url())
  expect(url.pathname).toBe('/my/quiz')
  expect(url.hash).toMatch(/^#[a-z]+_[a-z]+$/)
})

test('a hash naming a quiz opens straight to it', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()
  await page.getByRole('button', { name: '+ New quiz' }).click()
  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Quiz name').blur()
  const secondUrl = page.url()

  await page.goto(secondUrl)
  await page.waitForSelector('table')
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz two')
})

test('switching quizzes rewrites the hash to match', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()
  const firstUrl = page.url()

  await page.getByRole('button', { name: '+ New quiz' }).click()
  await page.getByLabel('Quiz name').blur()
  expect(page.url()).not.toBe(firstUrl)

  await page.getByLabel('Open quiz').selectOption({ label: 'Quiz one' })
  await expect(page).toHaveURL(firstUrl)
})

test('the gear icon opens a modal for managing the label, and for opening any other quiz', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()

  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await expect(page.getByText('Manage this quiz')).toBeVisible()
  await expect(page.getByLabel('Label', { exact: true })).toHaveValue(/^[a-z]+_[a-z]+$/)

  await page.getByLabel('Label', { exact: true }).fill('Leon\'s Quiz!!')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Manage this quiz')).toBeHidden()

  const url = new URL(page.url())
  expect(url.hash).toBe('#leonsquiz')
})

test('a label already used by another quiz is refused, with the field left open to fix', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await page.getByLabel('Label', { exact: true }).fill('leon')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Manage this quiz')).toBeHidden()

  await page.getByRole('button', { name: '+ New quiz' }).click()
  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await page.getByLabel('Label', { exact: true }).fill('leon')
  await page.getByRole('button', { name: 'Apply' }).click()

  await expect(page.getByText('Another quiz already uses that label.')).toBeVisible()
  await expect(page.getByText('Manage this quiz')).toBeVisible()
})

test('the "All quizzes" list opens another quiz and closes the modal', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()

  await page.getByRole('button', { name: '+ New quiz' }).click()
  await page.getByLabel('Quiz name').fill('Quiz two')
  await page.getByLabel('Quiz name').blur()

  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await page.getByRole('button', { name: 'Quiz one' }).click()
  await expect(page.getByText('Manage this quiz')).toBeHidden()
  await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
})

test.describe('an address naming a quiz that is not here', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('table')
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await waitUntilSaved(page)
    await loadAfresh(page, '/my/quiz#asdf')
    await expect(page.getByRole('heading', { name: 'No such quiz' })).toBeVisible()
  })

  test('says which label it looked for, and lists the quizzes there are', async ({ page }) => {
    await expect(page.getByText('Nothing here is labelled “asdf”.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quiz one' })).toBeVisible()
    expect(new URL(page.url()).hash).toBe('#asdf')
  })

  test('offers to make a quiz under that label', async ({ page }) => {
    await page.getByRole('button', { name: /Make a quiz called .asdf./ }).click()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Asdf')
    expect(new URL(page.url()).hash).toBe('#asdf')
  })

  test('opens an existing quiz from the list, and moves the address to it', async ({ page }) => {
    await page.getByRole('button', { name: 'Quiz one' }).click()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
    expect(new URL(page.url()).hash).not.toBe('#asdf')
  })
})

test('the history repositories are listed on their own, including those of deleted quizzes', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByLabel('Quiz name').fill('Quiz one')
  await page.getByLabel('Quiz name').blur()
  const label = new URL(page.url()).hash.slice(1)
  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await page.getByRole('button', { name: 'Mark a milestone' }).click()
  await expect(page.getByRole('status')).toHaveText(/^main-m-\d{14}z$/)
  await page.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: '+ New quiz' }).click()
  await page.getByLabel('Open quiz').selectOption({ label: 'Quiz one' })
  await page.getByRole('button', { name: 'Delete quiz' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByLabel('Open quiz').locator('option')).toHaveCount(1)
  await waitUntilSaved(page)

  await loadAfresh(page, '/my/quiz#nothing')
  const repo = page.getByRole('listitem').filter({ hasText: label })
  await expect(repo).toContainText('main')
  await expect(repo).toContainText('quiz deleted')
})

test.describe('editing the address of a page that is already open', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('table')
    await page.getByLabel('Quiz name').fill('Quiz one')
    await page.getByLabel('Quiz name').blur()
    await page.getByRole('button', { name: '+ New quiz' }).click()
    await page.getByLabel('Quiz name').fill('Quiz two')
    await page.getByLabel('Quiz name').blur()
  })

  test('moves to another quiz when its label is put in the address', async ({ page }) => {
    await page.getByLabel('Open quiz').selectOption({ label: 'Quiz one' })
    const firstHash = new URL(page.url()).hash
    await page.getByLabel('Open quiz').selectOption({ label: 'Quiz two' })
    await page.evaluate((hash) => { location.hash = hash }, firstHash)
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz one')
    expect(new URL(page.url()).hash).toBe(firstHash)
  })

  test('says so when the label put in the address is not a quiz, and the back button returns', async ({ page }) => {
    const before = new URL(page.url()).hash
    await page.evaluate(() => { location.hash = 'asdf' })
    await expect(page.getByRole('heading', { name: 'No such quiz' })).toBeVisible()
    await page.goBack()
    await expect(page.getByLabel('Quiz name')).toHaveValue('Quiz two')
    expect(new URL(page.url()).hash).toBe(before)
  })
})
