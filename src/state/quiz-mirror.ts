'use client'

import LightningFS from '@isomorphic-git/lightning-fs'
import _ from 'es-toolkit/compat'
import * as Changes from '../lib/changes'
import * as Downloading from '../lib/downloading'
import * as Postmortem from '../lib/postmortem'
import * as Quizgit from '../lib/quizgit'
import { createCommitScheduler, type MirrorSnapshot } from './commit-scheduler'
import { MirrorSettings } from '../models/mirror-settings'
import type { QuizT } from '../models/quiz'

/** Where this browser keeps the quiz histories, alongside but separate from the database itself */
export const MirrorFsName = 'triquet-quizzes'

/** Held state: the filesystem once it has been asked for, and the tail of the work queued on it */
const mirror = { fs: null as Quizgit.GitFs | null, queue: Promise.resolve() as Promise<unknown> }

/** Wait for whatever is already queued, and hand back the release for whoever queues next */
async function takeTurn(): Promise<() => void> {
  const ahead = mirror.queue
  const gate = Promise.withResolvers<null>()
  mirror.queue = gate.promise
  await ahead
  return () => { gate.resolve(null) }
}

/**
 * This browser's filesystem for quiz history, or null where there is none.
 *
 * Made on first use rather than on import, because it is IndexedDB-backed and a server render
 * has no such thing.
 *
 * @returns The filesystem, or null during a server render or in a browser without IndexedDB.
 */
export function mirrorFs(): Quizgit.GitFs | null {
  if (typeof indexedDB === 'undefined') { return null }
  mirror.fs ??= new LightningFS(MirrorFsName) as unknown as Quizgit.GitFs
  return mirror.fs
}

/**
 * Run `work` against the mirror once everything already queued has finished.
 *
 * Commits have to land in the order the edits happened, and git is not safe to run twice over
 * one repository at once, so every piece of work waits its turn. A failure here belongs to the
 * caller and never to the queue: the turn is released either way, so one bad commit cannot
 * wedge every edit after it.
 *
 * @param work - What to do with the filesystem.
 * @returns What `work` returned, or null where there is no filesystem to work on.
 * @throws Whatever `work` threw, once its turn has been released.
 */
export async function enqueue<TT>(work: (fs: Quizgit.GitFs) => Promise<TT>): Promise<TT | null> {
  const fs = mirrorFs()
  if (! fs) { return null }
  const release = await takeTurn()
  try {
    const landed = await work(fs)
    await Quizgit.flushFs(fs)
    return landed
  } finally {
    release()
  }
}

/** Record `latest` in its repository, describing what moved since `baseline`; nothing, if nothing did. With no baseline, open the history if it has none. */
async function commitBurst(baseline: MirrorSnapshot | null, latest: MirrorSnapshot): Promise<void> {
  if (! baseline) {
    await enqueue(async (fs) => await Quizgit.commitFirst(fs, latest.quiz, latest.library, latest.place, latest.branch))
    return
  }
  const changes = [
    ...Changes.quizChanges(baseline.quiz, latest.quiz),
    ...Changes.widgetChanges(Quizgit.worked(baseline.quiz, baseline.library), Quizgit.worked(latest.quiz, latest.library)),
  ]
  if (changes.length === 0) { return }
  await enqueue(async (fs) => await Quizgit.commitQuiz(fs, latest.quiz, latest.library, latest.place, latest.branch, changes))
}

/**
 * The one scheduler for this tab. Built as the module loads, so a nonsense wait in the
 * environment stops the app at startup where a developer will see it, rather than on the first
 * edit where it would look like the edit's fault.
 */
const scheduler = createCommitScheduler({
  seconds: MirrorSettings.fromEnv(process.env.NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS).commit_debounce_seconds,
  commit:  commitBurst,
})

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

/** Once every change this tab is writing has landed, whether or not it succeeded */
async function writesLanded(): Promise<void> {
  await Promise.allSettled(writing)
}

/** The quizzes this tab has already made sure have a history */
const opened = new Set<string>()

/**
 * Make sure the quiz `latest` holds has a history, starting with the quiz as it stands; a quiz
 * that already has commits is left alone. Done once per quiz per tab, and at once rather than
 * after the wait, so a quiz's history opens with its creation even if the tab closes straight
 * after.
 */
function openHistory(latest: MirrorSnapshot): void {
  if (opened.has(latest.quiz._id)) { return }
  opened.add(latest.quiz._id)
  const open = async () => {
    try {
      await enqueue(async (fs) => await Quizgit.commitFirst(fs, latest.quiz, latest.library, latest.place, latest.branch))
    } catch (err) {
      // A record that misses a commit is a smaller loss than an edit that fails.
      Postmortem.report('start the quiz history', err, { quiz_id: latest.quiz._id })
    }
  }
  void open()
}

/**
 * Note the open quiz as it now stands, for its history: whoever changed it, in this tab, another,
 * or another browser. The first reading of a quiz makes sure it has a history; each after that
 * notes what moved since the one before, for committing after the wait.
 *
 * Fire-and-forget by design: the change is already stored, and nothing waits on, or fails for, a
 * mirror that is only ever a record. A deleted quiz is never read again, so its history is left
 * exactly as it stood: the one thing deletion should not take away.
 *
 * @param before - The quiz as last read, or null for the first reading.
 * @param after - The quiz as it now stands.
 *
 * @example mirrorQuiz(null, { quiz, library, place })  // opens the quiz's history
 */
export function mirrorQuiz(before: MirrorSnapshot | null, after: MirrorSnapshot): void {
  if (before?.quiz._id !== after.quiz._id) {
    openHistory(after)
    return
  }
  const moved = before.quiz !== after.quiz || before.library !== after.library || ! _.isEqual(before.place, after.place) || before.branch !== after.branch
  if (moved) { scheduler.note(before, after) }
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
  await scheduler.flushAll()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { void flushPending() } })
  addEventListener('pagehide', () => { void flushPending() })
}

/**
 * Mark where `quiz` now stands as a milestone, a point worth coming back to.
 *
 * @param quiz - The quiz being marked.
 * @param branch - The branch its hunt is on.
 * Any change still being written, and anything still waiting to be committed, is committed first,
 * so the milestone marks what the author is looking at rather than what was true a moment ago.
 *
 * @returns The tag left behind, or null when there was no history here to tag.
 */
export async function milestoneQuiz(quiz: QuizT, branch: string): Promise<string | null> {
  await writesLanded()
  await scheduler.flush(quiz._id)
  return await enqueue(async (fs) => await Quizgit.milestoneQuiz(fs, quiz, branch))
}

/**
 * Carry out a sweeping change -- an import, a deletion -- so that the history shows exactly what
 * it did: the quiz as it stood is committed first, then the change is applied and committed, then
 * that commit is tagged.
 *
 * Without the first commit, edits still waiting for their commit would be folded into the
 * change's and pass for its doing. The first commit is a no-op when nothing was waiting.
 *
 * @param quiz - The quiz being changed.
 * @param markkind - What the change is, which names the tag.
 * @param branch - The branch its hunt is on, which names the tag too.
 * @param apply - Applies the change; it must dispatch it synchronously, so that it is being written by the time this looks.
 * @returns The tag left behind, or null when there was no history here to tag.
 *
 * @example void QuizMirror.markedChange(quiz, 'delete', hunt.branch, () => { dispatch({ kind: 'delete_questions', question_ids }) })
 */
export async function markedChange(quiz: QuizT, markkind: Quizgit.Markkind, branch: string, apply: () => void): Promise<string | null> {
  await writesLanded()
  await scheduler.flush(quiz._id)
  apply()
  await writesLanded()
  await scheduler.flush(quiz._id)
  return await enqueue(async (fs) => await Quizgit.markChange(fs, quiz, markkind, branch))
}

/** What a download needs of a quiz: its id, which finds the repository, and its label, which names the zip */
type Zippable = Readonly<Pick<QuizT, '_id' | 'label'>>

/**
 * `quiz`'s whole repository, zipped and ready to hand to a download.
 *
 * @param quiz - The quiz to package.
 * Any change still being written, and anything still waiting to be committed, is committed first,
 * so the download is the quiz as it stands.
 *
 * @returns The zip's bytes, or null where this browser keeps no history.
 */
export async function quizRepoZip(quiz: Zippable): Promise<Uint8Array | null> {
  await writesLanded()
  await scheduler.flush(quiz._id)
  return await enqueue(async (fs) => await Quizgit.zipQuizRepo(fs, quiz))
}

/**
 * Hand the browser `quiz`'s whole history to download, as a zip named for the quiz.
 *
 * @param quiz - The quiz to package.
 * @returns Whether a download was offered; false where this browser keeps no history.
 */
export async function downloadQuizRepo(quiz: Zippable): Promise<boolean> {
  const zipped = await quizRepoZip(quiz)
  if (! zipped) { return false }
  Downloading.offerDownload(`${quiz.label}.zip`, zipped, 'application/zip')
  return true
}

/**
 * Hand the browser one repository `listQuizRepos` found to download, whether or not its quiz is
 * still here: named for the quiz its latest commit holds, or for its id when it has none.
 *
 * @param repo - The repository, as listed.
 * @returns Whether a download was offered; false where this browser keeps no history.
 *
 * @example await downloadRepo(repos[0])  // offers 'quiet_otter.zip'
 */
export async function downloadRepo(repo: Quizgit.RepoSummary): Promise<boolean> {
  return await downloadQuizRepo({ _id: repo.id, label: repo.label ?? repo.id })
}

/**
 * Every quiz repository this browser holds, including those of quizzes since deleted.
 *
 * @returns One summary per repository, newest work first; empty where this browser keeps no history.
 */
export async function listQuizRepos(): Promise<Quizgit.RepoSummary[]> {
  const repos = await enqueue(async (fs) => await Quizgit.listRepos(fs))
  return repos ?? []
}
