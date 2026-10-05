import * as Postmortem from '../lib/postmortem'
import { MirrorSettings } from '../models/mirror-settings'
import type { HuntReadingT } from './hunt-feed'

/**
 * What to do when a hunt's wait is up: commit `latest`, which differs from `baseline` by the
 * burst of changes. A first reading (`latest.first`) asks for the hunt whole, which catches up on
 * whatever changed while this tab was not reading it; its baseline is the tab's last reading of the
 * hunt before, or null when it has none.
 */
export type CommitFn = (baseline: HuntReadingT | null, latest: HuntReadingT) => Promise<unknown>

export type CommitSchedulerOpts = {
  /** Target wait between a change and its commit, in whole seconds from 2 to 600 */
  seconds: number
  commit:  CommitFn
}

export type CommitScheduler = {
  /** Record a reading of a hunt: committed at once when it is the first, else after the wait unless one is already due */
  note:         (reading: HuntReadingT) => void
  /** Commit one hunt's pending changes now, resolving when that commit has finished */
  flush:        (hunt_id: string) => Promise<void>
  /** Commit everything pending now */
  flushAll:     () => Promise<void>
  /** How many hunts are waiting for their commit */
  pendingCount: () => number
}

/** One hunt's wait: the reading it was in when the wait began, the reading it is in now, and the clock */
type Pending = {
  baseline: HuntReadingT | null
  latest:   HuntReadingT
  timer:    ReturnType<typeof setTimeout>
}

/**
 * Batches a hunt's changes into one commit, made roughly `seconds` after the first of them.
 *
 * The clock starts at the first change and is not restarted by later ones. A debounce that
 * restarted would never fire for someone who keeps typing, leaving the history further and
 * further behind exactly when the most is happening; this way a hunt being worked on
 * continuously is still committed about every `seconds`. The wait is a target, not a promise:
 * timers can be delayed, and a flush can beat the clock, so a commit may come sooner or later.
 *
 * The commit is told the hunt as it stood when the wait began and as it stands now, so it writes
 * only the files that differ between the two (the dirty files), and its message describes the
 * whole burst rather than only its last change. Two moments never share a commit with the ones
 * before them:
 *
 * * A tab's first reading of a hunt is committed at once, whole, after whatever was waiting: that
 *   is the catch-up, and it opens the history even if the tab closes straight after.
 * * A reading on another branch than the one waiting commits what was waiting first, on its own
 *   branch, and starts a wait of its own: work done before a switch stays on the branch it was
 *   done on.
 *
 * @param opts - The wait, and what to do when it is up.
 * @returns The scheduler.
 * @throws When `seconds` is not a whole number from 2 to 600.
 *
 * @example const scheduler = createCommitScheduler({ seconds: 30, commit })
 */
export function createCommitScheduler(opts: Readonly<CommitSchedulerOpts>): CommitScheduler {
  const { commit_debounce_seconds } = MirrorSettings.fill({ commit_debounce_seconds: opts.seconds })
  const pending = new Map<string, Pending>()
  // Each hunt's latest reading: where its next wait begins.
  const lastFor = new Map<string, HuntReadingT>()

  const run = async (baseline: HuntReadingT | null, latest: HuntReadingT): Promise<void> => {
    try {
      await opts.commit(baseline, latest)
    } catch (err) {
      // A record that misses a commit is a smaller loss than an edit that fails; storage has the edit.
      Postmortem.report('commit to the hunt history', err, { hunt_id: latest.hunt._id })
    }
  }

  const flush = async (hunt_id: string): Promise<void> => {
    const waiting = pending.get(hunt_id)
    if (! waiting) { return }
    clearTimeout(waiting.timer)
    pending.delete(hunt_id)
    await run(waiting.baseline, waiting.latest)
  }

  const wait = (baseline: HuntReadingT | null, latest: HuntReadingT) => {
    const hunt_id = latest.hunt._id
    const timer = setTimeout(() => { void flush(hunt_id) }, commit_debounce_seconds * 1000)
    pending.set(hunt_id, { baseline, latest, timer })
  }

  return {
    note(reading) {
      const hunt_id = reading.hunt._id
      const waiting = pending.get(hunt_id)
      const last = lastFor.get(hunt_id) ?? null
      lastFor.set(hunt_id, reading)
      if (reading.first) {
        // Each is handed to the commit as it is called, so what was waiting is committed first.
        void flush(hunt_id)
        void run(last, reading)
      } else if (! waiting) {
        wait(last, reading)
      } else if (waiting.latest.hunt.branch === reading.hunt.branch) {
        waiting.latest = reading
      } else {
        void flush(hunt_id)
        wait(waiting.latest, reading)
      }
    },
    flush,
    async flushAll() {
      await Promise.all(pending.keys().map(async (hunt_id) => { await flush(hunt_id) }))
    },
    pendingCount() {
      return pending.size
    },
  }
}
