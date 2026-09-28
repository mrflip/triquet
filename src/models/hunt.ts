import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { mintId } from '../lib/ids'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import { Quiz, type QuizT } from './quiz'
import { ExpressionValidators, SeedExpressions, keyOf, type ExpressionT } from './expression'
import { defaultLayoutFor } from './layout'
import { HomeRealmLabel, Realm, RealmValidators, type RealmT } from './realm'

export const HuntValidators = Validator(({ obj, arr, label, titleish, treeid }) => {
  const huntLabel = label
    .describe('What the hunt is called in an address. Minted when the hunt is made, and unique across the app by convention: two hunts minted with one label resolve to the earlier.')
  const forced_label = label.nullable()
    .describe('An author-chosen label overriding the minted one, or null to keep the minted one.')
  const title = titleish
    .describe('What the hunt is called on screen; a blank one displays as its label titleized.')

  const hunt = obj({
    _id:          treeid,
    label:        huntLabel,
    forced_label: forced_label.default(null),
    title:        title.default(''),
    realms:       arr(RealmValidators.realm).min(PA.RealmsPerHunt.min).max(PA.RealmsPerHunt.max)
      .describe('The hunt\'s realms, in order, at most 99. Every hunt has `home`, and for now nothing else.'),
    expressions:  arr(ExpressionValidators.expression).max(PA.ExpressionsPerHunt.max).default([])
      .describe('The calculations any quiz of this hunt can put to work as columns, at most 99.'),
  })
    .check((context) => {
      for (const issue of integrityIssues(context.value)) { context.issues.push({ code: 'custom', ...issue }) }
    })
    .describe('Everything one hunt holds: its realms, their quizzes, and its expressions. This is also exactly what the Export panel emits.')

  const row = obj({
    label:        huntLabel,
    forced_label,
    title,
  })
    .describe('One hunt as the database holds it: its realms and expressions are rows of their own.')

  return { hunt, row }
})

export type HuntDNA = Z.input<typeof HuntValidators.hunt>
export type HuntT   = Z.output<typeof HuntValidators.hunt>

/** One thing wrong with a hunt, and where */
type Issue = { input: unknown, path: (string | number)[], message: string }

/**
 * Everything only wrong across a hunt's parts: two expressions with one owner and label, a
 * widget working an expression the hunt does not have, two realms with one label, two quizzes of
 * a realm answering to one label.
 */
function integrityIssues(hunt: Pick<HuntT, 'realms' | 'expressions'>): Issue[] {
  const labelsHeld = new Set(hunt.expressions.map((expression) => expression.label))
  return [
    ...repeatIssues(hunt.expressions.map((expression) => keyOf(expression)), (ii) => ['expressions', ii, 'label'], 'Two expressions share an owner and a label'),
    ...repeatIssues(hunt.realms.map((realm) => realm.label), (rr) => ['realms', rr, 'label'], 'Two realms of one hunt share a label'),
    ...hunt.realms.flatMap((realm, rr) => [
      ...repeatIssues(realm.quizzes.map((quiz) => Labelmaker.effectiveLabelOf(quiz)), (qq) => ['realms', rr, 'quizzes', qq, 'label'], 'Two quizzes of one realm answer to one label'),
      ...realm.quizzes.flatMap((quiz, qq) => unheldExpressionIssues(quiz, labelsHeld, ['realms', rr, 'quizzes', qq])),
    ]),
  ]
}

/** Every key of `keys` an earlier one already had, placed by `pathFor` */
function repeatIssues(keys: readonly string[], pathFor: (idx: number) => Issue['path'], message: string): Issue[] {
  return keys.flatMap((key, idx) => (keys.indexOf(key) < idx ? [{ input: key, path: pathFor(idx), message }] : []))
}

/** Every widget of `quiz` working an expression not among `labelsHeld`, placed under `path` */
function unheldExpressionIssues(quiz: QuizT, labelsHeld: ReadonlySet<string>, path: Issue['path']): Issue[] {
  return quiz.widgets.flatMap((widget, ii): Issue[] => (
    widget.kind === 'expressing' && ! labelsHeld.has(widget.expression_label)
      ? [{ input: widget.expression_label, path: [...path, 'widgets', ii, 'expression_label'], message: 'A widget names an expression this hunt does not have' }]
      : []
  ))
}

/** Everything one hunt holds: its realms, their quizzes, and its expressions */
export class Hunt implements HuntT {
  declare _id:           string
  declare label:        string
  declare forced_label: string | null
  declare title:        string
  declare realms:       RealmT[]
  declare expressions:  ExpressionT[]

  /**
   * Validated hunt, with a blank title populated from its label, titleized, and each realm's the
   * same way.
   *
   * @param dna - An id, a label, and at least one realm holding at least one quiz.
   * @returns A complete hunt.
   * @throws When two expressions share an owner and label, a widget works an expression not here, two realms share a label, or two quizzes of a realm answer to one label.
   */
  static fill(dna: HuntDNA): HuntT {
    const hunt = HuntValidators.hunt(dna)
    return {
      ...hunt,
      title:  hunt.title === '' ? Labelmaker.titleize(Labelmaker.effectiveLabelOf(hunt)) : hunt.title,
      realms: hunt.realms.map((realm) => Realm.fill(realm)),
    }
  }

  /**
   * A fresh hunt under `label`: one realm, `home`, holding one blank quiz that shares the hunt's
   * label and so its title, laid out with the standard widgets and columns for the standard
   * expressions.
   *
   * @param label - The hunt's label; one is minted when omitted. A caller that has to put it in an address mints it first.
   * @returns A hunt ready to type into.
   *
   * @example Hunt.blank('quiet_otter').realms[0].quizzes[0].title  // => 'Quiet Otter'
   */
  static blank(label: string = Labelmaker.localBlankLabel(new Set(), mintId())): HuntT {
    const quiz = { ...Quiz.blank('', label), ...defaultLayoutFor(SeedExpressions) }
    return this.fill({
      _id:         mintId(),
      label,
      realms:      [{ _id: mintId(), label: HomeRealmLabel, quizzes: [quiz] }],
      expressions: [...SeedExpressions],
    })
  }

  /** Every quiz of `hunt`, realm by realm */
  static quizzesOf(hunt: Pick<HuntT, 'realms'>): QuizT[] {
    return hunt.realms.flatMap((realm) => realm.quizzes)
  }
}

