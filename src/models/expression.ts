import * as Z from 'zod'
import { Validator } from '../lib/validator'

/** Who wrote an expression: `tq` is Triquet itself */
export const ExpressionOwnerVals = ['tq'] as const
export type ExpressionOwner = typeof ExpressionOwnerVals[number]

/** The owner an expression has unless it says otherwise */
export const DefaultOwner: ExpressionOwner = 'tq'

export const ExpressionValidators = Validator(({ obj, oneof, label, formulaish, noteish }) => {
  const owner = oneof(ExpressionOwnerVals)
    .describe('Who wrote the expression. With the label it names the expression uniquely, so two owners may each have a "letter_count" without either being confused for the other.')
  const expressionLabel = label
    .describe('What the expression is called, unique among its owner\'s. Quizzes refer to it by this label, so it is fixed once made.')
  const formula = formulaish
    .describe('A JSONata formula. It reads the bag an expressing hands it -- `quiz`, `qns`, `qn`, `qn_label` and `quiz_label` -- and comes to one value per question. Kept exactly as typed, newlines and all, so a long formula can be laid out to be read.')
  const description = noteish
    .describe('What the expression works out, for the author choosing between expressions.')

  const expression = obj({
    owner:       owner.default(DefaultOwner),
    label:       expressionLabel,
    formula,
    description: description.default(''),
  })
    .describe('One reusable calculation over a question, such as "letter count". It is generic: which quiz shows it, and under what column title, is an expressing\'s business.')

  const expressionPatch = obj({
    formula:     formula.optional(),
    description: description.optional(),
  })
    .describe('The fields of one expression being revised. A key absent from a patch means "leave whatever is already there". The owner and label are not among them: they are what other things refer to it by.')

  return { owner, expression, expressionPatch }
})

export type ExpressionDNA   = Z.input<typeof ExpressionValidators.expression>
export type ExpressionT     = Z.output<typeof ExpressionValidators.expression>
export type ExpressionPatch = Z.output<typeof ExpressionValidators.expressionPatch>

/**
 * What names an expression among all the others: its owner and its label.
 *
 * @param expression - Anything with an owner and a label.
 * @returns A string equal for two expressions exactly when they are the same one.
 *
 * @example keyOf({ owner: 'tq', label: 'letter_count' })  // => 'tq/letter_count'
 */
export function keyOf(expression: Pick<ExpressionT, 'owner' | 'label'>): string {
  return `${expression.owner}/${expression.label}`
}

/** One reusable calculation over a question: a label, a JSONata formula, and what it is for */
export class Expression implements ExpressionT {
  declare owner:       ExpressionOwner
  declare label:       string
  declare formula:     string
  declare description: string

  /**
   * Validated expression, with the owner and description defaulted.
   *
   * @param dna - At least a label and a formula.
   * @returns A complete expression.
   * @throws When the label is not a label or the formula is empty, has control characters, or runs past 999 characters.
   *
   * @example Expression.fill({ label: 'shout', formula: '$uppercase(qn.title)' })
   */
  static fill(dna: ExpressionDNA): ExpressionT {
    return ExpressionValidators.expression(dna)
  }
}

/** The reference a formula in an expressing's column reads, for the seeds below to be written against */
const SumOf = (ishes: string, kind = ''): string => `$floor($sum($append([0], ${ishes}.items${kind}.value)) + 0.5)`

/**
 * The sum columns every quiz starts with, as expressions.
 *
 * Each reads one extraction and totals its spans, rounding halves upward. A column with nothing
 * behind it comes to nothing, because "nobody has extracted this yet" and "the answer is nought"
 * are different facts about a clue; and each carries the extraction's `stale` mark, so an edited
 * text greys its sums instead of emptying them.
 */
const SumSeedDNAs: readonly ExpressionDNA[] = [
  {
    label:       'clueing_full',
    description: 'Every number-like span in the clueing, added up.',
    formula:     `qn.clueing_ishes.status = 'done' ? {\n  'value': ${SumOf('qn.clueing_ishes')},\n  'stale': qn.clueing_ishes.stale\n}`,
  },
  {
    label:       'clueing_numeral',
    description: 'The spans in the clueing that are written in digits, added up.',
    formula:     `qn.clueing_ishes.status = 'done' ? {\n  'value': ${SumOf('qn.clueing_ishes', "[kind = 'numeral']")},\n  'stale': qn.clueing_ishes.stale\n}`,
  },
  {
    label:       'hint_full',
    description: 'Every number-like span in this question\'s own hint, added up.',
    formula:     `qn.hint_ishes.status = 'done' ? {\n  'value': ${SumOf('qn.hint_ishes')},\n  'stale': qn.hint_ishes.stale\n}`,
  },
  {
    label:       'hint_numeral',
    description: 'The spans in this question\'s own hint that are written in digits, added up.',
    formula:     `qn.hint_ishes.status = 'done' ? {\n  'value': ${SumOf('qn.hint_ishes', "[kind = 'numeral']")},\n  'stale': qn.hint_ishes.stale\n}`,
  },
  {
    label:       'butnot_full',
    description: 'Every number-like span in the hint of the question this one chains to, added up.',
    formula:     `(\n  $hint := (qns[label = $$.qn.chains_to]).hint_ishes;\n  $hint.status = 'done' ? {\n    'value': ${SumOf('$hint')},\n    'stale': $hint.stale\n  }\n)`,
  },
  {
    label:       'butnot_numeral',
    description: 'The spans written in digits in the hint of the question this one chains to, added up.',
    formula:     `(\n  $hint := (qns[label = $$.qn.chains_to]).hint_ishes;\n  $hint.status = 'done' ? {\n    'value': ${SumOf('$hint', "[kind = 'numeral']")},\n    'stale': $hint.stale\n  }\n)`,
  },
  {
    label:       'clueing_plus_rank',
    description: 'The clueing sum plus this question\'s rank: its place, counting from 1, once the quiz is put in Q# order.',
    formula:     `qn.clueing_ishes.status = 'done' and $type(qn.rank) = 'number' ? {\n  'value': ${SumOf('qn.clueing_ishes')} + qn.rank,\n  'stale': qn.clueing_ishes.stale\n}`,
  },
  {
    label:       'clueing_plus_butnot_full',
    description: 'The clueing sum plus the sum of the hint of the question this one chains to.',
    formula:     `(\n  $clueing := qn.clueing_ishes;\n  $hint := (qns[label = $$.qn.chains_to]).hint_ishes;\n  $clueing.status = 'done' and $hint.status = 'done' ? {\n    'value': ${SumOf('$clueing')} + ${SumOf('$hint')},\n    'stale': $clueing.stale or $hint.stale\n  }\n)`,
  },
]

/** Small text calculations, for the columns an author might want beside the sums */
const TextSeedDNAs: readonly ExpressionDNA[] = [
  {
    label:       'clueing_word_count',
    description: 'How many words the clueing has.',
    formula:     String.raw`$count($split($trim(qn.clueing), /\s+/)[$ != ''])`,
  },
  {
    label:       'clueing_with_butnot',
    description: 'The clueing with the BUT NOT text of the question this one chains to folded in: the complete unit as a player receives it. The phrase is only supplied when the hint does not already say it.',
    formula:     "(\n  $hint := $trim((qns[label = $$.qn.chains_to]).hint);\n  $exists($hint) and $hint != '' ?\n    qn.clueing & ($contains($hint, /^but not\\b/i) ? ' ... ' : ' ... BUT NOT ... ') & $hint :\n    qn.clueing\n)",
  },
  {
    label:       'answer_letter_count',
    description: 'How many letters the full answer has, ignoring everything that is not a letter.',
    formula:     "$length($replace(qn.full_answer, /[^a-z]/i, ''))",
  },
  {
    label:       'answer_reversed',
    description: 'The full answer written backward.',
    formula:     "$join($reverse($split(qn.full_answer, '')))",
  },
  {
    label:       'answer_alphabetized',
    description: 'The letters of the full answer in alphabetical order, ignoring case and everything that is not a letter.',
    formula:     "$join($sort($split($lowercase($replace(qn.full_answer, /[^a-z]/i, '')), '')))",
  },
]

/** The expressions every new workspace starts with */
export const SeedExpressions: readonly ExpressionT[] = [...SumSeedDNAs, ...TextSeedDNAs].map((dna) => Expression.fill(dna))
