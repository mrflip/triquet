import { describe, expect, it } from 'vitest'
import * as ST from '../../src/lib/storage'
import { Workspace } from '../../src/models/workspace'
import { Quiz } from '../../src/models/quiz'
import { MemoryStore } from '../support/memory-store'

/** A store holding `raw` where the pre-database workspace lived */
function storeHolding(raw: string): MemoryStore {
  const store = new MemoryStore()
  store.setItem(ST.WorkspaceStorekey, raw)
  return store
}

describe('readLegacyWorkspace', () => {
  it('reads back the workspace this browser held', () => {
    const quiz = Quiz.blank('Quiz one')
    const workspace = Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
    const store = storeHolding(JSON.stringify(workspace))
    expect(ST.readLegacyWorkspace(store)).to.deep.eq(workspace)
  })

  it('repairs an open-quiz id that names no quiz', () => {
    const quiz = Quiz.blank()
    const store = storeHolding(JSON.stringify({ quizzes: [quiz], active_quiz_id: 'gone' }))
    expect(ST.readLegacyWorkspace(store)?.active_quiz_id).to.eq(quiz.id)
  })

  const Nothing: [MemoryStore | null, string][] = [
    [new MemoryStore(),                   'a store holding nothing'],
    [null,                                'no store at all'],
    [storeHolding('{"quizzes":['),        'unparseable text'],
    [storeHolding('{"quizzes":[]}'),      'a shape it cannot use'],
  ]
  for (const [store, describes] of Nothing) {
    it(`finds nothing in ${describes}`, () => {
      expect(ST.readLegacyWorkspace(store)).to.eq(null)
    })
  }
})

describe('retireLegacyWorkspace', () => {
  it('moves the old workspace aside, so it reads as nothing but is still there', () => {
    const store = storeHolding('{"quizzes":[]}')
    ST.retireLegacyWorkspace(store)
    expect(store.getItem(ST.WorkspaceStorekey)).to.eq(null)
    expect(store.getItem(ST.RetiredWorkspaceStorekey)).to.eq('{"quizzes":[]}')
  })

  it('leaves a store holding nothing untouched', () => {
    const store = new MemoryStore()
    ST.retireLegacyWorkspace(store)
    expect(store.length).to.eq(0)
  })

  it('leaves the old workspace where it was when the store refuses', () => {
    const store = storeHolding('{"quizzes":[]}')
    store.refuses = true
    ST.retireLegacyWorkspace(store)
    expect(store.getItem(ST.WorkspaceStorekey)).to.eq('{"quizzes":[]}')
  })
})
