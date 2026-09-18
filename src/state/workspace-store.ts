import * as ST from '../lib/storage'
import { mirrorWorkspace } from './quiz-mirror'
import { Workspace, type WorkspaceT } from '../models/workspace'
import { workspaceReducer, type WorkspaceAction } from './workspace-reducer'

export type WorkspaceSnapshot = {
  workspace: WorkspaceT
  /** Whether this browser's own quizzes have been read yet; false during a server render */
  loaded:     boolean
  /** Why the last save did not land, or null while saving is working */
  saveNotice: string | null
}

export type WorkspaceStore = {
  subscribe:      (listener: () => void) => () => void
  snapshot:       () => WorkspaceSnapshot
  serverSnapshot: () => WorkspaceSnapshot
  dispatch:       (action: WorkspaceAction) => void
}

/**
 * The workspace as an external store, for `useSyncExternalStore`.
 *
 * Storage really is external state: it outlives the page, another tab can change it, and it can
 * refuse a write. Holding it as a store rather than as React state is what lets a server render,
 * a first paint, a cross-tab update and a failed save all be ordinary readings of one snapshot.
 *
 * Every dispatch is committed before it is announced, so there is never a moment where the
 * screen shows a change this browser has not accepted.
 *
 * @param store - Where quizzes live; defaults to this browser's local storage.
 * @param target - What emits cross-tab `storage` events; defaults to the global scope.
 * @param onChanged - Told what the workspace was and what it became, after every landed write. Must not throw, and must not be relied on.
 * @returns A store ready for `useSyncExternalStore`.
 *
 * @example const store = createWorkspaceStore(new MemoryStore(), new EventTarget())
 */
export function createWorkspaceStore(
  store?: Storage | null,
  target: EventTarget | null = globalThis,
  onChanged: (before: WorkspaceT, after: WorkspaceT) => void = () => { /* nobody is watching */ },
): WorkspaceStore {
  const resolveStore = () => (store === undefined ? ST.browserStore() : store)
  const emptySnapshot: WorkspaceSnapshot = { workspace: Workspace.blank(), loaded: false, saveNotice: null }
  const listeners = new Set<() => void>()
  let held = emptySnapshot

  const announce = (next: WorkspaceSnapshot) => {
    held = next
    for (const listener of listeners) { listener() }
  }

  /** Read-through on first use, then cached: the hook needs the same object back every time */
  const snapshot = (): WorkspaceSnapshot => {
    if (! held.loaded) { held = { workspace: ST.readWorkspace(resolveStore()), loaded: true, saveNotice: null } }
    return held
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      const stopWatching = ST.watchWorkspace((fromOtherTab) => {
        announce({ workspace: fromOtherTab, loaded: true, saveNotice: held.saveNotice })
      }, target)
      return () => {
        listeners.delete(listener)
        stopWatching()
      }
    },

    snapshot,

    serverSnapshot() {
      return emptySnapshot
    },

    dispatch(action) {
      const before = snapshot().workspace
      const workspace = workspaceReducer(before, action)
      if (workspace === held.workspace) { return }
      const outcome = ST.writeWorkspace(workspace, resolveStore())
      announce({ workspace, loaded: true, saveNotice: outcome.saved ? null : outcome.message })
      onChanged(before, workspace)
    },
  }
}

/** The one store this tab's grid reads and writes, mirroring every change into its quiz's history */
export const TabWorkspaceStore = createWorkspaceStore(undefined, globalThis, mirrorWorkspace)
