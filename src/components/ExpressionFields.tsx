'use client'

import { useMemo, useState } from 'react'
import { MenuItem, Stack, TextField } from '@mui/material'
import { CopyButton } from './CopyButton'
import { JsonFold } from './JsonFold'
import * as Expressed from '../lib/expressed'
import * as Formulas from '../lib/formulas'
import { formulaPrompt } from '../lib/formula-prompt'
import * as Rank from '../lib/rank'
import { ExpressionValidators, type ExpressionT } from '../models/expression'
import type { PromptSubject } from '../lib/formula-prompt'
import type { ShallowHuntT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import { useOtherQuiz } from '../state/use-other-quiz'
import styles from './workbench.module.css'

/** The parts of an expression being edited */
export type ExpressionDraft = Pick<ExpressionT, 'label' | 'description' | 'formula'>

export type ExpressionFieldsProps = {
  /** The hunt, whose every quiz the preview can be pointed at */
  hunt:          ShallowHuntT
  /** The quiz on screen, whose questions the preview starts on */
  openQuiz:      QuizT
  draft:         ExpressionDraft
  onChange:      (patch: Partial<ExpressionDraft>) => void
  /** A new expression is named here; an existing one is not renamed */
  labelEditable: boolean
  /** What is wrong with the label being typed, when something is */
  labelIssue:    string | null
  /** The column the expression is being written for, when there is one, for the prompt */
  expressing:    PromptSubject['expressing']
}

/**
 * An expression's label, description and formula, with a live preview against a real question
 * and a button that copies a prompt asking a chatbot for the formula.
 *
 * The preview is worked out from the draft as it is typed, so a mistake is named, and a fix is
 * seen, before anything is applied. Any quiz of the hunt and any of its questions can be
 * picked; it starts on the lowest-numbered question of the open quiz.
 */
export function ExpressionFields({ hunt, openQuiz, draft, onChange, labelEditable, labelIssue, expressing }: Readonly<ExpressionFieldsProps>) {
  const [quizId, setQuizId] = useState<string>(openQuiz._id)
  const [questionId, setQuestionId] = useState<string | null>(null)

  const quizzes = useMemo(() => hunt.realms.flatMap((realm) => realm.quizzes), [hunt])
  // Another quiz than the one on screen is read for as long as the preview is pointed at it.
  const picked = quizId === openQuiz._id ? null : quizzes.find((row) => row._id === quizId) ?? null
  const other = useOtherQuiz(picked?._id ?? null)
  const quiz: QuizT | null = picked ? other : openQuiz
  const ranked = useMemo(() => Rank.inRankOrder(quiz?.questions ?? []), [quiz])
  const question = ranked.find((held) => held._id === questionId) ?? ranked[0]
  const bags = useMemo((): ReadonlyMap<string, Expressed.QuizBag> => (quiz ? Expressed.bagsFor(quiz) : new Map()), [quiz])
  const bag = question ? bags.get(question._id) : undefined

  const syntaxIssue = draft.formula === '' ? null : Formulas.check(draft.formula)
  const lengthIssue = ExpressionValidators.expressionPatch.safeParse({ formula: draft.formula }).error?.issues[0]?.message ?? null
  const preview = Expressed.previewOf(draft.formula, bag)

  return (
    <Stack spacing={1.5}>
      {labelEditable
        ? (
          <TextField
            size="small" label="Expression label" value={draft.label} sx={{ maxWidth: 320 }}
            error={labelIssue !== null} helperText={labelIssue ?? 'What the expression is called, for choosing it again. It cannot be changed afterward.'}
            onChange={(event) => { onChange({ label: event.target.value }) }}
          />
        )
        : <div><strong>{draft.label}</strong> <span className={styles.microcopy}>expression</span></div>}
      <TextField
        size="small" label="Expression description" value={draft.description}
        helperText="What it works out, for whoever is choosing between expressions."
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
          select size="small" label="Preview quiz" value={quizId} sx={{ minWidth: 180 }}
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
          <JsonFold label="quiz" val={bag.quiz} />
          <JsonFold label={`qns (${String(bag.qns.length)})`} val={bag.qns} />
          <JsonFold label="qn" val={bag.qn} />
        </div>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CopyButton textOf={() => formulaPrompt({ expressing, expression: draft, sample: bag?.qn ?? null })}>
          Copy a prompt for a chatbot
        </CopyButton>
      </Stack>
    </Stack>
  )
}

/** What the draft formula comes to for the question chosen */
function PreviewResult({ preview }: Readonly<{ preview: Expressed.Expressed }>) {
  return (
    <div className={styles.previewResult} role="status" aria-label="Preview result">
      <span className={styles.microcopy}>Comes to </span>
      {previewText(preview)}
    </div>
  )
}

/** The preview, in words */
function previewText(preview: Expressed.Expressed): React.ReactNode {
  if (preview.status === 'error') { return <span className={styles.muted}>Fails: {preview.message}</span> }
  if (preview.status === 'nothing') { return <span className={styles.muted}>nothing (a dash in the grid)</span> }
  return <code>{String(preview.val)}{preview.stale ? ' (stale)' : ''}</code>
}
