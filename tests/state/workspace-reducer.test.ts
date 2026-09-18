import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { openQuizOf, workspaceReducer } from '../../src/state/workspace-reducer'
import { Workspace, type WorkspaceT } from '../../src/models/workspace'
import { BlankQuestionQty, Quiz } from '../../src/models/quiz'
import { Question } from '../../src/models/question'
import { present } from '../support/present'

/** A workspace holding one round built from `qnum, short_answer` pairs, open */
function workspaceOf(...pairs: [string, string][]): WorkspaceT {
  const questions = pairs.map(([qnum, short_answer]) => ({ ...Question.blank(), qnum, short_answer }))
  const quiz = { ...Quiz.blank('Round one'), questions }
  return Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
}

const answersOf = (workspace: WorkspaceT) => present(openQuizOf(workspace)).questions.map((question) => question.short_answer)
const qnumsOf   = (workspace: WorkspaceT) => present(openQuizOf(workspace)).questions.map((question) => question.qnum)

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

  describe('sort_questions', () => {
    it('commits the new order into the round rather than draping it over the top', () => {
      const ante = workspaceOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana'])
      const after = workspaceReducer(ante, { kind: 'sort_questions', sortkey: 'short_answer', descending: false })
      expect(answersOf(after)).to.deep.eq(['apple', 'banana', 'cherry'])
    })

    it('remembers which column put the round in this order', () => {
      const after = workspaceReducer(workspaceOf(['1', 'a']), { kind: 'sort_questions', sortkey: 'qnum', descending: false })
      expect(present(openQuizOf(after)).last_sortkey).to.eq('qnum')
    })

    it('reverses when asked', () => {
      const ante = workspaceOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana'])
      const after = workspaceReducer(ante, { kind: 'sort_questions', sortkey: 'short_answer', descending: true })
      expect(answersOf(after)).to.deep.eq(['cherry', 'banana', 'apple'])
    })

    it('refuses while the round is locked', () => {
      const ante = workspaceOf(['3', 'cherry'], ['1', 'apple'])
      const locked = { ...ante, quizzes: ante.quizzes.map((quiz) => ({ ...quiz, locked: true })) }
      expect(workspaceReducer(locked, { kind: 'sort_questions', sortkey: 'short_answer', descending: false })).to.eq(locked)
    })
  })

  describe('renumber_qnums', () => {
    it('tidies the numbers with no question moving', () => {
      const ante = workspaceOf(['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a'])
      const after = workspaceReducer(ante, { kind: 'renumber_qnums' })
      expect(qnumsOf(after)).to.deep.eq(['3', '2', '4', '1'])
      expect(answersOf(after)).to.deep.eq(['d', 'c', 'f', 'a'])
    })

    it('does not claim the round is now in Q# order, which would immediately re-sort it', () => {
      const ante = workspaceReducer(workspaceOf(['4', 'd'], ['1', 'a']), {
        kind: 'sort_questions', sortkey: 'short_answer', descending: false,
      })
      const after = workspaceReducer(ante, { kind: 'renumber_qnums' })
      expect(present(openQuizOf(after)).last_sortkey).to.eq('short_answer')
    })

    it('refuses while the round is locked', () => {
      const ante = workspaceOf(['4', 'd'])
      const locked = { ...ante, quizzes: ante.quizzes.map((quiz) => ({ ...quiz, locked: true })) }
      expect(workspaceReducer(locked, { kind: 'renumber_qnums' })).to.eq(locked)
    })
  })

  describe('drag_question', () => {
    it('moves the question and renumbers everything by its new position', () => {
      const ante = workspaceOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
      const dragged = present(present(openQuizOf(ante)).questions[2])
      const after = workspaceReducer(ante, { kind: 'drag_question', question_id: dragged.id, onto_idx: 0 })
      expect(answersOf(after)).to.deep.eq(['c', 'a', 'b'])
      expect(qnumsOf(after)).to.deep.eq(['1', '2', '3'])
    })

    it('adopts a question that had no Q# into the sequence', () => {
      const ante = workspaceOf(['1', 'a'], ['', 'b'])
      const dragged = present(present(openQuizOf(ante)).questions[1])
      const after = workspaceReducer(ante, { kind: 'drag_question', question_id: dragged.id, onto_idx: 0 })
      expect(qnumsOf(after)).to.deep.eq(['1', '2'])
    })

    it('leaves the round in Q# order, which is the only order a drag is offered in', () => {
      const ante = workspaceOf(['1', 'a'], ['2', 'b'])
      const dragged = present(present(openQuizOf(ante)).questions[0])
      const after = workspaceReducer(ante, { kind: 'drag_question', question_id: dragged.id, onto_idx: 1 })
      expect(present(openQuizOf(after)).last_sortkey).to.eq('qnum')
    })
  })

  describe('set_ishes', () => {
    it('stores an extraction against the text it came from', () => {
      const ante = workspaceOf(['1', 'a'])
      const target = present(present(openQuizOf(ante)).questions[0])
      const after = workspaceReducer(ante, {
        kind: 'set_ishes', question_id: target.id, textkind: 'hint',
        ishes: { status: 'done', items: [{ text: '1994', value: 1994, kind: 'numeral' }], truncated: false, stale: false, updated_at: 1 },
      })
      const question = present(present(openQuizOf(after)).questions[0])
      expect(question.hint_ishes?.status).to.eq('done')
      expect(question.clueing_ishes).to.eq(null)
    })

    it('refuses while the round is locked', () => {
      const ante = workspaceOf(['1', 'a'])
      const locked = { ...ante, quizzes: ante.quizzes.map((quiz) => ({ ...quiz, locked: true })) }
      const target = present(present(openQuizOf(locked)).questions[0])
      expect(workspaceReducer(locked, { kind: 'set_ishes', question_id: target.id, textkind: 'clueing', ishes: null })).to.eq(locked)
    })
  })

  describe('staleness', () => {
    const extracted = { status: 'done' as const, items: [], truncated: false, stale: false, updated_at: 1 }

    it('marks the clueing extraction stale when the clueing is edited', () => {
      const ante = workspaceOf(['1', 'a'])
      const target = present(present(openQuizOf(ante)).questions[0])
      const withIshes = workspaceReducer(ante, { kind: 'set_ishes', question_id: target.id, textkind: 'clueing', ishes: extracted })
      const after = workspaceReducer(withIshes, { kind: 'edit_question', question_id: target.id, patch: { clueing: 'Reworded' } })
      const question = present(present(openQuizOf(after)).questions[0])
      expect(question.clueing_ishes?.status === 'done' && question.clueing_ishes.stale).to.eq(true)
    })

    it('leaves the extraction visible rather than throwing it away', () => {
      const ante = workspaceOf(['1', 'a'])
      const target = present(present(openQuizOf(ante)).questions[0])
      const withIshes = workspaceReducer(ante, {
        kind: 'set_ishes', question_id: target.id, textkind: 'clueing',
        ishes: { ...extracted, items: [{ text: '300', value: 300, kind: 'numeral' }] },
      })
      const after = workspaceReducer(withIshes, { kind: 'edit_question', question_id: target.id, patch: { clueing: 'Reworded' } })
      const question = present(present(openQuizOf(after)).questions[0])
      expect(question.clueing_ishes?.status === 'done' && question.clueing_ishes.items).to.have.length(1)
    })

    it('marks only the hint extraction when only the hint is edited', () => {
      const ante = workspaceOf(['1', 'a'])
      const target = present(present(openQuizOf(ante)).questions[0])
      const both = workspaceReducer(
        workspaceReducer(ante, { kind: 'set_ishes', question_id: target.id, textkind: 'clueing', ishes: extracted }),
        { kind: 'set_ishes', question_id: target.id, textkind: 'hint', ishes: extracted },
      )
      const after = workspaceReducer(both, { kind: 'edit_question', question_id: target.id, patch: { hint: 'Rewritten' } })
      const question = present(present(openQuizOf(after)).questions[0])
      expect(question.hint_ishes?.status === 'done' && question.hint_ishes.stale).to.eq(true)
      expect(question.clueing_ishes?.status === 'done' && question.clueing_ishes.stale).to.eq(false)
    })

    it('leaves an extraction alone when the edit did not change the text', () => {
      const ante = workspaceOf(['1', 'a'])
      const target = present(present(openQuizOf(ante)).questions[0])
      const withIshes = workspaceReducer(ante, { kind: 'set_ishes', question_id: target.id, textkind: 'clueing', ishes: extracted })
      const after = workspaceReducer(withIshes, { kind: 'edit_question', question_id: target.id, patch: { clueing: '' } })
      const question = present(present(openQuizOf(after)).questions[0])
      expect(question.clueing_ishes?.status === 'done' && question.clueing_ishes.stale).to.eq(false)
    })

    it('leaves an extraction alone when some other field is edited', () => {
      const ante = workspaceOf(['1', 'a'])
      const target = present(present(openQuizOf(ante)).questions[0])
      const withIshes = workspaceReducer(ante, { kind: 'set_ishes', question_id: target.id, textkind: 'clueing', ishes: extracted })
      const after = workspaceReducer(withIshes, { kind: 'edit_question', question_id: target.id, patch: { notes: 'later' } })
      const question = present(present(openQuizOf(after)).questions[0])
      expect(question.clueing_ishes?.status === 'done' && question.clueing_ishes.stale).to.eq(false)
    })
  })

  describe('open_quiz', () => {
    it('switches to a round the workspace holds', () => {
      const [one, two] = [Quiz.blank('one'), Quiz.blank('two')]
      const ante = Workspace.fill({ quizzes: [one, two], active_quiz_id: one.id })
      expect(workspaceReducer(ante, { kind: 'open_quiz', quiz_id: two.id }).active_quiz_id).to.eq(two.id)
    })

    it('ignores a round the workspace does not hold', () => {
      const ante = workspaceOf(['1', 'a'])
      expect(workspaceReducer(ante, { kind: 'open_quiz', quiz_id: 'gone' })).to.eq(ante)
    })

    it('switches away from a locked round, because locking must never be a trap', () => {
      const [one, two] = [{ ...Quiz.blank('one'), locked: true }, Quiz.blank('two')]
      const ante = Workspace.fill({ quizzes: [one, two], active_quiz_id: one.id })
      expect(workspaceReducer(ante, { kind: 'open_quiz', quiz_id: two.id }).active_quiz_id).to.eq(two.id)
    })
  })

  describe('new_quiz', () => {
    it('adds a round and opens it', () => {
      const ante = workspaceOf(['1', 'a'])
      const after = workspaceReducer(ante, { kind: 'new_quiz' })
      expect(after.quizzes).to.have.length(2)
      expect(after.active_quiz_id).to.eq(after.quizzes[1]?.id)
    })

    it('starts the new round with the same blank questions a fresh workspace has', () => {
      const after = workspaceReducer(workspaceOf(['1', 'a']), { kind: 'new_quiz' })
      expect(present(openQuizOf(after)).questions).to.have.length(BlankQuestionQty)
    })

    it('works from a locked round', () => {
      const locked = { ...Quiz.blank('one'), locked: true }
      const ante = Workspace.fill({ quizzes: [locked], active_quiz_id: locked.id })
      expect(workspaceReducer(ante, { kind: 'new_quiz' }).quizzes).to.have.length(2)
    })
  })

  describe('delete_quiz', () => {
    it('removes the round and opens its neighbour', () => {
      const [one, two, three] = [Quiz.blank('one'), Quiz.blank('two'), Quiz.blank('three')]
      const ante = Workspace.fill({ quizzes: [one, two, three], active_quiz_id: two.id })
      const after = workspaceReducer(ante, { kind: 'delete_quiz', quiz_id: two.id })
      expect(after.quizzes.map((quiz) => quiz.title)).to.deep.eq(['one', 'three'])
      expect(after.active_quiz_id).to.eq(three.id)
    })

    it('opens the round before it when the last one goes', () => {
      const [one, two] = [Quiz.blank('one'), Quiz.blank('two')]
      const ante = Workspace.fill({ quizzes: [one, two], active_quiz_id: two.id })
      expect(workspaceReducer(ante, { kind: 'delete_quiz', quiz_id: two.id }).active_quiz_id).to.eq(one.id)
    })

    it('refuses to delete the last remaining round', () => {
      const ante = workspaceOf(['1', 'a'])
      expect(workspaceReducer(ante, { kind: 'delete_quiz', quiz_id: ante.quizzes[0]?.id ?? '' })).to.eq(ante)
    })

    it('leaves the open round alone when some other round goes', () => {
      const [one, two] = [Quiz.blank('one'), Quiz.blank('two')]
      const ante = Workspace.fill({ quizzes: [one, two], active_quiz_id: one.id })
      expect(workspaceReducer(ante, { kind: 'delete_quiz', quiz_id: two.id }).active_quiz_id).to.eq(one.id)
    })

  })

  describe('set_lock', () => {
    it('freezes a round', () => {
      const ante = workspaceOf(['1', 'a'])
      const quiz_id = present(openQuizOf(ante)).id
      const after = workspaceReducer(ante, { kind: 'set_lock', quiz_id, locked: true })
      expect(present(openQuizOf(after)).locked).to.eq(true)
    })

    it('unfreezes one, from inside the lock', () => {
      const ante = workspaceOf(['1', 'a'])
      const quiz_id = present(openQuizOf(ante)).id
      const locked = workspaceReducer(ante, { kind: 'set_lock', quiz_id, locked: true })
      const after = workspaceReducer(locked, { kind: 'set_lock', quiz_id, locked: false })
      expect(present(openQuizOf(after)).locked).to.eq(false)
    })

    it('leaves the round exactly as it was', () => {
      const ante = workspaceOf(['1', 'a'], ['2', 'b'])
      const quiz_id = present(openQuizOf(ante)).id
      const locked = workspaceReducer(ante, { kind: 'set_lock', quiz_id, locked: true })
      const unlocked = workspaceReducer(locked, { kind: 'set_lock', quiz_id, locked: false })
      expect(present(openQuizOf(unlocked)).questions).to.deep.eq(present(openQuizOf(ante)).questions)
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
