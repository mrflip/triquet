'use client'

import { useState } from 'react'
import { Button, Stack } from '@mui/material'
import styles from './workbench.module.css'

export type ConfirmRemoveProps = {
  /** What is being removed, e.g. "column" */
  noun:      string
  /** Said while asking, to make clear what is lost and what is kept */
  question:  string
  /** When the thing cannot be removed, why; the button is then replaced by this */
  refusal?:  string | null
  onConfirm: () => void
}

/**
 * A remove button that asks first: pressing it swaps it for the question and a yes and a no.
 *
 * @param noun - Names the thing on the button.
 * @param question - What it asks.
 * @param refusal - Shown instead of the button when removal is not allowed.
 * @param onConfirm - Called only on the yes.
 */
export function ConfirmRemove({ noun, question, refusal = null, onConfirm }: Readonly<ConfirmRemoveProps>) {
  const [confirming, setConfirming] = useState(false)
  if (refusal !== null) { return <span className={styles.microcopy}>{refusal}</span> }
  if (! confirming) { return <Button size="small" color="error" onClick={() => { setConfirming(true) }}>Remove {noun}</Button> }
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <span className={styles.microcopy}>{question}</span>
      <Button size="small" color="error" variant="contained" onClick={onConfirm}>Yes, remove</Button>
      <Button size="small" onClick={() => { setConfirming(false) }}>Keep it</Button>
    </Stack>
  )
}
