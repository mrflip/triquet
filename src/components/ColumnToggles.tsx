'use client'

import { Box, IconButton, Stack, Tooltip } from '@mui/material'
import AbcIcon from '@mui/icons-material/Abc'
import CodeIcon from '@mui/icons-material/Code'
import DataObjectIcon from '@mui/icons-material/DataObject'
import HdrAutoOutlinedIcon from '@mui/icons-material/HdrAutoOutlined'
import HistoryEduIcon from '@mui/icons-material/HistoryEdu'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import TextRotateVerticalIcon from '@mui/icons-material/TextRotateVertical'
import type { ColumnStagesT, ColumnTemplating } from './ColumnFields'
import { readoutAfter } from '../lib/columns'
import type { ColumnPatch, ColumnReadout, ColumnT } from '../models/column'

/** How wide one of a column's toggles is, in pixels: a small icon button's footprint */
const ToggleWidthPx = 34

/** How wide a column's row holds its toggles, in pixels, so that the row's last part stays put whether they show or not */
export const ColumnTogglesWidthPx = 3 * ToggleWidthPx

/** The mark of each readout, and what it is called: a column naming none is drawn as its cells choose */
const ReadoutFaces: Readonly<Record<ColumnReadout | 'unset', { Icon: typeof AbcIcon, title: string }>> = {
  unset:    { Icon: HdrAutoOutlinedIcon, title: 'as the cells choose' },
  plain:    { Icon: AbcIcon,             title: 'plain text' },
  markdown: { Icon: HistoryEduIcon,      title: 'markdown' },
  code:     { Icon: CodeIcon,            title: 'code' },
  label:    { Icon: SellOutlinedIcon,    title: 'a label' },
}

export type ColumnTogglesProps = {
  column:     ColumnT
  /** What the column is called on screen */
  columnName: string
  /** What its stages are offered (`columnStagesOf`): whether its editor draws its cells, whatever its readout */
  stages:     ColumnStagesT
  /** Whether what it shows is templated; null where it cannot be, which leaves a blank in the toggle's place */
  templating: ColumnTemplating | null
  locked:     boolean
  /** Told the change, as a patch of the column */
  onCommit:   (patch: ColumnPatch) => void
}

/**
 * A folded column's toggles, each its state in place, set by a click, for its row: its readout, a
 * mark stepping through as the cells choose, plain text, markdown, code and a label
 * (`readoutAfter`); whether what it shows is templated, where it can be; and whether it is
 * collapsed to its turned header. Each says in its tooltip what it is and what a click makes it.
 * Unfolded, the column's fold holds the full controls for the same, and these leave the row.
 */
export function ColumnToggles({ column, columnName, stages, templating, locked, onCommit }: Readonly<ColumnTogglesProps>) {
  return (
    <Stack direction="row" sx={{ width: ColumnTogglesWidthPx, flexShrink: 0, pt: 0.5 }}>
      <ReadoutToggle column={column} columnName={columnName} drawnByEditor={stages.drawnByEditor} locked={locked} onCommit={onCommit} />
      {templating === null ? <Box sx={{ width: ToggleWidthPx }} /> : (
        <Toggle
          label={`Templated: ${columnName}`} pressed={templating.templated} locked={locked}
          tip={templating.templated ? 'Templated: its text is filled in as a Liquid template. Click to take it as typed.' : 'Taken as typed. Click to fill its text in as a Liquid template.'}
          onClick={() => { templating.onTemplated(! templating.templated) }}
        >
          <DataObjectIcon fontSize="small" />
        </Toggle>
      )}
      <Toggle
        label={`Collapsed: ${columnName}`} pressed={column.collapsed ?? false} locked={locked}
        tip={column.collapsed ? 'Collapsed to its turned header. Click to open it out.' : 'Open. Click to collapse it to its turned header.'}
        onClick={() => { onCommit({ collapsed: column.collapsed ? null : true }) }}
      >
        <TextRotateVerticalIcon fontSize="small" />
      </Toggle>
    </Stack>
  )
}

type ReadoutToggleProps = Pick<ColumnTogglesProps, 'column' | 'columnName' | 'locked' | 'onCommit'> & {
  drawnByEditor: boolean
}

/** A column's readout, as its mark; a click steps it to the next. Still while its editor draws its cells. */
function ReadoutToggle({ column, columnName, drawnByEditor, locked, onCommit }: Readonly<ReadoutToggleProps>) {
  const { Icon, title } = ReadoutFaces[column.readout ?? 'unset']
  const next = readoutAfter(column.readout)
  const tip = drawnByEditor
    ? 'Its cells are typed into, and drawn as their box draws them.'
    : `Drawn as ${title}. Click to draw it as ${ReadoutFaces[next ?? 'unset'].title}.`
  return (
    <Tooltip title={tip} describeChild>
      {/* The span lets the tooltip hear the pointer while the button is disabled. */}
      <span>
        <IconButton size="small" aria-label={`Readout of ${columnName}: ${title}`} disabled={locked || drawnByEditor} onClick={() => { onCommit({ readout: next }) }}>
          <Icon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  )
}

type ToggleProps = {
  /** Its name, the same whichever way it is set: `aria-pressed` says which */
  label:    string
  pressed:  boolean
  /** What it is set to, and what a click makes it */
  tip:      string
  locked:   boolean
  onClick:  () => void
  children: React.ReactNode
}

/** An icon button set on or off by a click, marked in the theme's colour while on */
function Toggle({ label, pressed, tip, locked, onClick, children }: Readonly<ToggleProps>) {
  return (
    <Tooltip title={tip} describeChild>
      {/* The span lets the tooltip hear the pointer while the button is disabled. */}
      <span>
        <IconButton size="small" aria-label={label} aria-pressed={pressed} color={pressed ? 'primary' : 'default'} disabled={locked} onClick={onClick} sx={pressed ? undefined : { opacity: 0.55 }}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}
