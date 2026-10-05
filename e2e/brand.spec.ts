import { AppNotices } from '../src/lib/notices'
import { expect, headLinks, test } from './support'

// About the header and the about page, neither of which needs a hunt.
test.use({ startAt: null })

test.describe('the header', () => {
  test('carries the logo home, and the way to About', async ({ page }) => {
    await page.goto('/about')
    const banner = page.getByRole('banner')
    await banner.getByRole('link', { name: 'Triquet' }).click()
    await expect(page.getByRole('heading', { name: AppNotices.identGateTitle })).toBeVisible()
    await banner.getByRole('link', { name: 'About' }).click()
    await expect(page).toHaveTitle('About — Triquet')
  })

  test('shows the light lockup in a light scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/about')
    await expect(page.getByRole('banner').getByRole('img', { name: 'Triquet' })).toHaveAttribute('src', /triquet-lockup-light\.svg/)
  })

  test('shows the dark lockup in a dark scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/about')
    await expect(page.getByRole('banner').getByRole('img', { name: 'Triquet' })).toHaveAttribute('src', /triquet-lockup-dark\.svg/)
  })
})

test.describe('the icons', () => {
  test('are all named in the head, the dark one only for a dark scheme', async ({ page }) => {
    await page.goto('/about')
    const icons = headLinks(page, 'icon')
    await expect(icons.first()).toHaveAttribute('href', /^\/favicon\.ico/)
    await expect(icons.and(page.locator('[media="(prefers-color-scheme: dark)"]'))).toHaveAttribute('href', '/brand/icon-dark.svg')
    await expect(icons.and(page.locator(':not([media])[type="image/svg+xml"]'))).toHaveAttribute('href', '/brand/icon.svg')
    await expect(headLinks(page, 'apple-touch-icon')).toHaveAttribute('href', /^\/apple-icon\.png/)
  })

  test('install from the manifest at the two sizes Chrome asks for', async ({ page }) => {
    const served = await page.request.get('/manifest.webmanifest')
    const manifest = await served.json() as { icons: { src: string, sizes: string }[] }
    for (const [src, sizes] of [['/brand/icon-192.png', '192x192'], ['/brand/icon-512.png', '512x512']] as const) {
      expect(manifest.icons).toContainEqual(expect.objectContaining({ src, sizes }))
      const icon = await page.request.get(src)
      expect(icon.ok()).toBe(true)
    }
  })
})

test.describe('the about page', () => {
  test('shows without the database, which it never opens', async ({ page, baseURL }) => {
    // With the database unreachable no page that reads it gets past its opening notice.
    const appHost = new URL(String(baseURL)).host
    await page.routeWebSocket((url) => url.host !== appHost, (socket) => { void socket.close() })
    await page.goto('/about')
    await expect(page.getByRole('heading', { name: 'About Triquet' })).toBeVisible()
  })

  test('downloads a brand asset when it is clicked', async ({ page }) => {
    await page.goto('/about')
    const downloading = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Download Lockup · light (triquet-lockup-light.svg)' }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toBe('triquet-lockup-light.svg')
  })
})
