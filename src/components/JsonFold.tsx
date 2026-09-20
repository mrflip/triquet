'use client'

import { useState } from 'react'
import * as UU from '../lib/useful'
import styles from './workbench.module.css'

export type JsonFoldProps = {
  label: string
  val:   unknown
}

/**
 * A value that can be folded: closed, it is one line of compact JSON beside its name; open, it is
 * pretty-printed in a box that scrolls once it is tall.
 *
 * @param label - What the value is called.
 * @param val - The JSON-serialisable value.
 */
export function JsonFold({ label, val }: Readonly<JsonFoldProps>) {
  const [open, setOpen] = useState(false)
  return (
    <details open={open} onToggle={(event) => { setOpen(event.currentTarget.open) }}>
      <summary className={styles.foldSummary}>
        <span className={styles.foldLabel}>{label}</span>
        {open ? null : <span className={styles.foldOneLine}>{UU.jsonify(val)}</span>}
      </summary>
      {open && <pre className={styles.foldBody} aria-label={`Input: ${label}`}>{UU.jsonify(val, { pretty: true })}</pre>}
    </details>
  )
}
