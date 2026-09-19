import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { WorkspaceChangeValidators, changeBetween } from '../../src/models/workspace-change'
import { Quiz } from '../../src/models/quiz'
import type { WorkspaceT } from '../../src/models/workspace'
import { mintId } from '../../src/lib/ids'

describe('changeBetween', () => {
  // Built by hand rather than filled, because a fill copies every quiz and this is about identity.
  const [kept, revised, dropped] = [Quiz.blank('Kept'), Quiz.blank('Revised'), Quiz.blank('Dropped')]
  const before: WorkspaceT = { quizzes: [kept, revised, dropped], active_quiz_id: kept.id, expressions: [] }

  it('is nothing at all between a workspace and itself', () => {
    expect(changeBetween(before, before)).to.deep.eq({ active_quiz_id: kept.id, quizzes: [], deleted_quiz_ids: [], expressions: null })
  })

  it('sends a revised quiz whole, and leaves an untouched one out', () => {
    const retitled = { ...revised, title: 'Revised again' }
    const after = { ...before, quizzes: [kept, retitled, dropped] }
    expect(changeBetween(before, after).quizzes).to.deep.eq([retitled])
  })

  it('sends a new quiz, and names a deleted one', () => {
    const fresh = Quiz.blank('Fresh')
    const after = { ...before, quizzes: [kept, revised, fresh], active_quiz_id: fresh.id }
    expect(changeBetween(before, after)).to.deep.eq({ active_quiz_id: fresh.id, quizzes: [fresh], deleted_quiz_ids: [dropped.id], expressions: null })
  })

  it('carries a switch of quiz on its own', () => {
    const after = { ...before, active_quiz_id: revised.id }
    expect(changeBetween(before, after)).to.deep.eq({ active_quiz_id: revised.id, quizzes: [], deleted_quiz_ids: [], expressions: null })
  })
})

describe('WorkspaceChangeValidators.workspaceChange', () => {
  it('defaults an absent list to an empty one', () => {
    const active_quiz_id = mintId()
    expect(WorkspaceChangeValidators.workspaceChange({ active_quiz_id })).to.deep.eq({ active_quiz_id, quizzes: [], deleted_quiz_ids: [], expressions: null })
  })

  it('fills each quiz it carries, just as the app does', () => {
    const change = WorkspaceChangeValidators.workspaceChange({ active_quiz_id: mintId(), quizzes: [{ id: mintId() }] })
    expect(change.quizzes[0]).to.include({ version: 'main', locked: false })
  })

  const Refused: [unknown, string][] = [
    [{},                                                        'a change that does not say which quiz is open'],
    [{ active_quiz_id: 'not-an-id' },                           'an open quiz that is not an id'],
    [{ active_quiz_id: mintId(), deleted_quiz_ids: ['nope'] },  'a deletion naming something that is not an id'],
    [{ active_quiz_id: mintId(), quizzes: [{ title: 'Idless' }] }, 'a quiz with no id'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => WorkspaceChangeValidators.workspaceChange(dna as never)).to.throw(Z.ZodError)
    })
  }
})
