import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { mintId } from '../lib/ids'
import * as Labelmaker from '../lib/labelmaker'
import { AskValidators } from './ask'
import { Question, QuestionValidators, type QuestionT } from './question'

/** Every column or ordering a quiz can have been committed into */
export const SortkeyVals = [
  'qnum', 'title', 'chains_to', 'clueing_plus_rank',
  'clueing_full', 'clueing_numeral', 'butnot_full', 'butnot_numeral',
  'hint_full', 'hint_numeral', 'clueing_plus_butnot_full',
  'clueing_ishes', 'butnot_ishes', 'hint_ishes',
  'chain_order',
] as const
export type Sortkey = typeof SortkeyVals[number]

/** How many blank questions a new quiz opens with, so the grid is never an empty void */
export const BlankQuestionQty = 5

export const QuizValidators = Validator(({ obj, arr, oneof, title, label, bool, uint, timestamp, ulid }) => {
  const sortkey = oneof(SortkeyVals)
    .describe('Which column or ordering last committed the quiz to its current order. Purely a label: it is remembered so that header can stay bold as a reminder of how the questions came to be in this order, and it never re-sorts anything on load.')

  const quizLabel = label
    .describe('A freeform-editable local identifier, generated once at creation. Meant to become the quiz\'s URL route.')
  const forced_label = label.nullable()
    .describe('An author-chosen label overriding the generated one, or null to keep the generated one.')

  const bulkIshesRun = obj({
    approx_tokens: AskValidators.approxTokens,
    text_count:    uint
      .describe('How many texts went into that one batched request, so "~4,200 tok last time (28 texts)" reads as a cost per run rather than a mystery number.'),
    updated_at:    timestamp,
  }).nullable()
    .describe('What the last "Recalculate all ishes" run cost, kept per quiz. Never cleared by, and never clears, an individual cell\'s own token figure.')

  const quiz = obj({
    id:              ulid,
    title:           title.default('')
      .describe('What the author calls this quiz. Shown in the switcher, in the browser tab title, and as the heading; an empty title displays as "Untitled quiz" without ever being rewritten to that on disk.'),
    label:           quizLabel.default(() => Labelmaker.localBlankLabel(new Set(), mintId())),
    forced_label:    forced_label.default(null),
    questions:       arr(QuestionValidators.question).default([])
      .describe('The questions, in their committed display order. This array IS the order: sorting and dragging rewrite it, so the arrangement survives a reload exactly as it was left.'),
    locked:          bool.default(false)
      .describe('When true this quiz accepts no edits at all -- a finished draft sent out for playtesting, kept readable and copyable but frozen against accidental change.'),
    last_sortkey:    sortkey.nullable().default(null),
    bulk_ishes_last: bulkIshesRun.default(null),
  })
    .check((context) => {
      const idsSeen = new Set<string>()
      for (const [ii, question] of context.value.questions.entries()) {
        if (idsSeen.has(question.id)) {
          context.issues.push({ code: 'custom', input: question.id, path: ['questions', ii, 'id'], message: 'Two questions in one quiz share an id' })
        }
        idsSeen.add(question.id)
      }
      for (const [ii, question] of context.value.questions.entries()) {
        if (! question.chains_to) { continue }
        if (question.chains_to === question.id) {
          context.issues.push({ code: 'custom', input: question.chains_to, path: ['questions', ii, 'chains_to'], message: 'A question cannot chain to itself' })
        } else if (! idsSeen.has(question.chains_to)) {
          context.issues.push({ code: 'custom', input: question.chains_to, path: ['questions', ii, 'chains_to'], message: 'Chain target is not a question in this quiz' })
        }
      }
    })
    .describe('One trivia quiz. Chain integrity is checked here rather than on the question, because a chain is only meaningful relative to its siblings.')

  return { sortkey, bulkIshesRun, quiz }
})

export type BulkIshesRunT = Z.output<typeof QuizValidators.bulkIshesRun>
export type QuizDNA       = Z.input<typeof QuizValidators.quiz>
export type QuizT         = Z.output<typeof QuizValidators.quiz>

/** One trivia quiz: a name, an ordered list of questions, and how it came to be in that order */
export class Quiz implements QuizT {
  declare id:              string
  declare title:           string
  declare label:           string
  declare forced_label:    string | null
  declare questions:       QuestionT[]
  declare locked:          boolean
  declare last_sortkey:    Sortkey | null
  declare bulk_ishes_last: BulkIshesRunT

  /**
   * Validated quiz, with every omitted field defaulted and its chains checked. A blank title is
   * populated from the label, titleized, so a fresh quiz reads as "Quiet Otter" rather than
   * nothing at all.
   *
   * @param dna - At minimum an id.
   * @returns A complete quiz.
   * @throws When two questions share an id, or a chain dangles or points at itself.
   *
   * @example Quiz.fill({ id: mintId(), title: 'Quiz one' })
   */
  static fill(dna: QuizDNA): QuizT {
    const quiz = QuizValidators.quiz(dna)
    return quiz.title === '' ? { ...quiz, title: Labelmaker.titleize(quiz.label) } : quiz
  }

  /**
   * Fresh quiz under a newly minted id, holding `BlankQuestionQty` empty questions.
   *
   * @param title - What to call it; defaults to unnamed, which displays as "Untitled quiz".
   * @returns A quiz ready to type into.
   *
   * @example Quiz.blank().questions.length  // => 5
   */
  static blank(title = ''): QuizT {
    return this.fill({
      id:        mintId(),
      title,
      questions: Array.from({ length: BlankQuestionQty }, () => Question.blank()),
    })
  }
}
