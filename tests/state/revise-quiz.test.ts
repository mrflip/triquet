import { describe, expect, it } from 'vitest'
import { openQuizOf, reviseOpenQuiz } from '../../src/state/revise-quiz'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { Workspace, type WorkspaceT } from '../../src/models/workspace'

/** A workspace of two quizzes, the first of them open */
function twoQuizWorkspace(openPatch: Partial<QuizT> = {}): WorkspaceT {
  const open = { ...Quiz.blank('Open one'), ...openPatch }
  const other = Quiz.blank('Other one')
  return { ...Workspace.blank(), quizzes: [open, other], active_quiz_id: open.id }
}

const retitled = (quiz: QuizT): QuizT => ({ ...quiz, title: 'Retitled' })

describe('reviseOpenQuiz', () => {
  it('revises the open quiz and leaves its siblings the same objects', () => {
    const workspace = twoQuizWorkspace()
    const revised = reviseOpenQuiz(workspace, retitled)
    expect(revised.quizzes[0]?.title).to.eq('Retitled')
    expect(revised.quizzes[1]).to.eq(workspace.quizzes[1])
  })

  it('returns the same workspace when the open quiz is locked', () => {
    const workspace = twoQuizWorkspace({ locked: true })
    expect(reviseOpenQuiz(workspace, retitled)).to.eq(workspace)
  })

  it('returns the same workspace when the revision changes nothing', () => {
    const workspace = twoQuizWorkspace()
    expect(reviseOpenQuiz(workspace, (quiz) => quiz)).to.eq(workspace)
  })

  it('returns the same workspace when it names an open quiz it does not hold', () => {
    const workspace = { ...twoQuizWorkspace(), active_quiz_id: Quiz.blank().id }
    expect(reviseOpenQuiz(workspace, retitled)).to.eq(workspace)
  })
})

describe('openQuizOf', () => {
  it('finds the quiz the workspace calls open', () => {
    const workspace = twoQuizWorkspace()
    expect(openQuizOf(workspace)).to.eq(workspace.quizzes[0])
  })

  it('is null when the workspace names a quiz it does not hold', () => {
    const workspace = { ...twoQuizWorkspace(), active_quiz_id: Quiz.blank().id }
    expect(openQuizOf(workspace)).to.eq(null)
  })
})
