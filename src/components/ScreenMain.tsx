'use client'

import type { ReactNode } from 'react'
import { usePageWriting } from '../state/page-hold'

export type ScreenMainProps = {
  className?: string
  children:   ReactNode
}

/**
 * A screen's `<main>`, saying whether a change made on the page is still being written
 * (`data-unsaved`, what a test waits on before a reload). Drawn again alone as each write begins
 * and ends: what it holds was made by the screen around it, and is not.
 */
export function ScreenMain({ className, children }: Readonly<ScreenMainProps>) {
  const unsaved = usePageWriting()
  return <main className={className} data-unsaved={unsaved}>{children}</main>
}
