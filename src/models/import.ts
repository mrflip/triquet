import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as PA from '../lib/vv/patterns'
import { AskValidators, ModelTierVals } from './ask'
import { BotSlots, BottingValidators, checkBotSlot } from './botting'
import { IshValidators, IshesPerTextMax } from './ish'
import { QuestionValidators } from './question'

export const ImportValidators = Validator(({ obj, arr, bool, lit, oneof, textish, titleish, label, union, zod }) => {
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
    .describe('One question as it arrives from an import. Every field is nullable and nothing is required, because the three states carry three different instructions: a field ABSENT means "leave whatever is already there", a field set to NULL means "clear it", and a field with a value means "take this". The label (or the forced label, where there is one) is the key a question is matched on, and is never itself revised. A chain names the label of the question it points at. Unknown keys are dropped rather than rejected, so a file carrying extra bookkeeping from somewhere else still imports cleanly. What a bot replied is read on its own (`importedGuess`, `importedIshes`), so a reply that will not read never costs the question its text.')

  // A bot's reply as an export carries it: when it was asked, whether it was stale and how a
  // refresh failed are passed over, since none of them survives the move.
  const replyMeta = {
    truncated:          bool.default(false),
    model_tier_applied: oneof(ModelTierVals).optional(),
    approx_tokens:      AskValidators.approxTokens.optional(),
  }
  const importedGuess = obj({ status: lit('done'), text: textish, ...replyMeta })
    .describe('A guess as an export carries it, to be kept as the question\'s cached reply.')
  const importedIshes = obj({ status: lit('done'), items: arr(IshValidators.ishItem).max(IshesPerTextMax).default([]), ...replyMeta })
    .describe('An extraction as an export carries it, to be kept as the question\'s cached reply.')

  // The shape is read loosely first and each question validated on its own afterwards, so one
  // bad question is skipped and logged rather than blocking the whole import.
  const looseQuestions = arr(zod.unknown()).default([])

  const importQuiz = obj({
    label:        label.optional(),
    forced_label: label.nullable().optional(),
    title:        titleish.nullable().optional(),
    questions:    looseQuestions,
  })
    .describe('One quiz as it arrives from an import. Only the questions are merged; a pasted quiz\'s own lock state, sort memory and batch-run record are ignored, because those describe how someone ELSE was working, not what this quiz contains.')

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

  const { bot_label, textkind, reply_text, items, truncated, model_tier_applied, approx_tokens } = BottingValidators.row.shape
  const importedBotting = obj({ bot_label, textkind, reply_text, items, truncated, model_tier_applied, approx_tokens })
    .check(checkBotSlot)
    .describe('A bot\'s reply carried in by an import, to fill a cell that holds none: what the reply was, and nothing of what it was asked. It is recorded with that text unknown, so it reads as stale until the bot is asked again.')

  const importedQuestion = obj({ label, patch: importPatch, bottings: arr(importedBotting).max(BotSlots.length).default([]) })
    .describe('One question as the Import panel sends it: which question, by the label in force, what to change, and the bots\' replies it carried. A label no question of the quiz answers to adds one under it.')

  const importedQuestions = arr(importedQuestion).max(PA.QuestionsPerQuiz.max).readonly()
    .check((context) => {
      const labels = context.value.map((question) => question.label)
      for (const [idx, seen] of labels.entries()) {
        if (labels.indexOf(seen) < idx) { context.issues.push({ code: 'custom', input: seen, path: [idx, 'label'], message: 'Two imported questions share a label' }) }
      }
    })
    .describe('Everything one import changes, one entry per label.')

  return { importQuestion, importedGuess, importedIshes, importQuiz, importHunt, importPayload, importPatch, importedBotting, importedQuestion, importedQuestions }
})

export type ImportQuestionT    = Z.output<typeof ImportValidators.importQuestion>
export type ImportQuizT        = Z.output<typeof ImportValidators.importQuiz>
export type ImportHuntT        = Z.output<typeof ImportValidators.importHunt>
export type ImportPayloadT     = Z.output<typeof ImportValidators.importPayload>
export type ImportPatchT       = Z.output<typeof ImportValidators.importPatch>
export type ImportedBottingT   = Z.output<typeof ImportValidators.importedBotting>
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
