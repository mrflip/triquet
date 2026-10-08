'use client'

import { FormControlLabel, ListSubheader, MenuItem, Stack, Switch, TextField, type SxProps, type Theme } from '@mui/material'
import { FormulaField } from './FormulaField'
import { TemplateField } from './TemplateField'
import * as ColumnMenu from '../lib/column-menu'
import { isDrawnByEditor, resolve } from '../lib/columns'
import { ColumnReadoutVals, plainOf, type ColumnPatch, type ColumnReadout, type ColumnT } from '../models/column'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'

/**
 * A column's fields, one component each, every one committing on its own as it is made (a pick
 * at once, a typed field as it is left) and saying in its own sentence what will not do. They
 * know nothing of the form they sit in: the columns editor's row lays them out today.
 */

/** What a column's field changes, and how */
export type ColumnFieldProps = {
  column:   ColumnT
  locked:   boolean
  /** Told the change, as a patch of the column */
  onCommit: (patch: ColumnPatch) => void
}

/** What the source menu says the group of a ref the quiz no longer offers is */
const UnofferedGroup = 'As it is'

export type ColumnRefFieldProps = {
  /** The ref picked now */
  source:   string
  /** Every ref the quiz offers (`ColumnMenu.refChoicesOf`) */
  choices:  readonly ColumnMenu.RefChoice[]
  locked:   boolean
  /** Told the ref picked */
  onPick:   (source: string) => void
  sx?:      SxProps<Theme>
}

/**
 * What a column shows, its ref, picked from one menu over the bag's words, grouped: the
 * question's fields, its view, its keys, the widgetings, the widgetings for the whole quiz, and
 * the words the same in every row. A ref the quiz no longer offers is kept on the list, as it is.
 */
export function ColumnRefField({ source, choices, locked, onPick, sx }: Readonly<ColumnRefFieldProps>) {
  const listed = choices.some((each) => each.source === source) ? choices : [...choices, { source, group: UnofferedGroup }]
  const groups = [...new Set(listed.map((each) => each.group))]
  return (
    <TextField
      select fullWidth size="small" label="Shows" value={source} disabled={locked} sx={sx}
      slotProps={{ select: { renderValue: String } }}
      onChange={(event) => { onPick(event.target.value) }}
    >
      {groups.flatMap((group) => [
        <ListSubheader key={`group:${group}`}>{group}</ListSubheader>,
        ...listed.filter((each) => each.group === group).map((each) => <MenuItem key={each.source} value={each.source}>{`${each.source} — ${each.group}`}</MenuItem>),
      ])}
    </TextField>
  )
}

/** A column's formula: a field name or part offered where what it shows has a known shape, else typed */
export function ColumnFormulaField({ column, presets, locked, onCommit }: Readonly<ColumnFieldProps & { presets: readonly ColumnMenu.FormulaPreset[] }>) {
  return (
    <FormulaField
      label="Formula" committed={plainOf(column).formula ?? null} presets={presets} locked={locked}
      placeholder="The thing itself"
      helperText={presets.length > 0 ? 'Pick what to show of it, or work something out of it ($) in JSONata.' : 'JSONata over what it shows ($). Blank shows it as it is.'}
      onCommit={(formula) => { onCommit({ formula }) }}
    />
  )
}

/** A column's template: Liquid making text of what the formula came to */
export function ColumnTemplateField({ column, locked, onCommit }: Readonly<ColumnFieldProps>) {
  return (
    <TemplateField
      label="Template" committed={column.template ?? null} locked={locked}
      placeholder="{{ value }}"
      helperText="Liquid over the question's template bag, what the formula came to as {{ value }}. Blank draws the value as it is."
      onCommit={(template) => { onCommit({ template }) }}
    />
  )
}

/** How each readout is named in the menu */
const ReadoutTitles: Readonly<Record<ColumnReadout, string>> = {
  plain:    'Plain text',
  markdown: 'Markdown',
  code:     'Code',
  label:    'As a label',
}

/** The menu's word for the readout a column names none of */
const DefaultReadout = 'default'

/**
 * How a column draws its text, or, picking none, as the cells choose (markdown, for a column with
 * a template). A column whose cells are typed into is drawn by their editor, which says so.
 */
export function ColumnReadoutField({ column, drawnByEditor, locked, onCommit }: Readonly<ColumnFieldProps & { drawnByEditor: boolean }>) {
  const unset = column.template === undefined ? 'As the cells choose' : 'Markdown, for a template'
  return (
    <TextField
      select size="small" label="Readout" value={column.readout ?? DefaultReadout} disabled={locked || drawnByEditor} sx={{ minWidth: 200 }}
      helperText={drawnByEditor ? 'Its cells are typed into, and drawn as their box draws them.' : undefined}
      onChange={(event) => { onCommit({ readout: event.target.value === DefaultReadout ? null : event.target.value as ColumnReadout }) }}
    >
      <MenuItem value={DefaultReadout}>{unset}</MenuItem>
      {ColumnReadoutVals.map((readout) => <MenuItem key={readout} value={readout}>{ReadoutTitles[readout]}</MenuItem>)}
    </TextField>
  )
}

/** Whether a column is collapsed to its turned header, as a double-click on its head toggles it */
export function ColumnCollapsedField({ column, locked, onCommit }: Readonly<ColumnFieldProps>) {
  return (
    <FormControlLabel
      label="Collapsed" disabled={locked}
      control={<Switch size="small" checked={column.collapsed ?? false} onChange={(event) => { onCommit({ collapsed: event.target.checked || null }) }} />}
    />
  )
}

export type ColumnStagesFieldsProps = ColumnFieldProps & {
  quiz:    Pick<QuizT, 'widgetings'>
  /** The library, which says what a widgeting shown is, for the formulas offered beside it */
  library: readonly WidgetT[]
}

/**
 * What a column does with what it shows, each stage committing on its own: the formula working a
 * value out of it, the template making text of the value, the readout drawing the text, and
 * whether it is collapsed.
 */
export function ColumnStagesFields({ column, quiz, library, locked, onCommit }: Readonly<ColumnStagesFieldsProps>) {
  const plain = plainOf(column)
  const shown = resolve(plain.source, quiz.widgetings)
  const subject = shown === null ? null : ColumnMenu.subjectOf(shown, library)
  const presets = subject === null ? [] : ColumnMenu.presetsFor(subject)
  const drawnByEditor = subject !== null && isDrawnByEditor({ source: subject.shown, formula: plain.formula ?? null, template: column.template ?? null }, subject.widget)
  return (
    <Stack spacing={1.5}>
      <ColumnFormulaField column={column} presets={presets} locked={locked} onCommit={onCommit} />
      <ColumnTemplateField column={column} locked={locked} onCommit={onCommit} />
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <ColumnReadoutField column={column} drawnByEditor={drawnByEditor} locked={locked} onCommit={onCommit} />
        <ColumnCollapsedField column={column} locked={locked} onCommit={onCommit} />
      </Stack>
    </Stack>
  )
}
