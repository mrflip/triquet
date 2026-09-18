import { describe, expect, it } from 'vitest'
import { WorkspaceStorekey, readWorkspace, watchWorkspace, writeWorkspace } from '../../src/lib/storage'
import { AppNotices } from '../../src/lib/notices'
import { Workspace, type WorkspaceT } from '../../src/models/workspace'
import { Quiz } from '../../src/models/quiz'
import { MemoryStore } from '../support/memory-store'

describe('writeWorkspace', () => {
  it('commits the whole workspace under one key', () => {
    const store = new MemoryStore()
    const workspace = Workspace.blank()
    expect(writeWorkspace(workspace, store)).to.deep.eq({ saved: true })
    expect(JSON.parse(store.getItem(WorkspaceStorekey) ?? '')).to.deep.eq(workspace)
  })

  it('reports a refusing store in the author\'s words rather than throwing', () => {
    const store = new MemoryStore()
    store.refuses = true
    expect(writeWorkspace(Workspace.blank(), store)).to.deep.eq({ saved: false, message: AppNotices.saveFailed })
  })

  it('reports an absent store the same way', () => {
    expect(writeWorkspace(Workspace.blank(), null)).to.deep.eq({ saved: false, message: AppNotices.saveFailed })
  })
})

describe('readWorkspace', () => {
  it('round-trips a workspace through the store', () => {
    const store = new MemoryStore()
    const quiz = Quiz.blank('Round one')
    const workspace = Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
    writeWorkspace(workspace, store)
    expect(readWorkspace(store)).to.deep.eq(workspace)
  })

  it('opens a fresh workspace when the store holds nothing', () => {
    expect(readWorkspace(new MemoryStore()).quizzes).to.have.length(1)
  })

  it('opens a fresh workspace when there is no store at all', () => {
    expect(readWorkspace(null).quizzes).to.have.length(1)
  })

  it('opens a fresh workspace rather than failing on unparseable text', () => {
    const store = new MemoryStore()
    store.setItem(WorkspaceStorekey, '{"quizzes":[')
    expect(readWorkspace(store).quizzes).to.have.length(1)
  })

  it('opens a fresh workspace rather than failing on a shape it cannot use', () => {
    const store = new MemoryStore()
    store.setItem(WorkspaceStorekey, '{"quizzes":[]}')
    expect(readWorkspace(store).quizzes).to.have.length(1)
  })

  it('repairs an open-round id that names no round', () => {
    const store = new MemoryStore()
    const quiz = Quiz.blank()
    store.setItem(WorkspaceStorekey, JSON.stringify({ quizzes: [quiz], active_quiz_id: 'gone' }))
    expect(readWorkspace(store).active_quiz_id).to.eq(quiz.id)
  })
})

describe('watchWorkspace', () => {
  it('hands over what another tab wrote', () => {
    const target = new EventTarget()
    const quiz = Quiz.blank('From the other tab')
    const seen: WorkspaceT[] = []
    watchWorkspace((workspace) => { seen.push(workspace) }, target)
    target.dispatchEvent(storageEvent(WorkspaceStorekey, JSON.stringify({ quizzes: [quiz], active_quiz_id: quiz.id })))
    expect(seen[0]?.quizzes[0]?.title).to.eq('From the other tab')
  })

  it('ignores writes under some other key', () => {
    const target = new EventTarget()
    const seen: WorkspaceT[] = []
    watchWorkspace((workspace) => { seen.push(workspace) }, target)
    target.dispatchEvent(storageEvent('some.other.key', '{}'))
    expect(seen).to.have.length(0)
  })

  it('ignores a clear, which carries no new value', () => {
    const target = new EventTarget()
    const seen: WorkspaceT[] = []
    watchWorkspace((workspace) => { seen.push(workspace) }, target)
    target.dispatchEvent(storageEvent(WorkspaceStorekey, null))
    expect(seen).to.have.length(0)
  })

  it('keeps ours when the other tab writes something unreadable', () => {
    const target = new EventTarget()
    const seen: WorkspaceT[] = []
    watchWorkspace((workspace) => { seen.push(workspace) }, target)
    target.dispatchEvent(storageEvent(WorkspaceStorekey, 'not json'))
    expect(seen).to.have.length(0)
  })

  it('stops watching when asked', () => {
    const target = new EventTarget()
    const quiz = Quiz.blank()
    const seen: WorkspaceT[] = []
    const stop = watchWorkspace((workspace) => { seen.push(workspace) }, target)
    stop()
    target.dispatchEvent(storageEvent(WorkspaceStorekey, JSON.stringify({ quizzes: [quiz], active_quiz_id: quiz.id })))
    expect(seen).to.have.length(0)
  })
})

/** A `storage`-shaped event, since Node has no StorageEvent constructor */
function storageEvent(key: string, newValue: string | null): Event {
  return Object.assign(new Event('storage'), { key, newValue })
}
