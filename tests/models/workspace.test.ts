import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Workspace, WorkspaceValidators } from '../../src/models/workspace'
import { Expression, SeedExpressions } from '../../src/models/expression'
import { defaultsFor } from '../../src/models/expressing'
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
  it('starts with the standard expressions, and the open quiz showing the standard columns', () => {
    const workspace = Workspace.blank()
    expect(workspace.expressions).to.deep.eq([...SeedExpressions])
    expect(workspace.quizzes[0]?.expressings.map((column) => column.label)).to.deep.eq(defaultsFor(SeedExpressions).map((column) => column.label))
  })

  it('opens with exactly one quiz, and opens it', () => {
    const workspace = Workspace.blank()
    expect(workspace.quizzes).to.have.length(1)
    expect(workspace.active_quiz_id).to.eq(workspace.quizzes[0]?.id)
  })
})

describe('Workspace.fill with expressions', () => {
  const quiz = Quiz.blank('Quiz one')
  const column = { label: 'lettered', expression_label: 'answer_letter_count', title: 'Letters' }
  const expression = Expression.fill({ label: 'answer_letter_count', formula: '$length(qn.full_answer)' })

  it('accepts a column naming an expression the workspace holds', () => {
    const workspace = Workspace.fill({ quizzes: [{ ...quiz, expressings: [column] }], active_quiz_id: quiz.id, expressions: [expression] })
    expect(workspace.quizzes[0]?.expressings).to.have.length(1)
  })

  it('refuses a column naming an expression the workspace does not hold, saying which column', () => {
    const outcome = WorkspaceValidators.workspace.safeParse({ quizzes: [{ ...quiz, expressings: [column] }], active_quiz_id: quiz.id, expressions: [] })
    expect(outcome.success).to.eq(false)
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['quizzes', 0, 'expressings', 0, 'expression_label'])
  })

  it('refuses two expressions sharing an owner and a label', () => {
    expect(() => Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id, expressions: [expression, { ...expression, formula: '1' }] })).to.throw(Z.ZodError)
  })

  it('defaults to holding no expressions', () => {
    expect(Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id }).expressions).to.deep.eq([])
  })
})

describe('Workspace.revive', () => {
  it('gives a workspace with no expressions -- one saved before there were any -- the standard ones and columns', () => {
    const [ante, post] = [Quiz.blank('Ante'), Quiz.blank('Post')]
    const revived = Workspace.revive({ quizzes: [ante, post], active_quiz_id: ante.id, expressions: [] })
    expect(revived.expressions).to.deep.eq([...SeedExpressions])
    expect(revived.quizzes.map((held) => held.expressings.length)).to.deep.eq([8, 8])
  })

  it('leaves the columns a quiz already has alone even then', () => {
    const column = { label: 'answer_reversed', expression_label: 'answer_reversed', title: 'Backward' }
    const quiz = { ...Quiz.blank('Mine'), expressings: [column] }
    const revived = Workspace.revive({ quizzes: [quiz], active_quiz_id: quiz.id, expressions: [] })
    expect(revived.quizzes[0]?.expressings.map((held) => held.label)).to.deep.eq(['answer_reversed'])
  })

  it('does not add anything to a workspace that has expressions, however few', () => {
    const quiz = Quiz.blank('Mine')
    const expression = Expression.fill({ label: 'answer_reversed', formula: '1' })
    const revived = Workspace.revive({ quizzes: [quiz], active_quiz_id: quiz.id, expressions: [expression] })
    expect(revived.expressions).to.deep.eq([expression])
    expect(revived.quizzes[0]?.expressings).to.deep.eq([])
  })

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
