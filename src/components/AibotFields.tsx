'use client'

import { Box, MenuItem, Stack, TextField } from '@mui/material'
import { NumericFormat } from 'react-number-format'
import { CopyButton } from './CopyButton'
import { JsonFold } from './JsonFold'
import { PreviewPicker } from './PreviewPicker'
import { usePreviewBag } from './use-preview-bag'
import * as Formulas from '../lib/formulas'
import * as PA from '../lib/vv/patterns'
import * as Prompts from '../lib/ask/prompts'
import { AibotFormulary, type RenderedPrompt } from '../lib/formulary/aibot'
import { ServicelabelVals, type Servicelabel } from '../lib/credentials'
import { ModelTierVals, type ModelTier } from '../models/ask'
import { AibotTokensMax, type AibotWidgetT, type WidgetT } from '../models/widget'
import type { AdviceSubject } from '../lib/formulary/formularies'
import type { ShallowHuntT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import type { AibotDraft } from '../state/widget-edit'
import styles from './workbench.module.css'

/** How each tier reads in the tier select */
const TierTitles: Readonly<Record<ModelTier, string>> = {
  quick:   'Quick: a hasty first instinct',
  careful: 'Careful: a thorough reading',
}

/** How each service reads in the service select */
const ServiceTitles: Readonly<Record<Servicelabel, string>> = {
  claude: 'Claude',
}

export type AibotFieldsProps = {
  /** The hunt, whose every quiz the preview can be pointed at */
  hunt:          ShallowHuntT
  /** The library, whose widgets the quizzes' widgetings work */
  library:       readonly WidgetT[]
  /** The quiz on screen, whose questions the preview starts on */
  openQuiz:      QuizT
  draft:         AibotDraft
  onChange:      (patch: Partial<AibotDraft>) => void
  /** A new widget is named here; an existing one is not renamed */
  labelEditable: boolean
  /** What is wrong with the label being typed, when something is */
  labelIssue:    string | null
  /** The widgeting the widget is being written for, when there is one, for the preview and the advice */
  widgeting:     AdviceSubject | null
}

/**
 * An `aibot` widget's label, description, prompt, input formula and config, with a live preview
 * against a real question of what the input formula distils it to and the prompt as it would be
 * sent, and a button that copies a prompt asking a chatbot to help write the prompt.
 *
 * The preview follows the draft as it is typed, and asks nothing: a model is put the prompt only
 * from the cell. Any quiz of the hunt and any of its questions can be picked; it starts on the
 * lowest-numbered question of the open quiz.
 */
export function AibotFields({ hunt, library, openQuiz, draft, onChange, labelEditable, labelIssue, widgeting }: Readonly<AibotFieldsProps>) {
  const preview = usePreviewBag(hunt, library, openQuiz, widgeting?.label ?? '')
  const { bag } = preview
  const rendered: RenderedPrompt | null = bag ? AibotFormulary.prompt(draft, bag) : null

  const promptIssue = draft.formula === '' ? null : Prompts.templateIssue(draft.formula)
  const promptLong = draft.formula.length > PA.Textish.max ? `should be at most ${String(PA.Textish.max)} characters` : null
  const inputIssue = draft.input_formula === '' ? 'An input formula is needed: `{}` reads nothing' : Formulas.check(draft.input_formula)
  const setConfig = (patch: Partial<AibotDraft['config']>) => { onChange({ config: { ...draft.config, ...patch } }) }

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
        helperText="What it asks for, for whoever is choosing between widgets."
        onChange={(event) => { onChange({ description: event.target.value }) }}
      />
      <TextField
        size="small" multiline minRows={6} maxRows={20} label="Prompt" value={draft.formula}
        error={promptIssue !== null || promptLong !== null}
        helperText={promptIssue ?? promptLong ?? 'Each {{name}} is filled in from that key of the input. Say in words what JSON object you want back.'}
        slotProps={{ htmlInput: { style: { fontFamily: 'var(--font-data)', fontSize: 12 } } }}
        onChange={(event) => { onChange({ formula: event.target.value }) }}
      />
      <TextField
        size="small" multiline maxRows={6} label="Input formula" value={draft.input_formula}
        error={inputIssue !== null}
        helperText={inputIssue ?? 'A JSONata expression coming to the object the prompt is filled in from. Nothing means the question is not asked.'}
        slotProps={{ htmlInput: { style: { fontFamily: 'var(--font-data)', fontSize: 12 } } }}
        onChange={(event) => { onChange({ input_formula: event.target.value }) }}
      />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
        <TextField
          select size="small" label="Service" value={draft.config.servicelabel} sx={{ minWidth: 140 }}
          onChange={(event) => { setConfig({ servicelabel: event.target.value as Servicelabel }) }}
        >
          {ServicelabelVals.map((servicelabel) => <MenuItem key={servicelabel} value={servicelabel}>{ServiceTitles[servicelabel]}</MenuItem>)}
        </TextField>
        <TextField
          select size="small" label="Model tier" value={draft.config.model_tier} sx={{ minWidth: 260 }}
          onChange={(event) => { setConfig({ model_tier: event.target.value as ModelTier }) }}
        >
          {ModelTierVals.map((tier) => <MenuItem key={tier} value={tier}>{TierTitles[tier]}</MenuItem>)}
        </TextField>
        <NumericFormat
          customInput={TextField} size="small" label="Max tokens" sx={{ width: 170 }}
          value={draft.config.max_tokens} allowNegative={false} decimalScale={0}
          helperText={`Room to answer in, at most ${String(AibotTokensMax)}`}
          isAllowed={({ floatValue }) => floatValue === undefined || floatValue <= AibotTokensMax}
          onValueChange={({ floatValue }) => { setConfig({ max_tokens: floatValue ?? 0 }) }}
        />
      </Stack>
      <PreviewPicker preview={preview} />
      {rendered && <RenderedPreview rendered={rendered} template={draft.formula} />}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CopyButton textOf={() => AibotFormulary.advice(widgetOf(draft), widgeting, bag ?? null)}>
          Copy a prompt for a chatbot
        </CopyButton>
      </Stack>
    </Stack>
  )
}

/** What the input formula distils the question to, and the prompt it fills in, or why there is none */
function RenderedPreview({ rendered, template }: Readonly<{ rendered: RenderedPrompt, template: string }>) {
  if (rendered.status === 'missing') {
    return <div className={styles.previewResult} role="status" aria-label="Preview input"><span className={styles.muted}>The input comes to nothing: this question would not be asked.</span></div>
  }
  const unfilled = rendered.input === null ? [] : Prompts.unfilledKeys(template, rendered.input)
  return (
    <Stack spacing={1}>
      <div role="status" aria-label="Preview input">
        <div className={styles.microcopy}>The input the prompt is filled in from, for this question</div>
        {rendered.status === 'errored' && rendered.input === null
          ? <span className={styles.muted}>Fails: {rendered.message}</span>
          : <JsonFold label="input" val={rendered.input} />}
      </div>
      <div>
        <div className={styles.microcopy}>
          {rendered.status === 'ok' ? `The prompt as it would be sent: ${String(rendered.prompt.length)} characters` : 'The prompt as it would be sent'}
        </div>
        {rendered.status === 'ok'
          ? <Box component="pre" className={styles.foldBody} aria-label="Rendered prompt">{rendered.prompt}</Box>
          : rendered.input !== null && <div className={styles.previewResult} aria-label="Rendered prompt"><span className={styles.muted}>Fails: {rendered.message}</span></div>}
        {unfilled.length > 0 && (
          <div className={styles.microcopy} role="note">
            The input holds nothing for {unfilled.map((key) => `{{${key}}}`).join(', ')}, which fills in as nothing.
          </div>
        )}
      </div>
    </Stack>
  )
}

/** The draft as a widget, for the advice prompt */
function widgetOf(draft: AibotDraft): AibotWidgetT {
  return { scope: 'pub', title: '', ...draft }
}
