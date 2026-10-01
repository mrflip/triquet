'use client'

import { Stack, TextField } from '@mui/material'
import { CopyButton } from './CopyButton'
import { JsonFold } from './JsonFold'
import { PreviewPicker } from './PreviewPicker'
import { usePreviewBag } from './use-preview-bag'
import * as Formulas from '../lib/formulas'
import { JsonataFormulary } from '../lib/formulary/jsonata'
import { Widgeted } from '../models/widgeted'
import type { AdviceSubject, LiveRun } from '../lib/formulary/formularies'
import { JsonataDefaultInput, type WidgetT } from '../models/widget'
import type { ShallowHuntT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import type { JsonataDraft } from '../state/widget-edit'
import styles from './workbench.module.css'

export type JsonataFieldsProps = {
  /** The hunt, whose every quiz the preview can be pointed at */
  hunt:          ShallowHuntT
  /** The library, whose widgets the quizzes' widgetings work */
  library:       readonly WidgetT[]
  /** The quiz on screen, whose questions the preview starts on */
  openQuiz:      QuizT
  draft:         JsonataDraft
  onChange:      (patch: Partial<JsonataDraft>) => void
  /** A new widget is named here; an existing one is not renamed */
  labelEditable: boolean
  /** What is wrong with the label being typed, when something is */
  labelIssue:    string | null
  /** The widgeting the widget is being written for, when there is one, for the prompt */
  widgeting:     AdviceSubject | null
}

/**
 * A `jsonata` widget's label, description and formula, with a live preview against a real
 * question and a button that copies a prompt asking a chatbot for the formula.
 *
 * The preview is worked out from the draft as it is typed, so a mistake is named, and a fix is
 * seen, before anything is applied. Any quiz of the hunt and any of its questions can be
 * picked; it starts on the lowest-numbered question of the open quiz.
 */
export function JsonataFields({ hunt, library, openQuiz, draft, onChange, labelEditable, labelIssue, widgeting }: Readonly<JsonataFieldsProps>) {
  const preview = usePreviewBag(hunt, library, openQuiz, widgeting?.label ?? '')
  const { bag } = preview

  const syntaxIssue = draft.formula === '' ? null : Formulas.check(draft.formula)
  const lengthIssue = draft.formula.length > Formulas.FormulaMax ? `should be at most ${String(Formulas.FormulaMax)} characters` : null
  // A widget the library holds is previewed over its own input; a new one over the default.
  const input_formula = library.find((widget) => widget.label === draft.label)?.input_formula ?? JsonataDefaultInput
  const outcome: LiveRun = bag
    ? JsonataFormulary.run({ formula: draft.formula, input_formula }, null, bag)
    : { widgeted: Widgeted.missing, stops: false }

  return (
    <Stack spacing={1.5}>
      {labelEditable
        ? (
          <TextField
            size="small" label="Widget label" value={draft.label} sx={{ maxWidth: 320 }}
            error={labelIssue !== null} helperText={labelIssue ?? 'What the widget is called in the library, for choosing it again. It cannot be changed afterward.'}
            onChange={(event) => { onChange({ label: event.target.value }) }}
          />
        )
        : <div><strong>{draft.label}</strong> <span className={styles.microcopy}>widget</span></div>}
      <TextField
        size="small" label="Widget description" value={draft.description}
        helperText="What it works out, for whoever is choosing between widgets."
        onChange={(event) => { onChange({ description: event.target.value }) }}
      />
      <TextField
        size="small" multiline minRows={4} maxRows={16} label="Formula" value={draft.formula}
        error={syntaxIssue !== null || (lengthIssue !== null && draft.formula !== '')}
        helperText={syntaxIssue ?? (draft.formula === '' ? 'A JSONata formula, evaluated once per question.' : lengthIssue ?? undefined)}
        slotProps={{ htmlInput: { style: { fontFamily: 'var(--font-data)', fontSize: 12 } } }}
        onChange={(event) => { onChange({ formula: event.target.value }) }}
      />
      <PreviewPicker preview={preview} />
      <PreviewResult preview={outcome} />
      {bag && (
        <div>
          <div className={styles.microcopy}>The input the formula reads for this question</div>
          <JsonFold label="hunt" val={bag.hunt} />
          <JsonFold label="realm" val={bag.realm} />
          <JsonFold label="quiz" val={bag.quiz} />
          <JsonFold label={`qns (${String(bag.qns.length)})`} val={bag.qns} />
          <JsonFold label="qn" val={bag.qn} />
        </div>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CopyButton textOf={() => JsonataFormulary.advice(draft, widgeting, bag ?? null)}>
          Copy a prompt for a chatbot
        </CopyButton>
      </Stack>
    </Stack>
  )
}

/** What the draft formula comes to for the question chosen */
function PreviewResult({ preview }: Readonly<{ preview: LiveRun }>) {
  return (
    <div className={styles.previewResult} role="status" aria-label="Preview result">
      <span className={styles.microcopy}>Comes to </span>
      {previewText(preview)}
    </div>
  )
}

/** The preview, in words */
function previewText({ widgeted }: LiveRun): React.ReactNode {
  if (widgeted.status === 'errored') { return <span className={styles.muted}>Fails: {widgeted.err.message}</span> }
  if (widgeted.status === 'missing') { return <span className={styles.muted}>nothing (a dash in the grid)</span> }
  return <code>{Widgeted.textOf(widgeted)}</code>
}
