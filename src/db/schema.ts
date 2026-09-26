import { schema as JZS } from 'jazz-tools'
import { plain } from '../lib/validator'
import { TextkindVals } from '../lib/ask/contract'
import { ModelTierVals, type LastErrT } from '../models/ask'
import { ExpressionOwnerVals } from '../models/expression'
import { PlayerLabelVals } from '../models/player-label'
import { PlayingValidators, PlayingStatusVals } from '../models/playing'
import type { BulkIshesRunT, Sortkey } from '../models/quiz'
import { WidgetkindVals } from '../models/widget'
import { jsonText } from './json-text'

/**
 * Everything one person holds: one per account, found by who created it. Which quiz is on
 * screen is remembered here, so a reload opens where the author left off.
 */
const workspaces = JZS.table({
  active_quiz_id: JZS.uuid().optional(),
}, {
  active_quiz: JZS.rel('quizzes', 'active_quiz_id'),
  quizzes:     JZS.reverse('quizzes', 'workspace'),
  expressions: JZS.reverse('expressions', 'workspace'),
})

/** A calculation the workspace's quizzes can show as a column, kept in the order the author lists them */
const expressions = JZS.table({
  workspace_id: JZS.uuid(),
  owner:        JZS.enum(...ExpressionOwnerVals),
  label:        JZS.string(),
  formula:      JZS.string(),
  description:  JZS.string(),
  position:     JZS.int(),
}, {
  workspace: JZS.rel('workspaces', 'workspace_id'),
})

/** One trivia quiz. Its questions, widgets and columns are rows of their own, each ordered by `position`. */
const quizzes = JZS.table({
  workspace_id:    JZS.uuid(),
  title:           JZS.string(),
  label:           JZS.string(),
  forced_label:    JZS.string().optional(),
  version:         JZS.string(),
  locked:          JZS.boolean(),
  last_sortkey:    JZS.string().optional().transform<Sortkey | null>({ from: (raw) => raw as Sortkey | null, to: (val) => val }),
  bulk_ishes_last: jsonText<NonNullable<BulkIshesRunT>>(),
}, {
  workspace: JZS.rel('workspaces', 'workspace_id'),
  questions: JZS.reverse('questions', 'quiz'),
  widgets:   JZS.reverse('widgets', 'quiz'),
  columns:   JZS.reverse('columns', 'quiz'),
})

/**
 * Something a quiz can show for every question, kept in the order the author lists them: an
 * expression put to work, or a player put to the quiz. One table for both, so that they share
 * one order; the columns only one kind uses are null for the other.
 */
const widgets = JZS.table({
  quiz_id:          JZS.uuid(),
  label:            JZS.string(),
  kind:             JZS.enum(...WidgetkindVals),
  expression_label: JZS.string().optional(),
  player_label:     JZS.enum(...PlayerLabelVals).optional(),
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

/** One question: only what the author writes. What players replied lives in `playings`. */
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
  playings: JZS.reverse('playings', 'question'),
})

/**
 * One time a player was put one of a question's texts, and what came back. Never revised: a
 * fresh ask is a fresh row, and what the grid shows is the newest row for each player and text,
 * by `$createdAt`.
 */
const playings = JZS.table({
  question_id:        JZS.uuid(),
  player_label:       JZS.enum(...PlayerLabelVals),
  textkind:           JZS.enum(...TextkindVals),
  asked_text:         JZS.string().optional(),
  status:             JZS.enum(...PlayingStatusVals),
  reply_text:         JZS.string().optional(),
  items:              JZS.json(plain(PlayingValidators.items)).default([]),
  message:            JZS.string().optional(),
  response:           jsonText<NonNullable<LastErrT['response']>>(),
  truncated:          JZS.boolean(),
  model_tier_applied: JZS.enum(...ModelTierVals).optional(),
  approx_tokens:      JZS.int().optional(),
}, {
  question: JZS.rel('questions', 'question_id'),
})

/** The app's tables, in Jazz's own DSL. Each has a row validator in `models/` that says what the column cannot. */
export const schema = JZS.defineSchema({ workspaces, expressions, quizzes, widgets, columns, questions, playings })

/** The typed handle every query and write starts from */
export const app = JZS.defineApp(schema)

/** One row of each table, as a query reads it back */
export type WorkspaceRow  = JZS.RowOf<typeof app.workspaces>
export type ExpressionRow = JZS.RowOf<typeof app.expressions>
export type QuizRow       = JZS.RowOf<typeof app.quizzes>
export type WidgetRow     = JZS.RowOf<typeof app.widgets>
export type ColumnRow     = JZS.RowOf<typeof app.columns>
export type QuestionRow   = JZS.RowOf<typeof app.questions>
export type PlayingRow    = JZS.RowOf<typeof app.playings>
