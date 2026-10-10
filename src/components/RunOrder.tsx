'use client'

import { Box, Divider, Stack } from '@mui/material'
import { SortableList } from './SortableList'
import { TierChip, WidgetingTitle } from './WidgetingPanel'
import { RowSlots } from './room'
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
 * so run first wherever they are, never dragged; below them, ruled off when there are both, the
 * rest, dragged into a new order by their handles, or stepped by the arrow keys. Each reads what
 * those above it came to. A drop is sent as `move_widgeting`, counted in the quiz's whole run
 * order (`runOrderIdxOf`).
 */
export function RunOrderList({ quiz, library, revisable, dispatch, rowOf }: Readonly<RunOrderListProps>) {
  const { entries, rest, isEntry } = runOrderListsOf(quiz.widgetings, library)
  return (
    // Its rows' slots are measured against the list's own width (`RowSlots`).
    <Stack spacing={1} sx={{ containerType: 'inline-size' }}>
      {entries.length === 0 ? null : (
        <div role="list" aria-label="Entries">
          {entries.map((widgeting) => (
            <Box key={widgeting.label} role="listitem" sx={{ py: 0.5 }}>
              {rowOf(widgeting, <Box component="span" className={styles.grip} sx={{ visibility: 'hidden' }} aria-hidden>⠿</Box>)}
            </Box>
          ))}
        </div>
      )}
      {entries.length > 0 && rest.length > 0 && <Divider />}
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
 * its handle, its title block (`WidgetingTitle`: the mark of what it is, its label, and the widget
 * it works), its tier, and its description (the widgeting's own, or failing that its widget's)
 * cut to the line, each in a slot as wide on every line (`RowSlots`). It is edited in the *Widgets* panel below the grid,
 * or beneath a column showing it.
 */
export function RunOrderLine({ widgeting, widget, handle }: Readonly<RunOrderLineProps>) {
  const description = widgeting.description || (widget?.description ?? '')
  return (
    <Stack direction="row" spacing={1} role="group" aria-label={`Widgeting ${widgeting.label}`} sx={{ alignItems: 'flex-start' }}>
      <Box sx={RowSlots.grip}>{handle}</Box>
      <WidgetingTitle widgeting={widgeting} widget={widget} />
      <Box sx={RowSlots.tier}><TierChip tier={widgeting.tier} /></Box>
      <Box className={styles.microcopy} sx={{ pt: 1, flex: 1, minWidth: 0, maxWidth: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {description}
      </Box>
    </Stack>
  )
}
