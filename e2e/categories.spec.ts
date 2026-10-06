import type { Locator, Page } from '@playwright/test'
import * as Routes from '../src/lib/routes'
import { addMember, assumeIdent, expect, huntOf, manageDialog, openManage, otherVisitor, reloadOnceSaved, test } from './support'

/** The tile of the category titled `title`, wherever it sits on the editor's board: its name says where, after the title */
function tileOf(page: Page, title: string): Locator {
  return page.getByRole('button', { name: `${title}, ` })
}

/**
 * The tile of the category labelled `label`, by the label it carries: the same tile wherever it
 * moves, though its name changes as it does
 */
function carriedTile(page: Page, label: string): Locator {
  return page.locator(`[data-category="${label}"]`)
}

/** The editor's empty slot at `slotIdx`, counting from the top, which shows what the total order puts there */
function emptySlotAt(page: Page, slotIdx: number): Locator {
  return page.locator(`[data-empty][data-place="${String(slotIdx)}"]`)
}

/**
 * Drag the tile of the category labelled `label` and drop it on `target`: a tile, an empty slot
 * or the pool.
 *
 * Chromium under Playwright will not begin a native drag from a mouse press (see `dragOnto` in
 * support), so the events a drag makes are sent directly. What this proves is that the board
 * rearranges correctly on those events, not that a browser sends them.
 */
async function dropOn(page: Page, label: string, target: Locator): Promise<void> {
  const source = carriedTile(page, label)
  const from = await source.boundingBox()
  const onto = await target.boundingBox()
  if (! from || ! onto) { throw new Error('Cannot drag something that is not on screen') }
  const clientX = Math.round(onto.x + (onto.width / 2))
  const clientY = Math.round(onto.y + (onto.height / 2))
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await source.dispatchEvent('dragstart', { dataTransfer, clientX: Math.round(from.x + 5), clientY: Math.round(from.y + 5) })
  await target.dispatchEvent('dragenter', { dataTransfer, clientX, clientY })
  await target.dispatchEvent('dragover', { dataTransfer, clientX, clientY })
  await target.dispatchEvent('drop', { dataTransfer, clientX, clientY })
  await source.dispatchEvent('dragend', { dataTransfer, clientX, clientY })
}

/** Tap `target` twice in quick succession, as a finger double-taps */
async function doubleTap(target: Locator): Promise<void> {
  await target.tap()
  await target.tap()
}

test.describe("a hunt's category wheel", () => {
  test("opens from the quiz's gear on the default wheel, for its smith to arrange", async ({ page }) => {
    await openManage(page)
    await manageDialog(page).getByRole('link', { name: "Arrange the hunt's categories" }).click()
    await expect(page).toHaveURL(Routes.categoriesPath(huntOf(page)))
    await expect(page.getByRole('heading', { name: /^Categories of / })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Category wheel' }).getByRole('button')).toHaveCount(24)
    await expect(tileOf(page, 'Math & Econ')).toHaveAttribute('data-place', '0')
    await expect(tileOf(page, 'Physics & Eng')).toHaveAttribute('data-place', '23')
  })

  test("moves a category round the wheel and into the pool from the keyboard, and keeps it", async ({ page }) => {
    await page.goto(Routes.categoriesPath(huntOf(page)))
    const art = tileOf(page, 'Art')
    await art.focus()
    await art.press('ArrowRight')
    await expect(art).toHaveAttribute('data-place', '9')
    await expect(tileOf(page, 'Classical Music')).toHaveAttribute('data-place', '8')
    // Focus stays with the tile, so the next press moves it on.
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(art).toHaveAttribute('data-place', '7')

    await tileOf(page, 'TV').focus()
    await page.keyboard.press('Delete')
    await expect(page.getByRole('button', { name: 'TV, in the pool' })).toBeVisible()
    // The empty slot still has a place in the total order: the pool's first category.
    await expect(emptySlotAt(page, 15)).toHaveText('TV')

    await reloadOnceSaved(page)
    await expect(art).toHaveAttribute('data-place', '7')
    await expect(page.getByRole('button', { name: 'TV, in the pool' })).toBeVisible()

    // Back from the pool to the first empty slot.
    await page.getByRole('button', { name: 'TV, in the pool' }).press('Enter')
    await expect(tileOf(page, 'TV')).toHaveAttribute('data-place', '15')
  })

  test("swaps two categories dragged onto each other, and fills empty slots from the pool, lowest first", async ({ page }) => {
    await page.goto(Routes.categoriesPath(huntOf(page)))
    await dropOn(page, 'tv', tileOf(page, 'Gen Sci'))
    await expect(tileOf(page, 'TV')).toHaveAttribute('data-place', '1')
    await expect(tileOf(page, 'Gen Sci')).toHaveAttribute('data-place', '15')

    const pool = page.getByRole('region', { name: 'Pool' })
    await dropOn(page, 'theater', pool)
    await dropOn(page, 'geography', pool)
    await expect(page.getByRole('button', { name: 'Theater, in the pool' })).toBeVisible()
    await expect(emptySlotAt(page, 3)).toHaveText('Geogr')
    await expect(emptySlotAt(page, 12)).toHaveText('Theater')

    // Theater from the pool onto Geogr's empty slot, and Math & Econ into the pool: each empty
    // slot, from the top, takes the lowest-numbered category left in the pool.
    await dropOn(page, 'theater', emptySlotAt(page, 3))
    await dropOn(page, 'math_econ', pool)
    await expect(emptySlotAt(page, 0)).toHaveText('Math & Econ')
    await expect(emptySlotAt(page, 12)).toHaveText('Geogr')

    await reloadOnceSaved(page)
    await expect(tileOf(page, 'Theater')).toHaveAttribute('data-place', '3')
    await expect(emptySlotAt(page, 12)).toHaveText('Geogr')
  })

  test("sends a category to the pool by a double-click, and one in the pool to the first empty slot clockwise, whatever went before", async ({ page }) => {
    await page.goto(Routes.categoriesPath(huntOf(page)))
    for (const title of ['Math & Econ', 'Art', 'TV']) {
      await tileOf(page, title).dblclick()
      await expect(page.getByRole('button', { name: `${title}, in the pool` })).toBeVisible()
    }
    await expect(emptySlotAt(page, 0)).toBeVisible()
    await expect(emptySlotAt(page, 8)).toBeVisible()
    await expect(emptySlotAt(page, 15)).toBeVisible()

    // TV dragged into the middle hole leaves no trace on where the next double-click goes: the
    // first hole from the top, then the next one round.
    await dropOn(page, 'tv', emptySlotAt(page, 8))
    await expect(tileOf(page, 'TV')).toHaveAttribute('data-place', '8')
    await page.getByRole('button', { name: 'Art, in the pool' }).dblclick()
    await expect(tileOf(page, 'Art')).toHaveAttribute('data-place', '0')
    await page.getByRole('button', { name: 'Math & Econ, in the pool' }).dblclick()
    await expect(tileOf(page, 'Math & Econ')).toHaveAttribute('data-place', '15')
    await expect(page.getByRole('region', { name: 'Pool' })).toContainText('Drag a category here')

    // A tile taken off and put back, then two more taken off: the first goes back to the first hole.
    await tileOf(page, 'Euro Hist').dblclick()
    await page.getByRole('button', { name: 'Euro Hist, in the pool' }).dblclick()
    await expect(tileOf(page, 'Euro Hist')).toHaveAttribute('data-place', '4')
    await tileOf(page, 'Chem & Bio').dblclick()
    await tileOf(page, 'World Hist').dblclick()
    await page.getByRole('button', { name: 'Chem & Bio, in the pool' }).dblclick()
    await expect(tileOf(page, 'Chem & Bio')).toHaveAttribute('data-place', '2')

    await reloadOnceSaved(page)
    await expect(tileOf(page, 'Art')).toHaveAttribute('data-place', '0')
  })

  test("selects a category clicked, with a button beside it that sends it where a double-click would", async ({ page }) => {
    await page.goto(Routes.categoriesPath(huntOf(page)))
    await tileOf(page, 'Art').click()
    await expect(carriedTile(page, 'art')).toHaveAttribute('data-selected', '')
    const toPool = page.getByRole('button', { name: 'Move Art to the pool' })
    await expect(toPool).toHaveText('To the pool')
    // A click anywhere else lets it go, and so does a second click on it.
    await page.getByRole('heading', { name: /^Categories of / }).click()
    await expect(toPool).toBeHidden()
    await tileOf(page, 'Art').click()
    await tileOf(page, 'Art').click()
    await expect(toPool).toBeHidden()

    await tileOf(page, 'Art').click()
    await toPool.click()
    await expect(page.getByRole('button', { name: 'Art, in the pool' })).toBeVisible()
    await page.getByRole('button', { name: 'Art, in the pool' }).click()
    await page.getByRole('button', { name: 'Move Art to slot 9' }).click()
    await expect(tileOf(page, 'Art')).toHaveAttribute('data-place', '8')
    await expect(page.getByRole('button', { name: /^Move / })).toHaveCount(0)
  })

  test("sets Masie, Artie and Poppy at the triangle's corners, each knowing best what sits beside them", async ({ page }) => {
    await page.goto(Routes.categoriesPath(huntOf(page)))
    const masie = page.getByRole('group', { name: 'Masie' })
    await expect(masie).toContainText('Best: Math & Econ')
    await expect(masie).toContainText('Worst: Theater')
    await expect(page.getByRole('group', { name: 'Artie' })).toContainText('Best: Art')
    await expect(page.getByRole('group', { name: 'Poppy' })).toContainText('Best: Pop Music')

    // A persona keeps their slot, so what they know follows what is put in it.
    await dropOn(page, 'theater', tileOf(page, 'Math & Econ'))
    await expect(masie).toContainText('Best: Theater')
    await expect(masie).toContainText('Worst: Math & Econ')
  })

  test("shows a reviewer the total order, read-only, and a stranger who to ask", async ({ page, browser }) => {
    const path = Routes.categoriesPath(huntOf(page))
    const reviewer = await otherVisitor(browser)
    const label = await assumeIdent(reviewer)
    await addMember(page, label, 'Reviewer')

    // Art into the pool, and TV into its slot: TV's own slot is left empty, and Art fills it.
    await page.goto(path)
    await tileOf(page, 'Art').focus()
    await page.keyboard.press('Delete')
    await dropOn(page, 'tv', emptySlotAt(page, 8))
    await expect(emptySlotAt(page, 15)).toHaveText('Art')
    await reloadOnceSaved(page)

    await reviewer.goto(path)
    const wheel = reviewer.getByRole('list', { name: 'Category wheel' })
    await expect(wheel.getByRole('listitem')).toHaveCount(24)
    await expect(wheel.getByRole('listitem', { name: '9. TV' })).toBeVisible()
    await expect(wheel.getByRole('listitem', { name: '16. Art' })).toBeVisible()
    await expect(reviewer.getByRole('group', { name: 'Artie' })).toContainText('Best: TV')
    await expect(reviewer.getByRole('button', { name: /^Art, / })).toHaveCount(0)
    await expect(reviewer.getByRole('region', { name: 'Pool' })).toHaveCount(0)

    const stranger = await otherVisitor(browser)
    await assumeIdent(stranger)
    await stranger.goto(path)
    await expect(stranger.getByRole('heading', { name: 'Not yet on this hunt' })).toBeVisible()
  })
})

test.describe("a hunt's category wheel, on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test("sends a category to the pool and back by a double-tap, or by a tap and the button beside it", async ({ page }) => {
    await page.goto(Routes.categoriesPath(huntOf(page)))
    await doubleTap(tileOf(page, 'TV'))
    await expect(page.getByRole('button', { name: 'TV, in the pool' })).toBeVisible()
    await doubleTap(page.getByRole('button', { name: 'TV, in the pool' }))
    await expect(tileOf(page, 'TV')).toHaveAttribute('data-place', '15')

    await tileOf(page, 'Art').tap()
    await page.getByRole('button', { name: 'Move Art to the pool' }).tap()
    await expect(page.getByRole('button', { name: 'Art, in the pool' })).toBeVisible()
    await page.getByRole('button', { name: 'Art, in the pool' }).tap()
    await page.getByRole('button', { name: 'Move Art to slot 9' }).tap()
    await expect(tileOf(page, 'Art')).toHaveAttribute('data-place', '8')
  })
})
