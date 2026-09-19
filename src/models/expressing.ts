import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import type { ExpressionT } from './expression'

/** How much room a column gets: a number's, or a line of prose's. Neither can make its row taller. */
export const ExpressingShapeVals = ['skinny', 'medium'] as const
export type ExpressingShape = typeof ExpressingShapeVals[number]

/** What a quiz's sort memory says when it was last put in the order of an expressing's column */
export type ExpressingSortkey = `expressing:${string}`

/** The prefix that tells a sort memory it names an expressing rather than a built-in column */
const SortkeyPrefix = 'expressing:'

/** What a sort memory naming an expressing looks like: the prefix and then a label */
const ExpressingSortkeyRe = /^expressing:[a-z][a-z0-9_]*[a-z0-9]$/

export const ExpressingValidators = Validator(({ obj, oneof, zod, label, titleish, noteish }) => {
  const expressingSortkey = zod.custom<ExpressingSortkey>((val) => typeof val === 'string' && ExpressingSortkeyRe.test(val), 'should be "expressing:" and then a label')
    .describe('A quiz\'s sort memory when it was last put in the order of an expressing\'s column.')
  const shape = oneof(ExpressingShapeVals)
    .describe('"skinny" is the width of the number columns, with the header turned on its side; "medium" is the width of the notes columns. Either way the cell scrolls inside the row rather than making it taller.')
  const expressingLabel = label
    .describe('What the column is called within its quiz, unique there. It is what the quiz\'s sort memory refers to.')
  const expression_label = label
    .describe('Which of the workspace\'s expressions works out this column.')
  const title = titleish
    .describe('The column\'s header.')
  const description = noteish
    .describe('What this column is for in this quiz, in the author\'s words: the expression says what is calculated, this says why the quiz wants it.')

  const expressing = obj({
    label:            expressingLabel,
    expression_label,
    title,
    description:      description.default(''),
    shape:            shape.default('skinny'),
  })
    .describe('One expression put to work in one quiz: a column, computed for every question from the expression\'s formula. The quiz holds these in the order the columns appear.')

  const expressingPatch = obj({
    label:            expressingLabel.optional(),
    expression_label: expression_label.optional(),
    title:            title.optional(),
    description:      description.optional(),
    shape:            shape.optional(),
  })
    .describe('The fields of one expressing being revised. A key absent from a patch means "leave whatever is already there".')

  return { shape, expressingSortkey, expressing, expressingPatch }
})

export type ExpressingDNA   = Z.input<typeof ExpressingValidators.expressing>
export type ExpressingT     = Z.output<typeof ExpressingValidators.expressing>
export type ExpressingPatch = Z.output<typeof ExpressingValidators.expressingPatch>

/** One expression put to work as a column in one quiz */
export class Expressing implements ExpressingT {
  declare label:            string
  declare expression_label: string
  declare title:            string
  declare description:      string
  declare shape:            ExpressingShape

  /**
   * Validated expressing, with the shape and description defaulted.
   *
   * @param dna - A label, the expression it works, and the column's title.
   * @returns A complete expressing.
   *
   * @example Expressing.fill({ label: 'letters', expression_label: 'answer_letter_count', title: 'Letters' })
   */
  static fill(dna: ExpressingDNA): ExpressingT {
    return ExpressingValidators.expressing(dna)
  }

  /**
   * A column working `expression`, labelled and titled after it, under a label no sibling has.
   * A label already taken gains a short random suffix.
   *
   * @param expression - What the column shows.
   * @param taken - The labels the quiz's other columns already use.
   * @returns An expressing ready to add to the quiz.
   *
   * @example Expressing.forExpression(expression, new Set(['clueing_full']))
   */
  static forExpression(expression: Pick<ExpressionT, 'label'>, taken: ReadonlySet<string>): ExpressingT {
    const label = taken.has(expression.label) ? Labelmaker.appendFallback(expression.label) : expression.label
    return this.fill({ label, expression_label: expression.label, title: Labelmaker.titleize(expression.label) })
  }
}

/** The sort memory for the column `expressing` shows */
export function sortkeyOf(expressing: Pick<ExpressingT, 'label'>): ExpressingSortkey {
  return `${SortkeyPrefix}${expressing.label}`
}

/** The expressing label a sort memory names, or null when it names a built-in column */
export function expressingLabelOf(sortkey: string): string | null {
  return sortkey.startsWith(SortkeyPrefix) ? sortkey.slice(SortkeyPrefix.length) : null
}

const DefaultColumns: readonly ExpressingDNA[] = [
  { label: 'clueing_plus_rank',        expression_label: 'clueing_plus_rank',        title: 'Clueing + Rank' },
  { label: 'clueing_full',             expression_label: 'clueing_full',             title: 'Clueing Full Sum' },
  { label: 'clueing_numeral',          expression_label: 'clueing_numeral',          title: 'Clueing Numeral Sum' },
  { label: 'butnot_full',              expression_label: 'butnot_full',              title: 'BUT NOT Full Sum' },
  { label: 'butnot_numeral',           expression_label: 'butnot_numeral',           title: 'BUT NOT Numeral Sum' },
  { label: 'hint_full',                expression_label: 'hint_full',                title: 'Hint Full Sum' },
  { label: 'hint_numeral',             expression_label: 'hint_numeral',             title: 'Hint Numeral Sum' },
  { label: 'clueing_plus_butnot_full', expression_label: 'clueing_plus_butnot_full', title: 'Clueing+BUT NOT Full' },
]

/**
 * The columns a new quiz starts with: the eight sums, for as many of them as `expressions` still holds.
 *
 * @param expressions - The workspace's expressions.
 * @returns Up to eight expressings, in the order the sum columns have always appeared.
 *
 * @example defaultsFor(SeedExpressions).map((expressing) => expressing.label)[0]  // => 'clueing_plus_rank'
 */
export function defaultsFor(expressions: readonly ExpressionT[]): ExpressingT[] {
  const held = new Set(expressions.map((expression) => expression.label))
  return DefaultColumns
    .filter((dna) => held.has(dna.expression_label))
    .map((dna) => Expressing.fill(dna))
}
