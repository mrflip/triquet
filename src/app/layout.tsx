import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'
import { FontVariables } from './fonts'
import { Providers } from './providers'
import { paletteCss } from './palette'
import './globals.css'

export const metadata: Metadata = {
  title:       'Triquet',
  description: 'A workbench for drafting trivia rounds and checking them for ambiguity, accuracy and hidden numbers.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={FontVariables} suppressHydrationWarning>
      <head>
        <style>{paletteCss()}</style>
      </head>
      <body>
        <InitColorSchemeScript attribute="data-theme" defaultMode="system" />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
