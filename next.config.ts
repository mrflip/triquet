import type { NextConfig } from 'next'
import createMDX from '@next/mdx'

/** Agents build and serve from their own directory, so they never trample a human's running `pnpm dev` */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  turbopack: {
    root: import.meta.dirname,
  },
} satisfies NextConfig

/** Static content is written as markdown and imported as a component, `.md` files included */
const withMDX = createMDX({ extension: /\.(md|mdx)$/ })

export default withMDX(nextConfig)
