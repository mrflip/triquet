'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Button, TextField } from '@mui/material'
import * as Clipboard from '../../lib/clipboard'
import { AppNotices } from '../../lib/notices'
import styles from '../workbench.module.css'

/** How long an inline copy confirmation stays on screen */
export const CopyNoteMs = 2500

/** The box's type, in pixels and lines: denser for material meant to be copied out wholesale */
const BoxType = {
  dense: { fontSize: 10, lineHeight: 1.35 },
  plain: { fontSize: 12, lineHeight: 1.5 },
} as const

/** The space MUI's small outlined text box keeps above and below its text, together */
const BoxPaddingPx = 17

/**
 * How tall a box of `rows` lines stands, its padding with it, in pixels.
 *
 * @example boxHeightPx(10, true)  // => 152
 */
export function boxHeightPx(rows: number, dense: boolean): number {
  const { fontSize, lineHeight } = dense ? BoxType.dense : BoxType.plain
  return (rows * fontSize * lineHeight) + BoxPaddingPx
}

export type ReadonlyBoxProps = {
  label: string
  text:  string
  rows?: number
  /** Denser type, for material meant to be copied out wholesale rather than read */
  dense?: boolean
  /** More buttons, to the right of Copy */
  actions?: ReactNode
  /** A resize handle in the box's lower corner, so it can be dragged taller (`resize: vertical`) */
  resizable?: boolean
}

/**
 * A read-only box of generated text, with a Copy button, and any other actions beside it.
 *
 * Clicking the box selects the lot. When the browser refuses to write to the clipboard the
 * button falls back to selecting the text *for* the author and saying so -- a slightly worse
 * outcome, never a silent nothing.
 */
export function ReadonlyBox({ label, text, rows = 8, dense = false, actions, resizable = false }: Readonly<ReadonlyBoxProps>) {
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
      <TextField
        multiline
        rows={rows}
        fullWidth
        size="small"
        value={text}
        inputRef={boxRef}
        onClick={() => { boxRef.current?.select() }}
        slotProps={{ input: { readOnly: true }, htmlInput: { 'aria-label': label } }}
        sx={{
          mt: 1,
          '& .MuiInputBase-root': { bgcolor: 'var(--surface-sunk)' },
          '& textarea': {
            fontFamily: 'var(--font-data)',
            ...(dense ? BoxType.dense : BoxType.plain),
            whiteSpace: dense ? 'pre-wrap' : 'pre',
            wordBreak:  dense ? 'break-all' : 'normal',
            overflow:   'auto !important',
            resize:     resizable ? 'vertical' : 'none',
          },
        }}
      />
      <div className={styles.panelRow}>
        <Button size="small" variant="outlined" onClick={copy}>Copy</Button>
        {actions}
        {note === null ? null : <span className={styles.microcopy} role="status">{note}</span>}
      </div>
    </>
  )
}

export type ReadonlyBoxStandInProps = Pick<ReadonlyBoxProps, 'rows' | 'dense'> & {
  /** The buttons, where the box's own will be */
  actions: ReactNode
}

/**
 * The place a `ReadonlyBox` will take, held while its text is not yet made: an empty box in a fine
 * outline, half as tall as the box of `rows` lines will be, and beneath it the row its buttons
 * will sit in, holding `actions` (the button that makes the text) in their place.
 */
export function ReadonlyBoxStandIn({ rows = 8, dense = false, actions }: Readonly<ReadonlyBoxStandInProps>) {
  return (
    <>
      <Box sx={{ mt: 1, height: boxHeightPx(rows, dense) / 2, border: 1, borderColor: 'divider', borderRadius: 'var(--radius-input)' }} />
      <div className={styles.panelRow}>{actions}</div>
    </>
  )
}
