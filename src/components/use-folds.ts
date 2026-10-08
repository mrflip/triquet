'use client'

import { useState } from 'react'

export type Folds = {
  /** Whether any item is showing in full; the fold-all triangle points down while one is */
  anyOpen:    boolean
  isFolded:   (itemkey: string) => boolean
  /** Show one item in full */
  unfold:     (itemkey: string) => void
  /** Show every item in full, or fold every one */
  setAllOpen: (open: boolean) => void
}

/**
 * Which items of a list are folded, for a list that folds item by item and all at once.
 *
 * Every item there at the start is folded, and one that arrives later is open. Nothing folds an
 * item again but folding them all. The view that owns the list starts afresh for another list by
 * its `key`, as React resets any component's state.
 *
 * @param itemkeys - The list's items, in order.
 * @returns Whether any item is open, whether each is folded, and how to change either.
 */
export function useFolds(itemkeys: readonly string[]): Folds {
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set(itemkeys))
  return {
    anyOpen:    anyOpenIn(folded, itemkeys),
    isFolded:   (itemkey) => folded.has(itemkey),
    unfold:     (itemkey) => { setFolded((prev) => unfoldIn(prev, itemkey)) },
    setAllOpen: (open) => { setFolded(new Set(open ? [] : itemkeys)) },
  }
}

/**
 * The folded items, with `itemkey` open: the very same set when it already was, so opening an
 * open item changes nothing and re-renders nothing.
 *
 * @param folded - The items folded now.
 * @param itemkey - The item to open.
 * @returns The items folded once it is open.
 *
 * @example unfoldIn(new Set(['q1', 'q2']), 'q1')  // => Set {'q2'}
 */
export function unfoldIn(folded: ReadonlySet<string>, itemkey: string): ReadonlySet<string> {
  if (! folded.has(itemkey)) { return folded }
  return new Set([...folded].filter((each) => each !== itemkey))
}

/**
 * Whether any of the list's items is open. An item gone from the list is no longer asked about,
 * whatever the folded set remembers of it.
 *
 * @param folded - The items folded now.
 * @param itemkeys - The list's items.
 * @returns True when some item is not folded.
 *
 * @example anyOpenIn(new Set(['q1']), ['q1', 'q2'])  // => true: q2 arrived after the list was folded
 */
export function anyOpenIn(folded: ReadonlySet<string>, itemkeys: readonly string[]): boolean {
  return itemkeys.some((itemkey) => ! folded.has(itemkey))
}

export type FoldSet = {
  /** Whether the item is showing in full */
  isOpen:  (itemkey: string) => boolean
  /** Show the item in full, or fold it */
  setOpen: (itemkey: string, open: boolean) => void
}

/** The items open, and the scope they were opened in */
type Opened = { scope: string, itemkeys: ReadonlySet<string> }

/**
 * Which panels of a set are open, each opened and folded on its own, for a view whose panels all
 * start folded (the manage dialog's columns and widgetings). Held by a view that outlives the one
 * drawing the panels, it keeps each fold across a reopen. A new `scope` -- another quiz, say --
 * starts with every panel folded again.
 *
 * @param scope - What the panels belong to.
 * @returns Whether each is open, and how to change that.
 */
export function useFoldSet(scope: string): FoldSet {
  const [opened, setOpened] = useState<Opened>(() => ({ scope, itemkeys: new Set() }))
  const current = opened.scope === scope ? opened.itemkeys : NoneOpen
  return {
    isOpen:  (itemkey) => current.has(itemkey),
    setOpen: (itemkey, open) => {
      setOpened((prev) => ({ scope, itemkeys: openedIn(prev.scope === scope ? prev.itemkeys : NoneOpen, itemkey, open) }))
    },
  }
}

/** No panel open */
const NoneOpen: ReadonlySet<string> = new Set()

/**
 * The open items, with `itemkey` open or folded as asked: the very same set when it already was,
 * so asking for what is already so changes nothing and re-renders nothing.
 *
 * @param opened - The items open now.
 * @param itemkey - The item to open or fold.
 * @param open - Whether it is to be open.
 * @returns The items open afterward.
 *
 * @example openedIn(new Set(['notes']), 'hint', true)    // => Set {'notes', 'hint'}
 * @example openedIn(new Set(['notes']), 'notes', false)  // => Set {}
 */
export function openedIn(opened: ReadonlySet<string>, itemkey: string, open: boolean): ReadonlySet<string> {
  if (opened.has(itemkey) === open) { return opened }
  return new Set(open ? [...opened, itemkey] : [...opened].filter((each) => each !== itemkey))
}
