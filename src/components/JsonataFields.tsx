'use client'

import { useMemo, useState } from 'react'
import { MenuItem, Stack, TextField } from '@mui/material'
import { CopyButton } from './CopyButton'
import { JsonFold } from './JsonFold'
import * as Formulas from '../lib/formulas'
import { JsonataFormulary } from '../lib/formulary/jsonata'
import * as Runner from '../lib/formulary/runner'
import * as Rank from '../lib/rank'
import { Widgeted } from '../models/widgeted'
import type { AdviceSubject, LiveRun } from '../lib/formulary/formularies'
import { JsonataDefaultInput, type WidgetT } from '../models/widget'
import type { ShallowHuntT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import type { WidgetDraft } from '../state/widget-edit'
import { useOtherQuiz } from '../state/use-other-quiz'
import styles from './workbench.module.css'

export type JsonataFieldsProps = {
  /** The hunt, whose every quiz the preview can be pointed at */
  hunt:          ShallowHuntT
  /** The library, whose widgets the quizzes' widgetings work */
  library:       readonly WidgetT[]
  /** The quiz on screen, whose questions the preview starts on */
  openQuiz:      QuizT
  draft:         WidgetDraft
  onChange:      (patch: Partial<WidgetDraft>) => void
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
  const [quiz_id, setQuizId] = useState<string>(openQuiz._id)
  const [question_id, setQuestionId] = useState<string | null>(null)

  const quizzes = useMemo(() => hunt.realms.flatMap((realm) => realm.quizzes), [hunt])
  // Another quiz than the one on screen is read for as long as the preview is pointed at it.
  const picked = quiz_id === openQuiz._id ? null : quizzes.find((row) => row._id === quiz_id) ?? null
  const other = useOtherQuiz(picked?._id ?? null)
  const quiz: QuizT | null = picked ? other : openQuiz
  const ranked = useMemo(() => Rank.inRankOrder(quiz?.questions ?? []), [quiz])
  const question = ranked.find((held) => held._id === question_id) ?? ranked[0]
  const realm = quiz && hunt.realms.find((held) => held.quizzes.some((row) => row._id === quiz._id))
  // The bag the widget's widgeting reads: with the widgeteds of those before it, or of every
  // widgeting, for one not yet put to work.
  const label = widgeting?.label ?? ''
  const bags = useMemo((): ReadonlyMap<string, Runner.QuizBag> => {
    if (! quiz || ! realm) { return new Map() }
    const run = Runner.runQuiz(Runner.sourceOf(quiz, library, Runner.placeOf(hunt, realm)))
    return Runner.bagsAt(run, { label, params: {} })
  }, [quiz, hunt, library, realm, label])
  const bag = question ? bags.get(question._id) : undefined

  const syntaxIssue = draft.formula === '' ? null : Formulas.check(draft.formula)
  const lengthIssue = draft.formula.length > Formulas.FormulaMax ? `should be at most ${String(Formulas.FormulaMax)} characters` : null
  // A widget the library holds is previewed over its own input; a new one over the default.
  const input_formula = library.find((widget) => widget.label === draft.label)?.input_formula ?? JsonataDefaultInput
  const preview: LiveRun = bag
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
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
        <TextField
          select size="small" label="Preview quiz" value={quiz_id} sx={{ minWidth: 180 }}
          onChange={(event) => { setQuizId(event.target.value); setQuestionId(null) }}
        >
          {quizzes.map((held) => <MenuItem key={held._id} value={held._id}>{held.title || held.label}</MenuItem>)}
        </TextField>
        <TextField
          select size="small" label="Preview question" value={question?._id ?? ''} sx={{ minWidth: 220 }}
          disabled={ranked.length === 0}
          onChange={(event) => { setQuestionId(event.target.value) }}
        >
          {ranked.map((held) => <MenuItem key={held._id} value={held._id}>{`${held.qnum === '' ? '–' : held.qnum} · ${held.title || held.label}`}</MenuItem>)}
        </TextField>
      </Stack>
      <PreviewResult preview={preview} />
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
