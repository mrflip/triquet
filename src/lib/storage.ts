import { AppNotices } from './notices'
import { Workspace, type WorkspaceT } from '../models/workspace'

/** Where a workspace lives in the browser. Versioned, so a future shape change can coexist. */
export const WorkspaceStorekey = 'triquet.workspace.v1'

/** Whether a write landed, and what to tell the author when it did not */
export type SaveOutcome =
  | { saved: true }
  | { saved: false, message: string }

/**
 * The browser's own storage, or null where there is none -- a server render, a locked-down
 * profile, a browser that throws on the mere mention of it.
 *
 * @returns The store to read and write, or null.
 */
export function browserStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Some browsers throw on access rather than returning null when storage is disabled.
    return null
  }
}

/**
 * The workspace this browser holds, or a fresh one.
 *
 * Anything unreadable -- absent, truncated, hand-mangled, or written by a shape we no longer
 * understand -- yields a blank workspace rather than an error, because there is nothing the
 * author can do about it and a working grid is more use than a stack trace.
 *
 * @param store - Where to read from; defaults to this browser's local storage.
 * @returns A valid workspace, always.
 *
 * @example readWorkspace(new MemoryStore()).quizzes.length  // => 1
 */
export function readWorkspace(store: Storage | null = browserStore()): WorkspaceT {
  const raw = readRaw(store)
  if (raw === null) { return Workspace.blank() }
  try {
    return Workspace.revive(JSON.parse(raw) as WorkspaceT)
  } catch {
    return Workspace.blank()
  }
}

/**
 * Commit `workspace` to the browser, reporting refusal rather than throwing.
 *
 * @param workspace - The whole workspace; there is no partial save.
 * @param store - Where to write; defaults to this browser's local storage.
 * @returns Whether it landed, with the author's message when it did not.
 *
 * @example writeWorkspace(Workspace.blank(), new MemoryStore())  // => { saved: true }
 */
export function writeWorkspace(workspace: WorkspaceT, store: Storage | null = browserStore()): SaveOutcome {
  if (! store) { return { saved: false, message: AppNotices.saveFailed } }
  try {
    store.setItem(WorkspaceStorekey, JSON.stringify(workspace))
    return { saved: true }
  } catch {
    return { saved: false, message: AppNotices.saveFailed }
  }
}

/**
 * Watch for another tab of this browser saving over our workspace, and hand over what it wrote.
 *
 * @param onWorkspace - Called with the other tab's workspace; not called for our own writes.
 * @param target - What emits `storage` events; defaults to the global scope.
 * @returns A function that stops watching.
 *
 * @example const stop = watchWorkspace((workspace) => setWorkspace(workspace))
 */
export function watchWorkspace(
  onWorkspace: (workspace: WorkspaceT) => void,
  target: EventTarget | null = globalThis,
): () => void {
  if (! target) { return () => { /* nothing was ever watched */ } }
  const onStorage = (event: Event) => {
    const { key, newValue } = event as StorageEvent
    if (key !== WorkspaceStorekey || ! newValue) { return }
    try {
      onWorkspace(Workspace.revive(JSON.parse(newValue) as WorkspaceT))
    } catch {
      // Another tab wrote something we cannot read. Ours is still good; keep it.
    }
  }
  target.addEventListener('storage', onStorage)
  return () => { target.removeEventListener('storage', onStorage) }
}

/** Raw stored text, or null when there is none or the store refuses to be read */
function readRaw(store: Storage | null): string | null {
  if (! store) { return null }
  try {
    return store.getItem(WorkspaceStorekey)
  } catch {
    return null
  }
}
