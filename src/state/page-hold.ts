/** How many changes this page is writing, whichever mutation carries them */
const Writing = { count: 0 }

/** Asks before the page is left, which would lose a change still being written */
function askBeforeLeaving(event: BeforeUnloadEvent): void {
  event.preventDefault()
}

/**
 * Hold the page while a change is written, and let it go once none is: leaving it in between asks
 * first. Done at once rather than after the next render, because a change is only a moment in the
 * writing and the author may leave in that moment. Counted across every dispatcher on the page
 * (a quiz's, the library's), so one letting go does not let go of another's.
 *
 * @param holding - True as a write begins, false once it has ended, kept or not.
 *
 * @example holdThePage(true); try { await perform(...) } finally { holdThePage(false) }
 */
export function holdThePage(holding: boolean): void {
  Writing.count += holding ? 1 : -1
  if (holding && Writing.count === 1) { addEventListener('beforeunload', askBeforeLeaving) }
  if (! holding && Writing.count === 0) { removeEventListener('beforeunload', askBeforeLeaving) }
}
