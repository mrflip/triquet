import * as git from 'isomorphic-git'
import { zipSync } from 'fflate'
import _ from 'es-toolkit/compat'
import * as Huntfiles from './huntfiles'

/*
 * A hunt's git repository in the browser (`notes/hunt_git.md`): one per hunt, on the branch the
 * hunt names, holding the files `Huntfiles` writes. Every commit writes only the files whose body
 * differs from the branch's tip, so a commit is exactly what changed, and asking twice commits once.
 *
 * The repository is a mirror and never the source of truth: a caller treats a failure here as
 * something to report, never as a reason to lose an edit.
 */

/** Where each hunt's repository lives, one directory per hunt, named by the id that never moves */
export const RepoRoot = '/hunts'

/** Who every commit is attributed to. There are no accounts here, and nothing leaves the browser. */
export const GitAuthor = { name: 'Triquet', email: 'triquet@localhost' } as const

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

/** What finds a hunt's repository: its id */
export type RepoKeyT = { _id: string }

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
 * Where `hunt`'s repository sits. Keyed by id, so relabelling a hunt never moves or strands its history.
 *
 * @example repopathFor({ _id: 'j97abc' })  // => '/hunts/j97abc'
 */
export function repopathFor(hunt: Readonly<RepoKeyT>): string {
  return `${RepoRoot}/${hunt._id}`
}

/**
 * Commit what changed of a hunt's files to its repository, on the branch the hunt is on: each
 * file of `changes.written` whose body differs from the branch's tip, and the removal of each path
 * of `changes.removed` the tip holds. Nothing is committed when the tip already holds exactly
 * that, so the same change asked twice (from two tabs, say) is committed once.
 *
 * Creates the repository on first sight, and the branch the first time it is used, from where the
 * repository stands: an author who puts the hunt on a new branch simply starts one.
 *
 * @param fs - Where the repositories live.
 * @param hunt - The hunt, by id.
 * @param branch - The branch the hunt is on.
 * @param changes - Each file to write, by path, and each path to remove (`Huntfiles.changesBetween`).
 * @param message - The commit message.
 * @returns The new commit's oid, or null when the tip already held the change.
 *
 * @example await commitFiles(fs, hunt, hunt.branch, Huntfiles.changesBetween(ante.files, post.files), 'legends: leon ~clueing')
 */
export async function commitFiles(fs: GitFs, hunt: Readonly<RepoKeyT>, branch: string, changes: Readonly<Huntfiles.FileChangesT>, message: string): Promise<string | null> {
  const dir = repopathFor(hunt)
  await openRepo(fs, dir, branch)
  return await commitOnto(fs, dir, changes, message)
}

/** What a whole-tree commit leaves alone, and says */
export type WholeOptsT = {
  /** The paths the tip keeps as they are, whatever `files` holds: those of a quiz that could not be read */
  keep:    (path: string) => boolean
  message: string
}

/**
 * Commit the hunt's files whole: make the branch's tip hold exactly `files`, writing each that
 * differs from it, and removing each path it holds that `files` does not -- but for the paths
 * `opts.keep` holds, which stay as the tip has them, and the README, which is written once, by the
 * repository's first commit. Nothing is committed when the tip already holds them.
 *
 * What a tab's first reading of a hunt commits (the catch-up: whatever changed while this browser
 * was away), and what taking up a branch commits.
 *
 * @param fs - Where the repositories live.
 * @param hunt - The hunt, by id.
 * @param branch - The branch the hunt is on.
 * @param files - Every file of the hunt but its README, by path.
 * @param opts - The paths to leave alone, and the commit message.
 * @returns The new commit's oid, or null when the tip already held them.
 *
 * @example await commitWhole(fs, hunt, hunt.branch, reading.files, { keep: () => false, message: 'catch up: changes made while this browser was away' })
 */
export async function commitWhole(fs: GitFs, hunt: Readonly<RepoKeyT>, branch: string, files: Huntfiles.FilesT, opts: Readonly<WholeOptsT>): Promise<string | null> {
  const dir = repopathFor(hunt)
  await openRepo(fs, dir, branch)
  const held = await tipOids(fs, dir)
  const written = new Map(files)
  if (! held.has(Huntfiles.ReadmePath)) { written.set(Huntfiles.ReadmePath, Huntfiles.Readme) }
  const removed = held.keys().filter((path) => path !== Huntfiles.ReadmePath && ! files.has(path) && ! opts.keep(path)).toArray()
  return await commitOnto(fs, dir, { written, removed }, opts.message, held)
}

/**
 * Whether `hunt`'s repository has anything committed, on the branch it has checked out.
 *
 * @example await hasHistory(fs, hunt)  // => false, before the hunt's first reading in this browser
 */
export async function hasHistory(fs: GitFs, hunt: Readonly<RepoKeyT>): Promise<boolean> {
  return await hasCommits(fs, repopathFor(hunt))
}

/** The kinds of moment a tag marks: a milestone, an import merged in, questions deleted */
export const MarkkindVals = ['milestone', 'import', 'delete'] as const
export type Markkind = typeof MarkkindVals[number]

/** How each kind of moment is written in its tag */
const TagMarks: Readonly<Record<Markkind, string>> = { milestone: 'm', import: 'import', delete: 'delete' }

/**
 * The tag a marked moment leaves behind: the branch it was marked on, the quiz it was marked
 * from, what it was, and when -- so one quiz's milestones are told apart from another's in the
 * hunt's one repository, and every tag of a branch, or of a quiz on it, lists together.
 *
 * A tag follows the label rule, as a ref an address names must (`notes/decisions/urls.md`):
 * lowercase letters and digits, single underscores between. The moment is the UTC time as
 * fourteen digits and a `z`, so tags sort as text in the order their moments happened.
 *
 * @param branch - The branch the history is on.
 * @param quizlabel - The quiz the moment was marked from.
 * @param markkind - What the moment was.
 * @param at - The moment being stamped.
 * @returns A tag name that is a label.
 *
 * @example tagFor('main', 'legends', 'milestone', new Date('2026-09-18T18:45:04.123Z'))  // => 'main_legends_m_20260918184504z'
 * @example tagFor('draft_two', 'legends', 'import', new Date('2026-09-18T18:45:04.123Z'))  // => 'draft_two_legends_import_20260918184504z'
 */
export function tagFor(branch: string, quizlabel: string, markkind: Markkind, at: Date): string {
  return `${branch}_${quizlabel}_${TagMarks[markkind]}_${tagStampOf(at)}z`
}

/** `at` to the second in UTC, digits only, so tags sort as text in the order their moments happened */
function tagStampOf(at: Date): string {
  return at.toISOString().slice(0, 19).replaceAll(/\D/g, '')
}

/**
 * Mark a moment: tag the tip of the branch the hunt is on (`tagFor`). A hunt put on a new branch
 * since the last commit starts that branch here, so the tag marks where the new line of work
 * begins.
 *
 * A history with no commits yet has nothing to point a tag at, and says so rather than failing.
 *
 * @param fs - Where the repositories live.
 * @param hunt - The hunt, by id.
 * @param branch - The branch the hunt is on.
 * @param quizlabel - The quiz the moment was marked from.
 * @param markkind - What the moment was.
 * @param at - The moment to stamp; now, when omitted.
 * @returns The tag left behind, disambiguated when that second already has one, or null when there was nothing to tag.
 *
 * @example await markTip(fs, hunt, 'main', 'legends', 'milestone')  // => 'main_legends_m_20261005120000z'
 */
export async function markTip(fs: GitFs, hunt: Readonly<RepoKeyT>, branch: string, quizlabel: string, markkind: Markkind, at: Date = new Date()): Promise<string | null> {
  const dir = repopathFor(hunt)
  await openRepo(fs, dir, branch)
  if (! await hasCommits(fs, dir)) { return null }
  const taken = new Set(await git.listTags({ fs, dir }))
  const ref = untakenTag(tagFor(branch, quizlabel, markkind, at), taken)
  await git.tag({ fs, dir, ref })
  return ref
}

/**
 * `hunt`'s whole repository as a zip: the working tree, and the `.git` directory behind it, in a
 * folder named for the hunt.
 *
 * Unzipping it yields an ordinary git repository -- `git log`, `git diff`, `git checkout` and
 * every other command work on it without this tool being involved at all.
 *
 * @param fs - Where the repositories live.
 * @param hunt - The hunt: its id finds the repository, and its label names the folder inside the zip.
 * @returns The zip's bytes, ready to hand to a download.
 *
 * @example new Blob([await zipHuntRepo(fs, hunt)], { type: 'application/zip' })
 */
export async function zipHuntRepo(fs: GitFs, hunt: Readonly<RepoKeyT & { label: string }>): Promise<Uint8Array> {
  return await zipRepo(fs, repopathFor(hunt), hunt.label)
}

/** Every file of the repository at `dir`, `.git` and all, zipped under the folder `stem` */
async function zipRepo(fs: GitFs, dir: string, stem: string): Promise<Uint8Array> {
  const filepaths = await listFiles(fs, dir, '')
  const entries: Record<string, Uint8Array> = {}
  for (const filepath of filepaths) {
    entries[`${stem}/${filepath}`] = await fs.promises.readFile(`${dir}/${filepath}`)
  }
  return zipSync(entries)
}

// --- The per-quiz repositories of before (`/quizzes`): read for the hunts page's list alone

/** Where the per-quiz repositories of before live, one directory per quiz id. Nothing writes there now. */
export const QuizReposRoot = '/quizzes'

/** The whole-quiz file a per-quiz repository named its quiz by */
const QuizJsonExt = '.tq.json'

/** One per-quiz repository as it stands on disk, whether or not any quiz still answers to it */
export type RepoSummary = {
  /** The id of the quiz the repository belongs to: its directory's name */
  id:          string
  /** The quiz's label in its latest commit, or null when nothing has been committed */
  label:       string | null
  /** The branch checked out, or null when it has none yet */
  branch:      string | null
  /** The latest commit's message, or null when nothing has been committed */
  message:     string | null
  /** When the latest commit was made, in epoch milliseconds, or null when nothing has been committed */
  committed_at: number | null
}

/**
 * Every per-quiz repository of before the filesystem holds, newest work first.
 *
 * Independent of the database on purpose: a deleted quiz left its repository behind, and this is
 * where it can still be found. A directory that is not a repository is left out.
 *
 * @param fs - Where the repositories live.
 * @returns One summary per repository; empty when there are none.
 *
 * @example (await listQuizRepos(fs)).map((repo) => repo.label)  // => ['quiet_otter']
 */
export async function listQuizRepos(fs: GitFs): Promise<RepoSummary[]> {
  const ids = await readdirOrNothing(fs, QuizReposRoot)
  const found: RepoSummary[] = []
  for (const id of ids) {
    const summary = await summarizeQuizRepo(fs, id)
    if (summary) { found.push(summary) }
  }
  return _.orderBy(found, [(repo) => repo.committed_at ?? 0], ['desc'])
}

/**
 * The repositories among `repos` that no quiz in `quizIds` answers to: those of quizzes since
 * deleted, or of quizzes this browser can no longer see.
 *
 * @param repos - The repositories, as `listQuizRepos` found them.
 * @param quizIds - The ids of every quiz still to be had.
 * @returns The rest of `repos`, in the order given.
 *
 * @example orphansAmong(await listQuizRepos(fs), new Set([quiz._id]))  // => every repository but quiz's
 */
export function orphansAmong(repos: readonly RepoSummary[], quizIds: ReadonlySet<string>): RepoSummary[] {
  return repos.filter((repo) => ! quizIds.has(repo.id))
}

/**
 * A per-quiz repository of before as a zip, in a folder named `repo.label` (or its id, when it has none).
 *
 * @example new Blob([await zipQuizRepo(fs, repo)], { type: 'application/zip' })
 */
export async function zipQuizRepo(fs: GitFs, repo: Readonly<Pick<RepoSummary, 'id' | 'label'>>): Promise<Uint8Array> {
  return await zipRepo(fs, `${QuizReposRoot}/${repo.id}`, repo.label ?? repo.id)
}

/** `id`'s repository in brief, or null when the directory is not a repository */
async function summarizeQuizRepo(fs: GitFs, id: string): Promise<RepoSummary | null> {
  const dir = `${QuizReposRoot}/${id}`
  try {
    const branch = (await git.currentBranch({ fs, dir })) ?? null
    if (! await hasCommits(fs, dir)) { return { id, label: null, branch, message: null, committed_at: null } }
    const [latest] = await git.log({ fs, dir, depth: 1 })
    const filepaths = await git.listFiles({ fs, dir, ref: 'HEAD' })
    const json = filepaths.find((filepath) => filepath.endsWith(QuizJsonExt))
    return {
      id, branch,
      label:        json === undefined ? null : json.slice(json.lastIndexOf('/') + 1, -QuizJsonExt.length),
      message:      latest?.commit.message.trim() ?? null,
      committed_at: latest ? latest.commit.committer.timestamp * 1000 : null,
    }
  } catch {
    return null
  }
}

// --- The workings

/**
 * Write `changes` into the repository at `dir` and commit them, leaving out each file whose body
 * the tip already holds and each removal of a path it lacks; nothing at all when that leaves
 * nothing. `held` is the tip's blobs, when already read.
 */
async function commitOnto(fs: GitFs, dir: string, changes: Readonly<Huntfiles.FileChangesT>, message: string, held?: ReadonlyMap<string, string>): Promise<string | null> {
  const tip = held ?? await tipOids(fs, dir)
  const written: [string, string][] = []
  for (const [filepath, body] of changes.written) {
    const { oid } = await git.hashBlob({ object: body })
    if (tip.get(filepath) !== oid) { written.push([filepath, body]) }
  }
  const removed = changes.removed.filter((filepath) => tip.has(filepath))
  if (written.length === 0 && removed.length === 0) { return null }

  for (const filepath of removed) {
    await unlinkIfThere(fs, `${dir}/${filepath}`)
    await git.remove({ fs, dir, filepath })
  }
  for (const [filepath, body] of written) {
    await mkdirp(fs, parentOf(`${dir}/${filepath}`))
    await fs.promises.writeFile(`${dir}/${filepath}`, body)
    await git.add({ fs, dir, filepath })
  }
  return await git.commit({ fs, dir, message, author: { ...GitAuthor } })
}

/** Each file of the branch's tip by path, as the oid of its blob; none when nothing is committed */
async function tipOids(fs: GitFs, dir: string): Promise<Map<string, string>> {
  if (! await hasCommits(fs, dir)) { return new Map() }
  const found = await git.walk({
    fs, dir,
    trees: [git.TREE({ ref: 'HEAD' })],
    map:   async (filepath, [entry]) => {
      if (! entry || await entry.type() !== 'blob') { return }
      return { filepath, oid: await entry.oid() }
    },
  }) as { filepath: string, oid: string }[]
  return new Map(found.map(({ filepath, oid }) => [filepath, oid]))
}

/**
 * Open `dir` as a repository on branch `branch`, creating either the first time it is needed. A
 * branch seen before is checked out, its files overwriting whatever the working tree holds: the
 * files are written afresh from the hunt at every commit, so nothing uncommitted is worth keeping.
 */
async function openRepo(fs: GitFs, dir: string, branch: string): Promise<void> {
  await mkdirp(fs, dir)
  await git.init({ fs, dir, defaultBranch: branch })
  const current = await git.currentBranch({ fs, dir })
  if (current === branch) { return }
  const branches = await git.listBranches({ fs, dir })
  if (branches.includes(branch)) {
    await git.checkout({ fs, dir, ref: branch, force: true })
  } else if (await hasCommits(fs, dir)) {
    await git.branch({ fs, dir, ref: branch, checkout: true })
  } else {
    // Nothing committed, so no branch exists to start from: the first commit starts this one.
    await git.writeRef({ fs, dir, ref: 'HEAD', value: `refs/heads/${branch}`, symbolic: true, force: true })
  }
}

/** Whether the branch checked out has anything committed to it that a tag could point at */
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
    ref = `${wanted}_${String(attempt)}`
    attempt += 1
  }
  return ref
}

/** Every file at or below `dir`, `.git` and all, as paths relative to the directory the walk started from */
async function listFiles(fs: GitFs, dir: string, prefix: string): Promise<string[]> {
  const here = prefix === '' ? dir : `${dir}/${prefix}`
  const entries = await readdirOrNothing(fs, here)
  const found: string[] = []
  for (const entry of entries) {
    const filepath = prefix === '' ? entry : `${prefix}/${entry}`
    const stat = await fs.promises.lstat(`${dir}/${filepath}`)
    if (stat.isDirectory()) {
      found.push(...await listFiles(fs, dir, filepath))
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

/** Take `path` away, if it is there to take */
async function unlinkIfThere(fs: GitFs, path: string): Promise<void> {
  try {
    await fs.promises.unlink(path)
  } catch {
    // Already gone: what was wanted.
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
