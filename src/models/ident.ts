import type * as Z from 'zod'
import type * as Actor from '../lib/actor'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'

export const IdentValidators = Validator(({ obj, userlabel, titleish, stamps, zid }) => {
  const identLabel = userlabel
    .describe('What a person types to become this ident (their username), and what others add them to a hunt by. Unique across the app: a new one is made inside the write that looks it up, so two sessions asserting one new label at once make one ident between them.')
  const title = titleish.min(1)
    .describe('What the ident is called on screen.')
  const user_id = zid('users').nullable()
    .describe('The session that claimed this username, and the only one that may assert it; null for an ident nobody has claimed yet, which the next session to assert it claims.')

  const row = obj({
    label: identLabel,
    title,
    user_id,
    ...stamps,
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

/** Why what a person typed is not an ident label: no typing on would make it one, it is one still being typed (too short, or ending in an underscore), or it is a word kept for the app's own use */
export type LabelFlawT = 'shape' | 'unfinished' | 'reserved'

/** A persona in the app, named by a label a person types to become it */
export class Ident implements IdentT {
  declare _id:    string
  declare label: string
  declare title: string

  /**
   * The ident label a name makes: normalized as every label is, and no longer than a `Userlabel`
   * may be, the `z` a leading digit gets counted in. Shorter than the minimum is left short, for
   * the validator to refuse. What the label field beside a name shows until the label is typed in
   * itself.
   *
   * @param name - Whatever was typed as a name.
   * @returns A label-shaped string, or `''` when nothing was typed.
   *
   * @example Ident.labelFor('Flip Kromer')  // => 'flip_kromer'
   * @example Ident.labelFor('2nd Avenue Puzzle Solvers Club')  // => 'z2nd_avenue_puzzle_solve'
   */
  static labelFor(name: string): string {
    return Labelmaker.normalize(name, PA.Userlabel)
  }

  /**
   * What keeps a label, typed as it is, from being an ident label, if anything. Nothing is
   * repaired: a capital or a space is a flaw, not something to fold away. `shape` is a label no
   * typing on would make one -- a character no label keeps, a first character that is not a
   * letter, two underscores in a row, or too many characters. `unfinished` is one typing on could
   * still finish: too short, nothing typed included, or ending in an underscore. `reserved` is a
   * word no ident may be (`Labelmaker.isReserved`), which typing on may yet make another word.
   *
   * @param label - Whatever was typed into a label field.
   * @returns The flaw, or null when it is an ident label.
   *
   * @example Ident.flawIn('flip_kromer')  // => null
   * @example Ident.flawIn('Flip Kromer')  // => 'shape'
   * @example Ident.flawIn('flip')         // => 'unfinished'
   * @example Ident.flawIn('support')      // => 'reserved'
   */
  static flawIn(label: string): LabelFlawT | null {
    if (label.length > PA.Userbegun.max || ! PA.Userbegun.re.test(label)) { return 'shape' }
    if (Labelmaker.isReserved(label, { toplevel: true })) { return 'reserved' }
    return IdentValidators.identLabel.safeParse(label).success ? null : 'unfinished'
  }

  /**
   * The flaw a label field should say of itself now, if any. A `shape` is said at once; an
   * `unfinished` or `reserved` label only once the field has been left, as it may still be being
   * typed (`support` on its way to `supporter`); and an empty field says nothing, as nobody has
   * typed anything to be told of.
   *
   * @param label - Whatever is in the label field.
   * @param left - Whether the field has been left (where the label follows another field, either of them has).
   * @returns The flaw to say, or null.
   *
   * @example Ident.flawToSay('flip', false)  // => null
   * @example Ident.flawToSay('flip', true)   // => 'unfinished'
   * @example Ident.flawToSay('Flip', false)  // => 'shape'
   */
  static flawToSay(label: string, left: boolean): LabelFlawT | null {
    const flaw = this.flawIn(label)
    if (flaw === 'unfinished' || flaw === 'reserved') { return left && label !== '' ? flaw : null }
    return flaw
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
