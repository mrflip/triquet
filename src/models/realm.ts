import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import { QuizValidators, type QuizT } from './quiz'

/** The realm every hunt starts with, and for now the only one it has */
export const HomeRealmLabel = 'home'

export const RealmValidators = Validator(({ obj, arr, label, titleish, uint, zid, treeid }) => {
  const realmLabel = label
    .describe('What the realm is called in an address, unique among its hunt\'s realms. Every hunt has `home`.')
  const title = titleish
    .describe('What the realm is called on screen; a blank one displays as its label titleized.')

  const realm = obj({
    _id:     treeid,
    label:   realmLabel.default(HomeRealmLabel),
    title:   title.default(''),
    quizzes: arr(QuizValidators.quiz).min(PA.QuizzesPerRealm.min).max(PA.QuizzesPerRealm.max)
      .describe(`The realm's quizzes, in the order they were made, at most ${String(PA.QuizzesPerRealm.max)}. Never empty: deleting its last quiz is refused rather than leaving an address that leads nowhere.`),
  })
    .describe('A division of a hunt, holding quizzes. Its quizzes\' labels are unique within it, so a quiz is addressed by hunt, realm and quiz.')

  const row = obj({
    hunt_id:  zid('hunts')
      .describe('The hunt this realm belongs to.'),
    label:    realmLabel,
    title,
    position: uint
      .describe('The realm\'s place among its hunt\'s realms, counting from zero.'),
  })
    .describe('One realm as the database holds it: its quizzes are rows of their own.')

  return { realm, row }
})

export type RealmDNA = Z.input<typeof RealmValidators.realm>
export type RealmT   = Z.output<typeof RealmValidators.realm>

/** A division of a hunt, holding quizzes */
export class Realm implements RealmT {
  declare _id:      string
  declare label:   string
  declare title:   string
  declare quizzes: QuizT[]

  /**
   * The fields a realm shows the outside world, alphabetically: its label and its title (as
   * shown, so never blank). Not the id, and not its quizzes.
   */
  static readonly exposed = ['label', 'title'] as const

  /**
   * Validated realm, with a blank title populated from its label, titleized.
   *
   * @param dna - An id and at least one quiz.
   * @returns A complete realm.
   * @throws When it holds no quiz, or a quiz is not valid.
   */
  static fill(dna: RealmDNA): RealmT {
    const realm = RealmValidators.realm(dna)
    return realm.title === '' ? { ...realm, title: Labelmaker.titleize(realm.label) } : realm
  }
}
