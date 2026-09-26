'use client'

import { useEffect, useState } from 'react'
import { Button } from '@mui/material'
import * as Clipboard from '../lib/clipboard'
import { AppNotices } from '../lib/notices'
import styles from './workbench.module.css'

/** How long a copy confirmation stays on screen */
const NoteMs = 2500

export type CopyButtonProps = {
  /** Called when the button is pressed, so text that is costly to make is only made then */
  textOf: () => string
  children: React.ReactNode
}

/**
 * A button that puts text on the clipboard and says whether it did.
 *
 * @param textOf - Makes the text to copy.
 */
export function CopyButton({ textOf, children }: Readonly<CopyButtonProps>) {
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (note === null) { return }
    const timer = setTimeout(() => { setNote(null) }, NoteMs)
    return () => { clearTimeout(timer) }
  }, [note])

  return (
    <>
      <Button
        size="small" variant="outlined"
        onClick={() => { void Clipboard.took(textOf()).then((took) => { setNote(took ? AppNotices.copied : AppNotices.copyFailed) }) }}
      >
        {children}
      </Button>
      {note === null ? null : <span className={styles.microcopy} role="status">{note}</span>}
    </>
  )
}
