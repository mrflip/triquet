'use client'

import { useState } from 'react'
import * as UU from '../../lib/useful'
import { DifficultyDefault, Estimate, type Difficulty, type EstimatesT } from '../../models/estimate'
import { CategoryLabelsByTitle, type CategoryLabel } from '../../models/category'

/**
 * One pill of a category-estimate cell: a category, or blank, and a difficulty. Unlike the
 * estimates it comes to, a cell's pills may hold several blanks at once.
 */
export type PillT = { category: CategoryLabel | null, difficulty: Difficulty }

/**
 * The pills a cell holding `estimates` shows: one for each, a lone estimate of no category in
 * particular being one blank pill.
 *
 * @example pillsOf([{ category: null, difficulty: 'hard' }])  // => [{ category: null, difficulty: 'hard' }]
 */
export function pillsOf(estimates: EstimatesT): PillT[] {
  return estimates.map(({ category, difficulty }) => ({ category, difficulty }))
}

/**
 * What a cell's pills come to: every pill with a category, blank ones left out; or, when every
 * pill is blank, the lone estimate of no category in particular, at the first pill's difficulty.
 *
 * @example estimatesFrom([{ category: 'tv', difficulty: 'hard' }, { category: null, difficulty: 'easy' }])  // => [{ category: 'tv', difficulty: 'hard' }]
 * @example estimatesFrom([{ category: null, difficulty: 'easy' }])                                         // => [{ category: null, difficulty: 'easy' }]
 * @example estimatesFrom([])                                                                               // => [{ category: null, difficulty: 'medium' }]
 */
export function estimatesFrom(pills: readonly PillT[]): EstimatesT {
  const placed = pills.filter((pill) => pill.category !== null)
  return placed.length > 0 ? placed : [Estimate.neutral(pills[0]?.difficulty)]
}

/**
 * The categories the pill at `idx` may be given, alphabetically by title: its own, and every one
 * no other pill holds, since a question estimates each category once.
 *
 * @example choicesFor([{ category: 'tv', difficulty: 'hard' }, { category: null, difficulty: 'medium' }], 1).includes('tv')  // => false
 * @example choicesFor([{ category: null, difficulty: 'medium' }], 0)[0]  // => 'art'
 */
export function choicesFor(pills: readonly PillT[], idx: number): CategoryLabel[] {
  const heldElsewhere = new Set(pills.flatMap((pill, jj) => (jj !== idx && pill.category !== null ? [pill.category] : [])))
  return CategoryLabelsByTitle.filter((label) => ! heldElsewhere.has(label))
}

/**
 * Whether another pill may be added: only while every pill has a category, so a cell holds at
 * most the one blank it is offered.
 *
 * @example addable([{ category: 'tv', difficulty: 'hard' }])  // => true
 * @example addable([{ category: null, difficulty: 'hard' }])  // => false
 */
export function addable(pills: readonly PillT[]): boolean {
  return pills.every((pill) => pill.category !== null)
}

/** A cell's pills, and the ways to change them */
export type PillsHandle = {
  pills:   PillT[]
  /** Give the pill at `idx` a category, or make it blank */
  place:   (idx: number, category: CategoryLabel | null) => void
  /** Set how hard the question is in the pill at `idx`'s category */
  pitch:   (idx: number, difficulty: Difficulty) => void
  /** Take the pill at `idx` away */
  remove:  (idx: number) => void
  /** Add a blank pill at the end, at medium */
  add:     () => void
}

/**
 * A category-estimate cell's own pills, each change committed at once when it changes what they
 * come to. A blank pill is the cell's alone: it comes to nothing until it is given a category,
 * and is kept on screen while what the cell holds agrees with the pills. What the cell holds
 * on the way to the latest change sent (an earlier change, landing) is passed over; anything
 * else that does not agree -- another tab, an import -- takes over.
 *
 * @param committed - The estimates the cell now holds.
 * @param onCommit - Told what the pills come to, whenever that changes.
 * @returns The pills, and the ways to change them.
 *
 * @example const { pills, place, add } = usePills(Estimates.estimatesOf(widgeted), onEnter)
 */
export function usePills(committed: EstimatesT, onCommit: (estimates: EstimatesT) => void): PillsHandle {
  const committedKey = UU.jsonify(committed)
  const [pills, setPills] = useState(() => pillsOf(committed))
  const [seenKey, setSeenKey] = useState(committedKey)
  const [sentKey, setSentKey] = useState<string | null>(null)
  // Adjusted while rendering, as React advises for state that follows a prop, rather than in an effect.
  if (seenKey !== committedKey) {
    setSeenKey(committedKey)
    if (committedKey === sentKey) { setSentKey(null) }
    const agrees = UU.jsonify(estimatesFrom(pills)) === committedKey
    if (! agrees && (sentKey === null || committedKey === sentKey)) { setPills(pillsOf(committed)) }
  }

  const change = (next: PillT[]) => {
    setPills(next)
    const estimates = estimatesFrom(next)
    const nextKey = UU.jsonify(estimates)
    if (nextKey === (sentKey ?? committedKey)) { return }
    // A change back to what the cell already holds may never be seen to land, so nothing waits on it.
    setSentKey(nextKey === committedKey ? null : nextKey)
    onCommit(estimates)
  }
  return {
    pills,
    place:  (idx, category) => { change(pills.map((pill, jj) => (jj === idx ? { ...pill, category } : pill))) },
    pitch:  (idx, difficulty) => { change(pills.map((pill, jj) => (jj === idx ? { ...pill, difficulty } : pill))) },
    remove: (idx) => { change(pills.filter((_pill, jj) => jj !== idx)) },
    add:    () => { change([...pills, { category: null, difficulty: DifficultyDefault }]) },
  }
}
