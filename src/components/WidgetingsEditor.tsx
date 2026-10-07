'use client'

import { useState } from 'react'
import { Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, Divider, IconButton, Stack, TextField, createFilterOptions } from '@mui/material'
import _ from 'es-toolkit/compat'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { ConfirmRemove } from './ConfirmRemove'
import { SortableList } from './SortableList'
import { WidgetEditor } from './WidgetEditor'
import { FormularyWords } from './widget-words'
import { planWidgetingEdit } from '../lib/widgeting-edit'
import { formularyFor } from '../lib/formulary/formularies'
import { FormularykindVals, Widget, type WidgetT } from '../models/widget'
import { Widgeting, type WidgetingT, type WidgetingTier } from '../models/widgeting'
import type { QuizT } from '../models/quiz'
import type { ShallowHuntT } from '../lib/rows'
import type { HuntActionDNA, LibraryActionDNA } from '../models/actions'
import styles from './workbench.module.css'

export type WidgetingsEditorProps = {
  hunt:          ShallowHuntT
  quiz:          QuizT
  /** The library's widgets, which the quiz's widgetings work */
  library:       readonly WidgetT[]
  /** Whether the quiz's widgetings may be changed here: listed as they are when not */
  revisable:     boolean
  /** Whether the library may be written to from here: no door to the widget editor when not */
  changeable:    boolean
  dispatch:      (action: HuntActionDNA) => void
  /** Carry out a change to the library, from the widget editor (`useLibraryActions`) */
  changeLibrary: (action: LibraryActionDNA) => void
  onEditLibrary: () => void
}

/** Which widgeting's editor is open: one of the quiz's, by its label, or a new one of a tier */
type Editing = { kind: 'widgeting', label: string } | { kind: 'new', tier: WidgetingTier } | null

/** How a widgeting's row marks its tier */
const TierMarks: Readonly<Record<WidgetingTier, string>> = {
  question: 'each question',
  quiz:     'whole quiz',
}

/**
 * A quiz's widgetings -- the widgets of the library it puts to work -- listed in run order, both
 * tiers in one list, each marked with its tier: dragged into a new order by their handles, each
 * with a gear that opens it in the widgeting editor, and a door to put another to work for each
 * question or once for the whole quiz. Each reads what those above it came to, whichever tier.
 */
export function WidgetingsEditor({ hunt, quiz, library, revisable, changeable, dispatch, changeLibrary, onEditLibrary }: Readonly<WidgetingsEditorProps>) {
  const [editing, setEditing] = useState<Editing>(null)
  const edited: WidgetingT | null = editing?.kind === 'widgeting' ? quiz.widgetings.find((each) => each.label === editing.label) ?? null : null
  // The tier of the widgeting whose editor is open, the one it runs at or the one a new one will; null when none is open.
  const editingTier: WidgetingTier | null = edited?.tier ?? (editing?.kind === 'new' ? editing.tier : null)
  const close = () => { setEditing(null) }

  return (
    <Stack spacing={1}>
      {quiz.widgetings.length === 0 && <p className={styles.microcopy}>This quiz puts no widgets to work yet.</p>}
      <SortableList
        label="Widgetings"
        items={quiz.widgetings}
        keyOf={(widgeting) => widgeting.label}
        disabled={! revisable}
        onMove={(label, onto_idx) => { dispatch({ kind: 'move_widgeting', label, onto_idx }) }}
        renderRow={(widgeting, handle) => (
          <Stack direction="row" spacing={1} role="group" aria-label={`Widgeting ${widgeting.label}`} sx={{ alignItems: 'center' }}>
            {handle}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <strong>{widgeting.label}</strong> <span className={styles.microcopy}>{widgetingNote(widgeting, library)}</span>
              {widgeting.description === '' ? null : <div className={styles.microcopy}>{widgeting.description}</div>}
            </Box>
            <Chip size="small" variant="outlined" label={TierMarks[widgeting.tier]} />
            <IconButton size="small" aria-label={`Edit widgeting ${widgeting.label}`} onClick={() => { setEditing({ kind: 'widgeting', label: widgeting.label }) }}>⚙</IconButton>
          </Stack>
        )}
      />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button size="small" variant="outlined" disabled={! revisable} onClick={() => { setEditing({ kind: 'new', tier: 'question' }) }}>+ New widgeting…</Button>
        <Button size="small" variant="outlined" disabled={! revisable} onClick={() => { setEditing({ kind: 'new', tier: 'quiz' }) }}>+ New quiz widgeting…</Button>
        <Button size="small" variant="outlined" onClick={onEditLibrary}>Widget library…</Button>
      </Stack>
      {editingTier !== null && (
        <WidgetingDialog key={edited?.label ?? `new ${editingTier}`} hunt={hunt} quiz={quiz} tier={editingTier} library={library} widgeting={edited} revisable={revisable} changeable={changeable} dispatch={dispatch} changeLibrary={changeLibrary} onClose={close} />
      )}
    </Stack>
  )
}

/** What the widgeting works, in a few words */
function widgetingNote(widgeting: WidgetingT, library: readonly WidgetT[]): string {
  const widget = library.find((each) => each.label === widgeting.widget_label)
  if (! widget) { return `works ${widgeting.widget_label}, which the library no longer holds` }
  return `${FormularyWords[widget.formulary].noun} ${widget.label}`
}

type WidgetingDialogProps = {
  hunt:      ShallowHuntT
  quiz:      QuizT
  /** Which level a new widgeting runs at */
  tier:      WidgetingTier
  library:   readonly WidgetT[]
  /** The widgeting being edited, or null to make a new one */
  widgeting: WidgetingT | null
  /** Whether the widgeting may be changed: shown as it is, with nothing to apply, when not */
  revisable:  boolean
  /** Whether the library may be written to: no door to the widget editor when not */
  changeable: boolean
  dispatch:  (action: HuntActionDNA) => void
  changeLibrary: (action: LibraryActionDNA) => void
  onClose:   () => void
}

/** What the widgeting editor is titled for a new widgeting of each tier */
const NewTitles: Readonly<Record<WidgetingTier, string>> = {
  question: 'New widgeting',
  quiz:     'New quiz widgeting',
}

/** What the widgeting editor says under its label, for a widgeting of each tier */
const LabelHelp: Readonly<Record<WidgetingTier, string>> = {
  question: "Names it within this quiz: its column, and what later widgets read it as. Blank takes the widget's.",
  quiz:     "Names it within this quiz: its line in the Quiz entries panel, and what later widgets and templates read it as, quiz.<label>. Blank takes the widget's.",
}

/** Which widget editor the widgeting editor has open over it: for a new widget, or for the one it works */
type WidgetEditing = 'new' | 'held' | null

/**
 * The widgeting editor: one widgeting of the quiz, as this quiz has it -- the widget it works,
 * picked from the library, and its own label and description. Its place in the run order is the
 * list's, dragged by its handle.
 *
 * The widget itself is the library's, so it is never edited here: a door opens the widget editor,
 * to write a new widget for this widgeting to work, or to revise the one it works, which changes
 * every quiz that works it. Nothing is applied until Apply. Removing a widgeting asks first; its
 * widget stays in the library.
 */
function WidgetingDialog({ hunt, quiz, tier, library, widgeting, revisable, changeable, dispatch, changeLibrary, onClose }: Readonly<WidgetingDialogProps>) {
  const [label, setLabel] = useState(widgeting?.label ?? '')
  const [description, setDescription] = useState(widgeting?.description ?? '')
  const [widgetLabel, setWidgetLabel] = useState(widgeting?.widget_label ?? '')
  // A widget just written for this widgeting, until the library's watch brings it back.
  const [made, setMade] = useState<WidgetT | null>(null)
  const [widgetEditing, setWidgetEditing] = useState<WidgetEditing>(null)
  const [issue, setIssue] = useState<string | null>(null)
  const [labelIssue, setLabelIssue] = useState<string | null>(null)

  const known = made && library.every((each) => each.label !== made.label) ? [...library, made] : library
  const widget = known.find((each) => each.label === widgetLabel) ?? null
  const fixed = ! revisable || widgeting !== null
  const runsAt = widgeting?.tier ?? tier
  // A new widgeting is offered only widgets that run at its tier; an existing one shows the one it works.
  const offered = widgeting === null ? known.filter((each) => Widgeting.runsAt(each, runsAt)) : known

  const onApply = () => {
    const plan = planWidgetingEdit({ widgeting, label, description, widgetLabel, tier: runsAt }, known, quiz)
    if (! plan.ok) { setIssue(plan.issue); setLabelIssue(plan.labelIssue); return }
    for (const action of plan.actions) { dispatch(action) }
    onClose()
  }

  return (
    <>
      <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="sm" aria-labelledby="widgeting-dialog-title">
        <ClosableTitle id="widgeting-dialog-title" onClose={onClose}>{widgeting ? `Widgeting: ${widgeting.label}` : NewTitles[runsAt]}</ClosableTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <WidgetPicker
              library={offered} widget={widget} disabled={fixed}
              gone={widgeting !== null && widget === null ? widgeting.widget_label : null}
              onPick={(picked) => { setWidgetLabel(picked); setIssue(null) }}
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              {changeable && widgeting === null && <Button size="small" variant="outlined" disabled={! revisable} onClick={() => { setWidgetEditing('new') }}>New widget…</Button>}
              {changeable && widget && <Button size="small" variant="outlined" onClick={() => { setWidgetEditing('held') }}>Edit the widget…</Button>}
            </Stack>
            <Divider />
            <TextField
              size="small" label="Widgeting label" value={label} disabled={! revisable} placeholder={widgetLabel}
              error={labelIssue !== null} helperText={labelIssue ?? LabelHelp[runsAt]}
              onChange={(event) => { setLabel(event.target.value); setIssue(null); setLabelIssue(null) }}
            />
            <TextField
              size="small" label="Widgeting description" value={description} disabled={! revisable}
              helperText="What this widgeting is for in this quiz." onChange={(event) => { setDescription(event.target.value) }}
            />
            {issue !== null && issue !== labelIssue && <p className={styles.microcopy} role="alert">{issue}</p>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          {widgeting && revisable
            ? (
              <ConfirmRemove
                noun="widgeting"
                question={removalQuestion(widget)}
                onConfirm={() => { dispatch({ kind: 'delete_widgeting', label: widgeting.label }); onClose() }}
              />
            )
            : <span />}
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" disabled={! revisable} onClick={onApply}>Apply</Button>
          </Stack>
        </DialogActions>
      </Dialog>
      {widgetEditing !== null && (
        <WidgetEditor
          hunt={hunt}
          library={known}
          quiz={quiz}
          widget={widgetEditing === 'held' ? widget : null}
          widgeting={{ label: label || widgetLabel, description }}
          dispatch={changeLibrary}
          onClose={() => { setWidgetEditing(null) }}
          onMade={(fresh) => { setMade(fresh); setWidgetLabel(fresh.label); setIssue(null) }}
          onRemoved={(gone) => {
            if (made?.label === gone) { setMade(null) }
            if (widgeting === null && widgetLabel === gone) { setWidgetLabel('') }
          }}
        />
      )}
    </>
  )
}

type WidgetPickerProps = {
  library:  readonly WidgetT[]
  /** The widget picked; null while none is */
  widget:   WidgetT | null
  disabled: boolean
  /** The label of a widget the widgeting works and the library no longer holds, when that is so */
  gone:     string | null
  onPick:   (widget_label: string) => void
}

/** How the picker finds a widget from what is typed: by its label, its title or its description */
const filterWidgets = createFilterOptions<WidgetT>({ stringify: (widget) => `${widget.label} ${Widget.titleOf(widget)} ${widget.description}` })

/**
 * The library as a catalogue to pick a widget from: grouped by formulary, each widget by its
 * title, with its label and what it works out, and found by typing any of them.
 */
function WidgetPicker({ library, widget, disabled, gone, onPick }: Readonly<WidgetPickerProps>) {
  const options = _.sortBy([...library], (each) => FormularykindVals.indexOf(each.formulary))
  return (
    <Autocomplete
      options={options}
      value={widget}
      disabled={disabled}
      autoHighlight
      openOnFocus
      groupBy={(each) => FormularyWords[each.formulary].group}
      getOptionLabel={(each) => Widget.titleOf(each)}
      isOptionEqualToValue={(each, picked) => each.label === picked.label}
      filterOptions={filterWidgets}
      onChange={(_event, picked) => { onPick(picked?.label ?? '') }}
      renderOption={({ key, ...props }, each) => (
        <Box component="li" key={key} {...props}>
          <Box sx={{ minWidth: 0 }}>
            <div>{Widget.titleOf(each)} <Box component="code" sx={{ color: 'text.secondary', fontSize: 12 }}>{each.label}</Box></div>
            {each.description === '' ? null : <div className={styles.microcopy}>{each.description}</div>}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params} size="small" label="Widget"
          helperText={pickedNote(widget, gone)}
        />
      )}
    />
  )
}

/** What the picker says under itself: what the widget picked works out, or how to choose one */
function pickedNote(widget: WidgetT | null, gone: string | null): string {
  if (gone !== null) { return `It works ${gone}, which the library no longer holds.` }
  if (widget === null) { return 'Pick one of the library to put to work in this quiz, or write a new one.' }
  return widget.description === '' ? FormularyWords[widget.formulary].gist : widget.description
}

/** What removing a widgeting asks first: what it takes with it, by how its widget keeps its values */
function removalQuestion(widget: WidgetT | null): string {
  switch (widget ? formularyFor(widget).store : null) {
  case 'append': { return 'Remove this widgeting, the columns that show it, and every answer it kept? Its widget stays in the library.' }
  case 'upsert': { return 'Remove this widgeting, the columns that show it, and everything typed into it? Its widget stays in the library.' }
  case null:     { return 'Remove this widgeting, and the columns that show it? Its widget stays in the library.' }
  }
}
