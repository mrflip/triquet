import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import * as PA from '../lib/vv/patterns'
import type { BulkIshesRunT, Sortkey } from '../models/quiz'
import type { IshItemT } from '../models/ish'
import type { LastErrT, ModelTier } from '../models/ask'
import type { ExpressionOwner } from '../models/expression'
import type { ExpressingShape } from '../models/expressing'
import type { Servicelabel } from '../lib/credentials'
import type { Textkind } from '../lib/ask/contract'
import type { PlayerLabel, PlayerPrompts } from '../models/player'

/**
 * Everything one person holds, until there are accounts: one per browser, found again by the
 * cookie that browser carries.
 */
export const workspaces = sqliteTable('workspaces', {
  id:             text({ length: PA.Ulid.max }).primaryKey(),
  /** Deliberately not a foreign key: a quiz already points back at its workspace */
  active_quiz_id: text({ length: PA.Ulid.max }),
  created_at:     integer().notNull(),
})

/** A calculation the workspace's quizzes can show as a column, kept in the order the author lists them */
export const expressions = sqliteTable('expressions', {
  workspace_id: text({ length: PA.Ulid.max }).notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  owner:        text({ length: PA.Label.max }).$type<ExpressionOwner>().notNull(),
  label:        text({ length: PA.Label.max }).notNull(),
  formula:      text({ length: PA.Formulaish.max }).notNull(),
  description:  text({ length: PA.Noteish.max }).notNull(),
  position:     integer().notNull(),
}, (table) => [
  primaryKey({ columns: [table.workspace_id, table.owner, table.label] }),
])

/** One trivia quiz. Its questions are rows of their own, ordered by `questions.position`. */
export const quizzes = sqliteTable('quizzes', {
  id:              text({ length: PA.Ulid.max }).primaryKey(),
  workspace_id:    text({ length: PA.Ulid.max }).notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  title:           text({ length: PA.Titleish.max }).notNull(),
  label:           text({ length: PA.Label.max }).notNull(),
  forced_label:    text({ length: PA.Label.max }),
  version:         text({ length: PA.Label.max }).notNull(),
  locked:          integer({ mode: 'boolean' }).notNull(),
  last_sortkey:    text().$type<Sortkey>(),
  bulk_ishes_last: text({ mode: 'json' }).$type<BulkIshesRunT>(),
}, (table) => [
  index('quizzes_workspace_idx').on(table.workspace_id),
])

/**
 * One column a quiz shows: an expression put to work, in the order the columns appear. Not a
 * foreign key to `expressions`: a column is checked against them by the workspace, not the table.
 */
export const expressings = sqliteTable('expressings', {
  quiz_id:          text({ length: PA.Ulid.max }).notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  label:            text({ length: PA.Label.max }).notNull(),
  expression_label: text({ length: PA.Label.max }).notNull(),
  title:            text({ length: PA.Titleish.max }).notNull(),
  shape:            text().$type<ExpressingShape>().notNull(),
  position:         integer().notNull(),
}, (table) => [
  primaryKey({ columns: [table.quiz_id, table.label] }),
])

/** One question: only what the author writes. What players replied lives in `playings`. */
export const questions = sqliteTable('questions', {
  id:           text({ length: PA.Ulid.max }).primaryKey(),
  quiz_id:      text({ length: PA.Ulid.max }).notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  /** The question's place in its quiz's committed order, counting from zero */
  position:     integer().notNull(),
  label:        text({ length: PA.Label.max }).notNull(),
  forced_label: text({ length: PA.Label.max }),
  title:        text({ length: PA.Titleish.max }).notNull(),
  qnum:         text().notNull(),
  clueing:      text({ length: PA.Textish.max }).notNull(),
  hint:         text({ length: PA.Textish.max }).notNull(),
  /** Not a foreign key: a chain is checked against its siblings by the quiz, not by the table */
  chains_to:    text({ length: PA.Ulid.max }),
  full_answer:  text({ length: PA.Noteish.max }).notNull(),
  alt_text:     text({ length: PA.Noteish.max }).notNull(),
  notes:        text({ length: PA.Noteish.max }).notNull(),
}, (table) => [
  index('questions_quiz_idx').on(table.quiz_id, table.position),
])

/** Someone -- today, a model with a particular brief -- who can be put a question and reply */
export const players = sqliteTable('players', {
  label:      text({ length: PA.Label.max }).$type<PlayerLabel>().primaryKey(),
  title:      text({ length: PA.Titleish.max }).notNull(),
  blurb:      text({ length: PA.Noteish.max }).notNull(),
  /** Which outside service serves this player; defaulted so the column can be added to a database that already has players */
  servicelabel: text({ length: PA.Label.max }).$type<Servicelabel>().notNull().default('claude'),
  model_tier: text().$type<ModelTier>().notNull(),
  max_tokens: integer().notNull(),
  prompts:    text({ mode: 'json' }).$type<PlayerPrompts>().notNull(),
})

/**
 * One time a player was put one of a question's texts, and what came back. Never revised: a
 * fresh ask is a fresh row, and what the grid shows is the latest row for each player and text.
 */
export const playings = sqliteTable('playings', {
  id:                 text({ length: PA.Ulid.max }).primaryKey(),
  question_id:        text({ length: PA.Ulid.max }).notNull().references(() => questions.id, { onDelete: 'cascade' }),
  player_label:       text({ length: PA.Label.max }).$type<PlayerLabel>().notNull().references(() => players.label),
  /** Which of the question's texts was put to the player */
  textkind:           text().$type<Textkind>().notNull(),
  /** That text, exactly as put; null when it is not known */
  asked_text:         text({ length: PA.Textish.max }),
  status:             text().$type<'done' | 'error'>().notNull(),
  /** A dumdum reply */
  reply_text:        text({ length: PA.Noteish.max }),
  /** A numnum reply: the spans it found */
  items:              text({ mode: 'json' }).$type<IshItemT[]>(),
  /** Why the ask failed, in the author's words */
  message:            text({ length: PA.Noteish.max }),
  /** The error response as it came back, for a failed ask */
  response:           text({ mode: 'json' }).$type<LastErrT['response']>(),
  truncated:          integer({ mode: 'boolean' }).notNull(),
  model_tier_applied: text().$type<ModelTier>(),
  approx_tokens:      integer(),
  created_at:         integer().notNull(),
}, (table) => [
  index('playings_question_idx').on(table.question_id, table.player_label, table.textkind, table.created_at),
])

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  quizzes:     many(quizzes),
  expressions: many(expressions),
}))

export const expressionsRelations = relations(expressions, ({ one }) => ({
  workspace: one(workspaces, { fields: [expressions.workspace_id], references: [workspaces.id] }),
}))

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  workspace:   one(workspaces, { fields: [quizzes.workspace_id], references: [workspaces.id] }),
  questions:   many(questions),
  expressings: many(expressings),
}))

export const expressingsRelations = relations(expressings, ({ one }) => ({
  quiz: one(quizzes, { fields: [expressings.quiz_id], references: [quizzes.id] }),
}))

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz:       one(quizzes, { fields: [questions.quiz_id], references: [quizzes.id] }),
  playings: many(playings),
}))

export const playersRelations = relations(players, ({ many }) => ({
  playings: many(playings),
}))

export const playingsRelations = relations(playings, ({ one }) => ({
  question: one(questions, { fields: [playings.question_id], references: [questions.id] }),
  player:   one(players, { fields: [playings.player_label], references: [players.label] }),
}))

export type ExpressionRow = typeof expressions.$inferSelect
export type ExpressingRow = typeof expressings.$inferSelect
export type QuizRow      = typeof quizzes.$inferSelect
export type QuestionRow  = typeof questions.$inferSelect
export type PlayerRow    = typeof players.$inferSelect
export type PlayingRow = typeof playings.$inferSelect
