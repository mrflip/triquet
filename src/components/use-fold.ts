'use client'

import { useState } from 'react'

/**
 * How far one fold is turned: `folded` to its title bar, `open` at its resting size, or `big`,
 * open and as large as its place allows (a panel widened to the whole row). There is no "big but
 * folded": making it big opens it.
 */
export const FoldVals = ['folded', 'open', 'big'] as const
export type FoldT = typeof FoldVals[number]

/**
 * The fold one turn of the cycle on from `fold`, as a double-click on its title turns it: folded,
 * then open, then big, then folded again. Where nothing is bigger than open (`bigOffered` false),
 * it turns between folded and open alone.
 *
 * @param fold - How far it is turned now.
 * @param bigOffered - Whether it can be made big at all.
 * @returns How far it is turned next.
 *
 * @example nextFold('folded')  // => 'open'
 * @example nextFold('open')  // => 'big'
 * @example nextFold('big')  // => 'folded'
 * @example nextFold('open', false)  // => 'folded'
 */
export function nextFold(fold: FoldT, bigOffered = true): FoldT {
  if (fold === 'folded') { return 'open' }
  if (fold === 'open' && bigOffered) { return 'big' }
  return 'folded'
}

/**
 * Whether a fold shows what it holds: open, or big.
 *
 * @example isShowing('big')  // => true
 * @example isShowing('folded')  // => false
 */
export function isShowing(fold: FoldT): boolean {
  return fold !== 'folded'
}

/**
 * The fold its fold button asks for, from `fold`: folded when it shows anything, open when it is
 * folded. The button folds a big one outright rather than shrinking it first.
 *
 * @example toggledFold('big')  // => 'folded'
 * @example toggledFold('folded')  // => 'open'
 */
export function toggledFold(fold: FoldT): FoldT {
  return isShowing(fold) ? 'folded' : 'open'
}

/**
 * The fold its embiggen arrows ask for, from `fold`: big from folded or open, so one click shows it
 * at its largest; open again from big.
 *
 * @example embiggenedFold('folded')  // => 'big'
 * @example embiggenedFold('big')  // => 'open'
 */
export function embiggenedFold(fold: FoldT): FoldT {
  return fold === 'big' ? 'open' : 'big'
}

export type FoldHandle = {
  /** How far it is turned now */
  fold:      FoldT
  /** Turn it to any fold */
  setFold:   (fold: FoldT) => void
  /** One turn of the cycle on (`nextFold`): what a double-click on its title does */
  cycle:     () => void
  /** Open or fold it, as its fold button does (`toggledFold`) */
  toggle:    () => void
  /** Make it big, or open again from big, as its embiggen arrows do (`embiggenedFold`) */
  embiggen:  () => void
}

/**
 * One three-way fold (`FoldT`), and the gestures that turn it: the fold button, the embiggen
 * arrows, and a double-click on the title cycling folded, open, big. A view that holds the fold
 * itself (to grow its content when big) hands it in as `held` with its setter, and the hook keeps
 * none of its own.
 *
 * @param initial - How far it starts turned, when the hook holds it.
 * @param options.bigOffered - Whether it can be made big at all; the cycle skips big where it cannot.
 * @param options.held - The fold as the view holds it, and its setter; the hook's own when not given.
 * @returns The fold, and each gesture's turn of it.
 *
 * @example const { fold, cycle, toggle, embiggen } = useFold('folded', { bigOffered: inRow })
 */
export function useFold(initial: FoldT, { bigOffered = true, held }: { bigOffered?: boolean, held?: { fold: FoldT, setFold: (fold: FoldT) => void } } = {}): FoldHandle {
  const [own, setOwn] = useState<FoldT>(initial)
  const fold = held?.fold ?? own
  const setFold = held?.setFold ?? setOwn
  return {
    fold,
    setFold,
    cycle:    () => { setFold(nextFold(fold, bigOffered)) },
    toggle:   () => { setFold(toggledFold(fold)) },
    embiggen: () => { setFold(embiggenedFold(fold)) },
  }
}
