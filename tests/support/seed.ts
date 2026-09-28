import type { Id } from '../../convex/_generated/dataModel'
import { insertLayout, type Writer } from '../../convex/writing/quiz_writing'
import * as Labelmaker from '../../src/lib/labelmaker'
import { ExpressionValidators } from '../../src/models/expression'
import { HuntValidators, type HuntT } from '../../src/models/hunt'
import { QuestionValidators } from '../../src/models/question'
import { QuizValidators, type QuizT } from '../../src/models/quiz'
import { RealmValidators } from '../../src/models/realm'

// A test builds its fixture as a tree, which is the shape a test reads back (`hunts.whole`)
// and compares; these write one into rows. A fixture's ids are its own: the rows get the
// database's, and a chain is written as the label of the question it names, as the rows hold
// it. What a question's cells show is not written; a test records a reply through
// `record_botting`.

/**
 * `quiz`, a fixture, written into rows under `realm_id`: its own row, its questions in the order
 * given, and its widgets and columns in the order given.
 *
 * @returns The quiz's row id.
 * @throws When a row is not valid; the mutation writes nothing.
 *
 * @example await seedQuizRows(ctx.db, realm_id, Quiz.blank('Princes'))
 */
export async function seedQuizRows(db: Writer, realm_id: Id<'realms'>, quiz: QuizT): Promise<Id<'quizzes'>> {
  const { title, label, forced_label, version, locked, last_sortkey, bulk_ishes_last } = quiz
  const quiz_id = await db.insert('quizzes', QuizValidators.row({ realm_id, title, label, forced_label, version, locked, last_sortkey, bulk_ishes_last, row_ordering: [] }))
  const labelForId = new Map(quiz.questions.map((question) => [question._id, Labelmaker.effectiveLabelOf(question)]))
  const row_ordering: Id<'questions'>[] = []
  for (const question of quiz.questions) {
    const { label: questionLabel, forced_label: questionForced, title: questionTitle, qnum, clueing, hint, full_answer, alt_text, notes } = question
    const row = QuestionValidators.row({
      quiz_id,
      label:        questionLabel,
      forced_label: questionForced,
      title:        questionTitle,
      qnum,
      clueing,
      hint,
      chains_to:    question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null,
      full_answer,
      alt_text,
      notes,
    })
    row_ordering.push(await db.insert('questions', row))
  }
  await db.patch('quizzes', quiz_id, { row_ordering })
  await insertLayout(db, quiz_id, quiz)
  return quiz_id
}

/**
 * `hunt`, a fixture, written into rows: its own row, its expressions in order, its realms in
 * order, and each realm's quizzes as `seedQuizRows` writes them.
 *
 * @returns The hunt's row id.
 * @throws When a row is not valid; the mutation writes nothing.
 *
 * @example await seedHuntRows(ctx.db, Hunt.blank('quiet_otter'))
 */
export async function seedHuntRows(db: Writer, hunt: HuntT): Promise<Id<'hunts'>> {
  const hunt_id = await db.insert('hunts', HuntValidators.row({ label: hunt.label, forced_label: hunt.forced_label, title: hunt.title }))
  for (const [position, expression] of hunt.expressions.entries()) {
    await db.insert('expressions', ExpressionValidators.row({ hunt_id, position, ...expression }))
  }
  for (const [position, realm] of hunt.realms.entries()) {
    const realm_id = await db.insert('realms', RealmValidators.row({ hunt_id, position, label: realm.label, title: realm.title }))
    for (const quiz of realm.quizzes) { await seedQuizRows(db, realm_id, quiz) }
  }
  return hunt_id
}
