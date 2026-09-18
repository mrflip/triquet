'use client'

import { useRef } from 'react'
import clsx from 'clsx'
import styles from '../workbench.module.css'

export type ReadonlyBoxProps = {
  label: string
  text:  string
  rows?: number
  /** Denser type, for material meant to be copied out wholesale rather than read */
  dense?: boolean
}

/** A read-only box of generated text. Clicking it selects the lot, ready to copy. */
export function ReadonlyBox({ label, text, rows = 8, dense = false }: Readonly<ReadonlyBoxProps>) {
  const boxRef = useRef<HTMLTextAreaElement>(null)
  return (
    <textarea
      ref={boxRef}
      className={clsx(styles.readonlyBox, dense && styles.readonlyBoxDense)}
      aria-label={label}
      readOnly
      rows={rows}
      value={text}
      onClick={() => { boxRef.current?.select() }}
    />
  )
}
