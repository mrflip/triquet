'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import clsx from 'clsx'
import * as UU from '../../lib/useful'
import type { LastErrT } from '../../models/ask'
import styles from '../workbench.module.css'

export type ErrBadgeProps = {
  err:      LastErrT
  /** Sits in the flow of a line of text, rather than in the corner of a cell */
  inline?:  boolean
}

/**
 * A warning mark for the last failed ask: hover for the reason, click for the response as it came back.
 *
 * @param err - The failure a cell kept.
 */
export function ErrBadge({ err, inline = false }: Readonly<ErrBadgeProps>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={clsx(styles.errBadge, inline && styles.errBadgeInline)}
        title={`${err.message} Click for the response as it came back.`}
        aria-label={`The last ask failed: ${err.message} Show the response.`}
        onClick={() => { setOpen(true) }}
      >
        ⚠
      </button>
      {open && (
        <Dialog open onClose={() => { setOpen(false) }} fullWidth maxWidth="sm" aria-labelledby="err-title">
          <DialogTitle id="err-title">The last ask failed</DialogTitle>
          <DialogContent>
            <p>{err.message}</p>
            <p className={styles.microcopy}>{new Date(err.at).toLocaleString()}</p>
            <pre className={styles.errJson} aria-label="The response">{UU.jsonify(err.response, { pretty: true })}</pre>
          </DialogContent>
          <DialogActions><Button onClick={() => { setOpen(false) }}>Close</Button></DialogActions>
        </Dialog>
      )}
    </>
  )
}
