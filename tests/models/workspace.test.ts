import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Workspace } from '../../src/models/workspace'
import { Quiz } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'

describe('Workspace.fill', () => {
  it('holds the quizzes it is given, with one of them open', () => {
    const quiz = Quiz.blank('Quiz one')
    const workspace = Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
    expect(workspace.quizzes).to.have.length(1)
    expect(workspace.active_quiz_id).to.eq(quiz.id)
  })

  it('refuses an empty workspace, which would leave the author staring at nothing', () => {
    expect(() => Workspace.fill({ quizzes: [], active_quiz_id: mintId() })).to.throw(Z.ZodError)
  })

  it('refuses an open quiz that is not in the workspace', () => {
    expect(() => Workspace.fill({ quizzes: [Quiz.blank()], active_quiz_id: mintId() })).to.throw(Z.ZodError)
  })
})

describe('Workspace.blank', () => {
  it('opens with exactly one quiz, and opens it', () => {
    const workspace = Workspace.blank()
    expect(workspace.quizzes).to.have.length(1)
    expect(workspace.active_quiz_id).to.eq(workspace.quizzes[0]?.id)
  })
})

describe('Workspace.revive', () => {
  it('repairs an open-quiz id that names nothing, rather than throwing', () => {
    const quiz = Quiz.blank()
    expect(Workspace.revive({ quizzes: [quiz], active_quiz_id: mintId() }).active_quiz_id).to.eq(quiz.id)
  })

  it('leaves a workspace that already makes sense alone', () => {
    const [ante, post] = [Quiz.blank(), Quiz.blank()]
    expect(Workspace.revive({ quizzes: [ante, post], active_quiz_id: post.id }).active_quiz_id).to.eq(post.id)
  })

  it('still throws on damage it cannot repair', () => {
    expect(() => Workspace.revive({ quizzes: [], active_quiz_id: mintId() })).to.throw(Z.ZodError)
  })
})
