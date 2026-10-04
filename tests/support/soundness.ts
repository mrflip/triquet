import { expect } from 'vitest'
import { authTables } from '@convex-dev/auth/server'
import type { Doc, TableNames } from '../../convex/_generated/dataModel'
import schema from '../../convex/schema'
import { QuestionWidgetLabel, sourceOf } from '../../src/models/column'
import type { Tester } from './convex'

// Convex has no foreign keys and no unique indexes: every cascade and every uniqueness is code in
// `convex/writing/`. This reads a whole deployment back and says what in it no longer holds
// together, so a test of a write can end by checking it left nothing dangling. Each check is
// named, and a new one is a new entry in `SoundnessChecks`.

/** The tables a test reads back whole: ours, and Convex Auth's `users`, which ours point at */
export type HeldTablename = Exclude<TableNames, keyof typeof authTables> | 'users'

/** Every row of every table a test reads back, by table */
export type Held = { [TN in HeldTablename]: Doc<TN>[] }

/** One named thing a sound deployment holds to, and every place `held` breaks it, each in a line */
export type SoundnessCheck = { title: string, faultsOf: (held: Held) => string[] }

/** Our tables, and `users` */
const HeldTablenames = [
  ...Object.keys(schema.tables).filter((tablename) => ! Object.hasOwn(authTables, tablename)),
  'users',
] as HeldTablename[]

/** The table each id field of a row points into, by the field's name */
const TableForIdField: Record<string, HeldTablename> = {
  hunt_id:      'hunts',
  ident_id:     'idents',
  question_id:  'questions',
  quiz_id:      'quizzes',
  realm_id:     'realms',
  review_id:    'reviews',
  user_id:      'users',
  widgeting_id: 'widgetings',
}

/** Every key of `keys` an earlier one already had */
function repeatsIn(keys: readonly string[]): string[] {
  return keys.filter((key, idx) => keys.indexOf(key) < idx)
}

/** `rows` gathered by what `keyOf` says of each */
function groupedBy<RT>(rows: readonly RT[], keyOf: (row: RT) => string): Map<string, RT[]> {
  const groups = new Map<string, RT[]>()
  for (const row of rows) { groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), row]) }
  return groups
}

/** For sorting ids into a stable order to compare */
const alphabetically = (aa: string, bb: string) => aa.localeCompare(bb)

/** Every id a field of one of our rows holds names a row of the table the field points into; and every id a quiz's `row_ordering` lists, a question */
function danglingIds(held: Held): string[] {
  const idsIn = new Map(HeldTablenames.map((tablename) => [tablename, new Set<string>(held[tablename].map((row) => row._id))]))
  const fieldFaults = HeldTablenames.filter((tablename) => tablename !== 'users').flatMap((tablename) => (
    (held[tablename] as Record<string, unknown>[]).flatMap((row) => Object.entries(row).flatMap(([fieldname, val]) => {
      // A null id points nowhere on purpose: an ident nobody has claimed.
      if (typeof val !== 'string' || fieldname === '_id' || ! fieldname.endsWith('_id')) { return [] }
      const target = TableForIdField[fieldname]
      if (! target) { return [`${tablename}.${fieldname}: no table is known for this field`] }
      return idsIn.get(target)?.has(val) ? [] : [`${tablename}.${fieldname} ${val} names no row of ${target}`]
    }))
  ))
  const orderingFaults = held.quizzes.flatMap((quiz) => quiz.row_ordering.flatMap((question_id) => (
    idsIn.get('questions')?.has(question_id) ? [] : [`quiz ${quiz.label} lists ${question_id}, which names no question`]
  )))
  return [...fieldFaults, ...orderingFaults]
}

/** Each quiz's `row_ordering` lists every question naming the quiz, each once, and nothing else */
function misorderedQuizzes(held: Held): string[] {
  const questionsOf = groupedBy(held.questions, (question) => question.quiz_id)
  return held.quizzes.flatMap((quiz) => {
    const listed = quiz.row_ordering.toSorted(alphabetically)
    const holding = (questionsOf.get(quiz._id) ?? []).map((question) => question._id).toSorted(alphabetically)
    const repeated = repeatsIn(listed)
    return [
      ...(repeated.length > 0 ? [`quiz ${quiz.label} lists ${repeated.join(', ')} more than once`] : []),
      ...(listed.join(' ') === holding.join(' ') || repeated.length > 0 ? [] : [`quiz ${quiz.label} lists [${listed.join(', ')}] but holds [${holding.join(', ')}]`]),
    ]
  })
}

/** Each question's `chains_to` is null, or the label of another question of its quiz */
function danglingChains(held: Held): string[] {
  const questionsOf = groupedBy(held.questions, (question) => question.quiz_id)
  return held.questions.flatMap((question) => {
    if (question.chains_to === null) { return [] }
    const siblings = (questionsOf.get(question.quiz_id) ?? []).filter((sibling) => sibling._id !== question._id)
    return siblings.some((sibling) => sibling.label === question.chains_to) ? [] : [`question ${question.label} chains to ${question.chains_to}, which no other question of its quiz answers to`]
  })
}

/** Each column's `source` is a question's field or view, or the label of a widgeting of its quiz */
function unshowableSources(held: Held): string[] {
  const widgetingsOf = groupedBy(held.widgetings, (widgeting) => widgeting.quiz_id)
  return held.columns.flatMap((column) => (
    isShowable(column.source, widgetingsOf.get(column.quiz_id) ?? []) ? [] : [`column ${column.label} shows ${column.source}, which its quiz has nothing to show for`]
  ))
}

/** Whether `source` names a question's field or view, or one of `widgetings` */
function isShowable(source: string, widgetings: readonly Doc<'widgetings'>[]): boolean {
  const named = sourceOf(source)
  if (named.kind === 'widgeting') { return widgetings.some((widgeting) => widgeting.label === named.label) }
  if (named.kind === 'view') { return source === `${QuestionWidgetLabel}.${named.view}` }
  return source === `${QuestionWidgetLabel}.${named.field}`
}

/** No two hunts share a label, nor two quizzes of one realm */
function sharedLabels(held: Held): string[] {
  const quizzesOf = groupedBy(held.quizzes, (quiz) => quiz.realm_id)
  return [
    ...repeatsIn(held.hunts.map((hunt) => hunt.label)).map((label) => `two hunts answer to ${label}`),
    ...quizzesOf.values().flatMap((quizzes) => repeatsIn(quizzes.map((quiz) => quiz.label)).map((label) => `two quizzes of one realm answer to ${label}`)),
  ]
}

/** What a sound deployment holds to */
export const SoundnessChecks: SoundnessCheck[] = [
  { title: 'every id names a row',                                faultsOf: danglingIds },
  { title: "every quiz's row_ordering is its questions",          faultsOf: misorderedQuizzes },
  { title: 'every chain names a sibling',                         faultsOf: danglingChains },
  { title: "every column's source names something showable",      faultsOf: unshowableSources },
  { title: 'no two hunts, nor two quizzes of a realm, share a label', faultsOf: sharedLabels },
]

/**
 * Every row of every table a test reads back, as `tt` holds them now.
 *
 * @example (await heldIn(tt)).quizzes.length
 */
export async function heldIn(tt: Tester): Promise<Held> {
  const tables = await tt.run(async (ctx) => await Promise.all(HeldTablenames.map(async (tablename) => await ctx.db.query(tablename).collect())))
  return Object.fromEntries(HeldTablenames.map((tablename, idx) => [tablename, tables[idx] ?? []])) as Held
}

/**
 * Every way `tt` fails to hold together, each as `check title: what is wrong`; none when sound.
 *
 * @example expect(await faultsIn(tt)).to.deep.eq([])
 */
export async function faultsIn(tt: Tester): Promise<string[]> {
  const held = await heldIn(tt)
  return SoundnessChecks.flatMap(({ title, faultsOf }) => faultsOf(held).map((fault) => `${title}: ${fault}`))
}

/**
 * Fail the test when `tt` holds anything that does not hold together: what a test of a write
 * ends with, to show it left nothing dangling.
 *
 * @example await act({ kind: 'delete_quiz', quiz_id }); await expectSound(tt)
 */
export async function expectSound(tt: Tester): Promise<void> {
  const faults = await faultsIn(tt)
  expect(faults, `the deployment does not hold together:\n${faults.join('\n')}`).to.deep.eq([])
}
