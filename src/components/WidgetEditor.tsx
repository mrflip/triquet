'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, MenuItem, Stack, TextField } from '@mui/material'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { ConfirmRemove } from './ConfirmRemove'
import { AibotFields } from './AibotFields'
import { EntryFields } from './EntryFields'
import { JsonataFields } from './JsonataFields'
import { FormularyWords, usageLine } from './widget-words'
import { useWidgetUsage } from '../state/use-widget-usage'
import { BlankJsonataDraft, blankDraftOf, draftOf, planNewWidget, planWidgetEdit, type WidgetDraft } from '../state/widget-edit'
import { FormularykindVals, type Formularykind, type WidgetT } from '../models/widget'
import type { AdviceSubject } from '../lib/formulary/formularies'
import type { ShallowHuntT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import type { HuntActionDNA } from '../models/actions'
import styles from './workbench.module.css'

export type WidgetEditorProps = {
  hunt:       ShallowHuntT
  /** The library's widgets */
  library:    readonly WidgetT[]
  /** The quiz on screen, which the preview starts on */
  quiz:       QuizT
  /** The widget to revise, or null to write a new one */
  widget:     WidgetT | null
  /** The widgeting it is being written for, when it is opened from one: what the preview and the advice are told */
  widgeting?: AdviceSubject | null
  dispatch:   (action: HuntActionDNA) => void
  onClose:    () => void
  /** Told of a new widget once it has been sent to the library */
  onMade?:    (widget: WidgetT) => void
  /** Told of a widget once its removal has been sent to the library */
  onRemoved?: (widget_label: string) => void
}

/**
 * The widget editor: one widget of the library on its own, its fields following its formulary --
 * a formula, or a prompt with its input formula and config, each with a live preview against a
 * real question and the button that copies a prompt asking a chatbot for help; or an entry's kind.
 *
 * A new widget is written here, its formulary chosen first. An existing one says how far it is
 * put to work, in every hunt, and cannot be removed while anything works it. An edit here changes
 * every quiz that works the widget, which is why the widgetings that put it to work are edited
 * elsewhere. Nothing is applied until Apply.
 */
export function WidgetEditor({ widget, ...rest }: Readonly<WidgetEditorProps>) {
  return widget === null ? <NewWidgetEditor {...rest} /> : <HeldWidgetEditor widget={widget} {...rest} />
}

type HeldWidgetEditorProps = Omit<WidgetEditorProps, 'widget'> & { widget: WidgetT }

/** A widget the library holds, to revise or remove */
function HeldWidgetEditor({ hunt, library, quiz, widget, widgeting = null, dispatch, onClose, onRemoved }: Readonly<HeldWidgetEditorProps>) {
  const [draft, setDraft] = useState<WidgetDraft>(draftOf(widget))
  const [issue, setIssue] = useState<string | null>(null)
  const usage = useWidgetUsage(widget.label)

  const onApply = () => {
    const plan = planWidgetEdit(draft, library)
    if (! plan.ok) { setIssue(plan.issue); return }
    for (const action of plan.actions) { dispatch(action) }
    onClose()
  }
  const revise = (patch: Partial<WidgetDraft>) => { setDraft((was) => ({ ...was, ...patch }) as WidgetDraft); setIssue(null) }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="md" aria-labelledby="widget-editor-title">
      <ClosableTitle id="widget-editor-title" onClose={onClose}>Widget: {widget.label}</ClosableTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <p className={styles.microcopy} role="status" aria-label="Usage">
            {[`${FormularyWords[widget.formulary].gist}.`, usageSaid(usage), 'An edit here changes every quiz that works it.'].filter((said) => said !== '').join(' ')}
          </p>
          <DraftFields hunt={hunt} library={library} quiz={quiz} draft={draft} onChange={revise} labelEditable={false} labelIssue={null} widgeting={widgeting} />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <ConfirmRemove
          noun="widget"
          question="Remove this widget from the library for good?"
          refusal={usage && usage.widgetings > 0 ? 'It cannot be removed while a widgeting works it.' : null}
          onConfirm={() => { dispatch({ kind: 'delete_widget', label: widget.label }); onRemoved?.(widget.label); onClose() }}
        />
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={onApply}>Apply</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

/** The usage line as the editor says it: counting, the counts, or nothing for an ident that may not count them */
function usageSaid(usage: ReturnType<typeof useWidgetUsage>): string {
  if (usage === undefined) { return 'Counting the widgetings that work it…' }
  return usage === null ? '' : usageLine(usage)
}

type NewWidgetEditorProps = Omit<WidgetEditorProps, 'widget'>

/** A widget written afresh, its formulary chosen first, and added to the library on Apply */
function NewWidgetEditor({ hunt, library, quiz, widgeting = null, dispatch, onClose, onMade }: Readonly<NewWidgetEditorProps>) {
  const [draft, setDraft] = useState<WidgetDraft>(BlankJsonataDraft)
  const [issue, setIssue] = useState<string | null>(null)
  const [labelIssue, setLabelIssue] = useState<string | null>(null)

  const onApply = () => {
    const plan = planNewWidget(draft, library)
    if (! plan.ok) { setIssue(plan.issue); setLabelIssue(plan.labelIssue); return }
    for (const action of plan.actions) { dispatch(action) }
    onMade?.(plan.widget)
    onClose()
  }
  const revise = (patch: Partial<WidgetDraft>) => { setDraft((was) => ({ ...was, ...patch }) as WidgetDraft); setIssue(null); setLabelIssue(null) }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="md" aria-labelledby="new-widget-title">
      <ClosableTitle id="new-widget-title" onClose={onClose}>New widget</ClosableTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField
            select size="small" label="Formulary" value={draft.formulary} sx={{ maxWidth: 520 }}
            helperText="What kind of widget it is: how its formula is worked out. It cannot be changed afterward."
            onChange={(event) => { setDraft(blankDraftOf(event.target.value as Formularykind, draft)); setIssue(null) }}
          >
            {FormularykindVals.map((formulary) => <MenuItem key={formulary} value={formulary}>{FormularyWords[formulary].gist}</MenuItem>)}
          </TextField>
          <DraftFields key={draft.formulary} hunt={hunt} library={library} quiz={quiz} draft={draft} onChange={revise} labelEditable labelIssue={labelIssue} widgeting={widgeting} />
          {issue !== null && issue !== labelIssue && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onApply}>Apply</Button>
      </DialogActions>
    </Dialog>
  )
}

type DraftFieldsProps = {
  hunt:          ShallowHuntT
  library:       readonly WidgetT[]
  quiz:          QuizT
  draft:         WidgetDraft
  onChange:      (patch: Partial<WidgetDraft>) => void
  labelEditable: boolean
  labelIssue:    string | null
  widgeting:     AdviceSubject | null
}

/** The fields a draft's formulary has */
function DraftFields({ hunt, library, quiz, draft, onChange, labelEditable, labelIssue, widgeting }: Readonly<DraftFieldsProps>) {
  const shared = { hunt, library, openQuiz: quiz, onChange, labelEditable, labelIssue, widgeting }
  switch (draft.formulary) {
  case 'jsonata': { return <JsonataFields draft={draft} {...shared} /> }
  case 'aibot':   { return <AibotFields draft={draft} {...shared} /> }
  case 'entry':   { return <EntryFields draft={draft} onChange={onChange} labelEditable={labelEditable} labelIssue={labelIssue} /> }
  }
}
