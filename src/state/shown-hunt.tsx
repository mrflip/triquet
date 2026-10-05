'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { HuntListingT } from '../lib/rows'

/** The hunt a page is about, as the header names it */
export type ShownHuntT = Pick<HuntListingT, 'label' | 'title'>

/** Say which hunt the page is about; null for none */
type ShowHunt = (hunt: ShownHuntT | null) => void

// Two contexts, so a page that only says which hunt it is about is not drawn again when it does.
const ShowContext = createContext<ShowHunt | null>(null)
const ShownContext = createContext<ShownHuntT | null>(null)

/**
 * Which hunt the page is about, said by the page and read by the header above it, which sits
 * outside the page and its connection to the database. Wraps the whole app, header included.
 */
export function ShownHuntProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [shown, setShown] = useState<ShownHuntT | null>(null)
  return (
    <ShowContext value={setShown}>
      <ShownContext value={shown}>
        {children}
      </ShownContext>
    </ShowContext>
  )
}

/**
 * Say that the page is about `hunt`, for as long as it is on screen, so that the header names it.
 * A page about no hunt, or one whose hunt has not arrived, says nothing, and the header names none.
 *
 * @param hunt - The hunt the page is about; null while there is none to name.
 *
 * @example useShowHunt(hunt)
 */
export function useShowHunt(hunt: ShownHuntT | null): void {
  const show = useContext(ShowContext)
  if (show === null) { throw new Error('useShowHunt wants a ShownHuntProvider above it') }
  const label = hunt?.label ?? null
  const title = hunt?.title ?? null
  useEffect(() => {
    if (label === null || title === null) { return }
    show({ label, title })
    return () => { show(null) }
  }, [show, label, title])
}

/**
 * The hunt the page is about, for the header to name.
 *
 * @returns The hunt; null when the page is about none.
 */
export function useShownHunt(): ShownHuntT | null {
  return useContext(ShownContext)
}
