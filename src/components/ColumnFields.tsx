'use client'

import { useState } from 'react'
import { Autocomplete, Box, FormControlLabel, ListSubheader, MenuItem, Stack, Switch, TextField, type SxProps, type Theme } from '@mui/material'
import { ConfirmRemove } from './ConfirmRemove'
import { ExplicitField } from './ExplicitField'
import { FormulaField } from './FormulaField'
import { TemplateField } from './TemplateField'
import { NumberField } from './cells/fields'
import { useDraft } from './use-draft'
import * as ColumnMenu from '../lib/column-menu'
import * as Labelmaker from '../lib/labelmaker'
import { isDrawnByEditor, resolve } from '../lib/columns'
import { ColumnReadoutVals, ColumnValidators, WidthPxMax, plainOf, retitledPatch, type ColumnNamer, type ColumnPatch, type ColumnReadout, type ColumnT } from '../models/column'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import type { HuntActionDNA } from '../models/actions'
import styles from './workbench.module.css'

/**
 * A column's fields, one component each, every one committing on its own as it is made (a pick
 * at once, a typed field as it is left) and saying in its own sentence what will not do. They
 * know nothing of the form they sit in: the columns editor's panels lay them out, and a
 * widgeting's panel lists the columns showing it with the same fields.
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

export type RefPickerProps = {
  /** Every ref the quiz offers (`ColumnMenu.refChoicesOf`) */
  choices: readonly ColumnMenu.RefChoice[]
  /** What the picker is called */
  label:   string
  /** Told the ref picked */
  onPick:  (source: string) => void
}

/**
 * A ref to pick for a column not made yet: the same menu as `ColumnRefField`, grouped, opened as it
 * appears and found by typing, a pick told at once.
 */
export function RefPicker({ choices, label, onPick }: Readonly<RefPickerProps>) {
  return (
    <Autocomplete
      options={choices}
      value={null}
      autoHighlight
      openOnFocus
      groupBy={(each) => each.group}
      getOptionLabel={(each) => each.source}
      isOptionEqualToValue={(each, picked) => each.source === picked.source}
      onChange={(_event, picked) => { if (picked) { onPick(picked.source) } }}
      renderOption={({ key, ...props }, each) => <Box component="li" key={key} {...props}>{`${each.source} — ${each.group}`}</Box>}
      renderInput={(params) => <TextField {...params} autoFocus size="small" label={label} helperText="Pick what it shows: it is made at once, its title and label after it." />}
      sx={{ flex: 1, maxWidth: 420 }}
    />
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

/** A column's commit: the patch held to the column's validator, and the sentence when it will not do */
export type ColumnCommit = {
  /** Sends the patch, or says what is wrong with it */
  commit: (patch: ColumnPatch) => void
  /** What was wrong with the last patch, or null */
  issue:  string | null
}

/**
 * How one column's fields commit: each patch held to the column's validator and sent as
 * `edit_column` at once, or its sentence kept for the view to say beside the fields. A column
 * still headed after what it shows is headed after what it shows next (`retitledPatch`).
 *
 * @param column - The column the fields change.
 * @param dispatch - Carries out the edit.
 * @param named - How a column is named for what it shows (`ColumnMenu.namerOf`), so a header follows a preset's own names.
 * @returns The commit, and the last sentence.
 */
export function useColumnCommit(column: ColumnT, dispatch: (action: HuntActionDNA) => void, named: ColumnNamer): ColumnCommit {
  const [issue, setIssue] = useState<string | null>(null)
  const commit = (patch: ColumnPatch) => {
    const checked = ColumnValidators.columnPatch.safeParse(retitledPatch(column, patch, named))
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That will not do.'); return }
    setIssue(null)
    dispatch({ kind: 'edit_column', label: column.label, patch: checked.data })
  }
  return { commit, issue }
}

/** A container-query width, in MUI's shorthand (`'@620'`) */
type Room = `@${string}`

export type ColumnMoreFieldsProps = ColumnFieldProps & {
  quiz:     Pick<QuizT, 'columns' | 'widgetings'>
  /** The library, which says what a widgeting shown is, for the formulas offered beside it */
  library:  readonly WidgetT[]
  /** What the column could show instead */
  sources:  readonly ColumnMenu.RefChoice[]
  /**
   * Where the fields sit beneath the column's own row, how wide that row must be to show what it
   * shows and its width, so that these show them only while the row does not; absent, the fields
   * stand alone and show the column's title, what it shows and its width themselves.
   */
  beside?:  { source: Room, width: Room }
  /** Told the column's new label, once it has been sent */
  onRelabel: (label: string) => void
  onRemove:  () => void
}

/**
 * Everything of a column beyond the one row the columns editor gives it: its label, which waits
 * on its own *Relabel* button since sorts and exports name it; what it does with what it shows
 * (`ColumnStagesFields`); and its removal, asked first. Standing alone, as a widgeting's panel
 * lists the columns showing it, the title, what it shows and its width come first; beneath the
 * row, those of them the row has no room for. Every field commits as it is made.
 */
export function ColumnMoreFields({ column, quiz, library, sources, locked, beside, onCommit, onRelabel, onRemove }: Readonly<ColumnMoreFieldsProps>) {
  const columnName = column.title || column.label
  const siblings = new Set(quiz.columns.filter((other) => other.label !== column.label).map((other) => other.label))
  const relabel = (label: string): string | null => {
    if (label === '') { return 'Enter a label.' }
    if (siblings.has(label)) { return 'Another column in this quiz already has that label.' }
    const checked = ColumnValidators.columnPatch.safeParse({ label })
    if (! checked.success) { return checked.error.issues[0]?.message ?? 'That label will not do.' }
    onCommit({ label })
    onRelabel(label)
    return null
  }
  const shownUntil = (room: Room | undefined) => (room === undefined ? {} : { display: { '@': 'block', [room]: 'none' } })
  return (
    <Stack spacing={1.5}>
      {beside === undefined && <ColumnTitleField column={column} locked={locked} onCommit={onCommit} />}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
        <Box sx={{ ...shownUntil(beside?.source), width: 240 }}>
          <ColumnRefField source={plainOf(column).source} choices={sources} locked={locked} onPick={(source) => { onCommit({ source }) }} />
        </Box>
        <Box sx={{ ...shownUntil(beside?.width), width: 96 }}>
          <ColumnWidthField column={column} locked={locked} onCommit={onCommit} />
        </Box>
      </Stack>
      <ExplicitField
        label="Column label" committed={column.label} act="Relabel" actLabel={`Relabel column ${columnName}`} disabled={locked} tidy={Labelmaker.normalize}
        helperText="Names it in exports and in the quiz's sort memory." onCommit={relabel}
      />
      <ColumnStagesFields column={column} quiz={quiz} library={library} locked={locked} onCommit={onCommit} />
      {locked ? null : <Box><ConfirmRemove noun="column" question="Remove this column from the quiz? What it showed is kept." onConfirm={onRemove} /></Box>}
    </Stack>
  )
}

/** A column's title, the header the grid shows, kept as the box is left */
export function ColumnTitleField({ column, locked, onCommit, sx }: Readonly<ColumnFieldProps & { sx?: SxProps<Theme> }>) {
  const { draft, onChange, onBlur } = useDraft(column.title, (title) => { onCommit({ title }) })
  return (
    <TextField
      size="small" label="Column title" value={draft} disabled={locked} sx={sx}
      onChange={(event) => { onChange(event.target.value) }} onBlur={onBlur}
    />
  )
}

/** A column's width in pixels, kept as the box is left */
export function ColumnWidthField({ column, locked, onCommit }: Readonly<ColumnFieldProps>) {
  return (
    <NumberField
      label="Width (px)" locked={locked} fractional={false} max={WidthPxMax} committed={column.width_px}
      onCommit={(width_px) => { if (width_px !== null) { onCommit({ width_px }) } }}
    />
  )
}

/** A column's last sentence, said beneath its fields */
export function ColumnIssue({ issue }: Readonly<{ issue: string | null }>) {
  return issue === null ? null : <p className={styles.microcopy} role="alert">{issue}</p>
}
