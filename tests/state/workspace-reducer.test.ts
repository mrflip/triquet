import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { openQuizOf, workspaceReducer } from '../../src/state/workspace-reducer'
import { Workspace, type WorkspaceT } from '../../src/models/workspace'
import { BlankQuestionQty, Quiz } from '../../src/models/quiz'
import { present } from '../support/present'

/** A workspace holding one round of blank questions, open */
function openWorkspace(locked = false): WorkspaceT {
  const quiz = { ...Quiz.blank('Round one'), locked }
  return Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
}

describe('workspaceReducer', () => {
  describe('retitle_quiz', () => {
    it('renames the open round', () => {
      const after = workspaceReducer(openWorkspace(), { kind: 'retitle_quiz', title: 'Round two' })
      expect(openQuizOf(after)?.title).to.eq('Round two')
    })

    it('accepts an empty title without rewriting it', () => {
      const after = workspaceReducer(openWorkspace(), { kind: 'retitle_quiz', title: '' })
      expect(openQuizOf(after)?.title).to.eq('')
    })

    it('refuses while the round is locked', () => {
      const ante = openWorkspace(true)
      expect(workspaceReducer(ante, { kind: 'retitle_quiz', title: 'Round two' })).to.eq(ante)
    })
  })

  describe('add_question', () => {
    it('appends a blank question to the end', () => {
      const after = workspaceReducer(openWorkspace(), { kind: 'add_question' })
      expect(openQuizOf(after)?.questions).to.have.length(BlankQuestionQty + 1)
      expect(openQuizOf(after)?.questions.at(-1)?.clueing).to.eq('')
    })

    it('refuses while the round is locked', () => {
      const ante = openWorkspace(true)
      expect(workspaceReducer(ante, { kind: 'add_question' })).to.eq(ante)
    })
  })

  describe('edit_question', () => {
    it('rewrites only the named question, and only the named fields', () => {
      const ante = openWorkspace()
      const target = present(present(openQuizOf(ante)).questions[1])
      const after = workspaceReducer(ante, {
        kind: 'edit_question', question_id: target.id, patch: { clueing: 'Which région?' },
      })
      expect(openQuizOf(after)?.questions[1]?.clueing).to.eq('Which région?')
      expect(openQuizOf(after)?.questions[1]?.hint).to.eq('')
      expect(openQuizOf(after)?.questions[0]?.clueing).to.eq('')
    })

    it('leaves the round alone when the question is not in it', () => {
      const ante = openWorkspace()
      const after = workspaceReducer(ante, { kind: 'edit_question', question_id: 'nobody', patch: { clueing: 'x' } })
      expect(after.quizzes[0]?.questions).to.deep.eq(ante.quizzes[0]?.questions)
    })

    it('ignores fields the patch does not mention', () => {
      const ante = openWorkspace()
      const target = present(present(openQuizOf(ante)).questions[0])
      const after = workspaceReducer(ante, { kind: 'edit_question', question_id: target.id, patch: {} })
      expect(openQuizOf(after)?.questions[0]).to.deep.eq(target)
    })

    it('refuses text the model rejects rather than storing it', () => {
      const ante = openWorkspace()
      const target = present(present(openQuizOf(ante)).questions[0])
      expect(() => workspaceReducer(ante, {
        kind: 'edit_question', question_id: target.id, patch: { short_answer: 'x'.repeat(201) },
      })).to.throw(Z.ZodError)
    })

    it('refuses while the round is locked', () => {
      const ante = openWorkspace(true)
      const target = present(present(openQuizOf(ante)).questions[0])
      expect(workspaceReducer(ante, { kind: 'edit_question', question_id: target.id, patch: { clueing: 'x' } })).to.eq(ante)
    })
  })

  describe('replace_workspace', () => {
    it('takes the other tab\'s workspace wholesale, lock and all', () => {
      const other = openWorkspace(true)
      expect(workspaceReducer(openWorkspace(), { kind: 'replace_workspace', workspace: other })).to.eq(other)
    })
  })
})

describe('openQuizOf', () => {
  it('finds the round on screen', () => {
    expect(openQuizOf(openWorkspace())?.title).to.eq('Round one')
  })

  it('reads null when the workspace names a round it does not hold', () => {
    const workspace = { ...openWorkspace(), active_quiz_id: 'gone' }
    expect(openQuizOf(workspace)).to.eq(null)
  })
})
