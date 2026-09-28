import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'

export const IdentValidators = Validator(({ obj, identlabel, titleish }) => {
  const identLabel = identlabel
    .describe('What a person types to become this ident, and what others add them to a hunt by. Unique across the app, by convention: two idents made with one label at one moment resolve to the earlier.')
  const title = titleish.min(1)
    .describe('What the ident is called on screen.')

  const row = obj({
    label: identLabel,
    title,
  })
    .describe('One ident: a persona in the app. For now anyone may assume any ident; nothing is secret about one.')

  return { identLabel, title, row }
})

export type IdentDNA  = Z.input<typeof IdentValidators.row>
export type IdentRowT = Z.output<typeof IdentValidators.row>
export type IdentT    = IdentRowT & { _id: string }

/** A persona in the app, named by a label a person types to become it */
export class Ident implements IdentT {
  declare _id:    string
  declare label: string
  declare title: string

  /**
   * What a person typed, as the ident label it asks for: normalized as every label is, and no
   * longer than an ident label may be. Shorter than the minimum is left short, for the validator
   * to refuse.
   *
   * @param typed - Whatever was typed into the label box.
   * @returns A label-shaped string, or `''` when nothing was typed.
   *
   * @example Ident.labelFor('Flip Kromer')  // => 'flip_kromer'
   */
  static labelFor(typed: string): string {
    return Labelmaker.normalize(typed, { maxlen: PA.Identlabel.max })
  }

  /**
   * An ident's row, validated, with a blank title defaulting to its label titleized.
   *
   * @param dna - The label, already normalized, and what to call it; a blank title means "use the label".
   * @returns The row to insert.
   * @throws When the label is not an ident label, or the title is not a title.
   *
   * @example Ident.fill({ label: 'flip_kromer', title: '' })  // => { label: 'flip_kromer', title: 'Flip Kromer' }
   */
  static fill(dna: IdentDNA): IdentRowT {
    const title = dna.title.trim() === '' ? Labelmaker.titleize(dna.label) : dna.title
    return IdentValidators.row({ ...dna, title })
  }
}
