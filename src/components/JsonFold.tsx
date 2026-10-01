'use client'

import { useState } from 'react'
import { Box } from '@mui/material'
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

export type JsonTextProps = {
  val:  unknown
  /** Whether it is shown pretty-printed, rather than as compact JSON */
  open: boolean
}

/**
 * A JSON value in a box that already scrolls, such as a grid cell: compact JSON, wrapping, while
 * folded, and pretty-printed while open. The fold's control is the caller's `FoldButton`, kept
 * outside any button the text sits in, so a fold never nests inside another control.
 *
 * @param val - The JSON-serialisable value.
 * @param open - Whether it is pretty-printed.
 */
export function JsonText({ val, open }: Readonly<JsonTextProps>) {
  if (! open) { return <span>{UU.jsonify(val)}</span> }
  return <Box component="pre" sx={{ m: 0, font: 'inherit', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{UU.jsonify(val, { pretty: true })}</Box>
}
