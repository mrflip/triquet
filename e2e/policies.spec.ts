import { expect, test } from './support'

// About the privacy policy, the terms and the footer that links them, none of which needs a hunt.
test.use({ startAt: null })

/** The address to write to, as the footer and the policy give it */
const ContactAddress = 'info@triquet.me'

test.describe('the footer', () => {
  test('leads from the front door to the privacy policy, the terms and About', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/')
    const footer = page.getByRole('contentinfo')
    await footer.getByRole('link', { name: 'Privacy' }).click()
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible()
    await expect(page).toHaveTitle('Privacy — Triquet')
    await footer.getByRole('link', { name: 'Terms' }).click()
    await expect(page.getByRole('heading', { name: 'Terms of use', level: 1 })).toBeVisible()
    await expect(page).toHaveTitle('Terms — Triquet')
    await footer.getByRole('link', { name: 'About' }).click()
    await expect(page.getByRole('heading', { name: 'About Triquet', level: 1 })).toBeVisible()
  })

  test('gives the address to write to', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('contentinfo').getByRole('link', { name: ContactAddress })).toHaveAttribute('href', `mailto:${ContactAddress}`)
  })
})

test.describe('the privacy policy and the terms', () => {
  test('show without the database, which they never open', async ({ page, baseURL }) => {
    // With the database unreachable no page that reads it gets past its opening notice.
    const appHost = new URL(String(baseURL)).host
    await page.routeWebSocket((url) => url.host !== appHost, (socket) => { void socket.close() })
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'Who sees what' })).toBeVisible()
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: 'Your content is yours' })).toBeVisible()
  })

  test('link each other', async ({ page }) => {
    await page.goto('/privacy')
    await page.getByRole('main').getByRole('link', { name: 'terms of use' }).click()
    await expect(page.getByRole('heading', { name: 'Terms of use', level: 1 })).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'privacy policy' }).click()
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible()
  })

  test("give the address to write to, to have one's data deleted", async ({ page }) => {
    await page.goto('/privacy')
    const deleting = page.getByRole('main').getByRole('link', { name: ContactAddress }).first()
    await expect(deleting).toHaveAttribute('href', `mailto:${ContactAddress}`)
  })
})
