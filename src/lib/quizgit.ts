import * as git from 'isomorphic-git'
import { zipSync } from 'fflate'
import _ from 'es-toolkit/compat'
import Papa from 'papaparse'
import * as Changes from './changes'
import * as Exporting from './exporting'
import * as Expressed from './expressed'
import * as Exposure from './exposure'
import * as Labelmaker from './labelmaker'
import * as UU from './useful'
import type { ExpressionT } from '../models/expression'
import type { QuizT } from '../models/quiz'

/** Where each quiz's repository lives, one directory per quiz, named by the id that never moves */
export const RepoRoot = '/quizzes'

/** Who every commit is attributed to. There are no accounts here, and nothing leaves the browser. */
export const GitAuthor = { name: 'Triquet', email: 'triquet@localhost' } as const

/** The file-name extension of the tab-separated questions file */
export const QuestionsExt = '.qq.tsv'

/** The file-name extension of the whole-quiz JSON file */
export const QuizJsonExt = '.tq.json'

/** Where a quiz sits: its hunt's effective label, and its realm's label. The quiz's own label is on the quiz. */
export type QuizPlace = {
  hunt:  string
  realm: string
}

/**
 * Where inside its repository `quiz`'s two files live: under its hunt and realm, by label, so
 * git can be asked about one realm or one hunt with a path, and a quiz's files move when
 * anything above them is relabelled. The extensions make each file findable by glob: `*.qq.tsv`
 * for questions, `*.tq.json` for whole quizzes.
 *
 * @param quiz - Anything carrying a label.
 * @param place - The hunt and realm it sits in.
 * @returns Repository-relative paths for the questions file and the whole-quiz file.
 *
 * @example quizPathsFor({ label: 'quiet_otter', forced_label: null }, { hunt: 'deep_lake', realm: 'home' }).json
 *   // => 'tq/hunt/deep_lake/realm/home/quiz/quiet_otter.tq.json'
 */
export function quizPathsFor(quiz: Readonly<Labelmaker.Labelled>, place: QuizPlace): { tsv: string, json: string } {
  const label = Labelmaker.effectiveLabelOf(quiz)
  const dir = `tq/hunt/${place.hunt}/realm/${place.realm}/quiz`
  return { tsv: `${dir}/${label}${QuestionsExt}`, json: `${dir}/${label}${QuizJsonExt}` }
}

/**
 * Where the hunt's expressions are kept in every repository of its quizzes: at the hunt's own
 * level, since they belong to it rather than to any one quiz.
 *
 * @example expressionsPathFor({ hunt: 'deep_lake', realm: 'home' })  // => 'tq/hunt/deep_lake/deep_lake.tqexpressions.json'
 */
export function expressionsPathFor(place: QuizPlace): string {
  return `tq/hunt/${place.hunt}/${place.hunt}.tqexpressions.json`
}

/** Where `quiz`'s repository sits. Keyed by id, so renaming a quiz never orphans its history. */
export function repopathFor(quiz: Readonly<Pick<QuizT, '_id'>>): string {
  return `${RepoRoot}/${quiz._id}`
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
 * `quiz`'s table as tab-separated text, a header line first and one line per question after.
 *
 * It has a column for every exposed field of every widget -- the questions' own, the bots',
 * and each expression's value -- alphabetically by widget label and then by field label, and its
 * rows are in order of question label. Neither depends on how the author has arranged the grid
 * or the quiz, so a commit's diff of it shows what changed and nothing else. Quoting is Papa
 * Parse's, so a tab, a quote or a line break inside a field cannot break the row it sits in.
 *
 * @param quiz - The quiz as it now stands.
 * @param expressed - What its expressing widgets came to, from `Expressed.forQuiz`.
 * @returns The text, ending in a newline.
 *
 * @example questionsTsv(quiz, expressed).split('\n')[0]  // => 'clueing_full.value\t...\tquestion.alt_text\t...'
 */
export function questionsTsv(quiz: QuizT, expressed: Expressed.ExpressedForQuiz): string {
  const { header, rows } = Exposure.tableOf(quiz, expressed)
  const text = Papa.unparse({ fields: header, data: rows }, { delimiter: '\t', newline: '\n' })
  return `${_.trimEnd(text, '\n')}\n`
}

/**
 * The whole working tree for `quiz`: a legible table of its questions, a complete JSON file, and
 * the hunt's expressions, moving together in one commit.
 *
 * The `.qq.tsv` is what a commit reads as -- a line per question, so a diff is legible to anyone.
 * It is also lossy, so the `.tq.json` beside it carries the whole quiz as a smith is handed it
 * (by label, without ids), and is what could restore one from its own history through Import.
 * The expressions its widgets work are in the hunt's own file.
 * All are written in a fixed order (sorted keys for the JSON), because a diff that shuffles its
 * lines for no reason is a diff nobody reads.
 *
 * Renaming the quiz, or its realm or hunt, moves its files, which git reads as a rename rather
 * than as a loss.
 *
 * @param quiz - The quiz as it now stands.
 * @param expressions - The hunt's expressions.
 * @param place - The hunt and realm it sits in.
 * @returns Every file the repository should hold, and nothing else, by repository-relative path.
 *
 * @example quizFiles(quiz, expressions).keys().toArray()  // => [the .qq.tsv path, the .tq.json path, the expressions path]
 */
export function quizFiles(quiz: QuizT, expressions: readonly ExpressionT[], place: QuizPlace): Map<string, string> {
  const paths = quizPathsFor(quiz, place)
  return new Map([
    [paths.tsv, questionsTsv(quiz, Expressed.forQuiz(quiz, expressions))],
    [paths.json, `${UU.jsonify(Exporting.quizExported(quiz), { pretty: true })}\n`],
    [expressionsPathFor(place), `${UU.jsonify(expressions, { pretty: true })}\n`],
  ])
}

/**
 * The tag a milestone leaves behind: the version it was marked on, and when.
 *
 * The moment is the UTC time as fourteen digits and a `z`, with none of ISO's punctuation -- git
 * forbids a colon in a ref name, and digits alone sort chronologically as plain text.
 *
 * @param version - The quiz's version, which is also its branch.
 * @param at - The moment being stamped.
 * @returns A valid, sortable tag name.
 *
 * @example milestoneTagFor('main', new Date('2026-09-18T18:45:04.123Z'))  // => 'main-m-20260918184504z'
 */
export function milestoneTagFor(version: string, at: Date): string {
  return `${version}-m-${tagStampOf(at)}z`
}

/** `at` to the second in UTC, digits only, so tags sort as text in the order their moments happened */
function tagStampOf(at: Date): string {
  return at.toISOString().slice(0, 19).replaceAll(/\D/g, '')
}

/**
 * Open `quiz`'s history with its present state, unless it already has one.
 *
 * What makes a quiz's history start at its creation rather than at its first edit: a quiz this
 * browser has never committed is committed as it stands. Safe to ask twice, or to ask of a quiz
 * whose history is under way, because it then does nothing.
 *
 * @param fs - Where the repositories live.
 * @param quiz - The quiz as it now stands.
 * @param expressions - The hunt's expressions, kept in the same commit.
 * @param place - The hunt and realm it sits in.
 * @returns The new commit's oid, or null when the quiz's branch already had commits.
 *
 * @example await commitFirst(fs, quiz, expressions, { hunt: 'deep_lake', realm: 'home' })
 */
export async function commitFirst(fs: GitFs, quiz: QuizT, expressions: readonly ExpressionT[], place: QuizPlace): Promise<string | null> {
  const dir = repopathFor(quiz)
  await openRepo(fs, dir, quiz.version)
  if (await hasCommits(fs, dir)) { return null }
  return await commitQuiz(fs, quiz, expressions, place, Changes.quizChanges(null, quiz))
}

/** The sweeping changes the history brackets with commits and tags: an import merged in, questions deleted */
export const MarkkindVals = ['import', 'delete'] as const
export type Markkind = typeof MarkkindVals[number]

/**
 * The tag a sweeping change leaves behind: the version it landed on, what it was, and when.
 *
 * Stamped as a milestone's is, so they all sort together by time; the markkind in place of `m`
 * is what tells them apart in a list of tags.
 *
 * @param version - The quiz's version, which is also its branch.
 * @param markkind - What the change was.
 * @param at - The moment being stamped.
 * @returns A valid, sortable tag name.
 *
 * @example markTagFor('main', 'import', new Date('2026-09-18T18:45:04.123Z'))  // => 'main-import-20260918184504z'
 * @example markTagFor('main', 'delete', new Date('2026-09-18T18:45:04.123Z'))  // => 'main-delete-20260918184504z'
 */
export function markTagFor(version: string, markkind: Markkind, at: Date): string {
  return `${version}-${markkind}-${tagStampOf(at)}z`
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
 * @param expressions - The hunt's expressions, kept in the same commit.
 * @param place - The hunt and realm it sits in.
 * @param changes - What moved, as `Changes.quizChanges` and `Changes.expressionChanges` reported it.
 * @returns The new commit's oid, or null when nothing changed and nothing was committed.
 *
 * The commit message is the shorthand alone. The quiz itself is in the tree, and a body that
 * repeated it would only be a second copy to drift.
 *
 * @example await commitQuiz(fs, quiz, expressions, place, quizChanges(before, quiz))
 */
export async function commitQuiz(fs: GitFs, quiz: QuizT, expressions: readonly ExpressionT[], place: QuizPlace, changes: readonly Changes.Change[]): Promise<string | null> {
  const message = Changes.shorthandFor(changes)
  if (message === null) { return null }

  const dir = repopathFor(quiz)
  await openRepo(fs, dir, quiz.version)
  const { written, removed } = await syncTree(fs, dir, quizFiles(quiz, expressions, place))

  for (const filepath of written) { await git.add({ fs, dir, filepath }) }
  for (const filepath of removed) { await git.remove({ fs, dir, filepath }) }
  return await git.commit({ fs, dir, message, author: { ...GitAuthor } })
}

/**
 * Mark a milestone: tag `quiz`'s current commit as a moment worth coming back to.
 *
 * A version with no commits behind it yet has nothing to point a tag at, and says so rather than
 * failing: an author can reach this by marking a quiz whose history this browser has never held.
 *
 * @param fs - Where the repositories live.
 * @param quiz - The quiz being marked.
 * @param at - The moment to stamp; now, when omitted.
 * @returns The tag left behind, disambiguated when that second already has one, or null when there was nothing to tag.
 *
 * @example await milestoneQuiz(fs, quiz)  // => 'main-m-20260918184504z'
 */
export async function milestoneQuiz(fs: GitFs, quiz: QuizT, at: Date = new Date()): Promise<string | null> {
  return await tagHead(fs, quiz, milestoneTagFor(quiz.version, at))
}

/**
 * Mark a sweeping change: tag `quiz`'s current commit as the one the change just landed in.
 *
 * The caller commits the quiz as it stood before the change, and as it stood after, so the tag
 * sits on the second of those and the first is the commit before it.
 *
 * @param fs - Where the repositories live.
 * @param quiz - The quiz the change was made to.
 * @param markkind - What the change was.
 * @param at - The moment to stamp; now, when omitted.
 * @returns The tag left behind, disambiguated when that second already has one, or null when there was nothing to tag.
 *
 * @example await markChange(fs, quiz, 'import')  // => 'main-import-20260918184504z'
 */
export async function markChange(fs: GitFs, quiz: QuizT, markkind: Markkind, at: Date = new Date()): Promise<string | null> {
  return await tagHead(fs, quiz, markTagFor(quiz.version, markkind, at))
}

/** Tag the current commit `wanted`, or the first numbered variation of it that is free; null when there is no commit */
async function tagHead(fs: GitFs, quiz: QuizT, wanted: string): Promise<string | null> {
  const dir = repopathFor(quiz)
  await openRepo(fs, dir, quiz.version)
  if (! await hasCommits(fs, dir)) { return null }
  const taken = new Set(await git.listTags({ fs, dir }))
  const ref = untakenTag(wanted, taken)
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

/** One quiz repository as it stands on disk, whether or not any quiz still answers to it */
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
 * Every quiz repository the filesystem holds, newest work first.
 *
 * Independent of the database on purpose: a deleted quiz leaves its repository behind, and this
 * is where it can still be found. A directory that is not a repository is left out.
 *
 * @param fs - Where the repositories live.
 * @returns One summary per repository; empty when there are none.
 *
 * @example (await listRepos(fs)).map((repo) => repo.label)  // => ['quiet_otter']
 */
export async function listRepos(fs: GitFs): Promise<RepoSummary[]> {
  const ids = await readdirOrNothing(fs, RepoRoot)
  const found: RepoSummary[] = []
  for (const id of ids) {
    const summary = await summarizeRepo(fs, id)
    if (summary) { found.push(summary) }
  }
  return _.orderBy(found, [(repo) => repo.committed_at ?? 0], ['desc'])
}

/** `id`'s repository in brief, or null when the directory is not a repository */
async function summarizeRepo(fs: GitFs, id: string): Promise<RepoSummary | null> {
  const dir = `${RepoRoot}/${id}`
  try {
    const branch = (await git.currentBranch({ fs, dir })) ?? null
    if (! await hasCommits(fs, dir)) { return { id, label: null, branch, message: null, committed_at: null } }
    const [latest] = await git.log({ fs, dir, depth: 1 })
    const filepaths = await git.listFiles({ fs, dir, ref: 'HEAD' })
    return {
      id, branch,
      label:        quizLabelIn(filepaths),
      message:      latest?.commit.message.trim() ?? null,
      committed_at: latest ? latest.commit.committer.timestamp * 1000 : null,
    }
  } catch {
    return null
  }
}

/** The quiz label the whole-quiz file among `filepaths` is named for; null when there is none */
function quizLabelIn(filepaths: readonly string[]): string | null {
  const json = filepaths.find((filepath) => filepath.endsWith(QuizJsonExt))
  return json === undefined ? null : json.slice(json.lastIndexOf('/') + 1, -QuizJsonExt.length)
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
