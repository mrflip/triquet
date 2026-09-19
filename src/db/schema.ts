import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { BulkIshesRunT, Sortkey } from '../models/quiz'
import type { IshItemT } from '../models/ish'
import type { ModelTier } from '../models/ask'
import type { Textkind } from '../lib/ask/contract'
import type { PlayerLabel, PlayerPrompts } from '../models/player'

/**
 * Everything one person holds, until there are accounts: one per browser, found again by the
 * cookie that browser carries.
 */
export const workspaces = sqliteTable('workspaces', {
  id:             text().primaryKey(),
  /** Deliberately not a foreign key: a quiz already points back at its workspace */
  active_quiz_id: text(),
  created_at:     integer().notNull(),
})

/** One trivia quiz. Its questions are rows of their own, ordered by `questions.position`. */
export const quizzes = sqliteTable('quizzes', {
  id:              text().primaryKey(),
  workspace_id:    text().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  title:           text().notNull(),
  label:           text().notNull(),
  forced_label:    text(),
  version:         text().notNull(),
  locked:          integer({ mode: 'boolean' }).notNull(),
  last_sortkey:    text().$type<Sortkey>(),
  bulk_ishes_last: text({ mode: 'json' }).$type<BulkIshesRunT>(),
}, (table) => [
  index('quizzes_workspace_idx').on(table.workspace_id),
])

/** One question: only what the author writes. What players answered lives in `answerings`. */
export const questions = sqliteTable('questions', {
  id:           text().primaryKey(),
  quiz_id:      text().notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  /** The question's place in its quiz's committed order, counting from zero */
  position:     integer().notNull(),
  label:        text().notNull(),
  forced_label: text(),
  title:        text().notNull(),
  qnum:         text().notNull(),
  clueing:      text().notNull(),
  hint:         text().notNull(),
  /** Not a foreign key: a chain is checked against its siblings by the quiz, not by the table */
  chains_to:    text(),
  full_answer:  text().notNull(),
  alt_text:     text().notNull(),
  notes:        text().notNull(),
}, (table) => [
  index('questions_quiz_idx').on(table.quiz_id, table.position),
])

/** Someone -- today, a model with a particular brief -- who can be put a question and answer it */
export const players = sqliteTable('players', {
  label:      text().$type<PlayerLabel>().primaryKey(),
  title:      text().notNull(),
  blurb:      text().notNull(),
  model_tier: text().$type<ModelTier>().notNull(),
  max_tokens: integer().notNull(),
  prompts:    text({ mode: 'json' }).$type<PlayerPrompts>().notNull(),
})

/**
 * One time a player was put one of a question's texts, and what came back. Never revised: a
 * fresh ask is a fresh row, and what the grid shows is the latest row for each player and text.
 */
export const answerings = sqliteTable('answerings', {
  id:                 text().primaryKey(),
  question_id:        text().notNull().references(() => questions.id, { onDelete: 'cascade' }),
  player_label:       text().$type<PlayerLabel>().notNull().references(() => players.label),
  /** Which of the question's texts was put to the player */
  textkind:           text().$type<Textkind>().notNull(),
  /** That text, exactly as put; null when it is not known */
  asked_text:         text(),
  status:             text().$type<'done' | 'error'>().notNull(),
  /** A dumdum answer */
  answer_text:        text(),
  /** A numnum answer */
  items:              text({ mode: 'json' }).$type<IshItemT[]>(),
  /** Why the ask failed, in the author's words */
  message:            text(),
  truncated:          integer({ mode: 'boolean' }).notNull(),
  model_tier_applied: text().$type<ModelTier>(),
  approx_tokens:      integer(),
  created_at:         integer().notNull(),
}, (table) => [
  index('answerings_question_idx').on(table.question_id, table.player_label, table.textkind, table.created_at),
])

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  quizzes: many(quizzes),
}))

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [quizzes.workspace_id], references: [workspaces.id] }),
  questions: many(questions),
}))

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz:       one(quizzes, { fields: [questions.quiz_id], references: [quizzes.id] }),
  answerings: many(answerings),
}))

export const playersRelations = relations(players, ({ many }) => ({
  answerings: many(answerings),
}))

export const answeringsRelations = relations(answerings, ({ one }) => ({
  question: one(questions, { fields: [answerings.question_id], references: [questions.id] }),
  player:   one(players, { fields: [answerings.player_label], references: [players.label] }),
}))

export type QuizRow      = typeof quizzes.$inferSelect
export type QuestionRow  = typeof questions.$inferSelect
export type PlayerRow    = typeof players.$inferSelect
export type AnsweringRow = typeof answerings.$inferSelect
