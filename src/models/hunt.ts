import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { mintId } from '../lib/ids'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import { Quiz, type QuizT } from './quiz'
import { defaultLayout } from './layout'
import { HomeRealmLabel, Realm, RealmValidators, type RealmT } from './realm'

export const HuntValidators = Validator(({ obj, arr, label, titleish, treeid }) => {
  const huntLabel = label
    .describe('What the hunt is called in an address. Minted when the hunt is made, and unique across the app by convention: two hunts minted with one label resolve to the earlier.')
  const title = titleish
    .describe('What the hunt is called on screen; a blank one displays as its label titleized.')

  const hunt = obj({
    _id:          treeid,
    label:        huntLabel,
    title:        title.default(''),
    realms:       arr(RealmValidators.realm).min(PA.RealmsPerHunt.min).max(PA.RealmsPerHunt.max)
      .describe(`The hunt's realms, in order, at most ${String(PA.RealmsPerHunt.max)}. Every hunt has \`home\`, and for now nothing else.`),
  })
    .check((context) => {
      for (const issue of integrityIssues(context.value)) { context.issues.push({ code: 'custom', ...issue }) }
    })
    .describe('Everything one hunt holds: its realms and their quizzes. The widgets its quizzes work are the library\'s, which every hunt shares.')

  const row = obj({
    label:        huntLabel,
    title,
  })
    .describe('One hunt as the database holds it: its realms are rows of their own.')

  return { hunt, row }
})

export type HuntDNA = Z.input<typeof HuntValidators.hunt>
export type HuntT   = Z.output<typeof HuntValidators.hunt>

/** One thing wrong with a hunt, and where */
type Issue = { input: unknown, path: (string | number)[], message: string }

/** Everything only wrong across a hunt's parts: two realms with one label, two quizzes of a realm answering to one label */
function integrityIssues(hunt: Pick<HuntT, 'realms'>): Issue[] {
  return [
    ...repeatIssues(hunt.realms.map((realm) => realm.label), (idx) => ['realms', idx, 'label'], 'Two realms of one hunt share a label'),
    ...hunt.realms.flatMap((realm, realmIdx) => (
      repeatIssues(realm.quizzes.map((quiz) => quiz.label), (idx) => ['realms', realmIdx, 'quizzes', idx, 'label'], 'Two quizzes of one realm answer to one label')
    )),
  ]
}

/** Every key of `keys` an earlier one already had, placed by `pathFor` */
function repeatIssues(keys: readonly string[], pathFor: (idx: number) => Issue['path'], message: string): Issue[] {
  return keys.flatMap((key, idx) => (keys.indexOf(key) < idx ? [{ input: key, path: pathFor(idx), message }] : []))
}

/** Everything one hunt holds: its realms and their quizzes */
export class Hunt implements HuntT {
  declare _id:    string
  declare label:  string
  declare title:  string
  declare realms: RealmT[]

  /**
   * The fields a hunt shows the outside world, alphabetically: its label and
   * its title (as shown, so never blank). Not the id or the realms, and not who is on it.
   */
  static readonly exposed = ['label', 'title'] as const

  /**
   * Validated hunt, with a blank title populated from its label, titleized, and each realm's the
   * same way.
   *
   * @param dna - An id, a label, and at least one realm holding at least one quiz.
   * @returns A complete hunt.
   * @throws When two realms share a label, or two quizzes of a realm answer to one label.
   */
  static fill(dna: HuntDNA): HuntT {
    const hunt = HuntValidators.hunt(dna)
    return {
      ...hunt,
      title:  hunt.title === '' ? Labelmaker.titleize(hunt.label) : hunt.title,
      realms: hunt.realms.map((realm) => Realm.fill(realm)),
    }
  }

  /**
   * A fresh hunt under `label`: one realm, `home`, holding one blank quiz that shares the hunt's
   * label and so its title, laid out as a new quiz is (`defaultLayout`): the starter columns, and
   * no widgetings.
   *
   * @param label - The hunt's label; one is minted when omitted. A caller that has to put it in an address mints it first.
   * @returns A hunt ready to type into.
   *
   * @example Hunt.blank('quiet_otter').realms[0].quizzes[0].title  // => 'Quiet Otter'
   */
  static blank(label: string = Labelmaker.localBlankLabel(new Set(), mintId())): HuntT {
    const quiz = { ...Quiz.blank('', label), ...defaultLayout() }
    return this.fill({
      _id:    mintId(),
      label,
      realms: [{ _id: mintId(), label: HomeRealmLabel, quizzes: [quiz] }],
    })
  }

  /** Every quiz of `hunt`, realm by realm */
  static quizzesOf(hunt: Pick<HuntT, 'realms'>): QuizT[] {
    return hunt.realms.flatMap((realm) => realm.quizzes)
  }
}

