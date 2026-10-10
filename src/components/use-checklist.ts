'use client'

import { useCallback, useMemo, useState } from 'react'

export type Checklist = {
  /** Whether the list is in batch mode, its rows showing checkboxes */
  checking: boolean
  /** The checked items still in the list, in its order */
  checked:  readonly string[]
  isChecked: (itemkey: string) => boolean
  /** Check one item, or uncheck it: the same function from render to render */
  toggle:   (itemkey: string, on: boolean) => void
  /** Check every item, or none */
  checkAll: (on: boolean) => void
  begin:    () => void
  /** Leave batch mode, checking nothing */
  end:      () => void
}

/**
 * Batch mode for a list: whether it is on, and which of the list's items are checked.
 *
 * An item that leaves the list leaves the checked ones with it, and moving to another list
 * altogether (a new `scopekey`) leaves batch mode, so nothing checked in one is acted on in another.
 *
 * @param scopekey - Names the list; changing it starts afresh.
 * @param itemkeys - The list's items, in order.
 * @returns Whether batch mode is on, what is checked, and how to change either.
 *
 * @example const { checking, checked, toggle } = useChecklist(quiz._id, quiz.questions.map((question) => question._id))
 */
export function useChecklist(scopekey: string | null, itemkeys: readonly string[]): Checklist {
  const [scope, setScope]       = useState(scopekey)
  const [checking, setChecking] = useState(false)
  const [marked, setMarked]     = useState<ReadonlySet<string>>(new Set())
  if (scope !== scopekey) {
    setScope(scopekey)
    setChecking(false)
    setMarked(new Set())
  }
  const checked = useMemo(() => itemkeys.filter((itemkey) => marked.has(itemkey)), [itemkeys, marked])

  // The same function from render to render, so a row handed it need not be drawn again.
  const toggle = useCallback((itemkey: string, on: boolean) => {
    setMarked((prev) => new Set(on ? [...prev, itemkey] : [...prev].filter((each) => each !== itemkey)))
  }, [])
  const checkAll = (on: boolean) => { setMarked(new Set(on ? itemkeys : [])) }
  const begin = () => { setChecking(true) }
  const end = () => {
    setChecking(false)
    setMarked(new Set())
  }

  return { checking, checked, isChecked: (itemkey) => marked.has(itemkey), toggle, checkAll, begin, end }
}
