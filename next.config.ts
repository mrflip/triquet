import type { NextConfig } from 'next'

/** Agents build and serve from their own directory, so they never trample a human's running `pnpm dev` */
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  turbopack: {
    root: import.meta.dirname,
  },
}

export default nextConfig
