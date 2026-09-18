'use client'

import { useEffect, useState } from 'react'

/** How long the window must hold still before heights are re-measured */
export const ResizeSettleMs = 160

/**
 * A counter that ticks once the window has finished resizing.
 *
 * Row heights depend on how wide their columns are, so they need re-measuring after a resize --
 * but only after it settles, not on every intermediate frame.
 *
 * @returns A number that changes when a resize has come to rest.
 *
 * @example const resizeToken = useSettledResize()   // feed into a measuring effect's deps
 */
export function useSettledResize(): number {
  const [token, setToken] = useState(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { setToken((was) => was + 1) }, ResizeSettleMs)
    }
    addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      removeEventListener('resize', onResize)
    }
  }, [])

  return token
}
