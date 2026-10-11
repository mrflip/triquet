import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'
import { FontVariables } from './fonts'
import { Providers } from './providers'
import { DarkPalette, LightPalette, paletteCss } from './palette'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import './globals.css'

export const metadata: Metadata = {
  title:       { default: 'Triquet', template: '%s — Triquet' },
  description: 'A workbench for drafting trivia quizzes and checking them for ambiguity, accuracy and hidden numbers.',
  icons: {
    // favicon.ico comes from the file beside this one, and Next puts it first.
    icon: [
      { url: '/brand/icon.svg', type: 'image/svg+xml' },
      { url: '/brand/icon-dark.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    ],
    // Named here although it is also a file convention: once `icons` is set, Next stops adding
    // app/apple-icon.png on its own.
    apple: '/apple-icon.png',
  },
}

/** The browser's own chrome, in the page's ground colour */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: LightPalette.page },
    { media: '(prefers-color-scheme: dark)', color: DarkPalette.page },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={FontVariables} suppressHydrationWarning>
      <head>
        <style>{paletteCss()}</style>
      </head>
      <body>
        <InitColorSchemeScript attribute="data-theme" defaultMode="system" />
        <Providers>
          {/* A column the height of the window at least, so the footer sits at its foot on a short page */}
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
            <SiteHeader />
            <Box sx={{ flex: 1 }}>{children}</Box>
            <SiteFooter />
          </Box>
        </Providers>
      </body>
    </html>
  )
}
