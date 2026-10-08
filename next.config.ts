import type { NextConfig } from 'next'
import createMDX from '@next/mdx'

/**
 * The headers every response carries, page and route alike: no other site may frame the app
 * (`X-Frame-Options`), a browser takes each file as the type it is served as (`nosniff`), another
 * site is told only which site a visitor came from (`Referrer-Policy`), and the page may use no
 * camera, microphone, location, payment or USB device (`Permissions-Policy`). A Content Security
 * Policy is not among them: that is a discussion (`notes/stack.md`, *Later*).
 */
const SecurityHeaders = [
  { key: 'X-Frame-Options',        value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
] as const

/** Agents build and serve from their own directory, so they never trample a human's running `pnpm dev` */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  turbopack: {
    root: import.meta.dirname,
  },
  headers: () => Promise.resolve([{ source: '/:path*', headers: [...SecurityHeaders] }]),
} satisfies NextConfig

/** Static content is written as markdown and imported as a component, `.md` files included */
const withMDX = createMDX({ extension: /\.(md|mdx)$/ })

export default withMDX(nextConfig)
