/**
 * Ties Claude Code sessions to branches and pull requests, from the transcripts Claude Code keeps
 * (`~/.claude/projects/<project>/<session>.jsonl`, and a sprint's workers beside them in
 * `<session>/subagents/`). Give it a branch (its label, or its whole name) or a PR number, and it
 * lists the sessions that worked on it, the likeliest first, under the title the sidebar shows.
 *
 * Three ways to print them. `--rename`, the default, prints the `/rename` that would name a session
 * for the PRs it linked and the worktrees it cut, each in the order it met them (`/rename #93 #97
 * e2e_practices git_attic | PR merge and deploy order`): paste it into that session. Run inside a
 * session and asked nothing, it names that session (`$CLAUDE_CODE_SESSION_ID`); otherwise it names
 * every session it finds, a line each, newest first. `--table` prints a table: asked
 * nothing, every session, newest first, with the PRs and worktrees it touched; asked a branch or
 * PR, the evidence for each. `--json` prints everything it knows.
 *
 *   node scripts/session-branches.ts                          this session's /rename (outside one: every session's)
 *   node scripts/session-branches.ts userlabel                the /rename of each session that worked on 20261005-userlabel
 *   node scripts/session-branches.ts --table                  every session, newest first
 *   node scripts/session-branches.ts --table 20261005-userlabel 132   the evidence for a branch and a PR number, together
 *   node scripts/session-branches.ts --json 116               the same, as JSON
 *
 * What counts as evidence, strongest first:
 *   - `titled`    the session's title names it: someone renamed the session for its branch;
 *   - `PR`        the session linked that pull request (Claude Code records the link when a
 *                 session opens, or works on, a PR);
 *   - `worktree`  it cut or entered a worktree of that label (`pnpm worktree <label>`, a path
 *                 under `worktrees/triquet/<label>`);
 *   - `checkout`  its working directory stood on that branch. Weak: the main checkout is
 *                 switched to each branch that lands, whoever landed it;
 *   - `mentions`  how many transcript lines name it. Weakest.
 *
 * It reads only this machine's transcripts. A sandbox container keeps its own, so run it in each
 * (and on the Mac, where `--projects` is not needed): a session whose transcript is elsewhere
 * cannot be found from here. Names a session by what `/rename` set, else what Claude titled it.
 *
 * Options: `--rename`, `--table`, `--json` (one of them), `--projects <dir>` (default `$CLAUDE_CONFIG_DIR/projects`, else `~/.claude/projects`),
 * `--all-projects` (every project there, not only those whose directory names `triquet`).
 * `notes/housekeeping.md`, *Finding the session that owns a branch*, has the rest.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
// What `UU.jsonify` wraps: Node cannot follow the app's extensionless imports to reach it.
import stringify from 'safe-stable-stringify'
import { z } from 'zod'

/** The fields of a transcript line this script reads. A line holds many more, and each is allowed to be missing or odd */
const TranscriptLine = z.looseObject({
  type:        z.string().optional().catch(undefined),
  timestamp:   z.string().optional().catch(undefined),
  gitBranch:   z.string().optional().catch(undefined),
  customTitle: z.string().optional().catch(undefined),
  aiTitle:     z.string().optional().catch(undefined),
  prNumber:    z.number().optional().catch(undefined),
})

/** What was asked about: a branch's label, or a pull request's number */
export interface Term {
  /** As the person typed it, less any `#` */
  text:    string
  /** The branch's label, or null for a PR number */
  label:   string | null
  /** The PR's number, or null for a branch */
  pr:      number | null
  /** Finds the term in a line of transcript text */
  pattern: RegExp
}

/** How a session bears on one term */
export interface Evidence {
  /** The term, as a column heading would have it: a branch's label, or `#` and a PR's number */
  term:      string
  /** The session's title names this term */
  titled:    boolean
  /** The session linked this PR */
  linked:    boolean
  /** The session cut or entered a worktree of this label */
  worktree:  boolean
  /** Lines that put the session's working directory on this branch */
  checkout:  number
  /** Lines of the session's transcripts (workers' included) that name the term */
  mentions:  number
}

/** One session, as far as its transcripts tell */
export interface SessionFacts {
  /** Claude Code's id for the session: its transcript's file name */
  id:         string
  /** What `/rename` set, else what Claude titled it, else `(untitled)` */
  title:      string
  /** ISO time of the session's last line; its file's mtime when no line carried one */
  lastActive: string
  /** PR numbers the session linked, ascending */
  prs:        number[]
  /** Labels of the worktrees it cut or entered, sorted */
  worktrees:  string[]
  /** Those worktrees' labels and the PRs it linked (as `#116`), in the order it first met each */
  seen:       string[]
  /** Evidence for each term asked about, in the order asked; empty when none was */
  evidence:   Evidence[]
}

/** What the session accumulates while its lines are read */
interface Tally {
  customTitle: string | null
  aiTitle:     string | null
  lastSeen:    string | null
  prs:         Set<number>
  worktrees:   Set<string>
  seen:        Set<string>
  asked:       { term: Term, evidence: Evidence }[]
}

/** The label that follows `pnpm worktree`, or a worktrees directory, in transcript text */
const WorktreeLabelPattern = /(?:worktrees\/(?:triquet\/)?|pnpm worktree )([a-z][a-z0-9_]+)/g

/** A branch is `YYYYMMDD-<label>` */
const DatestampPattern = /^\d{8}-/

/** A label as the app makes them (`Labelmaker`): lowercase, digits and single underscores */
const LabelPattern = /^[a-z][a-z0-9_]*$/

/**
 * What a command-line argument asks about.
 *
 * @param arg - A branch name (`20261005-userlabel`), a bare label (`userlabel`), or a PR number
 *   with or without its `#` (`116`, `#116`).
 * @returns The term. A branch's datestamp comes off, so either spelling finds the same sessions.
 * @throws When the argument is neither a label nor a number.
 *
 * @example termOf('#116')               // => { text: '116', label: null, pr: 116, ... }
 * @example termOf('20261005-userlabel') // => { text: 'userlabel', label: 'userlabel', pr: null, ... }
 */
export function termOf(arg: string): Term {
  const bare = arg.trim().replace(/^#/, '')
  if (/^\d+$/.test(bare)) {
    return { text: bare, label: null, pr: Number(bare), pattern: new RegExp(String.raw`(?:#|/pull/|\bPR )${bare}(?!\d)`) }
  }
  const label = bare.replace(DatestampPattern, '')
  if (! LabelPattern.test(label)) {
    throw new Error(`"${arg}" is neither a branch label (lowercase letters, digits, underscores) nor a PR number`)
  }
  return { text: label, label, pr: null, pattern: new RegExp(String.raw`(?<![\w-])(?:\d{8}-)?${label}(?!\w)`) }
}

/** The heading a term goes by: a branch's label, or a PR's number after a `#` */
const headingOf = (term: Term): string => (term.pr === null ? term.text : `#${term.text}`)

/** Whether a branch is the term's: its label, with or without its datestamp */
const isBranchOf = (term: Term, branch: string): boolean => (
  term.label !== null && branch.replace(DatestampPattern, '') === term.label
)

/** The fields of a transcript line this script reads, or null for a line that is not JSON or not an object */
function parseLine(line: string): z.infer<typeof TranscriptLine> | null {
  try {
    const entry = TranscriptLine.safeParse(JSON.parse(line))
    return entry.success ? entry.data : null
  } catch {
    return null
  }
}

/** Adds what a line says about one term to the evidence for it */
function noteTerm(term: Term, evidence: Evidence, line: string, entry: z.infer<typeof TranscriptLine> | null, labels: readonly string[]): void {
  if (term.pattern.test(line)) { evidence.mentions += 1 }
  if (term.label !== null && labels.includes(term.label)) { evidence.worktree = true }
  if (entry?.gitBranch !== undefined && isBranchOf(term, entry.gitBranch)) { evidence.checkout += 1 }
  if (term.pr !== null && entry?.type === 'pr-link' && entry.prNumber === term.pr) { evidence.linked = true }
}

/** Adds what a line says of the session itself: when, the PRs it linked, its titles */
function noteSession(entry: z.infer<typeof TranscriptLine>, isMain: boolean, tally: Tally): void {
  if (entry.timestamp !== undefined && (tally.lastSeen === null || entry.timestamp > tally.lastSeen)) { tally.lastSeen = entry.timestamp }
  if (entry.type === 'pr-link' && entry.prNumber !== undefined) {
    tally.prs.add(entry.prNumber)
    tally.seen.add(`#${String(entry.prNumber)}`)
  }
  if (isMain && entry.customTitle !== undefined) { tally.customTitle = entry.customTitle }
  if (isMain && entry.aiTitle !== undefined) { tally.aiTitle = entry.aiTitle }
}

/** Adds one transcript line to what the session has accumulated */
function read(line: string, isMain: boolean, tally: Tally): void {
  if (line.trim() === '') { return }
  const entry = parseLine(line)
  const labels = line.matchAll(WorktreeLabelPattern).map((match) => match[1] ?? '').filter((label) => label !== '' && label !== 'triquet').toArray()
  for (const label of labels) {
    tally.worktrees.add(label)
    tally.seen.add(label)
  }
  for (const { term, evidence } of tally.asked) { noteTerm(term, evidence, line, entry, labels) }
  if (entry !== null) { noteSession(entry, isMain, tally) }
}

/**
 * What one session's transcripts say about it.
 *
 * @param id - The session's id.
 * @param files - Its transcript's lines (the session's own, then its workers').
 * @param terms - What is being asked about, if anything.
 * @param mtime - When the transcript was last written: the answer for `lastActive` when no line says.
 * @returns The session's facts; `evidence` has one entry per term.
 */
export function factsOf(
  id: string,
  files: readonly { lines: Iterable<string>, isMain: boolean }[],
  terms: readonly Term[],
  mtime: Date,
): SessionFacts {
  const asked = terms.map((term) => ({ term, evidence: { term: headingOf(term), titled: false, linked: false, worktree: false, checkout: 0, mentions: 0 } }))
  const tally: Tally = { customTitle: null, aiTitle: null, lastSeen: null, prs: new Set(), worktrees: new Set(), seen: new Set(), asked }
  for (const file of files) {
    for (const line of file.lines) { read(line, file.isMain, tally) }
  }
  const title = tally.customTitle ?? tally.aiTitle ?? '(untitled)'
  for (const { term, evidence } of tally.asked) { evidence.titled = term.pattern.test(title) }
  return {
    id,
    title,
    lastActive: tally.lastSeen ?? mtime.toISOString(),
    prs:        [...tally.prs].toSorted((left, right) => left - right),
    worktrees:  [...tally.worktrees].toSorted((left, right) => left.localeCompare(right)),
    seen:       [...tally.seen],
    evidence:   tally.asked.map((each) => each.evidence),
  }
}

/** The files of one session under a project directory: its own transcript, and its workers' */
interface SessionFiles {
  id:      string
  main:    string | null
  workers: string[]
}

/** Every session under one project directory, by id, with the files that hold it */
function filesOf(projectdir: string): SessionFiles[] {
  const byId = new Map<string, SessionFiles>()
  const sessionOf = (id: string): SessionFiles => {
    const known = byId.get(id) ?? { id, main: null, workers: [] }
    byId.set(id, known)
    return known
  }
  const entries = fs.readdirSync(projectdir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      sessionOf(path.basename(entry.name, '.jsonl')).main = path.join(projectdir, entry.name)
    } else if (entry.isDirectory()) {
      const subdir = path.join(projectdir, entry.name, 'subagents')
      if (! fs.existsSync(subdir)) { continue }
      sessionOf(entry.name).workers.push(
        ...fs.readdirSync(subdir).filter((file) => file.endsWith('.jsonl')).map((file) => path.join(subdir, file)),
      )
    }
  }
  return byId.values().toArray()
}

/** Whether a session has anything to say about any term */
export const isEvidence = (evidence: Evidence): boolean => (
  evidence.titled || evidence.linked || evidence.worktree || evidence.checkout > 0 || evidence.mentions > 0
)

/** Newest first */
const byRecency = (left: SessionFacts, right: SessionFacts): number => right.lastActive.localeCompare(left.lastActive)

/** What a session shows of one kind of evidence, over all the terms asked about */
type EvidencePick = (evidence: Evidence) => number

/** The kinds of evidence, strongest first: a title, a link, a worktree, then the checkout's lines, then mentions */
const Picks: EvidencePick[] = [
  (evidence) => Number(evidence.titled),
  (evidence) => Number(evidence.linked),
  (evidence) => Number(evidence.worktree),
  (evidence) => evidence.checkout,
  (evidence) => evidence.mentions,
]

/** The sessions with the strongest evidence first, then the newest */
function byStrength(left: SessionFacts, right: SessionFacts): number {
  for (const pick of Picks) {
    const gap = Math.max(0, ...right.evidence.map((each) => pick(each))) - Math.max(0, ...left.evidence.map((each) => pick(each)))
    if (gap !== 0) { return gap }
  }
  return byRecency(left, right)
}

/**
 * Every session under `projectsdir`, read for what it says about `terms`.
 *
 * @param projectsdir - Claude Code's projects directory (`~/.claude/projects`).
 * @param terms - What is being asked about. With none, every session is returned, newest first;
 *   with some, only the sessions with evidence, the strongest first.
 * @param opts - `onlyProjects`: keep the project directories whose names contain this (`triquet`);
 *   null keeps all.
 * @returns The sessions' facts.
 */
export function sessionsIn(
  projectsdir: string,
  terms: readonly Term[],
  opts: { onlyProjects: string | null },
): SessionFacts[] {
  const linesOf = (file: string): string[] => fs.readFileSync(file, 'utf8').split('\n')
  const found = fs.readdirSync(projectsdir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (opts.onlyProjects === null || entry.name.includes(opts.onlyProjects)))
    .flatMap((entry) => filesOf(path.join(projectsdir, entry.name)))
    .map((session) => factsOf(
      session.id,
      [
        ...(session.main === null ? [] : [{ lines: linesOf(session.main), isMain: true }]),
        ...session.workers.map((worker) => ({ lines: linesOf(worker), isMain: false })),
      ],
      terms,
      session.main === null ? new Date(0) : fs.statSync(session.main).mtime,
    ))
  if (terms.length === 0) { return found.toSorted(byRecency) }
  return found.filter((session) => session.evidence.some((each) => isEvidence(each))).toSorted(byStrength)
}

/** What the evidence for one term comes to, in words: `titled, PR linked, worktree, checkout 164x, mentioned 203x` */
export function describeEvidence(evidence: Evidence): string {
  return [
    evidence.titled ? 'titled' : null,
    evidence.linked ? 'PR linked' : null,
    evidence.worktree ? 'worktree' : null,
    evidence.checkout > 0 ? `checkout ${String(evidence.checkout)}x` : null,
    evidence.mentions > 0 ? `mentioned ${String(evidence.mentions)}x` : null,
  ].filter((part) => part !== null).join(', ')
}

/** A session's row in a printed table */
function rowOf(session: SessionFacts): Record<string, string> {
  const row: Record<string, string> = {
    session: session.id.slice(0, 8),
    active:  session.lastActive.slice(0, 16).replace('T', ' '),
    title:   session.title,
  }
  if (session.evidence.length === 0) {
    row.prs = session.prs.map((pr) => `#${String(pr)}`).join(' ')
    row.worktrees = session.worktrees.join(' ')
    return row
  }
  for (const each of session.evidence) { row[each.term] = describeEvidence(each) }
  return row
}

/**
 * Rows as plain aligned text: a header, then a line each, columns two spaces apart.
 *
 * @param rows - Rows that share their keys, which head the columns.
 * @returns The lines, without a trailing newline; empty when there are no rows.
 *
 * @example tableOf([{ id: 'a1', title: 'Hi' }, { id: 'b22', title: 'There' }])
 * // => 'id   title\na1   Hi\nb22  There'
 */
export function tableOf(rows: readonly Record<string, string>[]): string {
  if (rows.length === 0) { return '' }
  const heads = Object.keys(rows[0] ?? {})
  const widths = heads.map((head) => Math.max(head.length, ...rows.map((row) => (row[head] ?? '').length)))
  const lineOf = (cells: readonly string[]): string => (
    cells.map((cell, idx) => cell.padEnd(widths[idx] ?? 0)).join('  ').trimEnd()
  )
  return [lineOf(heads), ...rows.map((row) => lineOf(heads.map((head) => row[head] ?? '')))].join('\n')
}

/** The longest name `renameOf` gives a session */
export const MaxNameLength = 250

/** What separates the worktrees and PRs in a session's name from the title it had */
const NameSeparator = ' | '

/**
 * The `/rename` that names a session for the worktrees and PRs it touched, and keeps its title.
 *
 * The PRs come first, then the worktrees, each in the order the session first met it, the two set
 * apart by an extra space. Then ` | `, and the title the session had, with nothing wrapped round it: the whole of it, or only what follows the ` | ` when it has one already,
 * so naming a session twice does not stack the names. No dates or times. Past
 * `MaxNameLength` characters the name is cut short, ending in `…`.
 *
 * @param session - The session's facts.
 * @returns The command, or null when the session has touched no worktree or PR to name it for.
 *
 * @example renameOf({ seen: ['e2e_practices', '#93', 'git_attic', '#97'], title: 'PR merge', ... })
 * // => '/rename #93 #97  e2e_practices git_attic | PR merge'
 */
export function renameOf(session: Pick<SessionFacts, 'seen' | 'title'>): string | null {
  if (session.seen.length === 0) { return null }
  const prs = session.seen.filter((token) => token.startsWith('#')).join(' ')
  const worktrees = session.seen.filter((token) => ! token.startsWith('#')).join(' ')
  const groups = [prs, worktrees].filter((group) => group !== '').join('  ')
  const separated = session.title.indexOf(NameSeparator)
  const title = separated === -1 ? session.title : session.title.slice(separated + NameSeparator.length)
  const name = title === '(untitled)' ? groups : `${groups}${NameSeparator}${title}`
  const fitted = name.length > MaxNameLength ? `${name.slice(0, MaxNameLength - 1)}…` : name
  return `/rename ${fitted}`
}

/** Claude Code's projects directory: where `CLAUDE_CONFIG_DIR` points, else `~/.claude` */
export function defaultProjectsDir(env: Readonly<Record<string, string | undefined>>): string {
  return path.join(env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects')
}

/** The sessions to name: the one this is run in when nothing is asked, else every session found */
function sessionsToName(sessions: readonly SessionFacts[], terms: readonly Term[], env: Readonly<Record<string, string | undefined>>): SessionFacts[] {
  const own = env.CLAUDE_CODE_SESSION_ID
  if (own === undefined || own === '' || terms.length > 0) { return sessions.filter((session) => session.seen.length > 0) }
  const found = sessions.find((session) => session.id === own)
  if (found === undefined) { throw new Error(`No transcript of this session (${own}) under the projects directory`) }
  return found.seen.length > 0 ? [found] : []
}

/** Runs the command line: prints the names, the table, or JSON */
function main(argv: string[], env: Readonly<Record<string, string | undefined>>): void {
  const { values, positionals } = parseArgs({
    args:    argv,
    options: {
      rename:          { type: 'boolean', default: false },
      table:           { type: 'boolean', default: false },
      json:            { type: 'boolean', default: false },
      projects:        { type: 'string' },
      'all-projects':  { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })
  if ([values.rename, values.table, values.json].filter(Boolean).length > 1) {
    throw new Error('Choose one of --rename (the default), --table and --json')
  }
  const terms = positionals.map((arg) => termOf(arg))
  const projectsdir = values.projects ?? defaultProjectsDir(env)
  if (! fs.existsSync(projectsdir)) {
    throw new Error(`No transcripts at ${projectsdir}: this machine has run no Claude Code session (or --projects is wrong)`)
  }
  const sessions = sessionsIn(projectsdir, terms, { onlyProjects: values['all-projects'] ? null : 'triquet' })
  if (values.json) {
    process.stdout.write(`${stringify({ terms: terms.map((term) => term.text), sessions }, null, 2) ?? 'null'}\n`)
    return
  }
  if (sessions.length === 0) {
    process.stdout.write(`No session here mentions ${terms.map((term) => term.text).join(', ')}. Its transcript may be on another machine.\n`)
    return
  }
  if (values.table) {
    process.stdout.write(`${tableOf(sessions.map((session) => rowOf(session)))}\n`)
    return
  }
  const named = sessionsToName(sessions, terms, env)
  if (named.length === 0) {
    process.stdout.write('Nothing to name: no worktree cut and no PR linked.\n')
    return
  }
  for (const session of named) { process.stdout.write(`${renameOf(session) ?? ''}\n`) }
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2), process.env)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
