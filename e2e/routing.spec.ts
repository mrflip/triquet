import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear() })
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
  await expect(page.getByLabel('Label')).toHaveValue(/^[a-z]+_[a-z]+$/)

  await page.getByLabel('Label').fill('Leon\'s Quiz!!')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Manage this quiz')).toBeHidden()

  const url = new URL(page.url())
  expect(url.hash).toBe('#leonsquiz')
})

test('a label already used by another quiz is refused, with the field left open to fix', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('table')
  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await page.getByLabel('Label').fill('leon')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Manage this quiz')).toBeHidden()

  await page.getByRole('button', { name: '+ New quiz' }).click()
  await page.getByRole('button', { name: 'Manage quiz' }).click()
  await page.getByLabel('Label').fill('leon')
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
