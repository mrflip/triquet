import { Workspace, type WorkspaceT } from '../models/workspace'

/** Where a workspace lived in the browser before there was a database */
export const WorkspaceStorekey = 'triquet.workspace.v1'

/** Where it is moved once carried into the database: kept, but never carried in twice */
export const RetiredWorkspaceStorekey = 'triquet.workspace.v1.retired'

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
 * The workspace this browser held before there was a database, if it held one.
 *
 * Anything unreadable -- truncated, hand-mangled, or written by a shape we no longer
 * understand -- counts as nothing, because there is nothing the author can do about it.
 *
 * @param store - Where to read from; defaults to this browser's local storage.
 * @returns The workspace, or null.
 *
 * @example readLegacyWorkspace(new MemoryStore())  // => null
 */
export function readLegacyWorkspace(store: Storage | null = browserStore()): WorkspaceT | null {
  try {
    const raw = store?.getItem(WorkspaceStorekey) ?? null
    return raw === null ? null : Workspace.revive(JSON.parse(raw) as WorkspaceT)
  } catch {
    return null
  }
}

/**
 * Set the pre-database workspace aside, so it is never carried into the database again.
 *
 * It is moved rather than deleted: if anything went wrong on the way in, the author's quizzes
 * are still sitting in their browser.
 *
 * @param store - Where it lives; defaults to this browser's local storage.
 */
export function retireLegacyWorkspace(store: Storage | null = browserStore()): void {
  try {
    const raw = store?.getItem(WorkspaceStorekey) ?? null
    if (raw === null) { return }
    store?.setItem(RetiredWorkspaceStorekey, raw)
    store?.removeItem(WorkspaceStorekey)
  } catch {
    // A store that refuses leaves the old workspace where it was; it will be offered again.
  }
}
