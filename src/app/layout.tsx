import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'
import { FontVariables } from './fonts'
import { Providers } from './providers'
import { DarkPalette, LightPalette, paletteCss } from './palette'
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
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  )
}
