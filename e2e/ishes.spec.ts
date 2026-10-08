import type { Page } from '@playwright/test'
import { cellOf, closeManage, expect, manageDialog, openManage, stubAsk, test, waitUntilSaved } from './support'

const ThreeSpans = [
  { text: '#17-19', value: 36, kind: 'numeral' },
  { text: 'douzaine', value: 12, kind: 'wordish' },
  { text: '300 million', value: 300_000_000, kind: 'wordish' },
]

/** Stand in for the ask route with a number spotter's reply finding `items`, replacing any earlier stand-in */
async function stubIshes(page: Page, items: unknown[]) {
  await stubAsk(page, { ok: true, value: { items }, truncated: false, model_tier_applied: 'careful', approx_tokens: 120 })
}

/** The widgets every test here puts to work: the clueing's number spotter, and the sums that read it */
const ClueingSums = ['numnum_clueing', 'clueing_full', 'clueing_numeral', 'clueing_plus_rank'] as const

test.use({ layout: { widgetings: ClueingSums } })

test.beforeEach(async ({ page }) => {
  await page.getByRole('textbox', { name: 'Q#' }).first().fill('1')
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first()
    .fill('Numbers #17-19, a douzaine of them, and 300 million more')
  await page.getByLabel('Quiz name').click()
  await waitUntilSaved(page)
})

test('extracting lists every span with its value and kind', async ({ page }) => {
  await stubIshes(page, ThreeSpans)
  await page.getByRole('button', { name: 'Ask Numnum Clueing' }).first().dblclick()
  const cell = cellOf(page, 0, 'Numnum Clueing')
  // Shown as the value's JSON for now: a nicer presentation of a list of spans is a later nicety.
  await expect(cell).toContainText('"text":"#17-19"')
  await expect(cell).toContainText('"kind":"wordish"')
  await expect(cell).toContainText('"value":300000000')
})

test('a list of spans folds open from beside its cell, pretty-printed', async ({ page }) => {
  await stubIshes(page, ThreeSpans)
  await page.getByRole('button', { name: 'Ask Numnum Clueing' }).first().dblclick()
  const cell = cellOf(page, 0, 'Numnum Clueing')
  const fold = cell.getByRole('button', { name: 'Pretty-print Numnum Clueing' })
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await fold.click()
  await expect(fold).toHaveAttribute('aria-expanded', 'true')
  await expect(cell).toContainText('"text": "#17-19"')
  // Folding is not asking: the reply is the one already in hand.
  await expect(cell).toContainText('~120 tok')
})

test('the sums follow from the extraction', { tag: '@smoke' }, async ({ page }) => {
  await stubIshes(page, ThreeSpans)
  await page.getByRole('button', { name: 'Ask Numnum Clueing' }).first().dblclick()
  await expect(cellOf(page, 0, 'Clueing Full')).toContainText('300,000,048')
  await expect(cellOf(page, 0, 'Clueing Numeral')).toContainText('36')
  // Clueing Full plus this question's rank, which is 1.
  await expect(cellOf(page, 0, 'Clueing Plus Rank')).toContainText('300,000,049')
})

test('an extraction that found nothing says so, and sums to nought', async ({ page }) => {
  await stubIshes(page, [])
  await page.getByRole('button', { name: 'Ask Numnum Clueing' }).first().dblclick()
  await expect(cellOf(page, 0, 'Numnum Clueing')).toContainText('{"items":[]}')
  await expect(cellOf(page, 0, 'Clueing Full')).toHaveText('0')
})

test('editing the clueing leaves the sums as they were until it is asked again', async ({ page }) => {
  await stubIshes(page, ThreeSpans)
  await page.getByRole('button', { name: 'Ask Numnum Clueing' }).first().dblclick()
  await expect(cellOf(page, 0, 'Clueing Full')).toContainText('300,000,048')

  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Reworded, with no numbers at all')
  await page.getByLabel('Quiz name').click()
  await waitUntilSaved(page)

  // Staleness is off for now: nothing marks the sum as out of date.
  await expect(cellOf(page, 0, 'Clueing Full')).toContainText('300,000,048')
  await expect(cellOf(page, 0, 'Numnum Clueing')).toContainText('#17-19')
})

test.describe('with the hint, its sums and the chain shown too', () => {
  test.use({ layout: { widgetings: [...ClueingSums, 'numnum_hint', 'butnot_ishes', 'butnot_full', 'hint_full'], columns: ['hint', 'chains_to'] } })

  test('BUT NOT ishes mirrors the chained-to hint rather than computing its own', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Title' }).nth(1).fill('damson')
    await page.getByRole('textbox', { name: 'Hint', exact: true }).nth(1).fill('BUT NOT the 1994 film')
    await page.getByLabel('Quiz name').click()
    await page.getByRole('combobox', { name: 'Chains to' }).first().selectOption({ label: 'damson' })

    // Nothing to show until the chained-to question's hint has been asked about.
    await expect(cellOf(page, 0, 'Butnot Ishes')).toHaveText('–')

    await stubIshes(page, [{ text: '1994', value: 1994, kind: 'numeral' }])
    await page.getByRole('button', { name: 'Ask Numnum Hint' }).nth(1).dblclick()

    await expect(cellOf(page, 0, 'Butnot Ishes')).toContainText('1994')
    await expect(cellOf(page, 0, 'Butnot Full')).toContainText('1,994')
    await expect(cellOf(page, 1, 'Hint Full')).toContainText('1,994')
  })
})

test('double-clicking a Full Sum re-extracts what is behind it', async ({ page }) => {
  await stubIshes(page, ThreeSpans)
  await cellOf(page, 0, 'Clueing Full').dblclick()
  await expect(cellOf(page, 0, 'Numnum Clueing')).toContainText('douzaine')
})

test.describe('with only the clueing\'s number spotter, and no sum', () => {
  test.use({ layout: { widgetings: ['numnum_clueing'] } })

  test("a column showing the spotter is offered its sums as formulas, and is named for the sum it takes", async ({ page }) => {
    await openManage(page)
    await page.getByRole('button', { name: '+ New column…' }).click()
    const editor = page.getByRole('dialog', { name: /^New column/ })
    await editor.getByRole('combobox', { name: 'Shows' }).click()
    await page.getByRole('option', { name: /^numnum_clueing / }).click()
    await editor.getByRole('combobox', { name: 'Formula' }).click()
    await page.getByRole('option', { name: /The spans written in digits, added up$/ }).click()
    // The preset is taken as the box is left; the column's header follows it.
    await editor.getByRole('spinbutton', { name: 'Width (px)' }).click()
    await expect(editor.getByRole('textbox', { name: 'Column title' })).toHaveAttribute('placeholder', 'Clueing Numeral Sum')
    await editor.getByRole('button', { name: 'Apply' }).click()
    await expect(editor).toHaveCount(0)
    await expect(manageDialog(page).getByRole('group', { name: 'Column Clueing Numeral Sum', exact: true })).toBeVisible()
    await closeManage(page)

    await expect(cellOf(page, 0, 'Clueing Numeral Sum')).toHaveText('–')
    await stubIshes(page, ThreeSpans)
    await page.getByRole('button', { name: 'Ask Numnum Clueing' }).first().dblclick()
    await expect(cellOf(page, 0, 'Clueing Numeral Sum')).toHaveText('36')
  })
})
