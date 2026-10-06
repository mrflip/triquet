import _ from 'es-toolkit/compat'
import { defineSchema, defineTable } from 'convex/server'
import { v as CVX, type VAny } from 'convex/values'
import { zodOutputToConvex, zodOutputToConvexFields } from 'convex-helpers/server/zod4'
import { authTables } from '@convex-dev/auth/server'
import { ColumnValidators } from '../src/models/column'
import { HuntValidators } from '../src/models/hunt'
import { HuntingValidators } from '../src/models/hunting'
import { IdentValidators } from '../src/models/ident'
import { IdentingValidators } from '../src/models/identing'
import { QuestionValidators } from '../src/models/question'
import { QuizValidators } from '../src/models/quiz'
import { RealmValidators } from '../src/models/realm'
import { ReviewValidators } from '../src/models/review'
import { ReviewingValidators } from '../src/models/reviewing'
import { SignalValidators } from '../src/models/signal'
import { WidgetValidators } from '../src/models/widget'
import { WidgetedValidators, type JsonT } from '../src/models/widgeted'
import { WidgetingValidators } from '../src/models/widgeting'

// Every table's fields are its row validator's, through the bridge, which keeps each field's
// shape, nullability and closed sets; a widget, whose row is a union of its formularies, is a
// union table. What the bridge cannot carry (patterns, lengths, integers, and checks across
// fields) stays the row validator's, which every write passes first.
//
// Five fields are written by hand, each any JSON at all, whose recursive type the bridge converts
// at run time but TypeScript cannot follow: a widgeting's `params`, and a widgeted's `value` and
// `result_meta`, a quiz's widgeted's as a question's. `tests/convex/schema.test.ts` holds them to the row validators.
//
// Five more are written by hand while `migrations.ts` backfills them: a quiz's `recap_head`,
// `recap_tail` and `templated`, a question's `recap`, and a widgeting's `tier`. Each is optional
// here though every write gives one, so that rows written before it existed still fit; the row
// validators require them. Each is still bridged from its validator.
//
// A row's stamps (`created_at`, `updated_at`) are optional for good, in the row validators too:
// the trigger writes them once a row has landed (`stamping.ts`), so a row goes in without them.
//
// The tables of Convex Auth (`users`, `authSessions`, `authAccounts` and the rest) are its own,
// spread in as it ships them and written only by it: no row validator of ours derives them.

const identFields       = zodOutputToConvexFields(IdentValidators.row.shape)
const identingFields    = zodOutputToConvexFields(IdentingValidators.row.shape)
const huntFields        = zodOutputToConvexFields(HuntValidators.row.shape)
const realmFields       = zodOutputToConvexFields(RealmValidators.row.shape)
const quizFields        = {
  ...zodOutputToConvexFields(QuizValidators.row.shape),
  recap_head: CVX.optional(zodOutputToConvex(QuizValidators.recap_head)),
  recap_tail: CVX.optional(zodOutputToConvex(QuizValidators.recap_tail)),
  templated:  CVX.optional(zodOutputToConvex(QuizValidators.templated)),
}
const widgetFields      = zodOutputToConvex(WidgetValidators.row)
const widgetingFields   = {
  ...zodOutputToConvexFields(_.omit(WidgetingValidators.row.shape, ['params'])),
  params: CVX.any() as VAny<Record<string, JsonT>>,
  tier:   CVX.optional(zodOutputToConvex(WidgetingValidators.tier)),
}
const widgetedFields    = {
  ...zodOutputToConvexFields(_.omit(WidgetedValidators.row.shape, ['value', 'result_meta'])),
  value:       CVX.any() as VAny<JsonT | null>,
  result_meta: CVX.any() as VAny<Record<string, JsonT>>,
}
const quizWidgetedFields = {
  ...zodOutputToConvexFields(_.omit(WidgetedValidators.quizRow.shape, ['value', 'result_meta'])),
  value:       CVX.any() as VAny<JsonT | null>,
  result_meta: CVX.any() as VAny<Record<string, JsonT>>,
}
const columnFields      = zodOutputToConvexFields(ColumnValidators.row.shape)
const questionFields    = { ...zodOutputToConvexFields(QuestionValidators.row.shape), recap: CVX.optional(zodOutputToConvex(QuestionValidators.recap)) }
const reviewFields      = zodOutputToConvexFields(ReviewValidators.row.shape)
const reviewingFields   = zodOutputToConvexFields(ReviewingValidators.row.shape)
const huntingFields     = zodOutputToConvexFields(HuntingValidators.row.shape)
const signalFields      = zodOutputToConvexFields(SignalValidators.row.shape)

/**
 * The app's tables. Children are read through their parent's index, in their committed order
 * where they have one (`position`), else in the order they were made; Convex appends
 * `_creationTime` to every index, so the earliest of two rows sharing a label comes first. A
 * quiz's questions are the exception: the quiz holds their order (`row_ordering`), and each is
 * read by its id.
 */
export default defineSchema({
  ...authTables,
  /** A persona in the app, named by a label a person types to become it, held by the session that claimed it */
  idents:      defineTable(identFields).index('by_label', ['label']),
  /** One time a session asserted a username: its newest is the ident it is now */
  identings:   defineTable(identingFields).index('by_user_id', ['user_id']),
  /** A hunt: the unit of address and of membership, found by its label within its org (or, from an old address, by its label alone). Its realms hold its quizzes. */
  hunts:       defineTable(huntFields).index('by_label', ['label']).index('by_orglabel_and_label', ['orglabel', 'label']),
  /** A division of a hunt, holding quizzes, kept in the order its hunt lists them */
  realms:      defineTable(realmFields).index('by_hunt_id_and_position', ['hunt_id', 'position']),
  /** A reusable definition in the library every hunt shares, kept in the order the library lists them */
  widgets:     defineTable(widgetFields).index('by_scope_and_position', ['scope', 'position']).index('by_scope_and_label', ['scope', 'label']),
  /** One trivia quiz, in the order its realm's quizzes were made, or found in its realm by label, or among its hunt's */
  quizzes:     defineTable(quizFields).index('by_realm_id', ['realm_id']).index('by_realm_id_and_label', ['realm_id', 'label']).index('by_hunt_id', ['hunt_id']),
  /** One widget put to work in one quiz, in its quiz's run order */
  widgetings:  defineTable(widgetingFields).index('by_quiz_id_and_position', ['quiz_id', 'position']).index('by_widget_label', ['widget_label']),
  /** One column of a quiz's grid, apart from the widgetings they show */
  columns:     defineTable(columnFields).index('by_quiz_id_and_position', ['quiz_id', 'position']),
  /** One question: only what the author writes. What its widgetings stored lives in `widgeteds`. */
  questions:   defineTable(questionFields).index('by_quiz_id', ['quiz_id']),
  /** What one widgeting came to for one question, for a formulary that stores: appended, never revised */
  widgeteds:   defineTable(widgetedFields).index('by_question_id_and_widgeting_id', ['question_id', 'widgeting_id']).index('by_widgeting_id', ['widgeting_id']),
  /** What one widgeting run once for the whole quiz came to, for a formulary that stores: an entry's one row, upserted */
  quiz_widgeteds: defineTable(quizWidgetedFields).index('by_quiz_id_and_widgeting_id', ['quiz_id', 'widgeting_id']).index('by_widgeting_id', ['widgeting_id']),
  /** One ident's review of one quiz. Hidden from the smiths until shared. */
  reviews:     defineTable(reviewFields).index('by_quiz_id', ['quiz_id']).index('by_quiz_id_and_ident_id', ['quiz_id', 'ident_id']),
  /** One review's verdict on one question, made the first time the reviewer writes to it */
  reviewings:  defineTable(reviewingFields).index('by_review_id_and_question_id', ['review_id', 'question_id']).index('by_question_id', ['question_id']),
  /** One ident's place on one hunt, with a role: at most one per hunt and ident */
  huntings:    defineTable(huntingFields).index('by_hunt_id', ['hunt_id']).index('by_ident_id_and_hunt_id', ['ident_id', 'hunt_id']),
  /** One quiz's change signal: when its files last changed, written by the database's trigger alone (`signalling.ts`), read by its smiths' browsers to know which quiz to fetch again */
  signals:     defineTable(signalFields).index('by_hunt_id', ['hunt_id']).index('by_quiz_id', ['quiz_id']),
})
