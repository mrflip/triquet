'use client'

import { useEffect, useRef, useState } from 'react'

export type DraftHandle = {
  draft:    string
  onChange: (next: string) => void
  onBlur:   () => void
}

/**
 * A field's own copy of its text, committed when it loses focus.
 *
 * Committing on blur rather than on every keystroke keeps the grid from re-rendering under a
 * half-typed word. A change arriving from elsewhere -- another tab, an import, a sort -- takes
 * over only while the field is not being typed into.
 *
 * @param committed - The text as the quiz currently holds it.
 * @param onCommit - Called with the draft when the field loses focus and the text has changed.
 * @param tidy - Last chance to clean the draft up on the way out, applied to what the author
 *   still sees as well as to what is committed: `3.` typed on the way to `3.1` becomes `3`.
 * @returns The draft, and the handlers the field needs.
 *
 * @example const { draft, onChange, onBlur } = useDraft(question.clueing, commitClueing)
 */
export function useDraft(committed: string, onCommit: (draft: string) => void, tidy?: (draft: string) => string): DraftHandle {
  const [draft, setDraft] = useState(committed)
  const editing = useRef(false)

  useEffect(() => {
    if (! editing.current) { setDraft(committed) }
  }, [committed])

  return {
    draft,
    onChange: (next: string) => {
      editing.current = true
      setDraft(next)
    },
    onBlur: () => {
      editing.current = false
      const tidied = tidy ? tidy(draft) : draft
      if (tidied !== draft) { setDraft(tidied) }
      if (tidied !== committed) { onCommit(tidied) }
    },
  }
}
