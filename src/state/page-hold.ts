import { useEffect, useState } from 'react'

/** How many changes this page is writing, whichever mutation carries them, and who is told when that changes */
const Writing = { count: 0, listeners: new Set<() => void>() }

/** Asks before the page is left, which would lose a change still being written */
function askBeforeLeaving(event: BeforeUnloadEvent): void {
  event.preventDefault()
}

/**
 * Hold the page while a change is written, and let it go once none is: leaving it in between asks
 * first. Done at once rather than after the next render, because a change is only a moment in the
 * writing and the author may leave in that moment. Counted across every dispatcher on the page
 * (a quiz's, the library's), so one letting go does not let go of another's. Whoever watches
 * whether the page is writing (`usePageWriting`) is told.
 *
 * @param holding - True as a write begins, false once it has ended, kept or not.
 *
 * @example holdThePage(true); try { await perform(...) } finally { holdThePage(false) }
 */
export function holdThePage(holding: boolean): void {
  Writing.count += holding ? 1 : -1
  if (holding && Writing.count === 1) { addEventListener('beforeunload', askBeforeLeaving) }
  if (! holding && Writing.count === 0) { removeEventListener('beforeunload', askBeforeLeaving) }
  for (const listener of Writing.listeners) { listener() }
}

/** Whether a change is being written on this page now */
function isWriting(): boolean {
  return Writing.count > 0
}

/** Be told whenever a write begins or ends; the function handed back stops it */
function watchWriting(listener: () => void): () => void {
  Writing.listeners.add(listener)
  return () => { Writing.listeners.delete(listener) }
}

/**
 * Whether a change dispatched on this page, to its quiz or to the library, is still being written
 * (`holdThePage`). For the one view that says so: only it is drawn again as each write begins and
 * ends, never the screen around it.
 *
 * Held as React state, set at the priority of whatever began or ended the write, rather than read
 * through `useSyncExternalStore`, which draws at once: a write's end then lands in the same render
 * as the watches it brought current, never ahead of them, so the page says a change is written no
 * sooner than it shows it.
 *
 * @returns True while any change is being written.
 *
 * @example const unsaved = usePageWriting()
 */
export function usePageWriting(): boolean {
  const [writing, setWriting] = useState(isWriting)
  useEffect(() => {
    const told = () => { setWriting(isWriting()) }
    const stop = watchWriting(told)
    // A write begun between the first render and this effect.
    told()
    return stop
  }, [])
  return writing
}
