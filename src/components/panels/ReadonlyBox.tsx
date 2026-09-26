'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@mui/material'
import clsx from 'clsx'
import * as Clipboard from '../../lib/clipboard'
import { AppNotices } from '../../lib/notices'
import styles from '../workbench.module.css'

/** How long an inline copy confirmation stays on screen */
export const CopyNoteMs = 2500

export type ReadonlyBoxProps = {
  label: string
  text:  string
  rows?: number
  /** Denser type, for material meant to be copied out wholesale rather than read */
  dense?: boolean
}

/**
 * A read-only box of generated text, with a Copy button.
 *
 * Clicking the box selects the lot. When the browser refuses to write to the clipboard the
 * button falls back to selecting the text *for* the author and saying so -- a slightly worse
 * outcome, never a silent nothing.
 */
export function ReadonlyBox({ label, text, rows = 8, dense = false }: Readonly<ReadonlyBoxProps>) {
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (note === null) { return }
    const timer = setTimeout(() => { setNote(null) }, CopyNoteMs)
    return () => { clearTimeout(timer) }
  }, [note])

  const copy = useCallback(() => {
    void Clipboard.took(text).then((took) => {
      if (! took) { boxRef.current?.select() }
      setNote(took ? AppNotices.copied : AppNotices.copyRefused)
    })
  }, [text])

  return (
    <>
      <textarea
        ref={boxRef}
        className={clsx(styles.readonlyBox, dense && styles.readonlyBoxDense)}
        aria-label={label}
        readOnly
        rows={rows}
        value={text}
        onClick={() => { boxRef.current?.select() }}
      />
      <div className={styles.panelRow}>
        <Button size="small" variant="outlined" onClick={copy}>Copy</Button>
        {note === null ? null : <span className={styles.microcopy} role="status">{note}</span>}
      </div>
    </>
  )
}
