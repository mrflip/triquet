'use client'

import { useId, useState } from 'react'
import { Box, Button, Chip, Collapse, Stack, TextField } from '@mui/material'
import { ColumnIssue, ColumnMoreFields, useColumnCommit } from './ColumnFields'
import { ConfirmRemove } from './ConfirmRemove'
import { EntryParamsFields } from './EntryParamsFields'
import { ExplicitField } from './ExplicitField'
import { FoldButton } from './FoldButton'
import { WidgetEditor } from './WidgetEditor'
import { LayoutFoldkeys } from './layout-folds'
import { useDraft } from './use-draft'
import type { FoldSet } from './use-folds'
import { FormularyWords } from './widget-words'
import * as Labelmaker from '../lib/labelmaker'
import * as UU from '../lib/useful'
import * as ColumnMenu from '../lib/column-menu'
import { columnsShowing, widgetingRemovalRefusal } from '../lib/columns'
import { EntryFormulary } from '../lib/formulary/entry'
import { formularyFor } from '../lib/formulary/formularies'
import { planWidgetingEdit, type WidgetingEdit } from '../lib/widgeting-edit'
import { Widget, type EntryWidgetT, type WidgetT } from '../models/widget'
import type { WidgetingT, WidgetingTier } from '../models/widgeting'
import type { ColumnT } from '../models/column'
import type { QuizT } from '../models/quiz'
import type { JsonT } from '../models/widgeted'
import type { ShallowHuntT } from '../lib/rows'
import type { HuntActionDNA, LibraryActionDNA } from '../models/actions'
import styles from './workbench.module.css'

/** How a widgeting's row marks its tier */
export const TierMarks: Readonly<Record<WidgetingTier, string>> = {
  question: 'each question',
  quiz:     'whole quiz',
}

/** What a widgeting's panel is drawn with: the quiz and library around it, and who may change what */
export type WidgetingPanelContext = {
  hunt:          ShallowHuntT
  quiz:          QuizT
  /** The library's widgets, which the quiz's widgetings work */
  library:       readonly WidgetT[]
  /** What a column of the quiz could show, for the columns the panel lists */
  sources:       readonly ColumnMenu.RefChoice[]
  /** Whether the quiz's widgetings and columns may be changed: shown as they are when not */
  revisable:     boolean
  /** Whether the library may be written to: no door to the widget editor when not */
  changeable:    boolean
  dispatch:      (action: HuntActionDNA) => void
  /** Carry out a change to the library, from the widget editor (`useLibraryActions`) */
  changeLibrary: (action: LibraryActionDNA) => void
  /** Which panels are open, kept above the dialog so they stay so across a reopen */
  folds:         FoldSet
}

export type WidgetingPanelProps = WidgetingPanelContext & {
  widgeting: WidgetingT
  /** Its fold's key, given the widgeting's label: one per place the panel is drawn (`LayoutFoldkeys`) */
  foldkeyOf: (widgetingLabel: string) => string
  /** The handle to drag it by in the run order, or a blank in its place for an entry; nothing beneath a column */
  handle?:   React.ReactNode
  /** Whether its first row marks its tier, as the run order's rows do */
  tierMark?: boolean
  /** The column it is drawn beneath, which its list of the columns showing it leaves out */
  beneath?:  ColumnT
}

/**
 * One widgeting of the quiz, as a panel: folded, one row -- its label, what it works, and its
 * folded line, the few fields its formulary folds to (`formularyFor(widget).folded`: an entry's
 * params, a formula's formula, nothing for a prompt); open, the same row with more beneath it: its
 * label, which waits on its own *Relabel* button since columns and formulas name it; its
 * description; the widget it works, behind its door for whoever may change the library; the
 * columns showing it, each to unfold; and its removal, refused while a column shows it.
 *
 * Every field commits as it is made. The widget itself is the library's, and an edit to it
 * changes every quiz that works it, so it is never edited here: the door opens the widget editor.
 */
export function WidgetingPanel({ widgeting, foldkeyOf, handle = null, tierMark = false, beneath, ...context }: Readonly<WidgetingPanelProps>) {
  const { hunt, quiz, library, revisable, changeable, dispatch, changeLibrary, folds } = context
  const [widgetEditing, setWidgetEditing] = useState(false)
  const restId = useId()
  const foldkey = foldkeyOf(widgeting.label)
  const open = folds.isOpen(foldkey)
  const widget = library.find((each) => each.label === widgeting.widget_label) ?? null
  const locked = ! revisable

  /** Sends a revision of the widgeting, or says what is wrong with it */
  const revise = (edit: Partial<Pick<WidgetingEdit, 'label' | 'description' | 'params'>>): string | null => {
    const plan = planWidgetingEdit({ widgeting, label: widgeting.label, description: widgeting.description, widgetLabel: widgeting.widget_label, params: widgeting.params, ...edit }, library, quiz)
    if (! plan.ok) { return plan.issue }
    for (const action of plan.actions) { dispatch(action) }
    return null
  }
  const relabel = (label: string): string | null => {
    if (label === '') { return 'Enter a label.' }
    const issue = revise({ label })
    if (issue === null) { folds.setOpen(foldkeyOf(label), true) }
    return issue
  }
  const shown = columnsShowing(quiz, widgeting.label).filter((column) => column.label !== beneath?.label)

  return (
    <Stack spacing={1} role="group" aria-label={`Widgeting ${widgeting.label}`}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 1 }}>
        {handle === null ? null : <Box sx={{ pt: 1 }}>{handle}</Box>}
        <Box sx={{ pt: 0.5 }}>
          <FoldButton open={open} onOpenChange={(next) => { folds.setOpen(foldkey, next) }} label={`Widgeting ${widgeting.label} in full`} controls={restId} />
        </Box>
        <Box sx={{ pt: 1, width: 220, flexShrink: 0, overflowWrap: 'anywhere' }}>
          <strong>{widgeting.label}</strong> <span className={styles.microcopy}>{widgetingNote(widgeting, widget)}</span>
        </Box>
        {tierMark && <Chip size="small" variant="outlined" label={TierMarks[widgeting.tier]} sx={{ mt: 1 }} />}
        <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
          {widget && <FoldedLine widget={widget} widgeting={widgeting} locked={locked} revise={revise} />}
        </Box>
      </Stack>
      <Collapse in={open} unmountOnExit id={restId}>
        <Stack spacing={1.5} sx={{ pl: 4, pt: 1, pb: 1 }}>
          <ExplicitField
            label="Widgeting label" committed={widgeting.label} act="Relabel" actLabel={`Relabel widgeting ${widgeting.label}`} disabled={locked} tidy={Labelmaker.normalize}
            helperText="Names it within this quiz: its columns, and what later widgets and templates read it as." onCommit={relabel}
          />
          <DescriptionField widgeting={widgeting} locked={locked} revise={revise} />
          <WidgetLine widget={widget} widgeting={widgeting} changeable={changeable} onEditWidget={() => { setWidgetEditing(true) }} />
          <ShowingColumns widgeting={widgeting} columns={shown} beneath={beneath} {...context} />
          {locked ? null : (
            <Box>
              <ConfirmRemove
                noun="widgeting"
                question={removalQuestion(widget)}
                refusal={widgetingRemovalRefusal(quiz, widgeting.label)}
                onConfirm={() => { dispatch({ kind: 'delete_widgeting', label: widgeting.label }) }}
              />
            </Box>
          )}
        </Stack>
      </Collapse>
      {widgetEditing && widget && (
        <WidgetEditor
          hunt={hunt} library={library} quiz={quiz} widget={widget} widgeting={widgeting} dispatch={changeLibrary}
          onClose={() => { setWidgetEditing(false) }}
        />
      )}
    </Stack>
  )
}

type FoldedLineProps = {
  widget:    WidgetT
  widgeting: WidgetingT
  locked:    boolean
  /** Sends a revision of the widgeting's params, or says what is wrong with them */
  revise:    (edit: { params: Record<string, JsonT> }) => string | null
}

/**
 * A widgeting's folded line: the few fields its formulary folds to, an entry's params, a
 * formula's formula (the widget's, shown as it is: it is edited behind the widget's door), or
 * nothing for a prompt.
 */
function FoldedLine({ widget, widgeting, locked, revise }: Readonly<FoldedLineProps>) {
  switch (formularyFor(widget).folded) {
  case 'params': {
    return widget.formulary === 'entry' ? <FoldedParams widget={widget} widgeting={widgeting} locked={locked} revise={revise} /> : null
  }
  case 'formula': {
    return (
      <TextField
        size="small" fullWidth label="Formula" value={widget.formula.replaceAll(/\s+/g, ' ')}
        helperText="The widget's: edited behind its door, for every quiz that works it."
        slotProps={{ htmlInput: { readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 } } }}
      />
    )
  }
  case null: {
    return null
  }
  }
}

/**
 * Params sent and not yet back, or refused, beside the held params (as `UU.jsonify` writes them)
 * they may show over: those they were set over, and those of each sending before them not yet back
 */
export type PendingParams = { params: Record<string, JsonT>, over: readonly string[], sent: boolean }

/**
 * An entry widgeting's params in its folded line, side by side, each committing as it is left or
 * picked. Params sent show until the quiz's watch brings them back, so a second field left before
 * then builds on the first; params the planner refuses stay in the fields, each saying its own
 * sentence, until the widgeting's params change. Held params changing to anything this line did
 * not send (the same widgeting's line elsewhere, another tab) take the fields over.
 */
function FoldedParams({ widget, widgeting, locked, revise }: Readonly<Omit<FoldedLineProps, 'widget'> & { widget: EntryWidgetT }>) {
  const [pending, setPending] = useState<PendingParams | null>(null)
  const held = UU.jsonify(widgeting.params)
  const shown = pendingShown(pending, held)
  // Once the held params have moved past what was pending, it is done with: held coming back round to what it was set over does not revive it.
  if (pending !== null && shown === null) { setPending(null) }
  const { entry_kind, ...defaults } = widget.config
  const onChange = (next: Record<string, JsonT>) => {
    const over = pending === null || shown === null ? [held] : [...pending.over, ...(pending.sent ? [UU.jsonify(pending.params)] : [])]
    setPending({ params: next, over, sent: revise({ params: next }) === null })
  }
  return (
    <EntryParamsFields
      entry_kind={entry_kind} params={shown ?? widgeting.params} inherited={defaults} validator={EntryFormulary.paramsOf(widget)} disabled={locked}
      layout="line" label={`Settings of ${widgeting.label}`} onChange={onChange}
    />
  )
}

/**
 * The pending params to show over those held, or null for none: sent ones until the watch brings
 * them back, refused ones until the held change; either, only while the held are those they were
 * set over or an earlier sending's on its way.
 *
 * @param pending - What was last sent or refused, or null for nothing.
 * @param held - The widgeting's params as held now, as `UU.jsonify` writes them.
 * @returns The params to show, or null to show those held.
 *
 * @example pendingShown({ params: { max: 5 }, over: ['{}'], sent: true }, '{}')         // => { max: 5 }
 * @example pendingShown({ params: { max: 5 }, over: ['{}'], sent: true }, '{"max":7}')  // => null
 */
export function pendingShown(pending: PendingParams | null, held: string): Record<string, JsonT> | null {
  if (! pending?.over.includes(held)) { return null }
  return pending.sent && UU.jsonify(pending.params) === held ? null : pending.params
}

type DescriptionFieldProps = {
  widgeting: WidgetingT
  locked:    boolean
  revise:    (edit: { description: string }) => string | null
}

/** What the widgeting is for in this quiz, kept as the box is left */
function DescriptionField({ widgeting, locked, revise }: Readonly<DescriptionFieldProps>) {
  const [issue, setIssue] = useState<string | null>(null)
  const { draft, onChange, onBlur } = useDraft(widgeting.description, (description) => { setIssue(revise({ description })) })
  return (
    <TextField
      size="small" label="Widgeting description" value={draft} disabled={locked}
      error={issue !== null} helperText={issue ?? 'What this widgeting is for in this quiz.'}
      onChange={(event) => { onChange(event.target.value) }} onBlur={onBlur}
    />
  )
}

type WidgetLineProps = {
  widget:       WidgetT | null
  widgeting:    WidgetingT
  changeable:   boolean
  onEditWidget: () => void
}

/** The widget a widgeting works, said, and the door to it for whoever may change the library */
function WidgetLine({ widget, widgeting, changeable, onEditWidget }: Readonly<WidgetLineProps>) {
  if (! widget) { return <p className={styles.microcopy}>It works {widgeting.widget_label}, which the library no longer holds.</p> }
  const gist = widget.description === '' ? FormularyWords[widget.formulary].gist : widget.description
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
      <Box className={styles.microcopy} sx={{ flex: 1, minWidth: 200 }}>
        It works the widget <strong>{Widget.titleOf(widget)}</strong> (<code>{widget.label}</code>): {gist}
      </Box>
      {changeable && <Button size="small" variant="outlined" onClick={onEditWidget}>Edit the widget…</Button>}
    </Stack>
  )
}

type ShowingColumnsProps = WidgetingPanelContext & {
  widgeting: WidgetingT
  /** The columns showing it, but the one it is drawn beneath */
  columns:   readonly ColumnT[]
  beneath?:  ColumnT
}

/** The columns showing a widgeting, each to unfold to its fields; or, when none does, that none does */
function ShowingColumns({ widgeting, columns, beneath, ...context }: Readonly<ShowingColumnsProps>) {
  if (columns.length === 0) { return <p className={styles.microcopy}>{noColumnLine(widgeting, beneath)}</p> }
  return (
    <Stack spacing={0.5} role="list" aria-label={`Columns showing ${widgeting.label}`}>
      {columns.map((column) => <ColumnFold key={column.label} widgeting={widgeting} column={column} {...context} />)}
    </Stack>
  )
}

/** What a widgeting's panel says when no column but the one it is beneath shows it */
function noColumnLine(widgeting: WidgetingT, beneath: ColumnT | undefined): string {
  if (beneath) { return 'No other column shows it.' }
  return widgeting.tier === 'quiz' ? `No column shows it: later widgetings and templates read it as quiz.${widgeting.label}.` : 'No column shows it.'
}

/** A column showing a widgeting, as the widgeting's panel lists it: its name, unfolding to its fields */
function ColumnFold({ widgeting, column, quiz, library, sources, revisable, dispatch, folds }: Readonly<WidgetingPanelContext & { widgeting: WidgetingT, column: ColumnT }>) {
  const fieldsId = useId()
  const foldkey = LayoutFoldkeys.listed(widgeting.label, column.label)
  const { commit, issue } = useColumnCommit(column, dispatch, ColumnMenu.namerOf(quiz, library))
  const columnName = column.title || column.label
  return (
    <Box role="listitem">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <FoldButton open={folds.isOpen(foldkey)} onOpenChange={(next) => { folds.setOpen(foldkey, next) }} label={`Shown by column ${columnName}`} controls={fieldsId} />
        <span>Shown by the column <strong>{columnName}</strong></span>
      </Stack>
      <Collapse in={folds.isOpen(foldkey)} unmountOnExit id={fieldsId}>
        <Box sx={{ pl: 4, pt: 1, pb: 1 }}>
          <ColumnMoreFields
            column={column} quiz={quiz} library={library} sources={sources} locked={! revisable} onCommit={commit}
            onRelabel={(label) => { folds.setOpen(LayoutFoldkeys.listed(widgeting.label, label), true) }}
            onRemove={() => { dispatch({ kind: 'delete_column', label: column.label }) }}
          />
          <ColumnIssue issue={issue} />
        </Box>
      </Collapse>
    </Box>
  )
}

/** What the widgeting works, in a few words */
export function widgetingNote(widgeting: WidgetingT, widget: WidgetT | null): string {
  if (! widget) { return `works ${widgeting.widget_label}, which the library no longer holds` }
  return `${FormularyWords[widget.formulary].noun} ${widget.label}`
}

/** What removing a widgeting asks first: what it takes with it, by how its widget keeps its values */
function removalQuestion(widget: WidgetT | null): string {
  switch (widget ? formularyFor(widget).store : null) {
  case 'append': { return 'Remove this widgeting, and every answer it kept? Its widget stays in the library.' }
  case 'upsert': { return 'Remove this widgeting, and everything typed into it? Its widget stays in the library.' }
  case null:     { return 'Remove this widgeting? Its widget stays in the library.' }
  }
}
