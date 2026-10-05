'use client'

import LightningFS from '@isomorphic-git/lightning-fs'
import * as Downloading from '../lib/downloading'
import * as Huntgit from '../lib/huntgit'
import type { ShallowHuntT } from '../lib/rows'
import { createCommitScheduler } from './commit-scheduler'
import { commitReading } from './hunt-commits'
import { feedsRead, settleFeeds, type HuntReadingT } from './hunt-feed'
import { MirrorSettings } from '../models/mirror-settings'
import type { QuizT } from '../models/quiz'

/*
 * The mirror (`notes/vocabulary.md`): each hunt's history, kept in this browser as a git
 * repository (`Huntgit`), fed from the hunt's readings (`useHuntFeed`) and committed after a wait
 * (`createCommitScheduler`). Fire-and-forget throughout: the change is already stored, and nothing
 * waits on, or fails for, a mirror that is only ever a record.
 */

/**
 * Where this browser keeps its histories, alongside but separate from the database itself. Named
 * for the per-quiz repositories it first held, which are still found there (`listQuizRepos`).
 */
export const MirrorFsName = 'triquet-quizzes'

/** What a hunt's history is found and named by: its id, its label, and the branch it is on */
type HuntKeyT = Readonly<Pick<ShallowHuntT, '_id' | 'label' | 'branch'>>

/** Held state: the filesystem once it has been asked for, and the tail of the work queued on it */
const mirror = { fs: null as Huntgit.GitFs | null, queue: Promise.resolve() as Promise<unknown> }

/** Wait for whatever is already queued, and hand back the release for whoever queues next */
async function takeTurn(): Promise<() => void> {
  const ahead = mirror.queue
  const gate = Promise.withResolvers<null>()
  mirror.queue = gate.promise
  await ahead
  return () => { gate.resolve(null) }
}

/**
 * This browser's filesystem for the histories, or null where there is none.
 *
 * Made on first use rather than on import, because it is IndexedDB-backed and a server render
 * has no such thing.
 *
 * @returns The filesystem, or null during a server render or in a browser without IndexedDB.
 */
export function mirrorFs(): Huntgit.GitFs | null {
  if (typeof indexedDB === 'undefined') { return null }
  mirror.fs ??= new LightningFS(MirrorFsName) as unknown as Huntgit.GitFs
  return mirror.fs
}

/**
 * Run `work` against the mirror once everything already queued has finished.
 *
 * Commits have to land in the order the changes happened, and git is not safe to run twice over
 * one repository at once, so every piece of work waits its turn, from the moment it is asked for.
 * A failure here belongs to the caller and never to the queue: the turn is released either way,
 * so one bad commit cannot wedge every change after it.
 *
 * @param work - What to do with the filesystem.
 * @returns What `work` returned, or null where there is no filesystem to work on.
 * @throws Whatever `work` threw, once its turn has been released.
 */
export async function enqueue<TT>(work: (fs: Huntgit.GitFs) => Promise<TT>): Promise<TT | null> {
  const fs = mirrorFs()
  if (! fs) { return null }
  const release = await takeTurn()
  try {
    const landed = await work(fs)
    await Huntgit.flushFs(fs)
    return landed
  } finally {
    release()
  }
}

/**
 * The one scheduler for this tab. Built as the module loads, so a nonsense wait in the
 * environment stops the app at startup where a developer will see it, rather than on the first
 * edit where it would look like the edit's fault.
 */
const scheduler = createCommitScheduler({
  seconds: MirrorSettings.fromEnv(process.env.NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS).commit_debounce_seconds,
  commit:  async (baseline, latest) => await enqueue(async (fs) => await commitReading(fs, baseline, latest)),
})

/**
 * Note a reading of a hunt for its history: whoever changed it, in this tab, another, or another
 * browser. The first reading in a tab is committed at once, whole (the catch-up); each after that
 * is committed after the wait, with whatever else arrived meanwhile. Hand it to `useHuntFeed`.
 *
 * A deleted quiz's files are removed in a commit, and the history keeps them, as it keeps
 * everything: the one thing deletion should not take away.
 *
 * @param reading - The hunt as it now stands.
 *
 * @example useHuntFeed(labels.hunt, huntAffirms, quiz_id, HuntMirror.noteReading)
 */
export function noteReading(reading: HuntReadingT): void {
  scheduler.note(reading)
}

/** Changes this tab is still writing, which the history has not been told about yet */
const writing = new Set<Promise<unknown>>()

/**
 * Hold the history's hand-offs (a milestone, a download) until `work`, a change this tab is
 * writing, has landed and been noted, so neither can miss an edit the author has just made.
 *
 * @param work - The write, ending once the change is noted for the history.
 */
export function trackWrite(work: Promise<unknown>): void {
  writing.add(work)
  const forget = async () => {
    try {
      await work
    } finally {
      writing.delete(work)
    }
  }
  void forget()
}

/**
 * The longest the history waits, before it marks a moment, for the hunt's feed to hear from every
 * watch it holds, in milliseconds: past it, the moment is marked with what has been heard.
 */
export const ReadWaitMs = 5000

/**
 * Commit `hunt`'s waiting changes now, once every change this tab is writing has landed and been
 * heard of: the client tells the feed of a change before its writer hears it landed, and the feed
 * is made to hand on what it has put off.
 *
 * Settled (`settleFeeds`), the feed hands on what it has heard. Read (`feedsRead`), it waits as
 * well to hear from every watch it holds, up to `ReadWaitMs`: a change that adds a question is
 * heard of in full only once the watch of the new question, opened as the change was heard, has
 * answered.
 */
async function caughtUp(hunt: Readonly<Pick<ShallowHuntT, '_id'>>, heard: 'settled' | 'read'): Promise<void> {
  await Promise.allSettled(writing)
  if (heard === 'read') {
    const waited = Promise.withResolvers<null>()
    const timer = setTimeout(() => { waited.resolve(null) }, ReadWaitMs)
    await Promise.race([feedsRead(), waited.promise])
    clearTimeout(timer)
  } else {
    settleFeeds()
  }
  await scheduler.flush(hunt._id)
}

/**
 * Commit everything still waiting, now.
 *
 * Also what a closing tab asks for. That is best-effort: a page being torn down may not live
 * long enough to finish writing, which is the price of waiting to commit at all.
 *
 * @returns Once those commits have finished.
 */
export async function flushPending(): Promise<void> {
  settleFeeds()
  await scheduler.flushAll()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { void flushPending() } })
  addEventListener('pagehide', () => { void flushPending() })
}

/**
 * Mark where the hunt now stands as a milestone, a point worth coming back to, from `quiz`, whose
 * label its tag carries (`Huntgit.tagFor`).
 *
 * Any change still being written, and anything still waiting to be committed, is committed first,
 * so the milestone marks what the author is looking at rather than what was true a moment ago.
 *
 * @param hunt - The hunt, and the branch it is on.
 * @param quiz - The quiz it is marked from.
 * @returns The tag left behind, or null when there was no history here to tag.
 *
 * @example await HuntMirror.milestone(hunt, quiz)  // => 'main_legends_m_20261005120000z'
 */
export async function milestone(hunt: HuntKeyT, quiz: Readonly<Pick<QuizT, 'label'>>): Promise<string | null> {
  await caughtUp(hunt, 'read')
  return await enqueue(async (fs) => await Huntgit.markTip(fs, hunt, hunt.branch, quiz.label, 'milestone'))
}

/**
 * Carry out a sweeping change to `quiz` -- an import, a deletion of questions -- so that the
 * history shows exactly what it did: the hunt as it stood is committed first, then the change is
 * applied and committed, then that commit is tagged.
 *
 * Without the first commit, changes still waiting for their commit would be folded into the
 * change's and pass for its doing. The first commit is a no-op when nothing was waiting, and never
 * holds the change back waiting on the feed: the change is applied as soon as what was waiting is
 * committed.
 *
 * @param hunt - The hunt, and the branch it is on, which names the tag.
 * @param quiz - The quiz being changed, which names the tag too.
 * @param markkind - What the change is, which names the tag too.
 * @param apply - Applies the change; it must dispatch it synchronously, so that it is being written by the time this looks.
 * @returns The tag left behind, or null when there was no history here to tag.
 *
 * @example void HuntMirror.markedChange(hunt, quiz, 'delete', () => { dispatch({ kind: 'delete_questions', question_ids }) })
 */
export async function markedChange(hunt: HuntKeyT, quiz: Readonly<Pick<QuizT, 'label'>>, markkind: Exclude<Huntgit.Markkind, 'milestone'>, apply: () => void): Promise<string | null> {
  await caughtUp(hunt, 'settled')
  apply()
  await caughtUp(hunt, 'read')
  return await enqueue(async (fs) => await Huntgit.markTip(fs, hunt, hunt.branch, quiz.label, markkind))
}

/**
 * `hunt`'s whole repository, zipped and ready to hand to a download. Any change still being
 * written, and anything still waiting to be committed, is committed first, so the download is the
 * hunt as it stands.
 *
 * @param hunt - The hunt to package.
 * @returns The zip's bytes, or null where this browser keeps no history.
 */
export async function huntRepoZip(hunt: HuntKeyT): Promise<Uint8Array | null> {
  await caughtUp(hunt, 'read')
  return await enqueue(async (fs) => await Huntgit.zipHuntRepo(fs, hunt))
}

/**
 * Hand the browser `hunt`'s whole history to download, as a zip named for the hunt.
 *
 * @param hunt - The hunt to package.
 * @returns Whether a download was offered; false where this browser keeps no history.
 *
 * @example await downloadHuntRepo(hunt)  // offers 'spring_hunt.zip'
 */
export async function downloadHuntRepo(hunt: HuntKeyT): Promise<boolean> {
  const zipped = await huntRepoZip(hunt)
  if (! zipped) { return false }
  Downloading.offerDownload(`${hunt.label}.zip`, zipped, 'application/zip')
  return true
}

/**
 * Every per-quiz repository of before this browser holds, including those of quizzes since deleted.
 *
 * @returns One summary per repository, newest work first; empty where this browser keeps no history.
 */
export async function listQuizRepos(): Promise<Huntgit.RepoSummary[]> {
  const repos = await enqueue(async (fs) => await Huntgit.listQuizRepos(fs))
  return repos ?? []
}

/**
 * Hand the browser one per-quiz repository of before to download, whether or not its quiz is still
 * here: named for the quiz its latest commit holds, or for its id when it has none.
 *
 * @param repo - The repository, as listed.
 * @returns Whether a download was offered; false where this browser keeps no history.
 *
 * @example await downloadQuizRepo(repos[0])  // offers 'quiet_otter.zip'
 */
export async function downloadQuizRepo(repo: Huntgit.RepoSummary): Promise<boolean> {
  const zipped = await enqueue(async (fs) => await Huntgit.zipQuizRepo(fs, repo))
  if (! zipped) { return false }
  Downloading.offerDownload(`${repo.label ?? repo.id}.zip`, zipped, 'application/zip')
  return true
}
