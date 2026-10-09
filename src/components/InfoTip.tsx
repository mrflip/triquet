'use client'

import { Box, IconButton, Stack, Tooltip } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

/** How long a tap keeps a tip showing on a touch screen, in milliseconds: long enough to read a paragraph */
const TouchShowMs = 20_000

export type InfoTipProps = {
  /** What it explains, naming its button to assistive technology as "About <topic>" */
  topic:    string
  /** The explanation: prose, which may hold emphasis, code and links */
  children: React.ReactNode
}

/**
 * The (i) beside a heading, a field or a control, holding the prose that explains it, so the
 * screen shows the thing and keeps the explaining one step away. The prose shows on hover, on
 * keyboard focus and on a tap, and stays while the pointer is over it, so a link in it can be
 * followed. One size, small enough for a dense row and level with a small text field's label.
 *
 * @param topic - What it explains: "the columns" names the button "About the columns".
 * @param children - The explanation.
 *
 * @example <InfoTip topic="the run order">Each widgeting reads what those above it came to.</InfoTip>
 */
export function InfoTip({ topic, children }: Readonly<InfoTipProps>) {
  return (
    <Tooltip
      title={children}
      enterTouchDelay={0}
      leaveTouchDelay={TouchShowMs}
      slotProps={{ tooltip: { sx: { maxWidth: 420, p: 1.25, fontSize: 13, lineHeight: 1.5, fontWeight: 400 } } }}
    >
      <IconButton size="small" aria-label={`About ${topic}`} sx={{ p: 0.25, color: 'text.secondary' }}>
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
}

export type ExplainedProps = {
  /** What the tip explains (`InfoTip`'s `topic`) */
  topic:    string
  /** The explanation */
  about:    React.ReactNode
  /** The field or control explained, which takes the row's width less the tip's */
  children: React.ReactNode
}

/**
 * A field or control with its `InfoTip` at the row's end, level with a small text field's box:
 * what a field's helper text would say when it explains rather than reports, so the field's own
 * helper text is left to what is wrong with it.
 *
 * @example <Explained topic="the formula" about="JSONata over what it shows ($)."><FormulaField ... /></Explained>
 */
export function Explained({ topic, about, children }: Readonly<ExplainedProps>) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <Stack sx={{ flex: 1, minWidth: 0 }}>{children}</Stack>
      <Box sx={{ pt: 1 }}><InfoTip topic={topic}>{about}</InfoTip></Box>
    </Stack>
  )
}
