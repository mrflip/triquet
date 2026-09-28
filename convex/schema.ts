import _ from 'es-toolkit/compat'
import { defineSchema, defineTable } from 'convex/server'
import { v as CVX, type VAny } from 'convex/values'
import { zodOutputToConvex, zodOutputToConvexFields } from 'convex-helpers/server/zod4'
import type { LastErrT } from '../src/models/ask'
import { BottingValidators } from '../src/models/botting'
import { ColumnValidators } from '../src/models/column'
import { ExpressionValidators } from '../src/models/expression'
import { HuntValidators } from '../src/models/hunt'
import { IdentValidators } from '../src/models/ident'
import { IdentingValidators } from '../src/models/identing'
import { QuestionValidators } from '../src/models/question'
import { QuizValidators } from '../src/models/quiz'
import { RealmValidators } from '../src/models/realm'
import { ReviewValidators } from '../src/models/review'
import { WidgetValidators } from '../src/models/widget'

// Every table's fields are its row validator's, through the bridge, which keeps each field's
// shape, nullability and closed sets; a widget, whose row is a union of its two kinds, is a union
// table. What the bridge cannot carry (patterns, lengths, integers,
// and checks across fields) stays the row validator's, which every write passes first.
//
// One field is written by hand: a botting's `response`, any JSON at all, whose recursive type the
// bridge converts at run time but TypeScript cannot follow. `tests/convex/schema.test.ts` holds it
// to the row validator.

const identFields       = zodOutputToConvexFields(IdentValidators.row.shape)
const identingFields    = zodOutputToConvexFields(IdentingValidators.row.shape)
const huntFields        = zodOutputToConvexFields(HuntValidators.row.shape)
const realmFields       = zodOutputToConvexFields(RealmValidators.row.shape)
const expressionFields  = zodOutputToConvexFields(ExpressionValidators.row.shape)
const quizFields        = zodOutputToConvexFields(QuizValidators.row.shape)
const widgetFields      = zodOutputToConvex(WidgetValidators.row)
const columnFields      = zodOutputToConvexFields(ColumnValidators.row.shape)
const questionFields    = zodOutputToConvexFields(QuestionValidators.row.shape)
const bottingFields     = {
  ...zodOutputToConvexFields(_.omit(BottingValidators.row.shape, ['response'])),
  response: CVX.any() as VAny<LastErrT['response'] | null>,
}
const reviewFields      = zodOutputToConvexFields(ReviewValidators.row.shape)

/**
 * The app's tables. Children are read through their parent's index, in their committed order
 * where they have one (`position`), else in the order they were made; Convex appends
 * `_creationTime` to every index, so the earliest of two rows sharing a label comes first.
 */
export default defineSchema({
  /** A persona in the app, named by a label a person types to become it */
  idents:      defineTable(identFields).index('by_label', ['label']),
  /** One time a browser took on an ident: its newest is the ident it is now */
  identings:   defineTable(identingFields).index('by_browser_key', ['browser_key']),
  /** A hunt: the unit of address and, later, of membership. Its realms hold its quizzes. */
  hunts:       defineTable(huntFields).index('by_label', ['label']).index('by_forced_label', ['forced_label']),
  /** A division of a hunt, holding quizzes, kept in the order its hunt lists them */
  realms:      defineTable(realmFields).index('by_hunt_id_and_position', ['hunt_id', 'position']),
  /** A calculation the hunt's quizzes can show as a column, kept in the order the author lists them */
  expressions: defineTable(expressionFields).index('by_hunt_id_and_position', ['hunt_id', 'position']),
  /** One trivia quiz, in the order its realm's quizzes were made */
  quizzes:     defineTable(quizFields).index('by_realm_id', ['realm_id']),
  /** Something a quiz can show for every question: an expression put to work, or a bot put to the quiz */
  widgets:     defineTable(widgetFields).index('by_quiz_id_and_position', ['quiz_id', 'position']),
  /** One column of a quiz's grid, apart from the widgets they show */
  columns:     defineTable(columnFields).index('by_quiz_id_and_position', ['quiz_id', 'position']),
  /** One question: only what the author writes. What bots replied lives in `bottings`. */
  questions:   defineTable(questionFields).index('by_quiz_id_and_position', ['quiz_id', 'position']),
  /** One time a bot was put one of a question's texts, and what came back. Never revised. */
  bottings:    defineTable(bottingFields).index('by_question_id_and_bot_label_and_textkind', ['question_id', 'bot_label', 'textkind']),
  /** One ident's review of one quiz. Hidden from the smiths until shared. */
  reviews:     defineTable(reviewFields).index('by_quiz_id', ['quiz_id']).index('by_quiz_id_and_ident_id', ['quiz_id', 'ident_id']),
})
