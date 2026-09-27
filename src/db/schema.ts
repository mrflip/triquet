import { schema as JZS } from 'jazz-tools'
import { plain } from '../lib/validator'
import { TextkindVals } from '../lib/ask/contract'
import { ModelTierVals, type LastErrT } from '../models/ask'
import { ExpressionOwnerVals } from '../models/expression'
import { BotLabelVals } from '../models/bot-label'
import { BottingValidators, BottingStatusVals } from '../models/botting'
import type { BulkIshesRunT, Sortkey } from '../models/quiz'
import { ReviewPhaseVals } from '../models/review'
import { WidgetkindVals } from '../models/widget'
import { jsonText } from './json-text'

/** A persona in the app, named by a label a person types to become it */
const idents = JZS.table({
  label: JZS.string(),
  title: JZS.string(),
}, {
  identings: JZS.reverse('identings', 'ident'),
})

/** One time an account took on an ident: the account's newest is the ident it is now */
const identings = JZS.table({
  ident_id: JZS.uuid(),
}, {
  ident: JZS.rel('idents', 'ident_id'),
})

/** A hunt: the unit of address and, later, of membership. Its realms hold its quizzes. */
const hunts = JZS.table({
  label:        JZS.string(),
  forced_label: JZS.string().optional(),
  title:        JZS.string(),
}, {
  realms:      JZS.reverse('realms', 'hunt'),
  expressions: JZS.reverse('expressions', 'hunt'),
})

/** A division of a hunt, holding quizzes, kept in the order its hunt lists them */
const realms = JZS.table({
  hunt_id:  JZS.uuid(),
  label:    JZS.string(),
  title:    JZS.string(),
  position: JZS.int(),
}, {
  hunt:    JZS.rel('hunts', 'hunt_id'),
  quizzes: JZS.reverse('quizzes', 'realm'),
})

/** A calculation the hunt's quizzes can show as a column, kept in the order the author lists them */
const expressions = JZS.table({
  hunt_id:     JZS.uuid(),
  owner:       JZS.enum(...ExpressionOwnerVals),
  label:       JZS.string(),
  formula:     JZS.string(),
  description: JZS.string(),
  position:    JZS.int(),
}, {
  hunt: JZS.rel('hunts', 'hunt_id'),
})

/** One trivia quiz. Its questions, widgets and columns are rows of their own, each ordered by `position`. */
const quizzes = JZS.table({
  realm_id:        JZS.uuid(),
  title:           JZS.string(),
  label:           JZS.string(),
  forced_label:    JZS.string().optional(),
  version:         JZS.string(),
  locked:          JZS.boolean(),
  last_sortkey:    JZS.string().optional().transform<Sortkey | null>({ from: (raw) => raw as Sortkey | null, to: (val) => val }),
  bulk_ishes_last: jsonText<NonNullable<BulkIshesRunT>>(),
}, {
  realm:     JZS.rel('realms', 'realm_id'),
  questions: JZS.reverse('questions', 'quiz'),
  widgets:   JZS.reverse('widgets', 'quiz'),
  columns:   JZS.reverse('columns', 'quiz'),
})

/**
 * Something a quiz can show for every question, kept in the order the author lists them: an
 * expression put to work, or a bot put to the quiz. One table for both, so that they share
 * one order; the columns only one kind uses are null for the other.
 */
const widgets = JZS.table({
  quiz_id:          JZS.uuid(),
  label:            JZS.string(),
  kind:             JZS.enum(...WidgetkindVals),
  expression_label: JZS.string().optional(),
  bot_label:     JZS.enum(...BotLabelVals).optional(),
  textkind:         JZS.enum(...TextkindVals).optional(),
  description:      JZS.string(),
  position:         JZS.int(),
}, {
  quiz: JZS.rel('quizzes', 'quiz_id'),
})

/** One column of a quiz's grid, kept in the order they appear, apart from the widgets they show */
const columns = JZS.table({
  quiz_id:  JZS.uuid(),
  label:    JZS.string(),
  title:    JZS.string(),
  source:   JZS.string(),
  width_px: JZS.int(),
  position: JZS.int(),
}, {
  quiz: JZS.rel('quizzes', 'quiz_id'),
})

/** One ident's review of one quiz: an overall note and how far along it is. Hidden from the smiths until shared. */
const reviews = JZS.table({
  quiz_id:  JZS.uuid(),
  ident_id: JZS.uuid(),
  overall:  JZS.string(),
  phase:    JZS.enum(...ReviewPhaseVals),
}, {
  quiz:  JZS.rel('quizzes', 'quiz_id'),
  ident: JZS.rel('idents', 'ident_id'),
})

/** One question: only what the author writes. What bots replied lives in `bottings`. */
const questions = JZS.table({
  quiz_id:      JZS.uuid(),
  position:     JZS.int(),
  label:        JZS.string(),
  forced_label: JZS.string().optional(),
  title:        JZS.string(),
  qnum:         JZS.string(),
  clueing:      JZS.string(),
  hint:         JZS.string(),
  /** The label of the question this one chains to, checked against its siblings by the quiz */
  chains_to:    JZS.string().optional(),
  full_answer:  JZS.string(),
  alt_text:     JZS.string(),
  notes:        JZS.string(),
}, {
  quiz:     JZS.rel('quizzes', 'quiz_id'),
  bottings: JZS.reverse('bottings', 'question'),
})

/**
 * One time a bot was put one of a question's texts, and what came back. Never revised: a
 * fresh ask is a fresh row, and what the grid shows is the newest row for each bot and text,
 * by `$createdAt`.
 */
const bottings = JZS.table({
  question_id:        JZS.uuid(),
  bot_label:       JZS.enum(...BotLabelVals),
  textkind:           JZS.enum(...TextkindVals),
  asked_text:         JZS.string().optional(),
  status:             JZS.enum(...BottingStatusVals),
  reply_text:         JZS.string().optional(),
  items:              JZS.json(plain(BottingValidators.items)).default([]),
  message:            JZS.string().optional(),
  response:           jsonText<NonNullable<LastErrT['response']>>(),
  truncated:          JZS.boolean(),
  model_tier_applied: JZS.enum(...ModelTierVals).optional(),
  approx_tokens:      JZS.int().optional(),
}, {
  question: JZS.rel('questions', 'question_id'),
})

/** The app's tables, in Jazz's own DSL. Each has a row validator in `models/` that says what the column cannot. */
export const schema = JZS.defineSchema({ idents, identings, hunts, realms, expressions, quizzes, widgets, columns, questions, bottings, reviews })

/** The typed handle every query and write starts from */
export const app = JZS.defineApp(schema)

/** One row of each table, as a query reads it back */
export type IdentRow      = JZS.RowOf<typeof app.idents>
export type IdentingRow   = JZS.RowOf<typeof app.identings>
export type HuntRow       = JZS.RowOf<typeof app.hunts>
export type RealmRow      = JZS.RowOf<typeof app.realms>
export type ExpressionRow = JZS.RowOf<typeof app.expressions>
export type QuizRow       = JZS.RowOf<typeof app.quizzes>
export type WidgetRow     = JZS.RowOf<typeof app.widgets>
export type ColumnRow     = JZS.RowOf<typeof app.columns>
export type QuestionRow   = JZS.RowOf<typeof app.questions>
export type BottingRow    = JZS.RowOf<typeof app.bottings>
export type ReviewRow     = JZS.RowOf<typeof app.reviews>
