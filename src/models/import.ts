import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as PA from '../lib/vv/patterns'
import { QuestionValidators } from './question'

export const ImportValidators = Validator(({ obj, arr, titleish, label, union, zod }) => {
  const importQuestion = obj({
    label:         label.optional(),
    forced_label:  label.nullable().optional(),
    qnum:          QuestionValidators.qnum.nullable().optional(),
    clueing:       QuestionValidators.clueing.nullable().optional(),
    hint:          QuestionValidators.hint.nullable().optional(),
    title:         QuestionValidators.title.nullable().optional(),
    chains_to:     label.nullable().optional(),
    alt_text:      QuestionValidators.alt_text.nullable().optional(),
    notes:         QuestionValidators.notes.nullable().optional(),
    full_answer:   QuestionValidators.full_answer.nullable().optional(),
  })
    .describe('One question as it arrives from an import. Every field is nullable and nothing is required, because the three states carry three different instructions: a field ABSENT means "leave whatever is already there", a field set to NULL means "clear it", and a field with a value means "take this". The label (or the forced label, where there is one) is the key a question is matched on, and is never itself revised. A chain names the label of the question it points at. Unknown keys are dropped rather than rejected, so a file carrying extra bookkeeping from somewhere else still imports cleanly; what a widgeting came to is among them, since a worked-out value is worked out again and a stored one is recorded by asking.')

  // The shape is read loosely first and each question validated on its own afterwards, so one
  // bad question is skipped and logged rather than blocking the whole import.
  const looseQuestions = arr(zod.unknown()).default([])

  const importQuiz = obj({
    label:        label.optional(),
    forced_label: label.nullable().optional(),
    title:        titleish.nullable().optional(),
    questions:    looseQuestions,
    widgetings:   arr(zod.unknown()).default([])
      .describe('The widgetings the pasted quiz works, read one by one, so one that will not do is skipped and logged.'),
  })
    .describe('One quiz as it arrives from an import. Its questions are merged, and its widgetings, each by label; a pasted quiz\'s own columns, lock state and sort memory are ignored, because those describe how someone ELSE was working, not what this quiz contains.')

  const importRealm = obj({ quizzes: arr(importQuiz).min(1) })
  const importHunt = obj({
    realms: arr(importRealm).min(1),
  })
    .describe('A whole hunt, as the Export box hands it over: its quizzes are read realm by realm, and everything else about it is ignored.')

  const importPayload = union([importHunt, importQuiz, looseQuestions])
    .describe('What the Import box accepts: a whole exported hunt, a single quiz, or a bare list of questions. The author should be able to paste back anything the Export box hands them, or a fragment they trimmed by hand, without first having to reshape it.')

  const importPatch = obj({
    qnum:        QuestionValidators.qnum.optional(),
    clueing:     QuestionValidators.clueing.optional(),
    hint:        QuestionValidators.hint.optional(),
    title:       QuestionValidators.title.optional(),
    chains_to:   label.nullable().optional(),
    alt_text:    QuestionValidators.alt_text.optional(),
    notes:       QuestionValidators.notes.optional(),
    full_answer: QuestionValidators.full_answer.optional(),
  })
    .describe('What an import changes on one question, once read: the author\'s fields, each optional, as `edit_question` takes them, except that a chain names the label of the question it points at, or null for none.')

  const importedQuestion = obj({ label, patch: importPatch })
    .describe('One question as the Import panel sends it: which question, by the label in force, and what to change. A label no question of the quiz answers to adds one under it.')

  const importedQuestions = arr(importedQuestion).max(PA.QuestionsPerQuiz.max).readonly()
    .check((context) => {
      const labels = context.value.map((question) => question.label)
      for (const [idx, seen] of labels.entries()) {
        if (labels.indexOf(seen) < idx) { context.issues.push({ code: 'custom', input: seen, path: [idx, 'label'], message: 'Two imported questions share a label' }) }
      }
    })
    .describe('Everything one import changes, one entry per label.')

  return { importQuestion, importQuiz, importHunt, importPayload, importPatch, importedQuestion, importedQuestions }
})

export type ImportQuestionT    = Z.output<typeof ImportValidators.importQuestion>
export type ImportQuizT        = Z.output<typeof ImportValidators.importQuiz>
export type ImportHuntT        = Z.output<typeof ImportValidators.importHunt>
export type ImportPayloadT     = Z.output<typeof ImportValidators.importPayload>
export type ImportPatchT       = Z.output<typeof ImportValidators.importPatch>
export type ImportedQuestionT  = Z.output<typeof ImportValidators.importedQuestion>

/** Fields an import may revise; the label is not among them, and neither is anything derived */
export const ImportableFieldnames = [
  'qnum', 'clueing', 'hint', 'title', 'chains_to', 'alt_text', 'notes', 'full_answer',
] as const
export type ImportableFieldname = typeof ImportableFieldnames[number]

/** What "clear this field" means, per field */
export const ClearedValueFor: Record<ImportableFieldname, string | null> = {
  qnum:          '',
  clueing:       '',
  hint:          '',
  title:         '',
  chains_to:     null,
  alt_text:      '',
  notes:         '',
  full_answer:   '',
}
