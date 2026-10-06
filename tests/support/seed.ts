import type { Id } from '../../convex/_generated/dataModel'
import { insertAbsentWidgets, insertLayout, type QuizPlace, type Writer } from '../../convex/writing/quiz_writing'
import { HuntValidators, type HuntT } from '../../src/models/hunt'
import { QuestionValidators } from '../../src/models/question'
import { QuizValidators, type QuizT } from '../../src/models/quiz'
import { RealmValidators } from '../../src/models/realm'
import { SeedWidgets } from '../../src/models/seeds'

// A test builds its fixture as a tree, which is the shape a test reads back (`hunts.whole`)
// and compares; these write one into rows. A fixture's ids are its own: the rows get the
// database's, and a chain is written as the label of the question it names, as the rows hold
// it. What a question's widgetings stored is not written; a test records it through
// `record_widgeted`. Written raw, the rows carry no stamps, as rows the stamping trigger has never
// seen: each reads as made, and not edited, when the database made it (`Stamps.of`), until a test
// edits it through a mutation.

/**
 * `quiz`, a fixture, written into rows in the realm `place` names: its own row, its questions in
 * the order given, and its widgetings and columns in the order given.
 *
 * @returns The quiz's row id.
 * @throws When a row is not valid; the mutation writes nothing.
 *
 * @example await seedQuizRows(ctx.db, { hunt_id, realm_id }, Quiz.blank('Princes'))
 */
export async function seedQuizRows(db: Writer, { hunt_id, realm_id }: QuizPlace, quiz: QuizT): Promise<Id<'quizzes'>> {
  const { title, label, smiths_note, q1_preamble, locked, last_sortkey } = quiz
  const quiz_id = await db.insert('quizzes', QuizValidators.row({ hunt_id, realm_id, title, label, smiths_note, q1_preamble, locked, last_sortkey, row_ordering: [] }))
  const labelForId = new Map(quiz.questions.map((question) => [question._id, question.label]))
  const row_ordering: Id<'questions'>[] = []
  for (const question of quiz.questions) {
    const { label: questionLabel, title: questionTitle, qnum, clueing, hint, full_answer, alt_text, notes, viz } = question
    const row = QuestionValidators.row({
      hunt_id,
      quiz_id,
      label:     questionLabel,
      title:     questionTitle,
      qnum,
      clueing,
      hint,
      chains_to: question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null,
      full_answer,
      alt_text,
      notes,
      viz,
    })
    row_ordering.push(await db.insert('questions', row))
  }
  await db.patch('quizzes', quiz_id, { row_ordering })
  await insertLayout(db, { hunt_id, quiz_id }, quiz)
  return quiz_id
}

/** The org a seeded hunt is made in, unless the test says another: its seeded smith's (`seedHunt`) */
export const SeedOrg = 'seed_smith'

/**
 * `hunt`, a fixture, written into rows in the org `orglabel`: its own row, its realms in order,
 * and each realm's quizzes as `seedQuizRows` writes them; and the library given whichever seed
 * widgets it lacks.
 *
 * @returns The hunt's row id.
 * @throws When a row is not valid; the mutation writes nothing.
 *
 * @example await seedHuntRows(ctx.db, Hunt.blank('quiet_otter'))
 */
export async function seedHuntRows(db: Writer, hunt: HuntT, orglabel: string = SeedOrg): Promise<Id<'hunts'>> {
  const hunt_id = await db.insert('hunts', HuntValidators.row({ label: hunt.label, orglabel, title: hunt.title, branch: hunt.branch }))
  await insertAbsentWidgets(db, SeedWidgets)
  for (const [position, realm] of hunt.realms.entries()) {
    const realm_id = await db.insert('realms', RealmValidators.row({ hunt_id, position, label: realm.label, title: realm.title }))
    for (const quiz of realm.quizzes) { await seedQuizRows(db, { hunt_id, realm_id }, quiz) }
  }
  return hunt_id
}
