import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceStore, fetchCarryingLegacy, type WorkspaceGateway } from '../../src/state/workspace-store'
import * as ST from '../../src/lib/storage'
import { AppNotices } from '../../src/lib/notices'
import { Quiz } from '../../src/models/quiz'
import { Workspace, type WorkspaceT } from '../../src/models/workspace'
import { MemoryStore } from '../support/memory-store'
import type { SaveOutcome, WorkspaceChangeDNA } from '../../src/models/workspace-change'

vi.mock('../../src/lib/workspace/port', () => ({ fetchWorkspace: vi.fn(), saveWorkspaceChange: vi.fn() }))
vi.mock('../../src/state/quiz-mirror', () => ({ mirrorWorkspace: vi.fn() }))

/** Lets every already-settled promise run its continuation */
const settle = () => new Promise((resolve) => { setTimeout(resolve, 0) })

/** A gateway that answers from memory and remembers every change it was sent */
function memoryGateway(workspace: WorkspaceT = Workspace.blank()) {
  const sent: WorkspaceChangeDNA[] = []
  const outcomes: SaveOutcome[] = []
  const gateway: WorkspaceGateway = {
    fetch: vi.fn(() => Promise.resolve(workspace)),
    save:  vi.fn((change: WorkspaceChangeDNA) => {
      sent.push(change)
      const outcome: SaveOutcome = outcomes.shift() ?? { saved: true }
      return Promise.resolve(outcome)
    }),
  }
  return { gateway, sent, outcomes }
}

/** A store already subscribed to and loaded */
async function aLoadedStore(gateway: WorkspaceGateway, channel: EventTarget & { postMessage: (message: unknown) => void } | null = null) {
  const store = createWorkspaceStore(gateway, undefined, channel)
  store.subscribe(() => { /* keep it live */ })
  await settle()
  return store
}

describe('createWorkspaceStore', () => {
  it('fetches nothing until something subscribes, and is loaded once the workspace arrives', async () => {
    const workspace = Workspace.blank()
    const { gateway } = memoryGateway(workspace)
    const store = createWorkspaceStore(gateway)
    expect(gateway.fetch).not.toHaveBeenCalled()
    expect(store.snapshot().loaded).to.eq(false)
    store.subscribe(() => { /* keep it live */ })
    await settle()
    expect(store.snapshot()).to.include({ workspace, loaded: true, unsaved: false })
  })

  it('ignores a dispatch before the workspace has arrived', () => {
    const { gateway } = memoryGateway()
    const store = createWorkspaceStore(gateway)
    store.dispatch({ kind: 'retitle_quiz', title: 'Too soon' })
    expect(gateway.save).not.toHaveBeenCalled()
  })

  it('shows a change at once, and saves only the quiz it touched', async () => {
    const [kept, retitled] = [Quiz.blank('Kept'), Quiz.blank('Before')]
    const { gateway, sent } = memoryGateway({ quizzes: [kept, retitled], active_quiz_id: retitled.id })
    const store = await aLoadedStore(gateway)
    store.dispatch({ kind: 'retitle_quiz', title: 'After' })
    expect(store.snapshot()).to.include({ unsaved: true })
    expect(store.snapshot().workspace.quizzes[1]?.title).to.eq('After')
    await settle()
    expect(store.snapshot()).to.include({ unsaved: false, saveNotice: null })
    expect(sent.map((change) => change.quizzes?.map((quiz) => quiz.title))).to.deep.eq([['After']])
  })

  it('does not save a dispatch that changes nothing', async () => {
    const { gateway } = memoryGateway()
    const store = await aLoadedStore(gateway)
    store.dispatch({ kind: 'open_quiz', quiz_id: 'no such quiz' })
    await settle()
    expect(gateway.save).not.toHaveBeenCalled()
  })

  it('says so when a save fails, and makes it good with the next one', async () => {
    const { gateway, sent, outcomes } = memoryGateway()
    outcomes.push({ saved: false, message: AppNotices.saveFailed })
    const store = await aLoadedStore(gateway)
    store.dispatch({ kind: 'retitle_quiz', title: 'Lost?' })
    await settle()
    expect(store.snapshot()).to.include({ unsaved: true, saveNotice: AppNotices.saveFailed })
    store.dispatch({ kind: 'add_question' })
    await settle()
    expect(store.snapshot()).to.include({ unsaved: false, saveNotice: null })
    expect(sent[1]?.quizzes?.[0]).to.include({ title: 'Lost?' })
  })

  it('treats a save that throws the same as one that says it failed', async () => {
    const { gateway } = memoryGateway()
    vi.mocked(gateway.save).mockRejectedValueOnce(new Error('offline'))
    const store = await aLoadedStore(gateway)
    store.dispatch({ kind: 'retitle_quiz', title: 'Offline' })
    await settle()
    expect(store.snapshot()).to.include({ saveNotice: AppNotices.saveFailed })
  })

  it('saves one at a time, the later save carrying everything the first did not', async () => {
    const { gateway, sent } = memoryGateway()
    const first = Promise.withResolvers<SaveOutcome>()
    vi.mocked(gateway.save).mockImplementationOnce(async (change) => {
      sent.push(change)
      return await first.promise
    })
    const store = await aLoadedStore(gateway)
    store.dispatch({ kind: 'retitle_quiz', title: 'One' })
    await settle()
    store.dispatch({ kind: 'retitle_quiz', title: 'Two' })
    await settle()
    expect(sent).to.have.length(1)
    first.resolve({ saved: true })
    await settle()
    expect(sent.map((change) => change.quizzes?.[0]?.title)).to.deep.eq(['One', 'Two'])
  })

  it('folds changes made before a save starts into that one save', async () => {
    const { gateway, sent } = memoryGateway()
    const store = await aLoadedStore(gateway)
    store.dispatch({ kind: 'retitle_quiz', title: 'One' })
    store.dispatch({ kind: 'retitle_quiz', title: 'Two' })
    await settle()
    expect(sent.map((change) => change.quizzes?.[0]?.title)).to.deep.eq(['Two'])
  })

  it('says so when the workspace cannot be fetched', async () => {
    const { gateway } = memoryGateway()
    vi.mocked(gateway.fetch).mockRejectedValueOnce(new Error('offline'))
    const store = await aLoadedStore(gateway)
    expect(store.snapshot()).to.include({ loaded: false, saveNotice: AppNotices.loadFailed })
  })

  it('fetches afresh when another tab saves, and tells the others when it saves', async () => {
    const channel = Object.assign(new EventTarget(), { postMessage: vi.fn() })
    const { gateway } = memoryGateway()
    const store = await aLoadedStore(gateway, channel)
    channel.dispatchEvent(new Event('message'))
    await settle()
    expect(gateway.fetch).toHaveBeenCalledTimes(2)
    store.dispatch({ kind: 'retitle_quiz', title: 'Mine' })
    await settle()
    expect(channel.postMessage).toHaveBeenCalledOnce()
  })

  it('keeps its own unsaved changes rather than fetching over them', async () => {
    const channel = Object.assign(new EventTarget(), { postMessage: vi.fn() })
    const { gateway, outcomes } = memoryGateway()
    outcomes.push({ saved: false, message: AppNotices.saveFailed })
    const store = await aLoadedStore(gateway, channel)
    store.dispatch({ kind: 'retitle_quiz', title: 'Mine' })
    await settle()
    channel.dispatchEvent(new Event('message'))
    await settle()
    expect(gateway.fetch).toHaveBeenCalledOnce()
  })
})

describe('fetchCarryingLegacy', () => {
  const legacyQuiz = Quiz.blank('From before the database')
  const legacy = Workspace.fill({ quizzes: [legacyQuiz], active_quiz_id: legacyQuiz.id })
  const storeHoldingLegacy = () => {
    const store = new MemoryStore()
    store.setItem(ST.WorkspaceStorekey, JSON.stringify(legacy))
    return store
  }

  it('hands back the workspace untouched when there is nothing to carry in', async () => {
    const workspace = Workspace.blank()
    const save = vi.fn()
    expect(await fetchCarryingLegacy(() => Promise.resolve({ workspace, fresh: true }), save, new MemoryStore())).to.eq(workspace)
    expect(save).not.toHaveBeenCalled()
  })

  it('carries the old quizzes into a fresh workspace in place of its blank one, then sets them aside', async () => {
    const fresh = Workspace.blank()
    const save = vi.fn((): Promise<SaveOutcome> => Promise.resolve({ saved: true }))
    const fetch = vi.fn()
      .mockResolvedValueOnce({ workspace: fresh, fresh: true })
      .mockResolvedValueOnce({ workspace: legacy, fresh: false })
    const store = storeHoldingLegacy()
    expect(await fetchCarryingLegacy(fetch, save, store)).to.eq(legacy)
    expect(save).toHaveBeenCalledWith({ active_quiz_id: legacyQuiz.id, quizzes: legacy.quizzes, deleted_quiz_ids: [fresh.active_quiz_id] })
    expect(ST.readLegacyWorkspace(store)).to.eq(null)
  })

  it('adds the old quizzes alongside a workspace that already has some', async () => {
    const save = vi.fn((): Promise<SaveOutcome> => Promise.resolve({ saved: true }))
    const fetch = vi.fn(() => Promise.resolve({ workspace: Workspace.blank(), fresh: false }))
    await fetchCarryingLegacy(fetch, save, storeHoldingLegacy())
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ deleted_quiz_ids: [] }))
  })

  it('leaves the old quizzes where they were when carrying them in fails', async () => {
    const workspace = Workspace.blank()
    const save = vi.fn((): Promise<SaveOutcome> => Promise.resolve({ saved: false, message: AppNotices.saveFailed }))
    const store = storeHoldingLegacy()
    expect(await fetchCarryingLegacy(() => Promise.resolve({ workspace, fresh: true }), save, store)).to.eq(workspace)
    expect(ST.readLegacyWorkspace(store)).to.deep.eq(legacy)
  })
})

describe('createWorkspaceStore, as the page leaves', () => {
  it('sends whatever is waiting its turn at once, rather than behind a save still on its way', async () => {
    const { gateway, sent } = memoryGateway()
    const first = Promise.withResolvers<SaveOutcome>()
    vi.mocked(gateway.save).mockImplementationOnce((change) => {
      sent.push(change)
      return first.promise
    })
    const store = await aLoadedStore(gateway)
    store.dispatch({ kind: 'retitle_quiz', title: 'On its way' })
    await settle()
    store.dispatch({ kind: 'retitle_quiz', title: 'Waiting its turn' })
    store.leaving(true)
    expect(sent.map((change) => change.quizzes?.[0]?.title)).to.deep.eq(['On its way', 'Waiting its turn'])
  })

  it('sends a change made while leaving straight away', async () => {
    const { gateway, sent } = memoryGateway()
    const store = await aLoadedStore(gateway)
    store.leaving(true)
    store.dispatch({ kind: 'retitle_quiz', title: 'Committed on the way out' })
    expect(sent.map((change) => change.quizzes?.[0]?.title)).to.deep.eq(['Committed on the way out'])
  })

  it('sends nothing on leaving when nothing is unsaved', async () => {
    const { gateway } = memoryGateway()
    const store = await aLoadedStore(gateway)
    store.leaving(true)
    expect(gateway.save).not.toHaveBeenCalled()
  })

  it('goes back to taking turns once the page turns out to be staying', async () => {
    const { gateway, sent } = memoryGateway()
    const first = Promise.withResolvers<SaveOutcome>()
    vi.mocked(gateway.save).mockImplementationOnce((change) => {
      sent.push(change)
      return first.promise
    })
    const store = await aLoadedStore(gateway)
    store.leaving(true)
    store.leaving(false)
    store.dispatch({ kind: 'retitle_quiz', title: 'One' })
    await settle()
    store.dispatch({ kind: 'retitle_quiz', title: 'Two' })
    await settle()
    expect(sent).to.have.length(1)
  })
})
