'use client'

import { Box, Stack } from '@mui/material'
import { SortableList } from './SortableList'
import { TierChip, widgetingNote } from './WidgetingPanel'
import { runOrderIdxOf, runOrderListsOf } from '../lib/widgeting-edit'
import type { HuntActionDNA } from '../models/actions'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import type { WidgetingT } from '../models/widgeting'
import styles from './workbench.module.css'

export type RunOrderListProps = {
  quiz:      QuizT
  /** The library's widgets, which tell the entries from the rest */
  library:   readonly WidgetT[]
  /** Whether the run order may be changed: no row is dragged when not */
  revisable: boolean
  dispatch:  (action: HuntActionDNA) => void
  /** Draws one widgeting's row, given the handle to drag it by, or a blank in its place for an entry */
  rowOf:     (widgeting: WidgetingT, handle: React.ReactNode) => React.ReactNode
}

/**
 * A quiz's widgetings in run order, both tiers in one list, as the manage dialog's *Run order* and
 * the *Widgets* panel below the grid both show it: the entries at its head, which read nothing and
 * so run first wherever they are, never dragged; below them the rest, dragged into a new order by
 * their handles, or stepped by the arrow keys. Each reads what those above it came to. A drop is
 * sent as `move_widgeting`, counted in the quiz's whole run order (`runOrderIdxOf`).
 */
export function RunOrderList({ quiz, library, revisable, dispatch, rowOf }: Readonly<RunOrderListProps>) {
  const { entries, rest, isEntry } = runOrderListsOf(quiz.widgetings, library)
  return (
    <Stack spacing={1}>
      {entries.length === 0 ? null : (
        <div role="list" aria-label="Entries">
          {entries.map((widgeting) => (
            <Box key={widgeting.label} role="listitem" sx={{ py: 0.5 }}>
              {rowOf(widgeting, <Box component="span" className={styles.grip} sx={{ visibility: 'hidden' }} aria-hidden>⠿</Box>)}
            </Box>
          ))}
          <p className={styles.microcopy}>Entries are typed, and read nothing, so they run first, ahead of everything below.</p>
        </div>
      )}
      <SortableList
        label="Widgetings"
        items={rest}
        keyOf={(widgeting) => widgeting.label}
        disabled={! revisable}
        onMove={(label, onto_idx) => { dispatch({ kind: 'move_widgeting', label, onto_idx: runOrderIdxOf(quiz.widgetings, isEntry, label, onto_idx) }) }}
        renderRow={rowOf}
      />
    </Stack>
  )
}

export type RunOrderLineProps = {
  widgeting: WidgetingT
  /** The widget it works; null when the library no longer holds it */
  widget:    WidgetT | null
  handle:    React.ReactNode
}

/**
 * One widgeting as the manage dialog's run order lists it, a line to drag and nothing to edit:
 * its handle, its label, what it works, its tier, and its description (the widgeting's own, or
 * failing that its widget's) cut to the line. It is edited in the *Widgets* panel below the grid,
 * or beneath a column showing it.
 */
export function RunOrderLine({ widgeting, widget, handle }: Readonly<RunOrderLineProps>) {
  const description = widgeting.description || (widget?.description ?? '')
  return (
    <Stack direction="row" spacing={1} role="group" aria-label={`Widgeting ${widgeting.label}`} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ pt: 1 }}>{handle}</Box>
      <Box sx={{ pt: 1, width: 260, flexShrink: 0, overflowWrap: 'anywhere' }}>
        <strong>{widgeting.label}</strong> <span className={styles.microcopy}>{widgetingNote(widgeting, widget)}</span>
      </Box>
      <TierChip tier={widgeting.tier} />
      <Box className={styles.microcopy} sx={{ pt: 1, flex: 1, minWidth: 0, maxWidth: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {description}
      </Box>
    </Stack>
  )
}
