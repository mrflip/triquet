import * as EST from 'es-toolkit'
import type * as Z from 'zod'
import { Validator } from './validator'
import type { ColumnT } from '../models/column'
import type { HuntT } from '../models/hunt'
import type { HuntRole } from '../models/hunting'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { ReviewRowT } from '../models/review'
import type { ReviewingRowT } from '../models/reviewing'
import { WidgetScopeVals, type WidgetT } from '../models/widget'
import type { WidgetedT } from '../models/widgeted'
import type { WidgetingT } from '../models/widgeting'

/**
 * Jsonballs: each resource of a hunt as a JSON object holding its piece of the hunt nested under
 * the key path that leads to it (`Addresses.keypathOf`), so that deep-merging any set of them is
 * that much of the hunt, and merging every one is the whole of it.
 *
 * Every collection is an object keyed by label, never a list: a merge cannot tell that two lists'
 * members are the same thing, and tools disagree about how to merge lists, while a keyed object
 * merges one way in every tool. Where order matters (a quiz's questions, its widgetings and
 * columns, the wheel's slots, the library) each member carries its `position`. A list appears
 * only where a value is itself one, inside one ball.
 *
 * This module owns the shapes: what each ball's body holds, how one is placed at its key path,
 * how balls merge, and how anything pasted (any ball, any merge of them, and every shape an
 * export has ever had) reads back as quizzes and widgets. `Exporting` builds the balls from what
 * the screen holds; `Importing` reads them back in.
 */

/** Any JSON object: a jsonball, or one resource's body within one */
export type JsonballT = Record<string, unknown>

/**
 * What a member of an ordered collection carries for its place among its siblings, counting from
 * zero. No widgeting may take it as a label, since a question's widgeteds sit beside its fields.
 */
export const PositionField = 'position'

/** The hunt's own fields, which sit at the root of the merged hunt: its title as shown */
export type HuntBodyT = Pick<HuntT, 'label' | 'title' | 'branch'>

/** One subject category: the slot of the hunt's wheel it holds, or null for one in the pool */
export type CategoryBodyT = { position: number | null }

/** One ident on the hunt, by their label: what they are called, and their role */
export type MemberBodyT = { title: string, role: HuntRole }

/** What one widgeting came to for one question: its exposed fields */
export type WidgetedBodyT = Pick<WidgetedT, 'status' | 'value'>

/**
 * One question, by its label: its place in the quiz, its own fields, its chain by the label of the
 * question it points at, and beside them what each widgeting of the quiz came to, under the
 * widgeting's label.
 */
export type QuestionBodyT = Pick<QuestionT, 'qnum' | 'clueing' | 'hint' | 'title' | 'alt_text' | 'notes' | 'full_answer'> & {
  position:  number
  chains_to: string | null
  [widgeting_label: string]: unknown
}

/** One widgeting, by its label: its place in the quiz's run order, and its fields */
export type WidgetingBodyT = Omit<WidgetingT, 'label'> & { position: number }

/** One column, by its label: its place in the grid, and its fields */
export type ColumnBodyT = Omit<ColumnT, 'label'> & { position: number }

/** One quiz, by its label: its own fields (its sort memory among them), and its questions, widgetings and columns, each keyed by label */
export type QuizBodyT = Pick<QuizT, 'title' | 'smiths_note' | 'q1_preamble' | 'locked' | 'last_sortkey'> & {
  questions:  Record<string, QuestionBodyT>
  widgetings: Record<string, WidgetingBodyT>
  columns:    Record<string, ColumnBodyT>
}

/** What a reviewing writes of its verdict: everything the reviewer said of the question, and not whether they peeked */
export const VerdictFieldnames = ['get_rate', 'guesses', 'comments', 'minutes', 'keep_it', 'needs_fact_check', 'elimination_candidate'] as const

/** One reviewer's verdict on one question, by the question's label */
export type VerdictBodyT = Pick<ReviewingRowT, typeof VerdictFieldnames[number]>

/** One shared review of one quiz, by the reviewer's label: what they made of it, and their verdict on each question */
export type ReviewBodyT = Pick<ReviewRowT, 'overall'> & { verdicts: Record<string, VerdictBodyT> }

/** One widget of the library, by its scope and label: its place in the library, and its fields */
export type WidgetBodyT = DistributiveOmit<WidgetT, 'scope' | 'label'> & { position: number }

/** `Omit` taken across each member of a union, so the union survives it */
type DistributiveOmit<TT, KT extends PropertyKey> = TT extends unknown ? Omit<TT, KT> : never

/**
 * `body` nested under `keypath`: the ball a resource is, given its key path and its body. An empty
 * key path puts the body at the root.
 *
 * @example ballAt(['quizzes', 'home', 'legends'], { title: 'Legends' })  // => { quizzes: { home: { legends: { title: 'Legends' } } } }
 * @example ballAt([], { label: 'spring_hunt' })  // => { label: 'spring_hunt' }
 */
export function ballAt(keypath: readonly string[], body: JsonballT): JsonballT {
  let ball = body
  for (const key of keypath.toReversed()) { ball = { [key]: ball } }
  return ball
}

/**
 * `balls` deep-merged into one, none of them changed: as much of the hunt as they hold between
 * them. A later ball wins where two hold one leaf, which no two of a hunt's balls do.
 *
 * @example merged([{ quizzes: { home: { legends: {} } } }, { quizzes: { home: { princes: {} } } }])  // => { quizzes: { home: { legends: {}, princes: {} } } }
 * @example merged([])  // => {}
 */
export function merged(balls: readonly JsonballT[]): JsonballT {
  const whole: JsonballT = {}
  for (const ball of balls) { EST.merge(whole, ball) }
  return whole
}

/**
 * `items` as a collection keyed by label, each body carrying its place in the list.
 *
 * @param items - The members, in order.
 * @param labelOf - What each is keyed by.
 * @param bodyOf - What each holds beside its place.
 *
 * @example keyedOf([{ label: 'leon' }, { label: 'nantes' }], (qn) => qn.label, () => ({}))  // => { leon: { position: 0 }, nantes: { position: 1 } }
 */
export function keyedOf<TT, BT extends JsonballT>(items: readonly TT[], labelOf: (item: TT) => string, bodyOf: (item: TT) => BT): Record<string, BT & { position: number }> {
  return Object.fromEntries(items.map((item, ii) => [labelOf(item), { ...bodyOf(item), [PositionField]: ii }]))
}

/**
 * A collection as a list, whether it arrived as one or keyed by label: a list as it stands; a keyed
 * one in order of its members' `position` (any without one last, as they came), each member that
 * is an object carrying its key as its `label`. A member that is not an object is passed on as it
 * is, for whoever reads it to refuse.
 *
 * @example listedOf({ nantes: { position: 1 }, leon: { position: 0 } })  // => [{ position: 0, label: 'leon' }, { position: 1, label: 'nantes' }]
 * @example listedOf([{ label: 'leon' }])  // => [{ label: 'leon' }]
 */
export function listedOf(collection: readonly unknown[] | Readonly<Record<string, unknown>>): unknown[] {
  if (isList(collection)) { return [...collection] }
  const members = Object.entries(collection)
  const placeOf = ([, member]: [string, unknown]) => {
    const position: unknown = EST.isPlainObject(member) ? member[PositionField] : undefined
    return typeof position === 'number' ? position : Infinity
  }
  return EST.sortBy(members, [placeOf]).map(([label, member]) => (EST.isPlainObject(member) ? { ...member, label } : member))
}

/** How a paste was read: a bare list of questions, one quiz unwrapped, quizzes by realm, or a ball that holds no quiz */
export const PastedShapeVals = ['list', 'quiz', 'hunt', 'none'] as const
export type PastedShape = typeof PastedShapeVals[number]

export const PastedValidators = Validator(({ obj, arr, rec, union, str, unk, label, titleish }) => {
  const collection = union([arr(unk), rec(str, unk)])
    .describe('Members read one by one, so one that will not do is skipped and logged: a list, or an object keyed by label, its members carrying their `position`.')

  const quiz = obj({
    label:        label.optional(),
    forced_label: label.nullable().optional(),
    title:        titleish.nullable().optional(),
    smiths_note:  unk.optional(),
    q1_preamble:  unk.optional(),
    last_sortkey: unk.optional(),
    questions:    collection.default([]),
    widgetings:   collection.default([]),
    columns:      collection.optional(),
  })
    .describe('One quiz as a paste holds it: its label and title, which pick it out of several; its smith\'s note, Q1 preamble and sort memory, each read by Import against its own rule; and its questions, widgetings and columns, in a list or keyed by label. Its lock is not read: it says how far someone else\'s draft had come, not what it holds. An export made while a label could be overridden carries the override as `forced_label`, the label it answered to then.')

  const ball = obj({ quizzes: rec(str, rec(str, quiz)) })
    .describe('Quizzes by realm and label, as a quiz\'s ball holds one, and a merged hunt every one: what Raw Export emits.')

  const listedRealm = obj({ quizzes: arr(quiz) })
  const realmsHunt = obj({ realms: arr(listedRealm) })
    .describe('A whole hunt as Raw Export emitted it until October 2026: its realms in a list, each with its quizzes in a list.')

  const workspace = obj({ quizzes: arr(quiz) })
    .describe('Every quiz in a list, as Raw Export emitted it before there were hunts.')

  const scopedWidgets = rec(str, rec(str, unk))
  const oldLibrary = obj({ widgets: union([arr(unk), scopedWidgets]) })
    .describe('Widgets in a list, as the library\'s export emitted them until October 2026; or under `widgets`, keyed by scope and then label, as a widget\'s ball and the library\'s held them that month.')

  const scopeWidgets = obj({ widgets: rec(str, unk) })
    .describe('One scope\'s widgets, keyed by label: what a widget\'s ball holds under its scope (`{ pub: { widgets: { ... } } }`), and the library\'s every one.')

  return { collection, quiz, ball, realmsHunt, workspace, oldLibrary, scopeWidgets }
})

/** One quiz as a paste holds it, read loosely */
export type PastedQuizRawT = Z.output<typeof PastedValidators.quiz>

/** One quiz as a paste holds it, whatever shape it arrived in */
export type PastedQuizT = {
  /** The label it answered to, or null when the paste names none */
  label:      string | null
  /** Its title, or null when the paste gives none */
  title:      string | null
  /** Its own fields beside its title, as pasted, each only when the paste holds it: its smith's note, its Q1 preamble, its sort memory */
  fields:     Partial<Record<PastedFieldname, unknown>>
  /** Its questions in order, each as pasted, read one by one; each from a keyed collection carries its key as its `label` */
  questions:  unknown[]
  /** Its widgetings in run order, as pasted, read the same way */
  widgetings: unknown[]
  /** Its columns in order, as pasted, read the same way; null when the paste holds none, so says nothing of how the grid is laid out */
  columns:    unknown[] | null
}

/** A quiz's own fields, beside its title, that a paste may carry */
export const PastedFieldnames = ['smiths_note', 'q1_preamble', 'last_sortkey'] as const
export type PastedFieldname = typeof PastedFieldnames[number]

/** What a paste holds, as far as a quiz's Import reads it: the quizzes it holds, and the shape it was read as */
export type PastedT = { shape: PastedShape, quizzes: PastedQuizT[] }

/**
 * The quizzes a paste holds, in whatever shape it arrived: a bare list of questions; one quiz
 * unwrapped (a quiz's own history file, or the questions alone, `{ questions: { ... } }`); quizzes
 * by realm and label (a quiz's ball, a merged hunt, or a hunt or workspace from an older export);
 * or another ball, which holds none. Null for what is no such shape.
 *
 * @param raw - The paste, parsed.
 *
 * @example quizzesIn([{ label: 'leon' }])?.shape  // => 'list'
 * @example quizzesIn({ questions: { leon: { position: 0 } } })?.quizzes[0]?.questions  // => [{ position: 0, label: 'leon' }]
 * @example quizzesIn({ quizzes: { home: { legends: { title: 'Legends' } } } })?.quizzes[0]?.label  // => 'legends'
 * @example quizzesIn({ categories: {} })?.shape  // => 'none'
 * @example quizzesIn('legends')  // => null
 */
export function quizzesIn(raw: unknown): PastedT | null {
  if (isList(raw)) { return { shape: 'list', quizzes: [{ label: null, title: null, fields: {}, questions: [...raw], widgetings: [], columns: null }] } }
  if (! EST.isPlainObject(raw)) { return null }
  const read = readQuizzes(raw)
  return read && { shape: read.shape, quizzes: read.quizzes.map(([key, quiz]) => pastedQuizOf(quiz, key)) }
}

/** The quizzes of a pasted object, each with the key it sat under, by the shape it is in; null when it holds a shape that will not read */
function readQuizzes(raw: Record<string, unknown>): { shape: PastedShape, quizzes: [string | null, PastedQuizRawT][] } | null {
  const parsed = (() => {
    if (Object.hasOwn(raw, 'realms')) { return PastedValidators.realmsHunt.safeParse(raw) }
    if (Array.isArray(raw.quizzes)) { return PastedValidators.workspace.safeParse(raw) }
    if (Object.hasOwn(raw, 'quizzes')) { return PastedValidators.ball.safeParse(raw) }
    if (Object.hasOwn(raw, 'questions')) { return PastedValidators.quiz.safeParse(raw) }
    return null
  })()
  if (parsed === null) { return { shape: 'none', quizzes: [] } }
  if (! parsed.success) { return null }
  const { data } = parsed
  if ('realms' in data) { return { shape: 'hunt', quizzes: data.realms.flatMap((realm) => realm.quizzes.map((quiz) => [null, quiz] as [null, PastedQuizRawT])) } }
  if (! ('quizzes' in data)) { return { shape: 'quiz', quizzes: [[null, data]] } }
  if (Array.isArray(data.quizzes)) { return { shape: 'hunt', quizzes: data.quizzes.map((quiz) => [null, quiz] as [null, PastedQuizRawT]) } }
  return { shape: 'hunt', quizzes: Object.values(data.quizzes).flatMap((realm) => Object.entries(realm)) }
}

/**
 * A pasted quiz as its own fields, its questions, widgetings and columns in order, and the label it
 * answered to: an older export's override, the label it carries, or the key it sat under. An empty
 * list of columns, as exports made before columns were exported hold, says nothing of the grid.
 */
function pastedQuizOf(quiz: PastedQuizRawT, key: string | null): PastedQuizT {
  const columns = quiz.columns === undefined ? [] : listedOf(quiz.columns)
  return {
    label:      quiz.forced_label ?? quiz.label ?? key,
    title:      quiz.title ?? null,
    fields:     Object.fromEntries(PastedFieldnames.flatMap((fieldname) => (quiz[fieldname] === undefined ? [] : [[fieldname, quiz[fieldname]]]))),
    questions:  chainedByLabel(listedOf(quiz.questions)),
    widgetings: listedOf(quiz.widgetings),
    columns:    columns.length === 0 ? null : columns,
  }
}

/**
 * Questions carrying ids, as exports made before there were hunts did, with each chain naming the
 * sibling it pointed at by the label it answered to rather than its id, and a chain to a question
 * the paste does not hold naming none. Questions carrying no ids are left as they are.
 */
function chainedByLabel(questions: readonly unknown[]): unknown[] {
  const labelForId = new Map(questions.flatMap((question) => {
    if (! EST.isPlainObject(question) || typeof question.id !== 'string') { return [] }
    const label: unknown = question.forced_label ?? question.label
    return typeof label === 'string' ? [[question.id, label] as const] : []
  }))
  if (labelForId.size === 0) { return [...questions] }
  return questions.map((question) => {
    if (! EST.isPlainObject(question) || typeof question.chains_to !== 'string') { return question }
    return { ...question, chains_to: labelForId.get(question.chains_to) ?? null }
  })
}

/**
 * The widgets a paste holds, each as pasted for the library's Import to read: a bare list of
 * widgets; any ball holding widgets under their scope and keyed by label (a widget's, the
 * library's, a merged hunt's: `{ pub: { widgets: { ... } } }`), scope by scope in library order,
 * each carrying its scope and label; or an older library export (`{ widgets: [...] }`, or
 * `{ widgets: { pub: { ... } } }`). Null when the paste holds no widgets at all.
 *
 * @param raw - The paste, parsed.
 *
 * @example widgetsIn({ pub: { widgets: { shout: { position: 0, formulary: 'jsonata', formula: '1' } } } })  // => [{ position: 0, formulary: 'jsonata', formula: '1', scope: 'pub', label: 'shout' }]
 * @example widgetsIn([{ label: 'shout' }])  // => [{ label: 'shout' }]
 * @example widgetsIn({ quizzes: {} })  // => null
 */
export function widgetsIn(raw: unknown): unknown[] | null {
  if (isList(raw)) { return [...raw] }
  if (! EST.isPlainObject(raw)) { return null }
  const scoped = WidgetScopeVals.flatMap((scope) => {
    const parsed = PastedValidators.scopeWidgets.safeParse(raw[scope])
    return parsed.success ? [[scope, parsed.data.widgets] as const] : []
  })
  if (scoped.length > 0) { return scopedListed(scoped) }
  const parsed = PastedValidators.oldLibrary.safeParse(raw)
  if (! parsed.success) { return null }
  const { widgets } = parsed.data
  return Array.isArray(widgets) ? widgets : scopedListed(Object.entries(widgets))
}

/** Widgets keyed by label under each scope, as one list, scope by scope in library order, each carrying its scope and label */
function scopedListed(scoped: readonly (readonly [string, Readonly<Record<string, unknown>>])[]): unknown[] {
  return scoped.flatMap(([scope, held]) => listedOf(held).map((each) => (EST.isPlainObject(each) ? { ...each, scope } : each)))
}

/** Whether `val` is a list */
function isList(val: unknown): val is readonly unknown[] {
  return Array.isArray(val)
}
