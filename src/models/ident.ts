import type * as Z from 'zod'
import type * as Actor from '../lib/actor'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'

export const IdentValidators = Validator(({ obj, identlabel, titleish, zid }) => {
  const identLabel = identlabel
    .describe('What a person types to become this ident (their username), and what others add them to a hunt by. Unique across the app: a new one is made inside the write that looks it up, so two sessions asserting one new label at once make one ident between them.')
  const title = titleish.min(1)
    .describe('What the ident is called on screen.')
  const user_id = zid('users').nullable()
    .describe('The session that claimed this username, and the only one that may assert it; null for an ident nobody has claimed yet, which the next session to assert it claims.')

  const row = obj({
    label: identLabel,
    title,
    user_id,
  })
    .describe('One ident: a persona in the app, a username held by the session that claimed it.')

  return { identLabel, title, user_id, row }
})

export type IdentDNA  = Z.input<typeof IdentValidators.row>
export type IdentRowT = Z.output<typeof IdentValidators.row>
/** An ident as anyone is shown it, its holder included: never which session claimed it */
export type IdentT    = Pick<IdentRowT, 'label' | 'title'> & { _id: string }
/** Who a session is, as it is told: the ident it took on last, and the actor the server sees in its requests */
export type CurrentIdentT = { ident: IdentT, actor: Actor.IdentActorT }

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
   * An ident as it is named on screen in full: its title, then its label written `@label`, which
   * marks it as the username someone types rather than a word of prose.
   *
   * @param ident - The ident to name.
   * @returns Its title and its label.
   *
   * @example Ident.byline({ label: 'mrflip', title: 'Mrflip' })  // => 'Mrflip (@mrflip)'
   */
  static byline(ident: Pick<IdentT, 'label' | 'title'>): string {
    return `${ident.title} (${this.atLabel(ident)})`
  }

  /**
   * An ident's label written `@label`, as its byline writes it, for a screen that shows the
   * title some other way (the hunts page, where it is retitled in place).
   *
   * @param ident - The ident whose label to write.
   * @returns Its label, after an `@`.
   *
   * @example Ident.atLabel({ label: 'mrflip' })  // => '@mrflip'
   */
  static atLabel(ident: Pick<IdentT, 'label'>): string {
    return `@${ident.label}`
  }

  /**
   * An ident's row, validated, with a blank title defaulting to its label titleized.
   *
   * @param dna - The label, already normalized; what to call it, where blank means "use the label"; and the session claiming it.
   * @returns The row to insert.
   * @throws When the label is not an ident label, or the title is not a title.
   *
   * @example Ident.fill({ label: 'flip_kromer', title: '', user_id })  // => { label: 'flip_kromer', title: 'Flip Kromer', user_id }
   */
  static fill(dna: IdentDNA): IdentRowT {
    const title = dna.title.trim() === '' ? Labelmaker.titleize(dna.label) : dna.title
    return IdentValidators.row({ ...dna, title })
  }
}
