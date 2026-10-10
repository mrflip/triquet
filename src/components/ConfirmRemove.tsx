'use client'

import { useId, useState } from 'react'
import { Box, Button, IconButton, Popover, Stack, Tooltip } from '@mui/material'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import styles from './workbench.module.css'

export type ConfirmRemoveProps = {
  /** What is being removed, naming the button with `act`: "column" makes *Remove column* */
  noun:      string
  /** What removing it is called, on the button and its yes: *Delete* for what goes for good */
  act?:      'Remove' | 'Delete'
  /** Asked beneath the yes and the no, to make clear what is lost and what is kept */
  question:  string
  /** When the thing cannot be removed, why: said in place of the text button, or as the bin's tip */
  refusal?:  string | null
  /** `text`, a small text button, for the foot of a form; `icon`, a bin, small enough for a dense row */
  form?:     'text' | 'icon'
  /** Whether it is offered but not to be pressed, as for whoever may not change the thing */
  disabled?: boolean
  /** Called only on the yes */
  onConfirm: () => void
}

/**
 * A remove button that asks first: pressing it turns it, in its own place, into the question, with
 * *Keep it* where the button was and *Yes, remove* beside it. Keep, Escape or a click anywhere
 * else leaves the thing as it was. The text form and the icon form ask in the same way, at the
 * same size, so every remove on the screen reads alike.
 *
 * @param noun - Names the thing, on the button: `Remove ${noun}`.
 * @param act - *Remove*, or *Delete* for what goes for good.
 * @param question - What it asks.
 * @param refusal - Why it cannot be removed, when it cannot.
 * @param form - A text button, or a bin.
 * @param onConfirm - Called only on the yes.
 *
 * @example <ConfirmRemove noun="column" question="Remove this column from the quiz? What it showed is kept." onConfirm={remove} />
 * @example <ConfirmRemove form="icon" act="Delete" noun="Pluto" question="Delete “Pluto” for good?" onConfirm={remove} />
 */
export function ConfirmRemove({ noun, act = 'Remove', question, refusal = null, form = 'text', disabled = false, onConfirm }: Readonly<ConfirmRemoveProps>) {
  const [asking, setAsking] = useState<HTMLElement | null>(null)
  const questionId = useId()
  const actname = `${act} ${noun}`
  const keep = () => { setAsking(null) }
  const confirm = () => { setAsking(null); onConfirm() }
  return (
    <>
      <RemoveDoor actname={actname} refusal={refusal} form={form} disabled={disabled} onAsk={setAsking} />
      <Popover
        open={asking !== null}
        anchorEl={asking}
        onClose={keep}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { role: 'alertdialog', 'aria-label': `${actname}?`, 'aria-describedby': questionId, sx: { mt: -1, ml: -1 } } }}
      >
        <Stack spacing={1} sx={{ p: 1, maxWidth: 360 }}>
          <Stack direction="row" spacing={1}>
            <Button size="small" autoFocus onClick={keep}>Keep it</Button>
            <Button size="small" color="error" variant="contained" onClick={confirm}>Yes, {act.toLowerCase()}</Button>
          </Stack>
          <Box component="span" id={questionId} className={styles.microcopy}>{question}</Box>
        </Stack>
      </Popover>
    </>
  )
}

type RemoveDoorProps = {
  /** The button's name: the act and the noun */
  actname:  string
  refusal:  string | null
  form:     'text' | 'icon'
  disabled: boolean
  /** Told the button pressed, which the question is asked over */
  onAsk:    (door: HTMLElement) => void
}

/** The button a removal is asked from: a small text button or a bin, or, refused, why not */
function RemoveDoor({ actname, refusal, form, disabled, onAsk }: Readonly<RemoveDoorProps>) {
  if (form === 'text') {
    if (refusal !== null) { return <span className={styles.microcopy}>{refusal}</span> }
    return <Button size="small" color="error" disabled={disabled} onClick={(event) => { onAsk(event.currentTarget) }}>{actname}</Button>
  }
  return (
    <Tooltip title={refusal ?? actname}>
      {/* The span lets the tooltip hear the pointer while the button is disabled. */}
      <span>
        <IconButton size="small" color="error" aria-label={actname} disabled={disabled || refusal !== null} onClick={(event) => { onAsk(event.currentTarget) }}>
          <DeleteOutlinedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  )
}
