import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { openDb, type Db } from '../../src/db/client'
import { playings, questions } from '../../src/db/drizzle-schema'
import { createWorkspace, loadWorkspace, saveChange } from '../../src/db/workspaces'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SeedExpressions } from '../../src/models/expression'
import { mintId } from '../../src/lib/ids'
import { present } from '../support/present'
import type { WorkspaceT } from '../../src/models/workspace'

/** A fresh workspace, and a way to save one quiz of it as revised */
async function aWorkspace(db: Db): Promise<{ workspace_id: string, workspace: WorkspaceT, quiz: QuizT, save: (quiz: QuizT) => Promise<void> }> {
  const { workspace_id, workspace } = await createWorkspace(db)
  const quiz = workspace.quizzes[0]!
  const save = (revised: QuizT) => saveChange(db, workspace_id, { active_quiz_id: revised.id, quizzes: [revised], deleted_quiz_ids: [], expressions: null })
  return { workspace_id, workspace, quiz, save }
}

const guessAt = (updated_at: number, text = 'Leon') => ({ status: 'done' as const, text, truncated: false, updated_at, last_err: null })

describe('createWorkspace', () => {
  it('saves a workspace holding one blank quiz, which loads back as it was made', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, workspace } = await createWorkspace(db)
    expect(workspace.quizzes).to.have.length(1)
    expect(await loadWorkspace(db, workspace_id)).to.deep.eq(workspace)
  })
})

/** The first quiz as it loads back */
const quizHeld = (loaded: WorkspaceT | null) => present(loaded?.quizzes[0])

describe('widgets, columns and expressions', () => {
  const widget = { kind: 'expressing' as const, label: 'backward', expression_label: 'answer_reversed', description: 'Why we want it.' }
  const playing = { kind: 'playing' as const, label: 'numnum_again', player_label: 'numnum' as const, textkind: 'hint' as const, description: '' }
  const column = { label: 'backward_col', title: 'Backward', source: 'backward', width_px: 180 }

  it('come back as they were made: the standard expressions, and the standard widgets and columns, in order', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, workspace } = await createWorkspace(db)
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.expressions.map((expression) => expression.label)).to.deep.eq(workspace.expressions.map((expression) => expression.label))
    expect(quizHeld(loaded).widgets).to.deep.eq(present(workspace.quizzes[0]).widgets)
    expect(quizHeld(loaded).columns).to.deep.eq(present(workspace.quizzes[0]).columns)
  })

  it('keep a widget of each kind, whole', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    await save({ ...quiz, widgets: [...quiz.widgets, widget, playing] })
    const held = quizHeld(await loadWorkspace(db, workspace_id)).widgets.slice(-2)
    expect(held).to.deep.eq([widget, playing])
  })

  it('keep a column\'s title, source and width', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    await save({ ...quiz, widgets: [...quiz.widgets, widget], columns: [...quiz.columns, column] })
    expect(quizHeld(await loadWorkspace(db, workspace_id)).columns.at(-1)).to.deep.eq(column)
  })

  it('keep the order the widgets and the columns were given in, not the order of their labels', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    await save({ ...quiz, widgets: [widget, ...quiz.widgets.toReversed()], columns: [column, ...quiz.columns.toReversed()].filter((each) => each.source !== 'backward' || each === column) })
    const held = quizHeld(await loadWorkspace(db, workspace_id))
    expect(held.widgets.map((each) => each.label)).to.deep.eq([widget.label, ...quiz.widgets.toReversed().map((each) => each.label)])
    expect(held.columns.map((each) => each.label)).to.deep.eq([column.label, ...quiz.columns.toReversed().map((each) => each.label)])
  })

  it('keep the widgets and the columns apart: dropping a column keeps its widget', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    await save({ ...quiz, columns: quiz.columns.filter((each) => each.label !== 'hint_full') })
    const held = quizHeld(await loadWorkspace(db, workspace_id))
    expect(held.columns.map((each) => each.label)).to.not.include('hint_full')
    expect(held.widgets.map((each) => each.label)).to.include('hint_full')
  })

  it('lose a widget the quiz no longer holds', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    await save({ ...quiz, widgets: quiz.widgets.slice(1), columns: quiz.columns.filter((each) => each.source !== 'dumdum') })
    expect(quizHeld(await loadWorkspace(db, workspace_id)).widgets).to.have.length(quiz.widgets.length - 1)
  })

  it('remember a sort by a column', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    await save({ ...quiz, last_sortkey: 'column:clueing_full' })
    expect(quizHeld(await loadWorkspace(db, workspace_id)).last_sortkey).to.eq('column:clueing_full')
  })

  it('are replaced whole when a change carries them, and left alone when it does not', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, workspace, quiz } = await aWorkspace(db)
    const revised = workspace.expressions.map((expression) => (expression.label === 'answer_reversed' ? { ...expression, formula: '"changed"' } : expression))
    await saveChange(db, workspace_id, { active_quiz_id: quiz.id, quizzes: [], deleted_quiz_ids: [], expressions: revised })
    const first = await loadWorkspace(db, workspace_id)
    expect(first?.expressions.find((expression) => expression.label === 'answer_reversed')?.formula).to.eq('"changed"')
    await saveChange(db, workspace_id, { active_quiz_id: quiz.id, quizzes: [], deleted_quiz_ids: [], expressions: null })
    const second = await loadWorkspace(db, workspace_id)
    expect(second?.expressions).to.deep.eq(first?.expressions)
  })

  it('lose an expression the change no longer holds, and keep the order given', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, workspace, quiz } = await aWorkspace(db)
    const trimmed = workspace.expressions.filter((expression) => expression.label !== 'answer_reversed').toReversed()
    await saveChange(db, workspace_id, { active_quiz_id: quiz.id, quizzes: [], deleted_quiz_ids: [], expressions: trimmed })
    const loaded = await loadWorkspace(db, workspace_id)
    const held = loaded?.expressions.map((expression) => expression.label)
    expect(held).to.deep.eq(trimmed.map((expression) => expression.label))
  })

  it('are a workspace\'s own: another workspace\'s stay as they were', async () => {
    const db = await openDb(':memory:')
    const [mine, theirs] = [await aWorkspace(db), await aWorkspace(db)]
    await saveChange(db, mine.workspace_id, { active_quiz_id: mine.quiz.id, quizzes: [], deleted_quiz_ids: [], expressions: [] })
    const untouched = await loadWorkspace(db, theirs.workspace_id)
    expect(untouched?.expressions).to.have.length(mine.workspace.expressions.length)
  })

  it('give a workspace saved without any the standard ones on loading, standard columns and all', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    await saveChange(db, workspace_id, { active_quiz_id: quiz.id, quizzes: [], deleted_quiz_ids: [], expressions: [] })
    await save({ ...quiz, widgets: [], columns: [] })
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.expressions).to.have.length(SeedExpressions.length)
    expect(quizHeld(loaded).columns).to.have.length(21)
  })
})

describe('loadWorkspace', () => {
  it('finds nothing for a workspace that was never made', async () => {
    const db = await openDb(':memory:')
    expect(await loadWorkspace(db, mintId())).to.eq(null)
  })

  it('keeps each workspace to itself', async () => {
    const db = await openDb(':memory:')
    const [mine, theirs] = [await aWorkspace(db), await aWorkspace(db)]
    const loaded = await loadWorkspace(db, mine.workspace_id)
    expect(loaded?.quizzes.map((quiz) => quiz.id)).to.deep.eq([mine.quiz.id])
    expect(theirs.quiz.id).not.to.eq(mine.quiz.id)
  })
})

describe('saveChange', () => {
  it('saves every field an author writes, and loads it back', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    const [first, second] = quiz.questions
    const revised = Quiz.fill({
      ...quiz,
      title:        'Quiz one',
      locked:       true,
      last_sortkey: 'column:title',
      questions:    [
        { ...first!, clueing: 'Which region?', hint: 'BUT NOT a county', qnum: '3.1', chains_to: second!.id, notes: 'check', alt_text: 'alt', full_answer: 'Leon, in Spain' },
        second!,
      ],
    })
    await save(revised)
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.quizzes[0]).to.deep.eq(revised)
  })

  it('keeps the questions in the order they are given', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    const reversed = { ...quiz, questions: quiz.questions.toReversed() }
    await save(reversed)
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.quizzes[0]?.questions.map((question) => question.id)).to.deep.eq(reversed.questions.map((question) => question.id))
  })

  it('removes a question the quiz no longer holds, along with its playings', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    const [doomed, ...rest] = quiz.questions
    await save({ ...quiz, questions: [{ ...doomed!, guess: guessAt(5) }, ...rest] })
    await save({ ...quiz, questions: rest })
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.quizzes[0]?.questions).to.have.length(rest.length)
    expect(await db.select().from(playings).where(eq(playings.question_id, doomed!.id))).to.deep.eq([])
  })

  it('adds a new quiz, deletes an old one, and remembers which is open', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz } = await aWorkspace(db)
    const fresh = Quiz.blank('Fresh')
    await saveChange(db, workspace_id, { active_quiz_id: fresh.id, quizzes: [fresh], deleted_quiz_ids: [quiz.id], expressions: null })
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.quizzes.map((held) => held.id)).to.deep.eq([fresh.id])
    expect(loaded?.active_quiz_id).to.eq(fresh.id)
    expect(await db.select().from(questions).where(eq(questions.quiz_id, quiz.id))).to.deep.eq([])
  })

  it('refuses, and saves nothing, when the change names another workspace\'s quiz', async () => {
    const db = await openDb(':memory:')
    const [mine, theirs] = [await aWorkspace(db), await aWorkspace(db)]
    const hijacked = { ...theirs.quiz, title: 'Mine now' }
    await expect(saveChange(db, mine.workspace_id, { active_quiz_id: hijacked.id, quizzes: [hijacked], deleted_quiz_ids: [], expressions: null }))
      .rejects.toThrow('another workspace')
    const untouched = await loadWorkspace(db, theirs.workspace_id)
    expect(untouched?.quizzes[0]?.title).to.eq(theirs.quiz.title)
  })

  it('refuses a question another workspace holds, even inside a quiz of our own', async () => {
    const db = await openDb(':memory:')
    const [mine, theirs] = [await aWorkspace(db), await aWorkspace(db)]
    const smuggled = { ...mine.quiz, questions: [...mine.quiz.questions, theirs.quiz.questions[0]!] }
    await expect(mine.save(smuggled)).rejects.toThrow('another workspace')
  })
})

describe('a failed ask, saved', () => {
  const err = { message: 'Too many requests right now — try again shortly.', response: { ok: false, failurekind: 'rateLimited', detail: { status: 429 } }, at: 9 }

  it('rides along on the result it failed to refresh, and is still there after a reload', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    const question = { ...quiz.questions[0]!, clueing: 'Who?' }
    await save({ ...quiz, questions: [{ ...question, guess: guessAt(5, 'Leon') }] })
    await save({ ...quiz, questions: [{ ...question, guess: { ...guessAt(5, 'Leon'), last_err: err } }] })
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.quizzes[0]?.questions[0]?.guess).to.deep.include({ text: 'Leon', updated_at: 5, last_err: err })
    expect(await db.select().from(playings)).to.have.length(2)
  })

  it('is gone after a later success, though the failure stays in the history', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    const question = { ...quiz.questions[0]!, clueing: 'Who?' }
    await save({ ...quiz, questions: [{ ...question, guess: { ...guessAt(5, 'Leon'), last_err: err } }] })
    await save({ ...quiz, questions: [{ ...question, guess: guessAt(12, 'Lyon') }] })
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.quizzes[0]?.questions[0]?.guess).to.deep.include({ text: 'Lyon', last_err: null })
    expect(await db.select().from(playings)).to.have.length(3)
  })

  it('is the whole cell when the cell never had a result, and still carries its response', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    const question = { ...quiz.questions[0]!, clueing: 'Who?' }
    await save({ ...quiz, questions: [{ ...question, guess: { status: 'error', message: err.message, updated_at: 9, last_err: err } }] })
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.quizzes[0]?.questions[0]?.guess).to.deep.eq({ status: 'error', message: err.message, updated_at: 9, last_err: err })
  })
})

describe('saveChange, for playings', () => {
  it('records a new reply once, however many times the quiz is saved', async () => {
    const db = await openDb(':memory:')
    const { quiz, save } = await aWorkspace(db)
    const replied = { ...quiz, questions: [{ ...quiz.questions[0]!, clueing: 'Who?', guess: guessAt(5) }] }
    await save(replied)
    await save(replied)
    expect(await db.select().from(playings)).to.have.length(1)
  })

  it('keeps every reply, and shows the newest', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    const question = { ...quiz.questions[0]!, clueing: 'Who?' }
    await save({ ...quiz, questions: [{ ...question, guess: guessAt(5, 'Leon') }] })
    await save({ ...quiz, questions: [{ ...question, guess: guessAt(9, 'Lyon') }] })
    const loaded = await loadWorkspace(db, workspace_id)
    expect(loaded?.quizzes[0]?.questions[0]?.guess).to.include({ text: 'Lyon' })
    expect(await db.select().from(playings)).to.have.length(2)
  })

  it('records ishes against numnum, per text, and shows them stale once the text moves on', async () => {
    const db = await openDb(':memory:')
    const { workspace_id, quiz, save } = await aWorkspace(db)
    const ishes = { status: 'done' as const, items: [{ text: 'two', value: 2, kind: 'wordish' as const }], updated_at: 5 }
    const question = Question.fill({ ...quiz.questions[0]!, clueing: 'Two', hint: 'Three', clueing_ishes: ishes, hint_ishes: ishes })
    await save({ ...quiz, questions: [question] })
    await save({ ...quiz, questions: [{ ...question, clueing: 'Two, again' }] })
    const workspace = await loadWorkspace(db, workspace_id)
    const loaded = workspace?.quizzes[0]?.questions[0]
    expect(loaded?.clueing_ishes).to.include({ stale: true })
    expect(loaded?.hint_ishes).to.include({ stale: false })
    const recorded = await db.select().from(playings)
    expect(recorded.map((playing) => [playing.player_label, playing.textkind])).to.have.deep.members([['numnum', 'clueing'], ['numnum', 'hint']])
  })
})
