'use client'

import { Box, Stack, TextField } from '@mui/material'
import { CopyButton } from './CopyButton'
import { JsonFold } from './JsonFold'
import { PreviewPicker } from './PreviewPicker'
import { usePreviewBag } from './use-preview-bag'
import * as Formulas from '../lib/formulas'
import * as Templating from '../lib/templating'
import * as PA from '../lib/vv/patterns'
import { LiquidizeFormulary } from '../lib/formulary/liquidize'
import { Widgeted } from '../models/widgeted'
import type { AdviceSubject, LiveRun } from '../lib/formulary/formularies'
import type { WidgetT } from '../models/widget'
import type { ShallowHuntT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import type { LiquidizeDraft } from '../state/widget-edit'
import styles from './workbench.module.css'

export type LiquidizeFieldsProps = {
  /** The hunt, whose every quiz the preview can be pointed at */
  hunt:          ShallowHuntT
  /** The library, whose widgets the quizzes' widgetings work */
  library:       readonly WidgetT[]
  /** The quiz on screen, whose questions the preview starts on */
  openQuiz:      QuizT
  draft:         LiquidizeDraft
  onChange:      (patch: Partial<LiquidizeDraft>) => void
  /** A new widget is named here; an existing one is not renamed */
  labelEditable: boolean
  /** What is wrong with the label being typed, when something is */
  labelIssue:    string | null
  /** The widgeting the widget is being written for, when there is one, for the preview and the advice */
  widgeting:     AdviceSubject | null
}

/**
 * A `liquidize` widget's label, description, template and input formula, with a live preview
 * against a real question of the text the template comes to, and a button that copies a prompt
 * asking a chatbot for the template.
 *
 * The template here is the widget's: the default every widgeting of it fills in, unless the
 * widgeting gives one of its own or reads one from the bag. The preview follows the draft as it
 * is typed, so a mistake is named, and a fix is seen, before anything is applied. Any quiz of the
 * hunt and any of its questions can be picked; it starts on the lowest-numbered question of the
 * open quiz.
 */
export function LiquidizeFields({ hunt, library, openQuiz, draft, onChange, labelEditable, labelIssue, widgeting }: Readonly<LiquidizeFieldsProps>) {
  const preview = usePreviewBag(hunt, library, openQuiz, widgeting?.label ?? '')
  const { bag } = preview

  const templateIssue = draft.formula === '' ? null : Templating.issueOf(draft.formula)
  const templateLong = draft.formula.length > PA.Textish.max ? `should be at most ${String(PA.Textish.max)} characters` : null
  const inputIssue = draft.input_formula === '' ? 'An input formula is needed: `$` reads the whole bag' : Formulas.check(draft.input_formula)
  const outcome: LiveRun | null = bag && draft.formula !== '' ? LiquidizeFormulary.run(draft, null, bag) : null

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
        helperText="What it writes, for whoever is choosing between widgets."
        onChange={(event) => { onChange({ description: event.target.value }) }}
      />
      <TextField
        size="small" multiline minRows={4} maxRows={16} label="Template" value={draft.formula}
        error={templateIssue !== null || templateLong !== null}
        helperText={templateIssue ?? templateLong ?? 'Liquid, filled in once per question and shown as markdown: {{ question.title }}, {% if question.hint %}…{% endif %}. A widgeting may give one of its own.'}
        slotProps={{ htmlInput: { style: { fontFamily: 'var(--font-data)', fontSize: 12 } } }}
        onChange={(event) => { onChange({ formula: event.target.value }) }}
      />
      <TextField
        size="small" multiline maxRows={6} label="Input formula" value={draft.input_formula}
        error={inputIssue !== null}
        helperText={inputIssue ?? 'A JSONata expression coming to the object the template is filled in from: `$`, the whole bag, reads as a formula would. Nothing means no text for that question.'}
        slotProps={{ htmlInput: { style: { fontFamily: 'var(--font-data)', fontSize: 12 } } }}
        onChange={(event) => { onChange({ input_formula: event.target.value }) }}
      />
      <PreviewPicker preview={preview} />
      {outcome && <FilledPreview preview={outcome} />}
      {bag && draft.input_formula.trim() === '$' && (
        <div>
          <div className={styles.microcopy}>What the template reads for this question</div>
          <JsonFold label="quiz" val={bag.quiz} />
          <JsonFold label={`questions (${String(Object.keys(bag.questions).length)})`} val={bag.questions} />
          <JsonFold label="question" val={bag.question} />
        </div>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CopyButton textOf={() => LiquidizeFormulary.advice(draft, widgeting, bag ?? null)}>
          Copy a prompt for a chatbot
        </CopyButton>
      </Stack>
    </Stack>
  )
}

/** What the draft template comes to for the question chosen, as the text the markdown is read from */
function FilledPreview({ preview }: Readonly<{ preview: LiveRun }>) {
  const { widgeted } = preview
  return (
    <div role="status" aria-label="Preview result">
      <div className={styles.microcopy}>Comes to, before it is read as markdown</div>
      {widgeted.status === 'errored' && <div className={styles.previewResult}><span className={styles.muted}>Fails: {widgeted.err.message}</span></div>}
      {widgeted.status === 'missing' && <div className={styles.previewResult}><span className={styles.muted}>nothing (a dash in the grid)</span></div>}
      {widgeted.status === 'ok' && <Box component="pre" className={styles.foldBody}>{Widgeted.textOf(widgeted)}</Box>}
    </div>
  )
}
