import { type Page } from '@playwright/test'
import { dragOnto, expect, fillRows, reloadOnceSaved, stepBy, test, valuesOf } from './support'

/** Fill the first `pairs.length` questions with a Q# and a title, clearing the rest */
async function fillQuiz(page: Page, pairs: [string, string][]): Promise<void> {
  await fillRows(page, pairs.map(([qnum, title]) => ({ 'Q#': qnum, Title: title })))
  // A fresh question is titled from its generated label rather than left blank; clear the
  // untouched rows so they stay genuinely unranked and unnamed, as these tests expect.
  const titles = page.getByRole('textbox', { name: 'Title' })
  const rowCount = await titles.count()
  for (let idx = pairs.length; idx < rowCount; idx += 1) {
    await titles.nth(idx).fill('')
  }
  await page.getByLabel('Quiz name').click()
}

/** The titles, top to bottom, once the grid is on screen */
async function answersShown(page: Page): Promise<string[]> {
  const fields = page.getByRole('textbox', { name: 'Title' })
  await expect(fields.first()).toBeVisible()
  return valuesOf(fields)
}

/** The Q# values, top to bottom, once the grid is on screen */
async function qnumsShown(page: Page): Promise<string[]> {
  const fields = page.getByRole('textbox', { name: 'Q#' })
  await expect(fields.first()).toBeVisible()
  return valuesOf(fields)
}

test('a decimal Q# leaves the question where it is', async ({ page }) => {
  await fillQuiz(page, [['4', 'd'], ['3.1', 'c'], ['6', 'f'], ['1', 'a']])
  await expect.poll(() => answersShown(page)).toEqual(['d', 'c', 'f', 'a', ''])
})

test('Renumber Q# tidies the numbers without moving a question', async ({ page }) => {
  await fillQuiz(page, [['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a']])
  await page.getByRole('button', { name: 'Renumber Q#' }).click()
  await expect.poll(() => answersShown(page)).toEqual(['d', 'c', 'f', 'a', ''])
  await expect.poll(() => qnumsShown(page)).toEqual(['3', '2', '4', '1', ''])
})

test('a sort survives a reload, with its header still bold', async ({ page }) => {
  await fillQuiz(page, [['3', 'cherry'], ['1', 'apple'], ['2', 'banana']])
  await page.getByRole('button', { name: 'Title' }).click()
  await expect.poll(() => answersShown(page)).toEqual(['apple', 'banana', 'cherry', '', ''])

  await reloadOnceSaved(page)

  await expect.poll(() => answersShown(page)).toEqual(['apple', 'banana', 'cherry', '', ''])
  await expect(page.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('data-sorted', 'true')
  // The arrow marks only this session's sort, so it is gone after a reload.
  await expect(page.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('aria-sort', 'none')
})

test('clicking the same header again reverses it', async ({ page }) => {
  await fillQuiz(page, [['3', 'cherry'], ['1', 'apple'], ['2', 'banana']])
  await page.getByRole('button', { name: 'Title' }).click()
  await page.getByRole('button', { name: 'Title' }).click()
  // Questions with no title sink to the bottom in both directions.
  await expect.poll(() => answersShown(page)).toEqual(['cherry', 'banana', 'apple', '', ''])
})

/** The grip of the question titled `title`, in the grid */
function questionGrip(page: Page, title: string) {
  return page.getByRole('button', { name: `Reorder ${title}`, exact: true })
}

test('a question dragged up lands above the row it was dropped on, and is renumbered from the top', async ({ page }) => {
  await fillQuiz(page, [['1', 'apple'], ['2', 'banana'], ['3', 'cherry']])
  await dragOnto(page, questionGrip(page, 'cherry'), questionGrip(page, 'apple'), 'top')
  await expect.poll(() => answersShown(page)).toEqual(['cherry', 'apple', 'banana', '', ''])
  // A drag adopts every question into the sequence, including the two that never had a Q#.
  await expect.poll(() => qnumsShown(page)).toEqual(['1', '2', '3', '4', '5'])
})

test('a question dropped against a row\'s lower edge lands below it', async ({ page }) => {
  await fillQuiz(page, [['1', 'apple'], ['2', 'banana'], ['3', 'cherry']])
  await dragOnto(page, questionGrip(page, 'apple'), questionGrip(page, 'cherry'), 'bottom')
  await expect.poll(() => answersShown(page)).toEqual(['banana', 'cherry', 'apple', '', ''])
})

test('a question is moved by the arrow keys once its grip has focus, and the move survives a reload', async ({ page }) => {
  await fillQuiz(page, [['1', 'apple'], ['2', 'banana'], ['3', 'cherry']])
  await stepBy(questionGrip(page, 'apple'), 2)
  await expect.poll(() => answersShown(page)).toEqual(['banana', 'cherry', 'apple', '', ''])
  await reloadOnceSaved(page)
  await expect.poll(() => answersShown(page)).toEqual(['banana', 'cherry', 'apple', '', ''])
})

test('a locked quiz refuses the arrow keys as it refuses a drag', async ({ page }) => {
  await fillQuiz(page, [['1', 'apple'], ['2', 'banana'], ['3', 'cherry']])
  await page.getByRole('button', { name: 'Lock quiz' }).click()
  await stepBy(questionGrip(page, 'apple'), 2)
  await expect.poll(() => answersShown(page)).toEqual(['apple', 'banana', 'cherry', '', ''])
})

test('the grips go once the quiz is out of Q# order, and batch mode stays on offer', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Reorder/ }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Title' }).click()
  await expect(page.getByRole('button', { name: /^Reorder/ }).first()).toBeHidden()
  await expect(page.getByRole('button', { name: 'Batch select' })).toBeEnabled()
  await expect(page.locator('tbody tr').first().locator('td')).toHaveCount(22)
})
