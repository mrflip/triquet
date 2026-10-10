import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { mintId } from '../lib/ids'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import { CategoryValidators } from './category'
import { Quiz, type QuizT } from './quiz'
import { defaultLayout } from './layout'
import { HomeRealmLabel, Realm, RealmValidators, type RealmT } from './realm'

/** The branch every hunt starts on, and so the git branch its history begins on */
export const DefaultBranch = 'main'

export const HuntValidators = Validator(({ obj, arr, label, toplabel, userlabel, titleish, stamps, treeid }) => {
  const huntLabel = toplabel
    .describe('What the hunt is called in an address, within its org. Minted when the hunt is made, and unique within its org: two hunts of one org minted with one label resolve to the earlier.')
  const orglabel = userlabel
    .describe('The org the hunt is addressed under (`/~<org>/<hunt>`), which namespaces its label: the ident label of whoever made it, copied when it was made. Never changes: not when its maker is retitled, leaves the hunt, or changes role.')
  const title = titleish
    .describe('What the hunt is called on screen; a blank one displays as its label titleized.')
  const branch = label
    .describe('Which line of work the hunt is currently on, and the name of the git branch its history is committed to. Shares the `label` shape, which is a strict subset of what git accepts in a ref, so a branch an author can type is always one git will take.')

  const hunt = obj({
    _id:          treeid,
    label:        huntLabel,
    title:        title.default(''),
    branch:       branch.default(DefaultBranch),
    realms:       arr(RealmValidators.realm).min(PA.RealmsPerHunt.min).max(PA.RealmsPerHunt.max)
      .describe(`The hunt's realms, in order, at most ${String(PA.RealmsPerHunt.max)}. Every hunt has \`home\`, and for now nothing else.`),
  })
    .check((context) => {
      for (const issue of integrityIssues(context.value)) { context.issues.push({ code: 'custom', ...issue }) }
    })
    .describe('Everything one hunt holds: its realms and their quizzes. The widgets its quizzes work are the library\'s, which every hunt shares.')

  const row = obj({
    label:        huntLabel,
    orglabel,
    title,
    branch,
    wheel:        CategoryValidators.wheel.optional()
      .describe('How the hunt arranges the subject categories round its wheel. Absent until someone first arranges them, which reads as the default wheel.'),
    ...stamps,
  })
    .describe('One hunt as the database holds it: its realms are rows of their own.')

  return { hunt, row, branch, orglabel }
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
  declare branch: string
  declare realms: RealmT[]

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

