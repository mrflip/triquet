import { AppNotices } from '../lib/notices'
import { fetchWorkspace, saveWorkspaceChange } from '../lib/workspace/port'
import { mirrorWorkspace } from './quiz-mirror'
import { Workspace, type WorkspaceT } from '../models/workspace'
import { changeBetween, type SaveOutcome, type WorkspaceChangeDNA } from '../models/workspace-change'
import { workspaceReducer, type WorkspaceAction } from './workspace-reducer'

export type WorkspaceSnapshot = {
  workspace:  WorkspaceT
  /** Whether this browser's quizzes have arrived yet; false during a server render */
  loaded:     boolean
  /** Whether the screen shows changes the database does not hold yet */
  unsaved:    boolean
  /** Why the last save or load did not land, or null while all is well */
  saveNotice: string | null
}

export type WorkspaceStore = {
  subscribe:      (listener: () => void) => () => void
  snapshot:       () => WorkspaceSnapshot
  serverSnapshot: () => WorkspaceSnapshot
  dispatch:       (action: WorkspaceAction) => void
  /** Tell the store whether the page is going away: while it is, nothing waits its turn to save */
  leaving:        (going: boolean) => void
}

/** Where a store fetches its workspace from and saves it to */
export type WorkspaceGateway = {
  fetch: () => Promise<WorkspaceT>
  save:  (change: WorkspaceChangeDNA) => Promise<SaveOutcome>
}

/** What tells this tab that another one saved, and tells the others when this one does */
export type TabChannel = Pick<BroadcastChannel, 'postMessage' | 'addEventListener'>

/**
 * The workspace as an external store, for `useSyncExternalStore`.
 *
 * The workspace arrives once something first subscribes. Every dispatch is on screen at once
 * and saved behind it, one save at a time; each save carries everything the database has not
 * yet accepted, so a save that fails is made good by the next one. Once the page is leaving,
 * a save waiting its turn would never get one, so whatever is unsaved is sent at once instead.
 * When another tab saves, this one fetches the workspace afresh, unless it is holding changes
 * of its own.
 *
 * @param gateway - Where the workspace comes from and goes to.
 * @param onChanged - Told what the workspace was and what it became, after every change. Must not throw, and must not be relied on.
 * @param channel - How tabs tell each other they saved; null for a store alone in the world.
 * @returns A store ready for `useSyncExternalStore`.
 *
 * @example const store = createWorkspaceStore({ fetch, save })
 */
export function createWorkspaceStore(
  gateway: WorkspaceGateway,
  onChanged: (before: WorkspaceT, after: WorkspaceT) => void = () => { /* nobody is watching */ },
  channel: TabChannel | null = null,
): WorkspaceStore {
  const emptySnapshot: WorkspaceSnapshot = { workspace: Workspace.blank(), loaded: false, unsaved: false, saveNotice: null }
  const listeners = new Set<() => void>()
  let held = emptySnapshot
  /** What the database is known to hold; null until the workspace has arrived */
  let saved: WorkspaceT | null = null
  let fetching: Promise<void> | null = null
  let saving: Promise<void> = Promise.resolve()
  let going = false

  const announce = (patch: Partial<WorkspaceSnapshot>) => {
    held = { ...held, ...patch }
    for (const listener of listeners) { listener() }
  }

  const refetch = async () => {
    try {
      const workspace = await gateway.fetch()
      saved = workspace
      announce({ workspace, loaded: true, unsaved: false })
    } catch {
      announce({ saveNotice: AppNotices.loadFailed })
    }
  }

  const saveOrExplain = async (change: WorkspaceChangeDNA): Promise<SaveOutcome> => {
    try {
      return await gateway.save(change)
    } catch {
      return { saved: false, message: AppNotices.saveFailed }
    }
  }

  /** Queued behind whatever save is already on its way, so saves land in the order they were made */
  const queueSave = async (ahead: Promise<void>) => {
    await ahead
    await saveLatest()
  }

  const saveLatest = async () => {
    const target = held.workspace
    if (saved === null || target === saved) { return }
    const outcome = await saveOrExplain(changeBetween(saved, target))
    if (outcome.saved) {
      saved = target
      channel?.postMessage('saved')
    }
    announce({ unsaved: held.workspace !== saved, saveNotice: outcome.saved ? null : outcome.message })
  }

  const saveAtOnce = () => {
    if (saved !== null && held.workspace !== saved) { void saveOrExplain(changeBetween(saved, held.workspace)) }
  }

  channel?.addEventListener('message', () => {
    if (held.loaded && ! held.unsaved) { void refetch() }
  })

  return {
    subscribe(listener) {
      listeners.add(listener)
      fetching ??= refetch()
      return () => { listeners.delete(listener) }
    },

    snapshot() {
      return held
    },

    serverSnapshot() {
      return emptySnapshot
    },

    dispatch(action) {
      if (! held.loaded) { return }
      const before = held.workspace
      const workspace = workspaceReducer(before, action)
      if (workspace === before) { return }
      announce({ workspace, unsaved: true })
      if (going) { saveAtOnce() } else { saving = queueSave(saving) }
      onChanged(before, workspace)
    },

    leaving(leaves) {
      going = leaves
      if (going) { saveAtOnce() }
    },
  }
}

/** Tabs of this browser tell each other when they save; a server render has no tabs */
const TabChannelName = 'triquet.workspace'

/** The one store this tab's grid reads and writes, mirroring every change into its quiz's history */
export const TabWorkspaceStore = createWorkspaceStore(
  { fetch: fetchWorkspace, save: saveWorkspaceChange },
  mirrorWorkspace,
  typeof window === 'undefined' ? null : new BroadcastChannel(TabChannelName),
)

if (typeof window !== 'undefined') {
  addEventListener('pagehide', () => { TabWorkspaceStore.leaving(true) })
  // A page restored from the back-forward cache is staying after all.
  addEventListener('pageshow', () => { TabWorkspaceStore.leaving(false) })
}
