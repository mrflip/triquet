'use client'

import LightningFS from '@isomorphic-git/lightning-fs'
import * as Changes from '../lib/changes'
import * as Quizgit from '../lib/quizgit'
import { createCommitScheduler } from './commit-scheduler'
import { MirrorSettings } from '../models/mirror-settings'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

/** Where this browser keeps the quiz histories, alongside but separate from the workspace itself */
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

/** Record `latest` in its repository, describing what moved since `baseline`; nothing, if nothing did */
async function commitBurst(baseline: QuizT | null, latest: QuizT): Promise<void> {
  const changes = Changes.quizChanges(baseline, latest)
  if (changes.length === 0) { return }
  await enqueue(async (fs) => await Quizgit.commitQuiz(fs, latest, changes))
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

/**
 * Note every quiz that moved between two readings of the workspace, for committing after the wait.
 *
 * Fire-and-forget by design: the caller is a synchronous dispatch that has already committed the
 * change to storage, and must not wait on, or fail for, a mirror that is only ever a record.
 *
 * A deleted quiz is left exactly as it stood. Its history is the one thing deletion should not
 * take away, and nothing else in this browser still holds it.
 *
 * @param before - The workspace as it stood.
 * @param after - The workspace as it now stands.
 */
export function mirrorWorkspace(before: WorkspaceT, after: WorkspaceT): void {
  const wasById = new Map(before.quizzes.map((quiz) => [quiz.id, quiz]))
  for (const quiz of after.quizzes) {
    const was = wasById.get(quiz.id) ?? null
    if (quiz !== was) { scheduler.note(was, quiz) }
  }
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
 * Anything still waiting to be committed is committed first, so the milestone marks what the
 * author is looking at rather than what was true half a minute ago.
 *
 * @returns The tag left behind, or null when there was no history here to tag.
 */
export async function milestoneQuiz(quiz: QuizT): Promise<string | null> {
  await scheduler.flush(quiz.id)
  return await enqueue(async (fs) => await Quizgit.milestoneQuiz(fs, quiz))
}

/**
 * `quiz`'s whole repository, zipped and ready to hand to a download.
 *
 * @param quiz - The quiz to package.
 * Anything still waiting to be committed is committed first, so the download is the quiz as it
 * stands.
 *
 * @returns The zip's bytes, or null where this browser keeps no history.
 */
export async function quizRepoZip(quiz: QuizT): Promise<Uint8Array | null> {
  await scheduler.flush(quiz.id)
  return await enqueue(async (fs) => await Quizgit.zipQuizRepo(fs, quiz))
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
