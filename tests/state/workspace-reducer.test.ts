import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { openQuizOf, workspaceReducer } from '../../src/state/workspace-reducer'
import { SeedExpressions } from '../../src/models/expression'
import { Workspace, type WorkspaceT } from '../../src/models/workspace'
import { BlankQuestionQty, Quiz } from '../../src/models/quiz'
import { defaultLayoutFor } from '../../src/models/layout'
import { Question } from '../../src/models/question'
import { present } from '../support/present'

/** A workspace holding one quiz built from `qnum, title` pairs, open */
function workspaceOf(...pairs: [string, string][]): WorkspaceT {
  const questions = pairs.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
  const quiz = { ...Quiz.blank('Quiz one'), ...defaultLayoutFor(SeedExpressions), questions }
  return Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id, expressions: [...SeedExpressions] })
}

const answersOf = (workspace: WorkspaceT) => present(openQuizOf(workspace)).questions.map((question) => question.title)
const qnumsOf   = (workspace: WorkspaceT) => present(openQuizOf(workspace)).questions.map((question) => question.qnum)

/** A workspace holding one quiz of blank questions, open */
function openWorkspace(locked = false): WorkspaceT {
  const quiz = { ...Quiz.blank('Quiz one'), locked }
  return Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
}

const firstOf = (workspace: WorkspaceT) => present(present(openQuizOf(workspace)).questions[0])

describe('workspaceReducer', () => {
  describe('retitle_quiz', () => {
    it('renames the open quiz', () => {
      const after = workspaceReducer(openWorkspace(), { kind: 'retitle_quiz', title: 'Quiz two' })
      expect(openQuizOf(after)?.title).to.eq('Quiz two')
    })

    it('accepts an empty title without rewriting it', () => {
      const after = workspaceReducer(openWorkspace(), { kind: 'retitle_quiz', title: '' })
      expect(openQuizOf(after)?.title).to.eq('')
    })

    it('refuses while the quiz is locked', () => {
      const ante = openWorkspace(true)
      expect(workspaceReducer(ante, { kind: 'retitle_quiz', title: 'Quiz two' })).to.eq(ante)
    })
  })

  describe('relabel_quiz', () => {
    it('overrides the generated label of the open quiz', () => {
      const after = workspaceReducer(openWorkspace(), { kind: 'relabel_quiz', label: 'leon' })
      expect(openQuizOf(after)?.forced_label).to.eq('leon')
    })

    it('leaves the generated label itself alone', () => {
      const before = openQuizOf(openWorkspace())?.label
      const after = workspaceReducer(openWorkspace(), { kind: 'relabel_quiz', label: 'leon' })
      expect(openQuizOf(after)?.label).to.not.eq('leon')
      expect(before).to.not.eq(undefined)
    })

    it('refuses while the quiz is locked', () => {
      const ante = openWorkspace(true)
      expect(workspaceReducer(ante, { kind: 'relabel_quiz', label: 'leon' })).to.eq(ante)
    })
  })

  describe('add_question', () => {
    it('appends a blank question to the end', () => {
      const after = workspaceReducer(openWorkspace(), { kind: 'add_question' })
      expect(openQuizOf(after)?.questions).to.have.length(BlankQuestionQty + 1)
      expect(openQuizOf(after)?.questions.at(-1)?.clueing).to.eq('')
    })

    it('refuses while the quiz is locked', () => {
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

    it('leaves the quiz alone when the question is not in it', () => {
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
        kind: 'edit_question', question_id: target.id, patch: { title: 'x'.repeat(201) },
      })).to.throw(Z.ZodError)
    })

    it('refuses while the quiz is locked', () => {
      const ante = openWorkspace(true)
      const target = present(present(openQuizOf(ante)).questions[0])
      expect(workspaceReducer(ante, { kind: 'edit_question', question_id: target.id, patch: { clueing: 'x' } })).to.eq(ante)
    })
  })

  describe('sort_questions', () => {
    it('commits the new order into the quiz rather than draping it over the top', () => {
      const ante = workspaceOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana'])
      const after = workspaceReducer(ante, { kind: 'sort_questions', sortkey: 'column:title', descending: false })
      expect(answersOf(after)).to.deep.eq(['apple', 'banana', 'cherry'])
    })

    it('remembers which column put the quiz in this order', () => {
      const after = workspaceReducer(workspaceOf(['1', 'a']), { kind: 'sort_questions', sortkey: 'column:qnum', descending: false })
      expect(present(openQuizOf(after)).last_sortkey).to.eq('column:qnum')
    })

    it('reverses when asked', () => {
      const ante = workspaceOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana'])
      const after = workspaceReducer(ante, { kind: 'sort_questions', sortkey: 'column:title', descending: true })
      expect(answersOf(after)).to.deep.eq(['cherry', 'banana', 'apple'])
    })

    it('refuses while the quiz is locked', () => {
      const ante = workspaceOf(['3', 'cherry'], ['1', 'apple'])
      const locked = { ...ante, quizzes: ante.quizzes.map((quiz) => ({ ...quiz, locked: true })) }
      expect(workspaceReducer(locked, { kind: 'sort_questions', sortkey: 'column:title', descending: false })).to.eq(locked)
    })
  })

  describe('renumber_qnums', () => {
    it('tidies the numbers with no question moving', () => {
      const ante = workspaceOf(['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a'])
      const after = workspaceReducer(ante, { kind: 'renumber_qnums' })
      expect(qnumsOf(after)).to.deep.eq(['3', '2', '4', '1'])
      expect(answersOf(after)).to.deep.eq(['d', 'c', 'f', 'a'])
    })

    it('does not claim the quiz is now in Q# order, which would immediately re-sort it', () => {
      const ante = workspaceReducer(workspaceOf(['4', 'd'], ['1', 'a']), {
        kind: 'sort_questions', sortkey: 'column:title', descending: false,
      })
      const after = workspaceReducer(ante, { kind: 'renumber_qnums' })
      expect(present(openQuizOf(after)).last_sortkey).to.eq('column:title')
    })

    it('refuses while the quiz is locked', () => {
      const ante = workspaceOf(['4', 'd'])
      const locked = { ...ante, quizzes: ante.quizzes.map((quiz) => ({ ...quiz, locked: true })) }
      expect(workspaceReducer(locked, { kind: 'renumber_qnums' })).to.eq(locked)
    })
  })

  describe('move_question', () => {
    it('moves the question and renumbers everything by its new position', () => {
      const ante = workspaceOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
      const dragged = present(present(openQuizOf(ante)).questions[2])
      const after = workspaceReducer(ante, { kind: 'move_question', question_id: dragged.id, onto_idx: 0 })
      expect(answersOf(after)).to.deep.eq(['c', 'a', 'b'])
      expect(qnumsOf(after)).to.deep.eq(['1', '2', '3'])
    })

    it('adopts a question that had no Q# into the sequence', () => {
      const ante = workspaceOf(['1', 'a'], ['', 'b'])
      const dragged = present(present(openQuizOf(ante)).questions[1])
      const after = workspaceReducer(ante, { kind: 'move_question', question_id: dragged.id, onto_idx: 0 })
      expect(qnumsOf(after)).to.deep.eq(['1', '2'])
    })

    it('leaves the quiz in Q# order, which is the only order a drag is offered in', () => {
      const ante = workspaceOf(['1', 'a'], ['2', 'b'])
      const dragged = present(present(openQuizOf(ante)).questions[0])
      const after = workspaceReducer(ante, { kind: 'move_question', question_id: dragged.id, onto_idx: 1 })
      expect(present(openQuizOf(after)).last_sortkey).to.eq('column:qnum')
    })
  })

  describe('set_ishes', () => {
    it('stores an extraction against the text it came from', () => {
      const ante = workspaceOf(['1', 'a'])
      const target = present(present(openQuizOf(ante)).questions[0])
      const after = workspaceReducer(ante, {
        kind: 'set_ishes', question_id: target.id, textkind: 'hint',
        ishes: { status: 'done', items: [{ text: '1994', value: 1994, kind: 'numeral' }], truncated: false, stale: false, updated_at: 1, last_err: null },
      })
      const question = present(present(openQuizOf(after)).questions[0])
      expect(question.hint_ishes?.status).to.eq('done')
      expect(question.clueing_ishes).to.eq(null)
    })

    it('refuses while the quiz is locked', () => {
      const ante = workspaceOf(['1', 'a'])
      const locked = { ...ante, quizzes: ante.quizzes.map((quiz) => ({ ...quiz, locked: true })) }
      const target = present(present(openQuizOf(locked)).questions[0])
      expect(workspaceReducer(locked, { kind: 'set_ishes', question_id: target.id, textkind: 'clueing', ishes: null })).to.eq(locked)
    })
  })

  describe('a failed ask', () => {
    const err = { message: 'A connection hiccup — try again.', response: { ok: false, failurekind: 'connection' }, at: 9 }
    const held = { status: 'done' as const, text: 'Leon', truncated: false, updated_at: 3, last_err: null }
    const items = [{ text: '300', value: 300, kind: 'numeral' as const }]
    const ishesHeld = { status: 'done' as const, items, truncated: false, stale: true, updated_at: 3, last_err: null }

    const withHeld = () => {
      const ante = workspaceOf(['1', 'a'])
      const { id } = firstOf(ante)
      const value = workspaceReducer(workspaceReducer(ante, { kind: 'set_guess', question_id: id, guess: held }),
        { kind: 'set_ishes', question_id: id, textkind: 'clueing', ishes: ishesHeld })
      return { id, value }
    }

    it('leaves a guess as it was and rides along on it as its last_err', () => {
      const { id, value } = withHeld()
      const after = workspaceReducer(value, { kind: 'fail_guess', question_id: id, err })
      expect(firstOf(after).guess).to.deep.eq({ ...held, last_err: err })
    })

    it('leaves an extraction\'s items and stale flag exactly as they were', () => {
      const { id, value } = withHeld()
      const after = workspaceReducer(value, { kind: 'fail_ishes', question_id: id, textkind: 'clueing', err })
      expect(firstOf(after).clueing_ishes).to.deep.eq({ ...ishesHeld, last_err: err })
    })

    it('becomes the cell\'s only content when it never had a value', () => {
      const ante = workspaceOf(['1', 'a'])
      const after = workspaceReducer(ante, { kind: 'fail_guess', question_id: firstOf(ante).id, err })
      expect(firstOf(after).guess).to.deep.eq({ status: 'error', message: err.message, updated_at: 9, last_err: err })
    })

    it('is replaced by a newer failure, not stacked', () => {
      const { id, value } = withHeld()
      const twice = workspaceReducer(workspaceReducer(value, { kind: 'fail_guess', question_id: id, err }),
        { kind: 'fail_guess', question_id: id, err: { ...err, at: 12 } })
      expect(firstOf(twice).guess).to.deep.include({ text: 'Leon', last_err: { ...err, at: 12 } })
    })

    it('is cleared by any success', () => {
      const { id, value } = withHeld()
      const failed = workspaceReducer(value, { kind: 'fail_guess', question_id: id, err })
      const after = workspaceReducer(failed, { kind: 'set_guess', question_id: id, guess: { ...held, text: 'Lyon' } })
      expect(firstOf(after).guess).to.deep.include({ text: 'Lyon', last_err: null })
    })

    it('survives the text being edited, which only marks the extraction stale', () => {
      const { id, value } = withHeld()
      const failed = workspaceReducer(value, { kind: 'fail_ishes', question_id: id, textkind: 'clueing', err })
      const after = workspaceReducer(failed, { kind: 'edit_question', question_id: id, patch: { clueing: 'Reworded' } })
      expect(firstOf(after).clueing_ishes).to.deep.include({ stale: true, last_err: err })
    })

    it('is refused while the quiz is locked', () => {
      const ante = workspaceOf(['1', 'a'])
      const locked = { ...ante, quizzes: ante.quizzes.map((quiz) => ({ ...quiz, locked: true })) }
      expect(workspaceReducer(locked, { kind: 'fail_guess', question_id: firstOf(locked).id, err })).to.eq(locked)
    })

    it('is what a combined run leaves on a text it left out, beside the value that cell had', () => {
      const { id, value } = withHeld()
      const after = workspaceReducer(value, {
        kind: 'apply_bulk_ishes', run: { approx_tokens: 1, text_count: 1, updated_at: 9 },
        landings: [{ question_id: id, textkind: 'clueing', ishes: null, err }],
      })
      expect(firstOf(after).clueing_ishes).to.deep.eq({ ...ishesHeld, last_err: err })
    })
  })

  describe('staleness', () => {
    const extracted = { status: 'done' as const, items: [], truncated: false, stale: false, updated_at: 1, last_err: null }

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
    it('switches to a quiz the workspace holds', () => {
      const [one, two] = [Quiz.blank('one'), Quiz.blank('two')]
      const ante = Workspace.fill({ quizzes: [one, two], active_quiz_id: one.id })
      expect(workspaceReducer(ante, { kind: 'open_quiz', quiz_id: two.id }).active_quiz_id).to.eq(two.id)
    })

    it('ignores a quiz the workspace does not hold', () => {
      const ante = workspaceOf(['1', 'a'])
      expect(workspaceReducer(ante, { kind: 'open_quiz', quiz_id: 'gone' })).to.eq(ante)
    })

    it('switches away from a locked quiz, because locking must never be a trap', () => {
      const [one, two] = [{ ...Quiz.blank('one'), locked: true }, Quiz.blank('two')]
      const ante = Workspace.fill({ quizzes: [one, two], active_quiz_id: one.id })
      expect(workspaceReducer(ante, { kind: 'open_quiz', quiz_id: two.id }).active_quiz_id).to.eq(two.id)
    })
  })

  describe('new_quiz', () => {
    it('adds a quiz and opens it', () => {
      const ante = workspaceOf(['1', 'a'])
      const after = workspaceReducer(ante, { kind: 'new_quiz' })
      expect(after.quizzes).to.have.length(2)
      expect(after.active_quiz_id).to.eq(after.quizzes[1]?.id)
    })

    it('starts the new quiz with the same blank questions a fresh workspace has', () => {
      const after = workspaceReducer(workspaceOf(['1', 'a']), { kind: 'new_quiz' })
      expect(present(openQuizOf(after)).questions).to.have.length(BlankQuestionQty)
    })

    it('works from a locked quiz', () => {
      const locked = { ...Quiz.blank('one'), locked: true }
      const ante = Workspace.fill({ quizzes: [locked], active_quiz_id: locked.id })
      expect(workspaceReducer(ante, { kind: 'new_quiz' }).quizzes).to.have.length(2)
    })

    it('starts the new quiz with the standard columns, for the expressions the workspace still has', () => {
      const ante = Workspace.blank()
      const whole = workspaceReducer(ante, { kind: 'new_quiz' })
      expect(present(openQuizOf(whole)).widgets).to.have.length(11)
      expect(present(openQuizOf(whole)).columns).to.have.length(21)
      const trimmed = { ...ante, expressions: ante.expressions.filter((expression) => expression.label !== 'hint_full') }
      const fewer = workspaceReducer(trimmed, { kind: 'new_quiz' })
      expect(present(openQuizOf(fewer)).widgets).to.have.length(10)
      expect(present(openQuizOf(fewer)).columns).to.have.length(20)
    })

    it('keeps the workspace\'s expressions', () => {
      const ante = openWorkspace()
      expect(workspaceReducer(ante, { kind: 'new_quiz' }).expressions).to.eq(ante.expressions)
    })

    it('starts the new quiz under the label it is given', () => {
      const after = workspaceReducer(workspaceOf(['1', 'a']), { kind: 'new_quiz', label: 'princes' })
      expect(present(openQuizOf(after)).label).to.eq('princes')
    })
  })

  describe('delete_quiz', () => {
    it('removes the quiz and opens its neighbour', () => {
      const [one, two, three] = [Quiz.blank('one'), Quiz.blank('two'), Quiz.blank('three')]
      const ante = Workspace.fill({ quizzes: [one, two, three], active_quiz_id: two.id })
      const after = workspaceReducer(ante, { kind: 'delete_quiz', quiz_id: two.id })
      expect(after.quizzes.map((quiz) => quiz.title)).to.deep.eq(['one', 'three'])
      expect(after.active_quiz_id).to.eq(three.id)
    })

    it('opens the quiz before it when the last one goes', () => {
      const [one, two] = [Quiz.blank('one'), Quiz.blank('two')]
      const ante = Workspace.fill({ quizzes: [one, two], active_quiz_id: two.id })
      expect(workspaceReducer(ante, { kind: 'delete_quiz', quiz_id: two.id }).active_quiz_id).to.eq(one.id)
    })

    it('refuses to delete the last remaining quiz', () => {
      const ante = workspaceOf(['1', 'a'])
      expect(workspaceReducer(ante, { kind: 'delete_quiz', quiz_id: ante.quizzes[0]?.id ?? '' })).to.eq(ante)
    })

    it('leaves the open quiz alone when some other quiz goes', () => {
      const [one, two] = [Quiz.blank('one'), Quiz.blank('two')]
      const ante = Workspace.fill({ quizzes: [one, two], active_quiz_id: one.id })
      expect(workspaceReducer(ante, { kind: 'delete_quiz', quiz_id: two.id }).active_quiz_id).to.eq(one.id)
    })

  })

  describe('set_lock', () => {
    it('freezes a quiz', () => {
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

    it('leaves the quiz exactly as it was', () => {
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
  it('finds the quiz on screen', () => {
    expect(openQuizOf(openWorkspace())?.title).to.eq('Quiz one')
  })

  it('reads null when the workspace names a quiz it does not hold', () => {
    const workspace = { ...openWorkspace(), active_quiz_id: 'gone' }
    expect(openQuizOf(workspace)).to.eq(null)
  })
})
