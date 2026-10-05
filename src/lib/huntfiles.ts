import * as EST from 'es-toolkit'
import * as Addresses from './addresses'
import * as Exporting from './exporting'
import type * as Jsonball from './jsonball'
import * as Tsv from './tsv'
import * as UU from './useful'

/**
 * The files a hunt's repository holds, as text by path: each resource of the hunt once, as its
 * jsonball (`Exporting`) and as a table beside it (`Tsv`), at the path its address names
 * (`Addresses.filepathOf`), and a README saying how to read them.
 *
 * Every body is made from its resource alone, and the same resource always writes the same bytes
 * (keys sorted, rows and columns sorted, a newline at the end), so a resource that has not
 * changed writes files identical to the ones it wrote before, and a commit of the files that
 * differ is a commit of what changed.
 */

/** Every file of a repository, or some of them: each body by its path */
export type FilesT = Map<string, string>

/** Where the README sits: at the root, beside the hunt's own file */
export const ReadmePath = 'README.md'

/**
 * The shell line that merges every jsonball of the repository a merge reads (every
 * `Addresses.MergedPathspec` file, the questions alone not among them) into the hunt whole, as
 * Raw Export emits it. It wants `jq`, and is run at the repository's root.
 */
export const MergeCommand = `jq -s 'reduce .[] as $ball ({}; . * $ball)' $(git ls-files '${Addresses.MergedPathspec}')`

/** A resource of the README's table, with placeholders standing in for its labels */
const Sample = { org: '<org>', hunt: '<hunt>', realm: '<realm>', quiz: '<quiz>' } as const

/** The README's example of a quiz */
const Legends: Addresses.FiledAddressT = { kind: 'quiz', org: 'pat_smith', hunt: 'spring_hunt', realm: 'home', quiz: 'legends' }

/** Each kind of file, by the path its sample takes, and what it holds */
const ReadmeRows: readonly [Addresses.FiledAddressT, string][] = [
  [{ kind: 'hunt', ...Sample },                                'The hunt\'s own fields: its label, title and branch.'],
  [{ kind: 'categories', ...Sample },                          'Every subject category, with the slot of the wheel it holds (none for one in the pool).'],
  [{ kind: 'members', ...Sample },                             'Who is on the hunt, by their label, with their role.'],
  [{ kind: 'quiz', ...Sample },                                'One quiz, whole: its own fields, its questions, its widgetings and its columns.'],
  [{ kind: 'questions', ...Sample },                           'The same quiz\'s questions alone, to paste into any quiz\'s Import. Not merged.'],
  [{ kind: 'review', ...Sample, reviewer: '<reviewer>' },      'One shared review of the quiz: its overall view, and a verdict on each question.'],
  [{ kind: 'widget', scope: 'pub', widget: '<widget>' },       'A widget of the library the hunt\'s quizzes work.'],
]

/**
 * The README a hunt's repository opens with: what it is, what each file holds, and the line that
 * merges its jsonballs. The same for every hunt, and never changed by one.
 */
export const Readme = `# A Triquet hunt

This repository is the history of one hunt, written by Triquet as its smiths worked on it: a
commit for each stretch of work, and a tag for each milestone. Triquet keeps the hunt itself;
this is a copy you can read, diff and keep.

Each thing the hunt holds is written once, at the path its address in Triquet names, in two
formats: a \`.json\` file holding all of it, and a \`.tsv\` table beside it, with the same name, for
reading and diffing. Everything is named by its label.

| File | What it holds |
|---|---|
${ReadmeRows.map(([address, holds]) => `| \`${Addresses.filepathOf(address)}\` | ${holds} |`).join('\n')}

## The JSON

Every \`.json\` file but the questions alone is a piece of the hunt nested under the keys that
lead to it: \`${Addresses.filepathOf(Legends)}\` holds its quiz under \`${Addresses.keypathOf(Legends).join('.')}\`.
No two hold the same thing, and every collection is an object keyed by label, never a list, so
merging them all gives the hunt whole, at any commit:

    ${MergeCommand}

Where a collection's order matters (a quiz's questions, widgetings and columns; the wheel's
slots; the library) each member carries its \`position\`.

## The tables

Every \`.tsv\` reads the same way: a header line of column names, sorted, then a line per row,
sorted by \`label\`. A collection is a row per member; a single thing (the hunt, a quiz, a widget)
is one row. A nested field's column is named by its path (\`widgetings.dumdum.position\`). A tab,
line break or backslash inside a cell is written \`\\t\`, \`\\n\` or \`\\\\\`, so one line is always one
row. A quiz's table leaves its questions to the questions' own, and a review's is a row per
question it gave a verdict on.
`

/**
 * One resource's jsonball as its file holds it: pretty, keys sorted, ending in a newline.
 *
 * @example jsonOf(Exporting.huntBall(place, hunt))  // => '{\n  "branch": "main",\n  "label": "spring_hunt",\n  "title": "Spring Hunt"\n}\n'
 */
export function jsonOf(placed: Exporting.PlacedBallT): string {
  return `${UU.jsonify(placed.ball, { pretty: true })}\n`
}

/**
 * One resource's table: a row per member of a collection (its categories, its members, a quiz's
 * questions alone, a review's verdicts by question), or one row of a single thing (the hunt, a
 * quiz with its questions left to their own table, a widget), labelled as its address labels it.
 *
 * @example tsvOf(Exporting.membersBall(place, members))  // => 'label\trole\ttitle\npat_smith\tsmith\tPat\n'
 */
export function tsvOf(placed: Exporting.PlacedBallT): string {
  return Tsv.textOf(recordsOf(placed))
}

/** The rows of one resource's table */
function recordsOf({ address, body }: Exporting.PlacedBallT): Tsv.RecordT[] {
  switch (address.kind) {
  case 'hunt':       { return [{ ...body, label: address.hunt }] }
  case 'categories':
  case 'members':
  case 'questions':  { return Tsv.recordsOf(body as Readonly<Record<string, Jsonball.JsonballT>>) }
  case 'quiz':       { return [{ ...EST.omit(body as Jsonball.QuizBodyT, ['questions']), label: address.quiz }] }
  case 'review':     { return Tsv.recordsOf((body as Jsonball.ReviewBodyT).verdicts) }
  case 'widget':     { return [{ ...body, label: address.widget }] }
  }
}

/**
 * The files of the resources `placed`, each as its jsonball and its table, by path: what a
 * repository holds of them, made from them alone. Hand it one resource's ball, or one quiz's
 * (`Exporting.quizBalls`), to write only that much.
 *
 * @example filesOf([Exporting.membersBall(place, members)]).keys().toArray()  // => ['members.tqm.json', 'members.tqm.tsv']
 */
export function filesOf(placed: readonly Exporting.PlacedBallT[]): FilesT {
  return new Map(placed.flatMap((each) => [
    [Addresses.filepathOf(each.address, 'json'), jsonOf(each)],
    [Addresses.filepathOf(each.address, 'tsv'), tsvOf(each)],
  ]))
}

/**
 * Every file a hunt's repository holds, by path: the README, and each of the hunt's resources
 * (`Exporting.ballsOf`) as its jsonball and its table.
 *
 * @example huntFiles(snapshot).keys().toArray()  // => ['README.md', 'hunt.tqh.json', 'hunt.tqh.tsv', 'categories.tqc.json', ...]
 */
export function huntFiles(snapshot: Exporting.HuntSnapshotT): FilesT {
  return new Map([[ReadmePath, Readme], ...filesOf(Exporting.ballsOf(snapshot))])
}

/** What differs from one reading of a repository's files to the next: each file new or changed, with its body, and each path gone */
export type FileChangesT = {
  written: FilesT
  removed: readonly string[]
}

/**
 * What changed between two readings of a repository's files: each file whose body is new or
 * differs, and each path the later reading no longer holds, both in path order. What a commit of
 * only what changed writes and removes.
 *
 * @param ante - The files as they stood.
 * @param post - The files as they stand now.
 *
 * @example changesBetween(new Map([['a.json', '1']]), new Map([['a.json', '2'], ['b.json', '3']]))  // => { written: Map { 'a.json' => '2', 'b.json' => '3' }, removed: [] }
 * @example changesBetween(new Map([['a.json', '1']]), new Map())  // => { written: Map {}, removed: ['a.json'] }
 */
export function changesBetween(ante: FilesT, post: FilesT): FileChangesT {
  const written = post.entries().filter(([path, body]) => ante.get(path) !== body).toArray()
  const removed = ante.keys().filter((path) => ! post.has(path)).toArray()
  return { written: new Map(written.toSorted(([aa], [bb]) => Tsv.byCode(aa, bb))), removed: removed.toSorted(Tsv.byCode) }
}

/**
 * Whether two readings of a repository's files hold the same files with the same bodies.
 *
 * @example isSameFiles(new Map([['a.json', '1']]), new Map([['a.json', '1']]))  // => true
 */
export function isSameFiles(ante: FilesT, post: FilesT): boolean {
  return ante.size === post.size && post.entries().every(([path, body]) => ante.get(path) === body)
}

/**
 * Whether `path` is one of the files of the quiz `placed` names: its own, its questions alone, or
 * one of its reviews. A quiz's files are found by its realm and label alone.
 *
 * @example isQuizFile('quizzes/home/legends/reviews/lee_jones.tqr.json', { realm: 'home', quiz: 'legends' })  // => true
 * @example isQuizFile('quizzes/home/legends_two.tqq.json', { realm: 'home', quiz: 'legends' })  // => false
 */
export function isQuizFile(path: string, placed: Readonly<Pick<Addresses.InQuizT, 'realm' | 'quiz'>>): boolean {
  const stem = Addresses.keypathOf({ kind: 'quiz', org: '', hunt: '', ...placed }).join('/')
  return path.startsWith(`${stem}.`) || path.startsWith(`${stem}/`)
}
