import _ from 'es-toolkit/compat'
import * as Changes from '../lib/changes'
import * as Huntfiles from '../lib/huntfiles'
import * as Huntgit from '../lib/huntgit'
import * as Tsv from '../lib/tsv'
import { HuntPartkey, WidgetsPartkey, type FedPartT, type HuntReadingT } from './hunt-feed'

/*
 * What a hunt's repository is told of a stretch of work: from the readings it began and ended in
 * (`HuntReadingT`), the files to write, and a message summarising them, a line per quiz.
 */

/** The message of a tab's first commit to a hunt's repository, which starts its history */
export const StartMessage = 'start: the hunt as this browser first read it'

/** The message of a catch-up: a tab's first reading of a hunt whose history is under way */
export const CatchUpMessage = 'catch up: changes made while this browser was away'

/** The message of the commit that takes up a branch, holding the hunt as it stands */
export function takeUpMessage(branch: string): string {
  return `catch up: the hunt as it stands, on taking up branch ${branch}`
}

/**
 * Commit the stretch of work from `baseline` to `latest` to the hunt's repository, on the branch
 * the hunt is on now.
 *
 * Between two readings on the same branch, only what changed between them is written (the dirty
 * files), and the message names it, a line per quiz (`messageFor`). A tab's first reading of the
 * hunt (`latest.first`), or a reading on another branch than its baseline, is written whole, and
 * whatever differs from the branch's tip is committed: the catch-up. Each quiz that could not be
 * read (`latest.unread`) keeps the files the tip has for it, rather than reading as removed.
 *
 * @param fs - Where the repositories live.
 * @param baseline - The hunt as this tab last read it before, or null for never.
 * @param latest - The hunt as it now stands.
 * @returns The new commit's oid, or null when the tip already held it all.
 *
 * @example await commitReading(fs, null, reading)  // the catch-up, or the start of the history
 * @example await commitReading(fs, ante, post)    // => an oid, committing what changed from ante to post
 */
export async function commitReading(fs: Huntgit.GitFs, baseline: HuntReadingT | null, latest: HuntReadingT): Promise<string | null> {
  const { hunt } = latest
  if (baseline && ! latest.first && baseline.hunt.branch === hunt.branch) {
    return await Huntgit.commitFiles(fs, hunt, hunt.branch, Huntfiles.changesBetween(baseline.files, latest.files), messageFor(baseline, latest))
  }
  const unread = latest.unread.values().toArray()
  const keep = (path: string) => unread.some((quiz) => Huntfiles.isQuizFile(path, { realm: quiz.realm, quiz: quiz.label }))
  const message = await wholeMessageFor(fs, baseline, latest)
  return await Huntgit.commitWhole(fs, hunt, hunt.branch, latest.files, { keep, message })
}

/**
 * The message of a commit of the hunt whole: the start of its history; a catch-up; the taking up
 * of a branch; or, for a tab reading afresh a hunt it read before (its feed started over), what
 * moved since that reading, when anything did.
 */
async function wholeMessageFor(fs: Huntgit.GitFs, baseline: HuntReadingT | null, latest: HuntReadingT): Promise<string> {
  if (baseline && baseline.hunt.branch !== latest.hunt.branch) { return takeUpMessage(latest.hunt.branch) }
  if (baseline && summaryLines(baseline, latest).length > 0) { return messageFor(baseline, latest) }
  return await Huntgit.hasHistory(fs, latest.hunt) ? CatchUpMessage : StartMessage
}

/**
 * The commit message for the stretch of work from `baseline` to `latest`: its summary lines
 * (`summaryLines`) joined on one line, cut down to the first and a count once it outruns
 * `Changes.SubjectMax`, with every line listed below it then.
 *
 * @example messageFor(ante, post)  // => 'legends: quiz ~title; paris: louvre ~clueing'
 * @example messageFor(ante, post)  // => 'legends: quiz ~title; +4 more\n\nlegends: quiz ~title\nparis: ...'
 */
export function messageFor(baseline: HuntReadingT, latest: HuntReadingT): string {
  const lines = summaryLines(baseline, latest)
  if (lines.length === 0) { return '~files' }
  const oneline = lines.join('; ')
  if (oneline.length <= Changes.SubjectMax) { return oneline }
  return `${String(lines[0])}; +${String(lines.length - 1)} more\n\n${lines.join('\n')}`
}

/**
 * What moved from `baseline` to `latest`, a line for each part that did: the hunt's own files
 * first (`~hunt ~members`), then each quiz, by label, with `Changes.shorthandLines` for what moved
 * in it and the reviews whose files changed (`legends: quiz ~title, leon ~clueing, reviews +lee_jones`),
 * then the widgets (`widgets ~dumdum`). A quiz arriving or leaving is `+legends` or `-legends`;
 * one arriving that could not be read before is `legends: caught up`; one that cannot be read now
 * has no line, since its files stay as they were. A quiz whose files moved
 * only because what it runs on did (the library, the wheel, the hunt's title) has no line: the
 * line of what it runs on says why.
 *
 * @example summaryLines(ante, post)  // => ['~categories', 'legends: leon ~clueing', 'widgets ~dumdum']
 */
export function summaryLines(baseline: HuntReadingT, latest: HuntReadingT): string[] {
  const huntLine = filesLine(baseline.parts.get(HuntPartkey), latest.parts.get(HuntPartkey), '')
  const widgetsLine = filesLine(baseline.parts.get(WidgetsPartkey), latest.parts.get(WidgetsPartkey), 'widgets ')
  const quizkeys = new Set([...baseline.parts.keys(), ...latest.parts.keys()].filter((partkey) => partkey !== HuntPartkey && partkey !== WidgetsPartkey))
  const quizLines = quizkeys.values()
    .filter((partkey) => ! latest.unread.has(partkey))
    .map((partkey) => quizLine(quizPartOf(baseline, partkey), quizPartOf(latest, partkey), baseline.unread.has(partkey)))
    .filter((line) => line !== null)
    .toArray()
    .toSorted((aa, bb) => Tsv.byCode(aa.label, bb.label))
    .map((line) => line.text)
  return [huntLine, ...quizLines, widgetsLine].filter((line) => line !== null)
}

/** A quiz's part of a reading */
type QuizPartT = Extract<FedPartT, { kind: 'quiz' }>

/** The quiz part keyed `partkey` in `reading`, if it has one */
function quizPartOf(reading: HuntReadingT, partkey: string): QuizPartT | undefined {
  const part = reading.parts.get(partkey)
  return part?.kind === 'quiz' ? part : undefined
}

/** One quiz's line, with the label it sorts by; null when nothing of its own moved */
function quizLine(ante: QuizPartT | undefined, post: QuizPartT | undefined, wasUnread: boolean): { label: string, text: string } | null {
  if (ante === post) { return null }
  if (! post) { return ante ? { label: ante.quiz.label, text: `-${ante.quiz.label}` } : null }
  const { label } = post.quiz
  if (! ante) { return { label, text: wasUnread ? `${label}: caught up` : `+${label}` } }
  const marks = [
    ...Changes.shorthandLines(Changes.quizChanges(ante.quiz, post.quiz)),
    ...reviewsMarks(ante.files, post.files),
  ]
  return marks.length === 0 ? null : { label, text: `${label}: ${marks.join(', ')}` }
}

/** The quiz's reviews whose files moved, as `reviews ~lee_jones +kim_park`; none when none did */
function reviewsMarks(ante: Huntfiles.FilesT, post: Huntfiles.FilesT): string[] {
  const marks = jsonMarks(ante, post, (path) => path.includes('/reviews/'))
  return marks.length === 0 ? [] : [`reviews ${marks.join(' ')}`]
}

/** A line of the files of a hunt-level part or the widgets that moved, after `lead`; null when none did */
function filesLine(ante: FedPartT | undefined, post: FedPartT | undefined, lead: string): string | null {
  if (! post || ante === post) { return null }
  const marks = jsonMarks(ante?.files ?? NoFiles, post.files, () => true)
  return marks.length === 0 ? null : `${lead}${marks.join(' ')}`
}

/**
 * Each JSON file `rule` picks that moved, by the name its file is stemmed with, marked as
 * `Changes.ChangeSigils` mark an entity: `+` new, `-` gone, `~` revised. A file that moved to
 * another path holding the same thing (a review of a quiz since relabelled) has not moved.
 */
function jsonMarks(ante: Huntfiles.FilesT, post: Huntfiles.FilesT, rule: (path: string) => boolean): string[] {
  const { written, removed } = Huntfiles.changesBetween(ante, post)
  const isPicked = (path: string) => path.endsWith('.json') && rule(path)
  const goneFor = new Map(removed.filter((path) => isPicked(path)).map((path) => [stemOf(path), path]))
  const arrived = written.keys().filter((path) => isPicked(path)).toArray()
  const arrivedStems = new Set(arrived.map((path) => stemOf(path)))
  return [
    ...arrived.flatMap((path) => {
      const stem = stemOf(path)
      if (ante.has(path)) { return [`${Changes.ChangeSigils.revised}${stem}`] }
      const was = goneFor.get(stem)
      if (was === undefined) { return [`${Changes.ChangeSigils.added}${stem}`] }
      return _.isEqual(leafOf(was, ante), leafOf(path, post)) ? [] : [`${Changes.ChangeSigils.revised}${stem}`]
    }),
    ...goneFor.keys().filter((stem) => ! arrivedStems.has(stem)).map((stem) => `${Changes.ChangeSigils.dropped}${stem}`),
  ]
}

/**
 * What the jsonball at `path` of `files` holds at its key path: the file's path, less its
 * extensions, is its key path (`Addresses.filepathOf`), so the piece is found apart from where
 * the path puts it.
 */
function leafOf(path: string, files: Huntfiles.FilesT): unknown {
  const parsed: unknown = JSON.parse(files.get(path) ?? 'null')
  const keypath = path.slice(0, path.indexOf('.', path.lastIndexOf('/'))).split('/')
  return _.get(parsed, keypath)
}

/** No files: what a part not yet read holds */
const NoFiles: Huntfiles.FilesT = new Map()

/** The name a file's path is stemmed with: `legends` for `quizzes/home/legends.tqq.json` */
function stemOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return name.slice(0, name.indexOf('.'))
}
