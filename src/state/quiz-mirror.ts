'use client'

import LightningFS from '@isomorphic-git/lightning-fs'
import * as Changes from '../lib/changes'
import * as Quizgit from '../lib/quizgit'
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

/**
 * Commit every quiz that moved between two readings of the workspace.
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
  void commitMoved(before, after)
}

/** Commit each moved quiz in turn, letting a failed one cost only itself */
async function commitMoved(before: WorkspaceT, after: WorkspaceT): Promise<void> {
  const wasById = new Map(before.quizzes.map((quiz) => [quiz.id, quiz]))
  for (const quiz of after.quizzes) {
    const changes = Changes.quizChanges(wasById.get(quiz.id) ?? null, quiz)
    if (changes.length === 0) { continue }
    try {
      await enqueue(async (fs) => await Quizgit.commitQuiz(fs, quiz, changes))
    } catch {
      // The edit itself is already safe in storage. A record may miss one; an author may not.
    }
  }
}

/**
 * Tag where `quiz` now stands, as a point worth coming back to.
 *
 * @param quiz - The quiz being saved.
 * @returns The tag left behind, or null when there was no history here to tag.
 */
export async function saveQuiz(quiz: QuizT): Promise<string | null> {
  return await enqueue(async (fs) => await Quizgit.saveQuiz(fs, quiz))
}

/**
 * `quiz`'s whole repository, zipped and ready to hand to a download.
 *
 * @param quiz - The quiz to package.
 * @returns The zip's bytes, or null where this browser keeps no history.
 */
export async function quizRepoZip(quiz: QuizT): Promise<Uint8Array | null> {
  return await enqueue(async (fs) => await Quizgit.zipQuizRepo(fs, quiz))
}
