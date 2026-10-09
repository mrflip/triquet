import type { Locator, Page } from '@playwright/test'
import { AppNotices } from '../src/lib/notices'
import { addWidgeting, cellOf, closeManage, columnPanel, expect, exportedQuizzes, faceOf, freshWidgetLabel, manageDialog, openManage, openPanel, pickWidget, preparedExport, relabelWidgeting, reloadOnceSaved, showTab, test, unfoldBy, waitUntilSaved, widgetingPanel } from './support'

/** The widget editor writing a new widget, open over the gear's dialog that opened it */
function newWidgetDialog(page: Page) {
  return page.getByRole('dialog', { name: /^New widget(?!ing)/ })
}

/** Through the gear's dialog, which must be open: open the widget editor from *+ New column…*'s *A new widget…* */
async function newWidgetFromColumns(page: Page) {
  await manageDialog(page).getByRole('button', { name: '+ New column…' }).click()
  await page.getByRole('menuitem', { name: 'A new widget…' }).click()
  await expect(newWidgetDialog(page)).toBeVisible()
}

/**
 * Write a new entry widget into the library, labelled `widget_label` and taking the kind whose
 * words match `kind`, through *+ New column…*'s *A new widget…*, which puts it to work in the open
 * quiz with its column as it is written; close the gear's dialog, and relabel it `label` in the
 * Widgets panel.
 */
async function addNewEntry(page: Page, widget_label: string, kind: RegExp, label: string) {
  await openManage(page)
  await newWidgetFromColumns(page)
  const maker = newWidgetDialog(page)
  await maker.getByRole('combobox', { name: 'Formulary' }).click()
  await page.getByRole('option', { name: /^An entry/ }).click()
  await maker.getByRole('textbox', { name: 'Widget label' }).fill(widget_label)
  await maker.getByRole('combobox', { name: 'Entry kind' }).click()
  await page.getByRole('option', { name: kind }).click()
  // An entry has nothing to work out: no formula, and nothing to preview.
  await expect(maker.getByRole('textbox', { name: 'Formula', exact: true })).toHaveCount(0)
  await maker.getByRole('button', { name: 'Apply' }).click()
  await expect(maker).toHaveCount(0)
  await closeManage(page)
  await relabelWidgeting(page, widget_label, label)
}

/** The box of the entry column `colname` in the row at `rowIdx` */
function entryBox(page: Page, rowIdx: number, colname: string) {
  return cellOf(page, rowIdx, colname).getByRole('textbox', { name: colname, exact: true })
}

/** Leave whatever box has focus, committing it, as a person clicking elsewhere does */
async function leaveBox(page: Page) {
  await page.getByLabel('Quiz name').click()
}

test('what is typed into an entry is kept, and emptying it empties the cell', async ({ page }) => {
  await addNewEntry(page, freshWidgetLabel('remark'), /^Text/, 'remark')
  await entryBox(page, 0, 'Remark').fill('Ask *Flip*.')
  await leaveBox(page)
  await reloadOnceSaved(page)
  await expect(entryBox(page, 0, 'Remark')).toHaveValue('Ask *Flip*.')
  await expect(entryBox(page, 1, 'Remark')).toHaveValue('')

  await entryBox(page, 0, 'Remark').fill('')
  await leaveBox(page)
  await reloadOnceSaved(page)
  await expect(entryBox(page, 0, 'Remark')).toHaveValue('')
})

/**
 * Let `settle` say the params of the widgeting labelled `label` in its folded line, in the Widgets
 * panel's run order, each kept as it is left or picked, and wait until they have been kept.
 */
async function setParams(page: Page, label: string, settle: (settings: Locator) => Promise<void>) {
  await openPanel(page, 'Widgets')
  await settle(settingsOf(page, label))
  await waitUntilSaved(page)
}

/** The params of the widgeting labelled `label`, in its folded line in the Widgets panel's run order, which must be open */
function settingsOf(page: Page, label: string): Locator {
  return widgetingPanel(page, label).getByRole('group', { name: `Settings of ${label}` })
}

test('a new entry and its column are made in one go from + New column…, its settings in the line beneath the column', async ({ page }) => {
  await openManage(page)
  await manageDialog(page).getByRole('button', { name: '+ New column…' }).click()
  await page.getByRole('menuitem', { name: 'A new entry…' }).click()
  const picker = manageDialog(page).getByRole('combobox', { name: 'A new entry' })
  // Only the entries are offered.
  await expect(page.getByRole('listbox').getByText('Formulas', { exact: true })).toHaveCount(0)
  await pickWidget(page, picker, 'figure')
  const column = columnPanel(page, 'Figure')
  await expect(column).toBeVisible()
  const settings = column.getByRole('group', { name: 'Settings of figure' })
  await settings.getByRole('textbox', { name: 'Least' }).fill('5')
  await settings.getByRole('textbox', { name: 'Least' }).press('Tab')
  await expect(column.getByRole('group', { name: 'Widgeting figure' })).toContainText('entry figure')
  // Kept before the cell reads it, as `setParams` waits: params are not shown early, and a box
  // that holds them as last loaded sends what they refuse, which the server refuses in its own words.
  await waitUntilSaved(page)
  await closeManage(page)
  const box = cellOf(page, 0, 'Figure').getByRole('textbox', { name: 'Figure', exact: true })
  await box.fill('2')
  await leaveBox(page)
  await expect(page.getByRole('alert').filter({ hasText: AppNotices.changeNotKept })).toContainText('Figure: «2» should be «5» or more')
})

test('a new entry widget is one of a family, and the presets of text are not offered', async ({ page }) => {
  await openManage(page)
  await newWidgetFromColumns(page)
  const maker = newWidgetDialog(page)
  await maker.getByRole('combobox', { name: 'Formulary' }).click()
  await page.getByRole('option', { name: /^An entry/ }).click()
  await maker.getByRole('combobox', { name: 'Entry kind' }).click()
  await expect(page.getByRole('option')).toHaveText([/^Text/, /^A number/, /^Yes or no/, /^A choice/, /^Category estimates/])
})

test.describe('the seeded families', () => {
  test.use({ layout: { widgetings: ['memo', 'figure', 'yes_no', 'choice'] } })

  test('a text entry held to the label pattern is tidied into a label as its box is left', async ({ page }) => {
    await setParams(page, 'memo', async (settings) => {
      await settings.getByRole('combobox', { name: 'Pattern' }).selectOption({ label: 'A label: lowercase letters, digits and single underscores' })
    })
    await entryBox(page, 0, 'Memo').fill('Quiet Otter!')
    await leaveBox(page)
    await expect(entryBox(page, 0, 'Memo')).toHaveValue('quiet_otter')
    await reloadOnceSaved(page)
    await expect(entryBox(page, 0, 'Memo')).toHaveValue('quiet_otter')
  })

  test('a yes-or-no entry is ticked, unticked and emptied as it is clicked, and kept', async ({ page }) => {
    const box = cellOf(page, 0, 'Yes No').getByRole('checkbox', { name: 'Yes No' })
    await expect(box).toHaveAttribute('aria-checked', 'mixed')
    await box.click()
    await expect(box).toBeChecked()
    await reloadOnceSaved(page)
    await expect(box).toBeChecked()
    await box.click()
    await expect(box).toHaveAttribute('aria-checked', 'false')
    await box.click()
    await expect(box).toHaveAttribute('aria-checked', 'mixed')
    await reloadOnceSaved(page)
    await expect(box).toHaveAttribute('aria-checked', 'mixed')
  })

  test("a choice entry offers its widgeting's options, and keeps the one picked", async ({ page }) => {
    await setParams(page, 'choice', async (settings) => {
      const options = settings.getByRole('textbox', { name: 'Options, one per line' })
      await options.fill('draft\nplaytested\n\nfinal ')
      await options.blur()
    })
    const select = cellOf(page, 0, 'Choice').getByRole('combobox', { name: 'Choice' })
    await expect(select.getByRole('option')).toHaveText(['—', 'draft', 'playtested', 'final'])
    await select.selectOption('final')
    await reloadOnceSaved(page)
    await expect(select).toHaveValue('final')
    await select.selectOption({ label: '—' })
    await reloadOnceSaved(page)
    await expect(select).toHaveValue('')
  })

  test('a number entry held to bounds refuses a value past them, saying why, and keeps one within', async ({ page }) => {
    await setParams(page, 'figure', async (settings) => {
      await settings.getByRole('textbox', { name: 'Least' }).fill('1')
      await settings.getByRole('textbox', { name: 'Most' }).fill('10')
      await settings.getByRole('checkbox', { name: 'Whole numbers only' }).click()
      await expect(settings.getByRole('checkbox', { name: 'Whole numbers only' })).toBeChecked()
    })
    const box = cellOf(page, 0, 'Figure').getByRole('textbox', { name: 'Figure', exact: true })
    await box.fill('0')
    await leaveBox(page)
    await expect(page.getByRole('alert').filter({ hasText: AppNotices.changeNotKept })).toContainText('Figure: «0» should be «1» or more')
    await box.fill('7')
    await leaveBox(page)
    await reloadOnceSaved(page)
    await expect(box).toHaveValue('7')
  })

  test('a text entry held to its own regular expression refuses what does not match, saying why, and keeps what does', async ({ page }) => {
    await setParams(page, 'memo', async (settings) => {
      const regex = settings.getByRole('textbox', { name: 'Regular expression' })
      await regex.fill('^[A-Z]{3}$')
      await regex.blur()
      await settings.getByRole('button', { name: 'Ignore case' }).click()
      await expect(settings.getByRole('button', { name: 'Ignore case' })).toHaveAttribute('aria-pressed', 'true')
    })
    const box = entryBox(page, 0, 'Memo')
    await box.fill('abcd')
    await leaveBox(page)
    await expect(page.getByRole('alert').filter({ hasText: AppNotices.changeNotKept })).toContainText("Memo: «'abcd'» should match «/^[A-Z]{3}$/i»")
    await box.fill('aBc')
    await leaveBox(page)
    await reloadOnceSaved(page)
    await expect(box).toHaveValue('aBc')
  })

  test('a regular expression that could take too long to match is refused beside its field, and by the server', async ({ page }) => {
    await openPanel(page, 'Widgets')
    const settings = settingsOf(page, 'memo')
    const regex = settings.getByRole('textbox', { name: 'Regular expression' })
    await regex.fill('^(a+)+$')
    await regex.blur()
    await expect(settings).toContainText('Could take far too long to match some texts (twice as long for each character more), around «')
    await expect(page.getByRole('alert').filter({ hasText: 'The pattern «/^(a+)+$/» could take far too long' })).toBeVisible()
  })

  test('a regular expression that will not compile is said so beside its field, kept as typed, and not applied', async ({ page }) => {
    await openPanel(page, 'Widgets')
    const settings = settingsOf(page, 'memo')
    const regex = settings.getByRole('textbox', { name: 'Regular expression' })
    await regex.fill('(a')
    await regex.blur()
    await expect(regex).toHaveValue('(a')
    await expect(settings).toContainText('will not compile: Unterminated group')
    await reloadOnceSaved(page)
    await openPanel(page, 'Widgets')
    await expect(settingsOf(page, 'memo').getByRole('textbox', { name: 'Regular expression' })).toHaveValue('')
  })

  test('the entries head the run order in both its places, run first wherever they were placed, and are never dragged', async ({ page }) => {
    await addWidgeting(page, 'clueing_full')
    const openings = [
      async () => await openPanel(page, 'Widgets'),
      async () => { await openManage(page); return manageDialog(page) },
    ]
    for (const opening of openings) {
      const place = await opening()
      const entries = place.getByRole('list', { name: 'Entries' })
      await expect(entries.getByRole('group', { name: /^Widgeting / })).toHaveCount(4)
      await expect(entries.getByRole('button', { name: /^Reorder/ })).toHaveCount(0)
      await expect(place.getByRole('list', { name: 'Widgetings' }).getByRole('button', { name: 'Reorder clueing_full' })).toBeVisible()
    }
  })

  test('a widgeting refuses params that do not agree, saying which beside the field, and the one that does not agree is not kept', async ({ page }) => {
    await openPanel(page, 'Widgets')
    const settings = settingsOf(page, 'figure')
    await settings.getByRole('textbox', { name: 'Least' }).fill('5')
    await settings.getByRole('textbox', { name: 'Most' }).fill('1')
    await settings.getByRole('textbox', { name: 'Least' }).click()
    await expect(settings).toContainText('should be no less than the least, «5»')
    await reloadOnceSaved(page)
    await openPanel(page, 'Widgets')
    await expect(settingsOf(page, 'figure').getByRole('textbox', { name: 'Most' })).toHaveValue('')
  })

  test("a column showing an entry carries its settings beneath it, and a change there is the widgeting's everywhere", async ({ page }) => {
    await openManage(page)
    const beneath = columnPanel(page, 'Figure').getByRole('group', { name: 'Settings of figure' })
    await beneath.getByRole('textbox', { name: 'Least' }).fill('3')
    await beneath.getByRole('textbox', { name: 'Least' }).press('Tab')
    await closeManage(page)
    await openPanel(page, 'Widgets')
    await expect(settingsOf(page, 'figure').getByRole('textbox', { name: 'Least' })).toHaveValue('3')
    const box = cellOf(page, 0, 'Figure').getByRole('textbox', { name: 'Figure', exact: true })
    await box.fill('2')
    await leaveBox(page)
    await expect(page.getByRole('alert').filter({ hasText: AppNotices.changeNotKept })).toContainText('Figure: «2» should be «3» or more')
  })
})

test('the Widgets panel counts what has been typed, and says what the entry takes', async ({ page }) => {
  await addNewEntry(page, freshWidgetLabel('points'), /^A number/, 'points')
  await entryBox(page, 0, 'Points').fill('-2.5')
  await leaveBox(page)
  const panel = await openPanel(page, 'Widgets')
  await expect(panel.getByRole('group', { name: 'Cells of points' })).toHaveText(/^1 current • \d+ blank$/)
  await unfoldBy(widgetingPanel(page, 'points'), 'Widgeting points in full')
  await expect(panel).toContainText('Typed into its cells, one value per question. A number, between bounds if you like.')
  await expect(panel.getByRole('button', { name: 'Copy a prompt for a chatbot' })).toHaveCount(0)
})

test('an entry rides the export, and an import puts it back', { tag: '@smoke' }, async ({ page }) => {
  await addNewEntry(page, freshWidgetLabel('points'), /^A number/, 'points')
  await entryBox(page, 0, 'Points').fill('-2.5')
  await leaveBox(page)
  const exported = await preparedExport(page)
  const question = exportedQuizzes(exported)[0]?.questions[0]
  expect(question?.points).toEqual({ status: 'ok', value: -2.5 })

  await entryBox(page, 0, 'Points').fill('7')
  await leaveBox(page)
  const section = await showTab(page, 'Import')
  await section.getByRole('textbox', { name: 'Import' }).fill(exported)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(entryBox(page, 0, 'Points')).toHaveValue('-2.5')
  await reloadOnceSaved(page)
  await expect(entryBox(page, 0, 'Points')).toHaveValue('-2.5')
})

test('a templated clueing shows what an entry holds, filled in before its markdown is read', async ({ page }) => {
  await addNewEntry(page, freshWidgetLabel('author'), /^Text/, 'author')
  await openManage(page)
  const nominated = manageDialog(page).getByRole('group', { name: 'Templateable sources' }).getByRole('checkbox', { name: 'Clueing' })
  // Ticked once the server has it: the box shows the quiz's nominations, not a draft of them.
  await nominated.click()
  await expect(nominated).toBeChecked()
  await closeManage(page)

  await entryBox(page, 0, 'Author').fill('**Ada** <b>x</b>')
  await leaveBox(page)
  const clueing = cellOf(page, 0, 'Clueing').getByRole('textbox', { name: 'Clueing', exact: true })
  await clueing.fill('By {{qn.author}}')
  await leaveBox(page)
  // Filled in first, so the entry's markdown is bold, and the HTML it holds is shown as typed.
  const face = faceOf(cellOf(page, 0, 'Clueing'))
  await expect(face).toHaveText('By Ada <b>x</b>')
  await expect(face.getByText('Ada', { exact: true })).toBeVisible()
  await expect(clueing).toHaveValue('By {{qn.author}}')

  await clueing.fill('By {{qn.author')
  await leaveBox(page)
  await expect(face).toContainText('not closed')
  await expect(clueing).toHaveAttribute('aria-invalid', 'true')

  await reloadOnceSaved(page)
  await openManage(page)
  await expect(nominated).toBeChecked()
})
