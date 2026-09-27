import { type Page } from '@playwright/test'
import { cellOf, expect, startHunt, test } from './support'

/** Stand in for the server saying no bot has credentials, without touching its real environment */
async function stubNoCredentials(page: Page) {
  await page.route('**/api/bots', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body:        JSON.stringify({
        bots: [
          { label: 'dumdum', title: 'Dumdum', servicelabel: 'claude', credentialed: false },
          { label: 'numnum', title: 'Numnum', servicelabel: 'claude', credentialed: false },
        ],
      }),
    })
  })
}

/** Whether a request matching `pattern` is sent within `ms`; start it before whatever might send one */
async function requestSentWithin(page: Page, pattern: string, ms: number): Promise<boolean> {
  try {
    await page.waitForRequest(pattern, { timeout: ms })
    return true
  } catch {
    return false
  }
}

test('with credentials, a never-asked cell invites the author to ask', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region gave its name to Leon?')
  await page.getByLabel('Quiz name').click()
  const cell = page.getByRole('button', { name: 'Ask Quick-model guess' }).first()
  await expect(cell).toHaveText('Double-click to ask')
  await expect(cell).toBeEnabled()
})

test.describe('with no credentials for the bots\' service', () => {
  test.use({ startAt: null })

  test.beforeEach(async ({ page }) => {
    await stubNoCredentials(page)
    await startHunt(page)
    await page.getByRole('textbox', { name: 'Clueing', exact: true }).first().fill('Which region gave its name to Leon?')
    await page.getByRole('textbox', { name: 'Hint', exact: true }).first().fill('BUT NOT three')
    await page.getByLabel('Quiz name').click()
  })

  test('a bot\'s cell says so calmly, and is not offered', async ({ page }) => {
    const cell = page.getByRole('button', { name: 'Ask Quick-model guess' }).first()
    await expect(cell).toHaveText("Dumdum can't play yet — no Claude credentials are set up for this app.")
    await expect(cell).toBeDisabled()
  })

  test('so does the other bot, in each of its cells', async ({ page }) => {
    for (const name of ['Ask Clueing ishes', 'Ask Hint Ishes']) {
      const cell = page.getByRole('button', { name }).first()
      await expect(cell).toHaveText("Numnum can't play yet — no Claude credentials are set up for this app.")
      await expect(cell).toBeDisabled()
    }
  })

  test('a shortcut on a sum column asks nothing either', async ({ page }) => {
    const askWasSent = requestSentWithin(page, '**/api/ask', 1000)
    for (const colname of ['Clueing Full Sum', 'Hint Full Sum']) {
      await cellOf(page, 0, colname).dblclick()
    }
    // Deliberate one-shot "not yet" check: this waits out the 1s window itself, so there is
    // nothing left to retry against.
    expect(await askWasSent).toBe(false)
  })
})
