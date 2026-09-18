import * as git from 'isomorphic-git'
import { zipSync } from 'fflate'
import stringify from 'safe-stable-stringify'
import * as Changes from './changes'
import * as Labelmaker from './labelmaker'
import * as Sheets from './sheets'
import type { QuizT } from '../models/quiz'

/** Where each quiz's repository lives, one directory per quiz, named by the id that never moves */
export const RepoRoot = '/quizzes'

/** Who every commit is attributed to. There are no accounts here, and nothing leaves the browser. */
export const GitAuthor = { name: 'Triquet', email: 'triquet@localhost' } as const

/** What the tab-separated file is called. The label moves, and git reads the move as a rename. */
export function quizFilenameFor(quiz: Readonly<Labelmaker.Labelled>): string {
  return `${Labelmaker.effectiveLabelOf(quiz)}.tsv`
}

/** What the whole-quiz export is called, suffixed so it says whose format it is */
export function quizJsonFilenameFor(quiz: Readonly<Labelmaker.Labelled>): string {
  return `${Labelmaker.effectiveLabelOf(quiz)}.triquet.json`
}

/** Where `quiz`'s repository sits. Keyed by id, so renaming a quiz never orphans its history. */
export function repopathFor(quiz: Readonly<Pick<QuizT, 'id'>>): string {
  return `${RepoRoot}/${quiz.id}`
}

/**
 * The bits of a filesystem this module and isomorphic-git need, named structurally so a real
 * `node:fs`, an IndexedDB-backed browser filesystem, and a test double are all equally valid.
 *
 * Every one of these is required, `readlink` and `symlink` included: isomorphic-git binds the
 * whole set up front rather than reaching for them only when a repository turns out to hold a
 * symbolic link.
 */
export type GitFs = {
  promises: {
    readFile:  {
      (path: string):                             Promise<Uint8Array>
      (path: string, opts: { encoding: 'utf8' }): Promise<string>
    }
    writeFile: (path: string, data: Uint8Array | string, opts?: { encoding?: 'utf8' }) => Promise<void>
    unlink:    (path: string) => Promise<void>
    readdir:   (path: string) => Promise<string[]>
    mkdir:     (path: string) => Promise<void>
    rmdir:     (path: string) => Promise<void>
    stat:      (path: string) => Promise<{ isDirectory: () => boolean }>
    lstat:     (path: string) => Promise<{ isDirectory: () => boolean }>
    readlink:  (path: string) => Promise<string>
    symlink:   (target: string, path: string) => Promise<void>
    /** Commit the directory tree itself to durable storage, where that is a separate step */
    flush?:    () => Promise<void>
  }
}

/**
 * Make everything written so far durable, where the filesystem holds anything back.
 *
 * A filesystem that writes file contents eagerly may still keep the directory tree in memory,
 * flushing it on a timer -- which means a reload moments after an edit can find a repository
 * with nothing in it. A history worth keeping is worth not losing to that window.
 *
 * @param fs - The filesystem to settle. One with no separate flush step is already durable.
 */
export async function flushFs(fs: GitFs): Promise<void> {
  await fs.promises.flush?.()
}

/**
 * The whole working tree for `quiz`, both files under the label the quiz answers to.
 *
 * The `.tsv` is what a commit reads as: one line per question, so a diff is line-per-question and
 * legible to anyone. It is also lossy -- seven fields of a much larger quiz -- so the
 * `.triquet.json` beside it carries the whole thing, pretty-printed, and is what could restore a
 * quiz from its own history. They move together in one commit.
 *
 * The JSON is written with sorted keys rather than whatever order an object happened to be built
 * in. A diff that shuffles its lines for no reason is a diff nobody reads.
 *
 * Renaming the quiz renames both files, which git reads as a rename rather than as a loss.
 *
 * @param quiz - The quiz as it now stands.
 * @returns Every file the repository should hold, and nothing else.
 *
 * @example quizFiles(quiz).keys().toArray()  // => ['quiet_otter.tsv', 'quiet_otter.triquet.json']
 */
export function quizFiles(quiz: QuizT): Map<string, string> {
  return new Map([
    [quizFilenameFor(quiz), `${Sheets.sheetsExport(quiz.questions)}\n`],
    [quizJsonFilenameFor(quiz), `${stringify(quiz, null, 2)}\n`],
  ])
}

/**
 * The tag a save leaves behind: the version it was saved on, and when.
 *
 * The timestamp is an ISO one lowercased, with its colons dropped -- git forbids a colon in a
 * ref name, and the alternative to dropping them is a tag no version of git will accept.
 *
 * @param version - The quiz's version, which is also its branch.
 * @param at - The moment being stamped.
 * @returns A valid, sortable tag name.
 *
 * @example tagnameFor('main', new Date('2026-09-18T18:45:04.123Z'))  // => 'main-2026-09-18t184504z'
 */
export function tagnameFor(version: string, at: Date): string {
  const stamp = at.toISOString().toLowerCase().replaceAll(':', '').replace(/\.\d+z$/, 'z')
  return `${version}-${stamp}`
}

/**
 * Commit `quiz` to its own repository, on the branch its version names.
 *
 * Creates the repository on first sight, and the branch the first time a version is used, so an
 * author who renames a version simply starts a branch rather than meeting an error. The
 * repository is a mirror and never the source of truth: the caller is expected to treat a
 * failure here as something to report, not as a reason to lose an edit.
 *
 * @param fs - Where the repositories live.
 * @param quiz - The quiz as it now stands.
 * @param changes - What moved, as `Changes.quizChanges` reported it.
 * @returns The new commit's oid, or null when nothing changed and nothing was committed.
 *
 * @example await commitQuiz(fs, quiz, quizChanges(before, quiz))
 */
export async function commitQuiz(fs: GitFs, quiz: QuizT, changes: readonly Changes.Change[]): Promise<string | null> {
  const message = Changes.commitMessageFor(changes, quiz)
  if (message === null) { return null }

  const dir = repopathFor(quiz)
  await openRepo(fs, dir, quiz.version)
  const { written, removed } = await syncTree(fs, dir, quizFiles(quiz))

  for (const filepath of written) { await git.add({ fs, dir, filepath }) }
  for (const filepath of removed) { await git.remove({ fs, dir, filepath }) }
  return await git.commit({ fs, dir, message, author: { ...GitAuthor } })
}

/**
 * Tag `quiz`'s current commit, marking this moment as one worth coming back to.
 *
 * A version with no commits behind it yet has nothing to point a tag at, and says so rather than
 * failing: an author can reach this by saving a quiz whose history this browser has never held.
 *
 * @param fs - Where the repositories live.
 * @param quiz - The quiz being saved.
 * @param at - The moment to stamp; now, when omitted.
 * @returns The tag left behind, disambiguated when that second already has one, or null when there was nothing to tag.
 *
 * @example await saveQuiz(fs, quiz)  // => 'main-2026-09-18t184504z'
 */
export async function saveQuiz(fs: GitFs, quiz: QuizT, at: Date = new Date()): Promise<string | null> {
  const dir = repopathFor(quiz)
  await openRepo(fs, dir, quiz.version)
  if (! await hasCommits(fs, dir)) { return null }
  const taken = new Set(await git.listTags({ fs, dir }))
  const ref = untakenTag(tagnameFor(quiz.version, at), taken)
  await git.tag({ fs, dir, ref })
  return ref
}

/** Whether this branch has anything committed to it that a tag could point at */
async function hasCommits(fs: GitFs, dir: string): Promise<boolean> {
  try {
    await git.resolveRef({ fs, dir, ref: 'HEAD' })
    return true
  } catch {
    return false
  }
}

/** `wanted`, or the first numbered variation of it that no tag has claimed yet */
function untakenTag(wanted: string, taken: ReadonlySet<string>): string {
  let ref = wanted
  let attempt = 2
  while (taken.has(ref)) {
    ref = `${wanted}-${String(attempt)}`
    attempt += 1
  }
  return ref
}

/**
 * `quiz`'s whole repository as a zip: the working tree, and the `.git` directory behind it.
 *
 * Unzipping it yields an ordinary git repository -- `git log`, `git diff`, `git checkout` and
 * every other command work on it without this tool being involved at all.
 *
 * @param fs - Where the repositories live.
 * @param quiz - The quiz to package.
 * @returns The zip's bytes, ready to hand to a download.
 *
 * @example new Blob([await zipQuizRepo(fs, quiz)], { type: 'application/zip' })
 */
export async function zipQuizRepo(fs: GitFs, quiz: QuizT): Promise<Uint8Array> {
  const dir = repopathFor(quiz)
  const stem = Labelmaker.effectiveLabelOf(quiz)
  const filepaths = await allFiles(fs, dir)
  const entries: Record<string, Uint8Array> = {}
  for (const filepath of filepaths) {
    entries[`${stem}/${filepath}`] = await fs.promises.readFile(`${dir}/${filepath}`)
  }
  return zipSync(entries)
}

/** Open `dir` as a repository on branch `version`, creating either the first time it is needed */
async function openRepo(fs: GitFs, dir: string, version: string): Promise<void> {
  await mkdirp(fs, dir)
  await git.init({ fs, dir, defaultBranch: version })
  const branch = await git.currentBranch({ fs, dir })
  if (branch === version) { return }
  const branches = await git.listBranches({ fs, dir })
  if (branches.includes(version)) {
    await git.checkout({ fs, dir, ref: version })
  } else {
    await git.branch({ fs, dir, ref: version, checkout: true })
  }
}

/** Make `dir` hold exactly `files`, reporting which paths were written and which taken away */
async function syncTree(fs: GitFs, dir: string, files: ReadonlyMap<string, string>): Promise<{ written: string[], removed: string[] }> {
  const present = await treeFiles(fs, dir)
  const removed = present.filter((filepath) => ! files.has(filepath))
  for (const filepath of removed) { await fs.promises.unlink(`${dir}/${filepath}`) }

  const written = files.keys().toArray()
  for (const [filepath, body] of files) {
    await mkdirp(fs, parentOf(`${dir}/${filepath}`))
    await fs.promises.writeFile(`${dir}/${filepath}`, body)
  }
  return { written, removed }
}

/** The working tree: what a commit is made of, with the repository's own bookkeeping left out */
async function treeFiles(fs: GitFs, dir: string): Promise<string[]> {
  return await listFiles(fs, dir, '', false)
}

/** Everything in the directory, `.git` and all -- which is what makes a zip a real repository */
async function allFiles(fs: GitFs, dir: string): Promise<string[]> {
  return await listFiles(fs, dir, '', true)
}

/** Every file at or below `dir`, as paths relative to the directory the walk started from */
async function listFiles(fs: GitFs, dir: string, prefix: string, withGit: boolean): Promise<string[]> {
  const here = prefix === '' ? dir : `${dir}/${prefix}`
  const entries = await readdirOrNothing(fs, here)
  const found: string[] = []
  for (const entry of entries) {
    const filepath = prefix === '' ? entry : `${prefix}/${entry}`
    if (filepath === '.git' && ! withGit) { continue }
    const stat = await fs.promises.lstat(`${dir}/${filepath}`)
    if (stat.isDirectory()) {
      found.push(...await listFiles(fs, dir, filepath, withGit))
    } else {
      found.push(filepath)
    }
  }
  return found
}

/** What `path` holds, or nothing at all when it does not exist */
async function readdirOrNothing(fs: GitFs, path: string): Promise<string[]> {
  try {
    return await fs.promises.readdir(path)
  } catch {
    return []
  }
}

/** Create `path` and every directory above it, tolerating the ones already there */
async function mkdirp(fs: GitFs, path: string): Promise<void> {
  const segments = path.split('/').filter((segment) => segment !== '')
  let walked = ''
  for (const segment of segments) {
    walked += `/${segment}`
    try {
      await fs.promises.mkdir(walked)
    } catch {
      // Already there, which is the whole point of walking down from the root.
    }
  }
}

/** The directory `path` sits in */
function parentOf(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')))
}
