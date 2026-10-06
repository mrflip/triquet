import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as PA from '../lib/vv/patterns'
import { DefaultViz, QuestionValidators } from './question'
import { WidgetedValidators } from './widgeted'

export const ImportValidators = Validator(({ obj, arr, rec, label }) => {
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
    recap:         QuestionValidators.recap.nullable().optional(),
    viz:           QuestionValidators.viz.nullable().optional(),
  })
    .describe('One question as it arrives from an import. Every field is nullable and nothing is required, because the three states carry three different instructions: a field ABSENT means "leave whatever is already there", a field set to NULL means "clear it", and a field with a value means "take this". The label is the key a question is matched on, and is never itself revised; an export made while a label could be overridden carries the override as `forced_label`, which is the key in its place where it is set. A chain names the label of the question it points at; how the question is shown (its viz) is carried, null making it normal, but when it was made and edited is not: the question is stamped as the import writes it. Unknown keys are dropped rather than rejected, so a file carrying extra bookkeeping from somewhere else still imports cleanly; what a widgeting came to is among them, since a worked-out value is worked out again and an asked one is recorded by asking. An entry widgeting\'s value, which a person typed, is read apart from these fields, under its label.')

  const importPatch = obj({
    qnum:        QuestionValidators.qnum.optional(),
    clueing:     QuestionValidators.clueing.optional(),
    hint:        QuestionValidators.hint.optional(),
    title:       QuestionValidators.title.optional(),
    chains_to:   label.nullable().optional(),
    alt_text:    QuestionValidators.alt_text.optional(),
    notes:       QuestionValidators.notes.optional(),
    full_answer: QuestionValidators.full_answer.optional(),
    recap:       QuestionValidators.recap.optional(),
    viz:         QuestionValidators.viz.optional(),
  })
    .describe('What an import changes on one question, once read: the author\'s fields, each optional, as `edit_question` takes them, except that a chain names the label of the question it points at, or null for none.')

  const importedQuestion = obj({
    label,
    patch:   importPatch,
    entered: rec(label, WidgetedValidators.enteredValue).default({})
      .describe('What to type into the question\'s entry cells, by the entry widgeting\'s label: a value to take, or null to empty the cell. A label absent leaves its cell as it is.'),
  })
    .describe('One question as the Import panel sends it: which question, by its label, what to change, and what to type into its entry cells. A label no question of the quiz answers to adds one under it.')

  const importedQuestions = arr(importedQuestion).max(PA.QuestionsPerQuiz.max).readonly()
    .check((context) => {
      const labels = context.value.map((question) => question.label)
      for (const [idx, seen] of labels.entries()) {
        if (labels.indexOf(seen) < idx) { context.issues.push({ code: 'custom', input: seen, path: [idx, 'label'], message: 'Two imported questions share a label' }) }
      }
    })
    .describe('Everything one import changes, one entry per label.')

  return { importQuestion, importPatch, importedQuestion, importedQuestions }
})

export type ImportQuestionT    = Z.output<typeof ImportValidators.importQuestion>
export type ImportPatchT       = Z.output<typeof ImportValidators.importPatch>
export type ImportedQuestionT  = Z.output<typeof ImportValidators.importedQuestion>
export type ImportedQuestionDNA = Z.input<typeof ImportValidators.importedQuestion>

/** Fields an import may revise; the label is not among them, and neither is anything derived */
export const ImportableFieldnames = [
  'qnum', 'clueing', 'hint', 'title', 'chains_to', 'alt_text', 'notes', 'full_answer', 'recap', 'viz',
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
  recap:         '',
  viz:           DefaultViz,
}
