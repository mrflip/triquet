import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { GuessValidators } from './guess'
import { IshValidators } from './ish'
import { QuestionValidators } from './question'

export const ImportValidators = Validator(({ obj, arr, str, titleish, label, union, zod }) => {
  // Ids arriving from an import are accepted as-is provided they are non-empty: a hand-written
  // quiz file has no reason to know about ULIDs, and an id minted in another browser means
  // nothing here anyway -- it is only ever used to resolve that file's own chains.
  const foreignId = str.min(1)

  const importQuestion = obj({
    id:            foreignId.optional(),
    label:         label.optional(),
    forced_label:  label.nullable().optional(),
    qnum:          QuestionValidators.qnum.nullable().optional(),
    clueing:       QuestionValidators.clueing.nullable().optional(),
    hint:          QuestionValidators.hint.nullable().optional(),
    title:         QuestionValidators.title.nullable().optional(),
    chains_to:     foreignId.nullable().optional(),
    guess:         GuessValidators.guess.optional(),
    clueing_ishes: IshValidators.ishes.optional(),
    hint_ishes:    IshValidators.ishes.optional(),
    alt_text:      QuestionValidators.alt_text.nullable().optional(),
    notes:         QuestionValidators.notes.nullable().optional(),
    full_answer:   QuestionValidators.full_answer.nullable().optional(),
  })
    .describe('One question as it arrives from an import. Every field is nullable and nothing is required, because the three states carry three different instructions: a field ABSENT means "leave whatever is already there", a field set to NULL means "clear it", and a field with a value means "take this". The label (or the forced label, where there is one) is the key a question is matched on, and is never itself revised. Unknown keys are dropped rather than rejected, so a file carrying extra bookkeeping from somewhere else still imports cleanly.')

  // The shape is read loosely first and each question validated on its own afterwards, so one
  // bad question is skipped and logged rather than blocking the whole import.
  const looseQuestions = arr(zod.unknown()).default([])

  const importQuiz = obj({
    id:        foreignId.optional(),
    title:     titleish.nullable().optional(),
    questions: looseQuestions,
  })
    .describe('One quiz as it arrives from an import. Only the questions are merged; a pasted quiz\'s own lock state, sort memory and batch-run record are ignored, because those describe how someone ELSE was working, not what this quiz contains.')

  const importRealm = obj({ quizzes: arr(importQuiz).min(1) })
  const importHunt = obj({
    realms: arr(importRealm).min(1),
  })
    .describe('A whole hunt, as the Export box hands it over: its quizzes are read realm by realm, and everything else about it is ignored.')

  const importWorkspace = obj({
    quizzes:        arr(importQuiz).min(1),
    active_quiz_id: foreignId.optional(),
  })
    .describe('A whole workspace, as the Export box handed it over before quizzes lived in hunts. Still accepted, so an old backup can be brought back.')

  const importPayload = union([importHunt, importWorkspace, importQuiz, looseQuestions])
    .describe('What the Import box accepts: a whole exported hunt, a whole workspace exported before hunts, a single quiz, or a bare list of questions. The author should be able to paste back anything the Export box ever handed them, or a fragment they trimmed by hand, without first having to reshape it.')

  return { importQuestion, importQuiz, importHunt, importWorkspace, importPayload }
})

export type ImportQuestionDNA = Z.input<typeof ImportValidators.importQuestion>
export type ImportQuestionT   = Z.output<typeof ImportValidators.importQuestion>
export type ImportQuizT       = Z.output<typeof ImportValidators.importQuiz>
export type ImportHuntT       = Z.output<typeof ImportValidators.importHunt>
export type ImportWorkspaceT  = Z.output<typeof ImportValidators.importWorkspace>
export type ImportPayloadT    = Z.output<typeof ImportValidators.importPayload>

/** Fields an import may revise; the id is not among them, and neither is anything derived */
export const ImportableFieldnames = [
  'qnum', 'clueing', 'hint', 'title', 'chains_to',
  'guess', 'clueing_ishes', 'hint_ishes', 'alt_text', 'notes', 'full_answer',
] as const
export type ImportableFieldname = typeof ImportableFieldnames[number]

/** What "clear this field" means, per field */
export const ClearedValueFor: Record<ImportableFieldname, string | null> = {
  qnum:          '',
  clueing:       '',
  hint:          '',
  title:         '',
  chains_to:     null,
  guess:         null,
  clueing_ishes: null,
  hint_ishes:    null,
  alt_text:      '',
  notes:         '',
  full_answer:   '',
}
