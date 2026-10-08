'use client'

import { useId, useState } from 'react'
import { Box, Button, Collapse, IconButton, Menu, MenuItem, Stack, Tooltip } from '@mui/material'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import { ColumnIssue, ColumnMoreFields, ColumnRefField, ColumnTitleField, ColumnWidthField, RefPicker, useColumnCommit } from './ColumnFields'
import { FoldButton } from './FoldButton'
import { NewWidgetDoor, NewWidgetingPicker } from './NewWidgeting'
import { SortableList } from './SortableList'
import { WidgetingPanel, type WidgetingPanelContext } from './WidgetingPanel'
import { LayoutFoldkeys, madeFoldkeys } from './layout-folds'
import { hiddenUntil } from './room'
import * as ColumnMenu from '../lib/column-menu'
import { alignAfter, headAlignOf, resolve } from '../lib/columns'
import { newColumnShowing } from '../lib/widgeting-edit'
import { plainOf, type ColumnAlign, type ColumnT } from '../models/column'
import styles from './workbench.module.css'

export type ColumnsEditorProps = Omit<WidgetingPanelContext, 'sources'>

/** How a new column is being added: showing something the quiz has, as a new entry, or as a new widget */
type Adding = 'ref' | 'entry' | 'widget' | null

/** The familiar mark of each alignment, from a word processor's toolbar */
const AlignIcons: Readonly<Record<ColumnAlign, React.ReactNode>> = {
  left:   <FormatAlignLeftIcon fontSize="small" />,
  center: <FormatAlignCenterIcon fontSize="small" />,
  right:  <FormatAlignRightIcon fontSize="small" />,
}

/**
 * How wide the columns list must be for a column's row to show each of its lesser fields, as MUI's
 * container-query shorthand. The label goes first as it narrows, then what the column shows, then
 * its width, each moving into the column's panel; the title and the alignment always stay.
 */
const RoomFor = { label: '@800', source: '@620', width: '@400' } as const

/**
 * A quiz's columns, leading: every one listed in the order the grid shows them, dragged into a
 * new order by its handle, each a panel (`ColumnPanel`) whose row holds its title, what it shows,
 * its width and its alignment, unfolding to the rest of it; beneath it, the panel of the widgeting
 * it shows, folded to that widgeting's line. *+ New column…* adds one showing something the quiz
 * has, or a new entry to type into, or (for whoever may change the library) a new widget, each at
 * once. The list measures its own width, not the window's, to decide what its rows have room for.
 */
export function ColumnsEditor(props: Readonly<ColumnsEditorProps>) {
  const { quiz, revisable, changeable, dispatch, folds } = props
  const sources = ColumnMenu.refChoicesOf(quiz)
  const context = { ...props, sources }
  const [adding, setAdding] = useState<Adding>(null)
  const [menuAt, setMenuAt] = useState<HTMLElement | null>(null)
  const [issue, setIssue] = useState<string | null>(null)
  const startAdding = (next: Adding) => { setMenuAt(null); setIssue(null); setAdding(next) }
  const done = () => { setAdding(null) }

  return (
    <Stack spacing={1} sx={{ containerType: 'inline-size' }}>
      {quiz.columns.length === 0 && <p className={styles.microcopy}>This quiz shows no columns.</p>}
      <SortableList
        label="Columns"
        items={quiz.columns}
        keyOf={(column) => column.label}
        disabled={! revisable}
        onMove={(label, onto_idx) => { dispatch({ kind: 'move_column', label, onto_idx }) }}
        renderRow={(column, handle) => <ColumnPanel column={column} handle={handle} {...context} />}
      />
      {adding === 'ref' && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          <RefPicker
            choices={sources} label="The new column shows"
            onPick={(source) => {
              const action = newColumnShowing(quiz, source)
              dispatch(action)
              for (const foldkey of madeFoldkeys([action])) { folds.setOpen(foldkey, true) }
              done()
            }}
          />
          <Button size="small" sx={{ mt: 0.5 }} onClick={done}>Cancel</Button>
        </Stack>
      )}
      {adding === 'entry' && <NewWidgetingPicker tier="question" entriesOnly label="A new entry" {...props} onDone={done} />}
      {adding === 'widget' && <NewWidgetDoor tier="question" {...props} onClose={done} onPut={setIssue} />}
      {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
      <Stack direction="row">
        <Button size="small" variant="outlined" disabled={! revisable} aria-haspopup="menu" onClick={(event) => { setMenuAt(event.currentTarget) }}>+ New column…</Button>
        <Menu anchorEl={menuAt} open={menuAt !== null} onClose={() => { setMenuAt(null) }}>
          <MenuItem onClick={() => { startAdding('ref') }}>Showing something the quiz has…</MenuItem>
          <MenuItem onClick={() => { startAdding('entry') }}>A new entry…</MenuItem>
          {changeable && <MenuItem onClick={() => { startAdding('widget') }}>A new widget…</MenuItem>}
        </Menu>
      </Stack>
    </Stack>
  )
}

type ColumnPanelProps = WidgetingPanelContext & {
  column: ColumnT
  handle: React.ReactNode
}

/**
 * One column, as a panel: its row -- its handle, its title to type into, what it shows to pick,
 * its width, its alignment and its label, the lesser of them giving way as the list narrows
 * (`RoomFor`) -- unfolding to the rest of it (`ColumnMoreFields`): its label to relabel, its
 * formula, template, readout and collapse, and its removal. Beneath, the panel of the widgeting it
 * shows, if it shows one, folded to that widgeting's line. A title, width, formula or template is
 * kept when its field loses focus, a pick or a click at once.
 */
function ColumnPanel({ column, handle, ...context }: Readonly<ColumnPanelProps>) {
  const { quiz, library, sources, revisable, dispatch, folds } = context
  const { commit, issue } = useColumnCommit(column, dispatch)
  const restId = useId()
  const foldkey = LayoutFoldkeys.column(column.label)
  const columnName = column.title || column.label
  const locked = ! revisable
  const shown = resolve(plainOf(column).source, quiz.widgetings)
  const widgeting = shown?.kind === 'widgeting' ? shown.widgeting : null
  const onRelabel = (label: string) => {
    folds.setOpen(LayoutFoldkeys.column(label), true)
    if (folds.isOpen(LayoutFoldkeys.beneath(column.label))) { folds.setOpen(LayoutFoldkeys.beneath(label), true) }
  }

  return (
    <Stack spacing={0.5} role="group" aria-label={`Column ${columnName}`}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ pt: 1 }}>{handle}</Box>
        <Box sx={{ pt: 0.5 }}>
          <FoldButton open={folds.isOpen(foldkey)} onOpenChange={(next) => { folds.setOpen(foldkey, next) }} label={`Column ${columnName} in full`} controls={restId} />
        </Box>
        <ColumnTitleField column={column} locked={locked} onCommit={commit} sx={{ flex: 1, minWidth: 140 }} />
        <ColumnRefField
          source={plainOf(column).source} choices={sources} locked={locked} sx={{ ...hiddenUntil(RoomFor.source), width: 240, flexShrink: 0 }}
          onPick={(source) => { commit({ source }) }}
        />
        <Box sx={{ ...hiddenUntil(RoomFor.width), width: 96, flexShrink: 0 }}>
          <ColumnWidthField column={column} locked={locked} onCommit={commit} />
        </Box>
        <AlignButton column={column} columnName={columnName} locked={locked} onAlign={(align) => { commit({ align }) }} />
        <Box className={styles.microcopy} sx={{ ...hiddenUntil(RoomFor.label), width: 160, flexShrink: 0, pt: 1, overflowWrap: 'anywhere' }}>{column.label}</Box>
      </Stack>
      <Collapse in={folds.isOpen(foldkey)} unmountOnExit id={restId}>
        <Box sx={{ pl: 8, pt: 1, pb: 1 }}>
          <ColumnMoreFields
            column={column} quiz={quiz} library={library} sources={sources} locked={locked} beside={RoomFor} onCommit={commit}
            onRelabel={onRelabel} onRemove={() => { dispatch({ kind: 'delete_column', label: column.label }) }}
          />
        </Box>
      </Collapse>
      <ColumnIssue issue={issue} />
      {widgeting && (
        <Box sx={{ pl: 4, pb: 1 }}>
          <WidgetingPanel widgeting={widgeting} beneath={column} foldkeyOf={() => LayoutFoldkeys.beneath(column.label)} {...context} />
        </Box>
      )}
    </Stack>
  )
}

type AlignButtonProps = {
  column:     ColumnT
  /** What the column is called on screen */
  columnName: string
  locked:     boolean
  /** Told the alignment a click moves the column to */
  onAlign:    (align: ColumnAlign) => void
}

/**
 * A column's alignment, as the mark of where its header sits; a click moves it on to the next:
 * left, center, right, and round again. A column that has never been set shows where it sits
 * unset (`headAlignOf`), and says so.
 */
function AlignButton({ column, columnName, locked, onAlign }: Readonly<AlignButtonProps>) {
  const align = headAlignOf(column)
  const next = alignAfter(align)
  const unset = column.align === undefined ? ', as it sits unset' : ''
  return (
    <Tooltip title={`Aligned ${align}${unset}. Click to align ${next}.`}>
      {/* The span lets the tooltip hear the pointer while the button is disabled. */}
      <span>
        <IconButton size="small" aria-label={`Alignment of ${columnName}: ${align}`} disabled={locked} sx={{ mt: 0.5 }} onClick={() => { onAlign(next) }}>
          {AlignIcons[align]}
        </IconButton>
      </span>
    </Tooltip>
  )
}
