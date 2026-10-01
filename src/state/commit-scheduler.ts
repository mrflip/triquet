import * as Postmortem from '../lib/postmortem'
import { MirrorSettings } from '../models/mirror-settings'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import type { QuizPlace } from '../lib/formulary/runner'

/** What a repository is written from: the quiz, the library its widgetings work, and where the quiz sits */
export type MirrorSnapshot = {
  quiz:    QuizT
  library: readonly WidgetT[]
  place:   QuizPlace
}

/** What to do when a quiz's wait is up: record `latest`, which differs from `baseline` by the burst of edits */
export type CommitFn = (baseline: MirrorSnapshot | null, latest: MirrorSnapshot) => Promise<unknown>

export type CommitSchedulerOpts = {
  /** Target wait between an edit and its commit, in whole seconds from 2 to 600 */
  seconds: number
  commit:  CommitFn
}

export type CommitScheduler = {
  /** Record that a quiz moved from `before` to `after`; commits after the wait unless one is already due */
  note:         (before: MirrorSnapshot | null, after: MirrorSnapshot) => void
  /** Commit one quiz's pending edits now, resolving when that commit has finished */
  flush:        (quiz_id: string) => Promise<void>
  /** Commit everything pending now */
  flushAll:     () => Promise<void>
  /** How many quizzes are waiting for their commit */
  pendingCount: () => number
}

/** One quiz's wait: the state it was in when the wait began, the state it is in now, and the clock */
type Pending = {
  baseline: MirrorSnapshot | null
  latest:   MirrorSnapshot
  timer:    ReturnType<typeof setTimeout>
}

/**
 * Batches a quiz's edits into one commit, made roughly `seconds` after the first of them.
 *
 * The clock starts at the first edit and is not restarted by later ones. A debounce that
 * restarted would never fire for someone who keeps typing, leaving the history further and
 * further behind exactly when the most is happening; this way a quiz being worked on
 * continuously is still committed about every `seconds`. The wait is a target, not a promise:
 * timers can be delayed, and a flush can beat the clock, so a commit may come sooner or later.
 *
 * The commit is told the quiz as it stood when the wait began and as it stands now, so the
 * message it writes describes the whole burst rather than only its last edit.
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

  const run = async (waiting: Pending): Promise<void> => {
    try {
      await opts.commit(waiting.baseline, waiting.latest)
    } catch (err) {
      // A record that misses a commit is a smaller loss than an edit that fails; storage has the edit.
      Postmortem.report('commit to the quiz history', err, { quiz_id: waiting.latest.quiz._id })
    }
  }

  const flush = async (quiz_id: string): Promise<void> => {
    const waiting = pending.get(quiz_id)
    if (! waiting) { return }
    clearTimeout(waiting.timer)
    pending.delete(quiz_id)
    await run(waiting)
  }

  return {
    note(before, after) {
      const waiting = pending.get(after.quiz._id)
      if (waiting) { waiting.latest = after; return }
      const timer = setTimeout(() => { void flush(after.quiz._id) }, commit_debounce_seconds * 1000)
      pending.set(after.quiz._id, { baseline: before, latest: after, timer })
    },
    flush,
    async flushAll() {
      await Promise.all(pending.keys().map(async (quiz_id) => { await flush(quiz_id) }))
    },
    pendingCount() {
      return pending.size
    },
  }
}
