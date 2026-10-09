'use client'

import { useState } from 'react'
import { Box, Button, Stack } from '@mui/material'
import { NewWidgetingPicker } from './NewWidgeting'
import { SortableList } from './SortableList'
import { WidgetingPanel, type WidgetingPanelContext } from './WidgetingPanel'
import { LayoutFoldkeys } from './layout-folds'
import * as ColumnMenu from '../lib/column-menu'
import { runOrderIdxOf } from '../lib/widgeting-edit'
import type { WidgetingT, WidgetingTier } from '../models/widgeting'
import styles from './workbench.module.css'

export type WidgetingsEditorProps = Omit<WidgetingPanelContext, 'sources'> & {
  onEditLibrary: () => void
}

/** What the picker putting a widget to work is called, at each tier */
const NewLabels: Readonly<Record<WidgetingTier, string>> = {
  question: 'A new widgeting, for each question',
  quiz:     'A new widgeting, for the whole quiz',
}

/**
 * A quiz's widgetings -- the widgets of the library it puts to work -- listed in run order, both
 * tiers in one list, each a panel (`WidgetingPanel`) marked with its tier and folded to its line:
 * the entries at its head, which run first wherever they are and so are never dragged; below them
 * the rest, dragged into a new order by their handles. Each reads what those above it came to,
 * whichever tier. Beneath, the catalogue to put another to work for each question (with its
 * column) or once for the whole quiz, made as it is picked.
 */
export function WidgetingsEditor({ onEditLibrary, ...props }: Readonly<WidgetingsEditorProps>) {
  const { quiz, library, revisable, dispatch } = props
  const context = { ...props, sources: ColumnMenu.refChoicesOf(quiz) }
  const [adding, setAdding] = useState<WidgetingTier | null>(null)
  const isEntry = (widgeting: WidgetingT) => library.find((each) => each.label === widgeting.widget_label)?.formulary === 'entry'
  const entries = quiz.widgetings.filter((widgeting) => isEntry(widgeting))
  const rest = quiz.widgetings.filter((widgeting) => ! isEntry(widgeting))
  const panelOf = (widgeting: WidgetingT, handle: React.ReactNode) => (
    <WidgetingPanel widgeting={widgeting} handle={handle} tierMark foldkeyOf={LayoutFoldkeys.widgeting} {...context} />
  )

  return (
    <Stack spacing={1}>
      {quiz.widgetings.length === 0 && <p className={styles.microcopy}>This quiz puts no widgets to work yet.</p>}
      {entries.length === 0 ? null : (
        <div role="list" aria-label="Entries">
          {entries.map((widgeting) => (
            <Box key={widgeting.label} role="listitem" sx={{ py: 0.5 }}>
              {panelOf(widgeting, <Box component="span" className={styles.grip} sx={{ visibility: 'hidden' }} aria-hidden>⠿</Box>)}
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
        renderRow={panelOf}
      />
      {adding !== null && <NewWidgetingPicker key={adding} tier={adding} entriesOnly={false} label={NewLabels[adding]} {...props} onDone={() => { setAdding(null) }} />}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button size="small" variant="outlined" disabled={! revisable} onClick={() => { setAdding('question') }}>+ New widgeting…</Button>
        <Button size="small" variant="outlined" disabled={! revisable} onClick={() => { setAdding('quiz') }}>+ New quiz widgeting…</Button>
        <Button size="small" variant="outlined" onClick={onEditLibrary}>Widget library…</Button>
      </Stack>
    </Stack>
  )
}
