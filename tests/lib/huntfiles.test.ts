import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import _ from 'es-toolkit/compat'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Addresses from '../../src/lib/addresses'
import * as Exporting from '../../src/lib/exporting'
import * as Huntfiles from '../../src/lib/huntfiles'
import * as Jsonball from '../../src/lib/jsonball'
import * as UU from '../../src/lib/useful'
import { CategoryLabelVals } from '../../src/models/category'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { present } from '../support/present'
import { runOf } from '../support/runs'
import { EntryLibrary, chainedQuiz, snapshot } from '../support/snapshots'

/** The hunt every ball here is of */
const Place: Addresses.InHuntT = { org: 'pat_smith', hunt: 'deep_lake' }

/** `text`'s lines, each split into its cells, the trailing newline taken off */
function linesOf(text: string): string[][] {
  return text.slice(0, -1).split('\n').map((line) => line.split('\t'))
}

/** `text`'s rows as objects by column, the header line naming them */
function rowsOf(text: string): Record<string, string>[] {
  const [header = [], ...rows] = linesOf(text)
  return rows.map((cells) => _.zipObject(header, cells))
}

/** The file at `filepath`, which must be among `files` */
function fileAt(files: Huntfiles.FilesT, filepath: string): string {
  return present(files.get(filepath))
}

/** The snapshot's quiz `princes`, which a review is written of */
function princesOf(held: Exporting.HuntSnapshotT): QuizT {
  return present(held.realms[0]?.quizzes.find((quiz) => quiz.label === 'princes'))
}

/** `val` as it reads back once written as JSON: what is undefined, gone */
function asWritten(val: unknown): unknown {
  return JSON.parse(UU.jsonify(val))
}

/** The address of the snapshot's quiz `princes` */
const Princes = { ...Place, realm: 'home', quiz: 'princes' } as const

describe('huntFiles', () => {
  it("is the README, then each ball of the hunt as its JSON and its table, at its address's paths", () => {
    const paths = Huntfiles.huntFiles(snapshot()).keys().toArray()
    const fileds = Exporting.ballsOf(snapshot()).flatMap(({ address }) => [Addresses.filepathOf(address, 'json'), Addresses.filepathOf(address, 'tsv')])
    expect(paths).to.deep.eq([Huntfiles.ReadmePath, ...fileds])
  })

  it("reads the doc block's example", () => {
    expect(Huntfiles.huntFiles(snapshot()).keys().take(5).toArray()).to.deep.eq(['README.md', 'hunt.tqh.json', 'hunt.tqh.tsv', 'categories.tqc.json', 'categories.tqc.tsv'])
  })

  it("names the paths the address model names: the questions alone beside their quiz, a review under it, a widget under the library", () => {
    const paths = Huntfiles.huntFiles(snapshot()).keys().toArray()
    expect(paths).to.include.members([
      'members.tqm.json', 'members.tqm.tsv',
      'quizzes/home/princes.tqq.json', 'quizzes/home/princes.tqq.tsv',
      'quizzes/home/princes/questions.qq.json', 'quizzes/home/princes/questions.qq.tsv',
      'quizzes/home/princes/reviews/lee_jones.tqr.json', 'quizzes/home/princes/reviews/lee_jones.tqr.tsv',
      'quizzes/home/paris.tqq.json', 'widgets/pub/remark.tqw.json', 'widgets/pub/dumdum.tqw.tsv',
    ])
    expect(paths.filter((filepath) => filepath.includes('kim_park'))).to.deep.eq([])
  })

  it("writes the same bytes for the same hunt, however its pieces arrived", () => {
    const held = snapshot()
    const reordered = { ...held, members: held.members.toReversed() }
    expect(Huntfiles.huntFiles(reordered)).to.deep.eq(Huntfiles.huntFiles(held))
  })

  it("writes a resource's files from that resource alone, as the whole hunt's files hold them", () => {
    const held = snapshot()
    const princes = princesOf(held)
    const quizFiles = Huntfiles.filesOf(Exporting.quizBalls(Place, 'home', princes, runOf(princes, EntryLibrary), present(held.reviews[princes._id])))
    const whole = Huntfiles.huntFiles(held)
    expect(quizFiles.size).to.eq(6)
    for (const [filepath, body] of quizFiles) {
      expect(whole.get(filepath), filepath).to.eq(body)
    }
  })
})

describe('filesOf', () => {
  it("reads the doc block's example", () => {
    const files = Huntfiles.filesOf([Exporting.membersBall(Place, snapshot().members)])
    expect(files.keys().toArray()).to.deep.eq(['members.tqm.json', 'members.tqm.tsv'])
  })

  it("is no files for no balls", () => {
    expect(Huntfiles.filesOf([]).size).to.eq(0)
  })
})

describe('jsonOf', () => {
  it("reads the doc block's example", () => {
    const placed = Exporting.huntBall(Place, { label: 'spring_hunt', title: 'Spring Hunt', branch: 'main' })
    expect(Huntfiles.jsonOf(placed)).to.eq('{\n  "branch": "main",\n  "label": "spring_hunt",\n  "title": "Spring Hunt"\n}\n')
  })

  it("is the ball, pretty, with its keys sorted at every depth", () => {
    const quiz = chainedQuiz()
    const placed = Exporting.quizBall(Place, 'home', quiz, runOf(quiz, EntryLibrary))
    const text = Huntfiles.jsonOf(placed)
    expect(JSON.parse(text)).to.deep.eq(asWritten(placed.ball))
    expect(text.indexOf('"columns"')).to.be.lessThan(text.indexOf('"questions"'))
    expect(text.indexOf('"questions"')).to.be.lessThan(text.indexOf('"widgetings"'))
  })
})

describe('tsvOf', () => {
  const held = snapshot()
  const tsvAt = (filepath: string) => fileAt(Huntfiles.huntFiles(held), filepath)

  it("reads the doc block's example", () => {
    const placed = Exporting.membersBall(Place, [{ label: 'pat_smith', title: 'Pat', role: 'smith' }])
    expect(Huntfiles.tsvOf(placed)).to.eq('label\trole\ttitle\npat_smith\tsmith\tPat\n')
  })

  it("writes the hunt as one row of its own fields", () => {
    expect(linesOf(tsvAt('hunt.tqh.tsv'))).to.deep.eq([['branch', 'label', 'title'], ['main', 'deep_lake', 'Deep Lake']])
  })

  it("writes the categories as a row each, by label, with its slot or none", () => {
    const rows = rowsOf(tsvAt('categories.tqc.tsv'))
    expect(rows.map((row) => row.label)).to.deep.eq(CategoryLabelVals.toSorted((aa, bb) => aa.localeCompare(bb)))
    expect(rows.find((row) => row.label === 'tv')).to.deep.eq({ label: 'tv', position: '' })
    expect(rows.find((row) => row.label === 'math_econ')).to.deep.eq({ label: 'math_econ', position: '0' })
  })

  it("writes the members as a row each, by label", () => {
    expect(linesOf(tsvAt('members.tqm.tsv'))).to.deep.eq([['label', 'role', 'title'], ['lee_jones', 'reviewer', 'Lee'], ['pat_smith', 'smith', 'Pat']])
  })

  it("writes a quiz as one row, its widgetings and columns by key path, its questions left to their own table", () => {
    const [header = [], ...rows] = linesOf(tsvAt('quizzes/home/princes.tqq.tsv'))
    expect(rows).to.have.lengthOf(1)
    expect(header).to.include.members(['label', 'title', 'locked', 'smiths_note', 'q1_preamble', 'widgetings.remark.widget_label', 'widgetings.remark.params', 'columns.title.width_px'])
    expect(header.filter((column) => column.startsWith('questions'))).to.deep.eq([])
    expect(rowsOf(tsvAt('quizzes/home/princes.tqq.tsv'))[0]).to.deep.include({ 'label': 'princes', 'title': 'Princes', 'widgetings.remark.params': '{}' })
  })

  it("writes the questions alone as a row each, by label, no prefix on its fields, and what each widgeting came to as its status and one cell of JSON", () => {
    const rows = rowsOf(tsvAt('quizzes/home/princes/questions.qq.tsv'))
    expect(rows.map((row) => row.label)).to.deep.eq(['leon', 'nantes'])
    expect(rows[0]).to.deep.include({ 'chains_to': 'nantes', 'position': '0', 'remark.status': 'ok', 'remark.value': '"Ask Flip."', 'dumdum.status': 'errored', 'dumdum.value': '' })
    expect(rows[0]?.['numnum_clueing.value']).to.match(/^\{"items":\[\{"kind":"numeral"/)
    expect(Object.keys(present(rows[0])).filter((column) => column.startsWith('numnum_clueing.value.'))).to.deep.eq([])
  })

  it("writes a widgeting's params whole, as one cell of JSON, however much they hold", () => {
    const quiz = chainedQuiz()
    const widgetings = quiz.widgetings.map((widgeting) => (widgeting.label === 'remark' ? { ...widgeting, params: { level: 3, words: ['but'] } } : widgeting))
    const placed = Exporting.quizBall(Place, 'home', { ...quiz, widgetings }, runOf(quiz, EntryLibrary))
    expect(rowsOf(Huntfiles.tsvOf(placed))[0]).to.deep.include({ 'widgetings.remark.params': '{"level":3,"words":["but"]}' })
  })

  it("writes a quiz with no questions' questions as a header alone", () => {
    const empty = { ...Quiz.blank('Empty', 'empty'), questions: [] }
    const placed = Exporting.questionsBall(Place, 'home', empty, runOf(empty, EntryLibrary))
    expect(Huntfiles.tsvOf(placed)).to.eq('label\n')
  })

  it("writes a review as a row for each question it gave a verdict on", () => {
    const rows = rowsOf(tsvAt('quizzes/home/princes/reviews/lee_jones.tqr.tsv'))
    expect(rows).to.deep.eq([{ comments: 'Lovely.', elimination_candidate: 'false', get_rate: '40', guesses: 'Leon?', keep_it: 'true', label: 'leon', minutes: '2', needs_fact_check: 'false' }])
  })

  it("writes a widget as one row, labelled by its label", () => {
    const rows = rowsOf(tsvAt('widgets/pub/remark.tqw.tsv'))
    expect(rows).to.have.lengthOf(1)
    expect(rows[0]).to.deep.include({ 'label': 'remark', 'formulary': 'entry', 'config': '{"entry_kind":"text"}', 'position': String(EntryLibrary.length - 1) })
  })

  it("keeps a question's line breaks and tabs inside its one line", () => {
    const quiz = chainedQuiz()
    const noted = { ...quiz, questions: quiz.questions.map((question) => ({ ...question, notes: 'two\nlines\tand a tab' })) }
    const text = Huntfiles.tsvOf(Exporting.questionsBall(Place, 'home', noted, runOf(noted, EntryLibrary)))
    expect(text.split('\n')).to.have.lengthOf(4)
    expect(rowsOf(text)[0]?.notes).to.eq(String.raw`two\nlines\tand a tab`)
  })
})

/** Files by path, from path and body pairs */
function files(...pairs: [string, string][]): Huntfiles.FilesT {
  return new Map(pairs)
}

describe('changesBetween', () => {
  const ChangeCases: [[Huntfiles.FilesT, Huntfiles.FilesT], Huntfiles.FileChangesT, string][] = [
    // regular usage:
    [[files(['a.json', '1']), files(['a.json', '2'], ['b.json', '3'])], { written: files(['a.json', '2'], ['b.json', '3']), removed: [] },  'a changed body and a new file are written'],
    [[files(['a.json', '1'], ['b.json', '2']), files(['b.json', '2'])], { written: files(), removed: ['a.json'] },                          'a path gone is removed, an unchanged one left alone'],
    [[files(['b.json', '1'], ['a.json', '1']), files(['z.json', '2'], ['b.json', '3'])], { written: files(['b.json', '3'], ['z.json', '2']), removed: ['a.json'] }, 'both in path order, by code unit'],
    // trivial cases:
    [[files(['a.json', '1']), files(['a.json', '1'])], { written: files(), removed: [] },                                                     'nothing for the same files'],
    [[files(), files()], { written: files(), removed: [] },                                                                                 'nothing for nothing'],
    [[files(), files(['a.json', ''])], { written: files(['a.json', '']), removed: [] },                                                     'an empty body is a body'],
    // weird cases:
    [[files(['a.json', '']), files(['a.json', '1'])], { written: files(['a.json', '1']), removed: [] },                                     'an empty body filled is a change'],
    [[files(['B.json', '1'], ['a.json', '1']), files()], { written: files(), removed: ['B.json', 'a.json'] },                               'capitals sort before lowercase, not by locale'],
  ]
  for (const [[ante, post], changes, description] of ChangeCases) {
    it(description, () => {
      const changed = Huntfiles.changesBetween(ante, post)
      expect([...changed.written]).to.deep.eq([...changes.written])
      expect(changed.removed).to.deep.eq(changes.removed)
    })
  }

  it("reads the doc block's examples", () => {
    expect(Huntfiles.changesBetween(files(['a.json', '1']), files(['a.json', '2'], ['b.json', '3']))).to.deep.eq({ written: files(['a.json', '2'], ['b.json', '3']), removed: [] })
    expect(Huntfiles.changesBetween(files(['a.json', '1']), files())).to.deep.eq({ written: files(), removed: ['a.json'] })
  })

  it("is what a question's edit changes of a hunt's files, and nothing else", () => {
    const edited = snapshot()
    const ante = Huntfiles.huntFiles(edited)
    const princes = present(edited.realms[0]?.quizzes[0])
    const leon = present(princes.questions[0])
    const realm = present(edited.realms[0])
    const post = Huntfiles.huntFiles({ ...edited, realms: [{ ...realm, quizzes: [{ ...princes, questions: [{ ...leon, clueing: 'A new clueing' }, ...princes.questions.slice(1)] }, ...realm.quizzes.slice(1)] }] })
    const changed = Huntfiles.changesBetween(ante, post)
    expect(changed.written.keys().toArray()).to.deep.eq(['quizzes/home/princes.tqq.json', 'quizzes/home/princes/questions.qq.json', 'quizzes/home/princes/questions.qq.tsv'])
    expect(changed.removed).to.deep.eq([])
  })
})

describe('isQuizFile', () => {
  const Legends = { realm: 'home', quiz: 'legends' }

  it("reads the doc block's examples", () => {
    expect(Huntfiles.isQuizFile('quizzes/home/legends/reviews/lee_jones.tqr.json', Legends)).to.be.true
    expect(Huntfiles.isQuizFile('quizzes/home/legends_two.tqq.json', Legends)).to.be.false
  })

  it("is each file the quiz's balls are written to, and no other", () => {
    const held = snapshot()
    const princes = present(present(held.realms[0]).quizzes[0])
    const paths = Huntfiles.huntFiles(held).keys().toArray()
    const realm = present(held.realms[0])
    const reviews = present(held.reviews[princes._id])
    const own = Huntfiles.filesOf(Exporting.quizBallsIn(held, realm, princes, reviews))
    expect(paths.filter((path) => Huntfiles.isQuizFile(path, { realm: 'home', quiz: 'princes' }))).to.have.members(own.keys().toArray())
  })
})

describe('isSameFiles', () => {
  it("reads the doc block's example", () => {
    expect(Huntfiles.isSameFiles(files(['a.json', '1']), files(['a.json', '1']))).to.be.true
  })

  it("is false for a body changed, a file added or a file gone, and true whatever the order", () => {
    expect(Huntfiles.isSameFiles(files(['a.json', '1']), files(['a.json', '2']))).to.be.false
    expect(Huntfiles.isSameFiles(files(['a.json', '1']), files(['a.json', '1'], ['b.json', '1']))).to.be.false
    expect(Huntfiles.isSameFiles(files(['a.json', '1'], ['b.json', '1']), files(['a.json', '1']))).to.be.false
    expect(Huntfiles.isSameFiles(files(['a.json', '1']), files(['b.json', '1']))).to.be.false
    expect(Huntfiles.isSameFiles(files(['a.json', '1'], ['b.json', '2']), files(['b.json', '2'], ['a.json', '1']))).to.be.true
    expect(Huntfiles.isSameFiles(files(), files())).to.be.true
  })
})

describe('Readme', () => {
  it("holds the line that merges the jsonballs", () => {
    expect(Huntfiles.Readme).to.include(Huntfiles.MergeCommand)
  })

  it("names the path of every kind of file a hunt's repository holds", () => {
    for (const kind of Object.keys(Addresses.PreextForKind)) {
      expect(Huntfiles.Readme, kind).to.match(new RegExp(String.raw`\.${Addresses.PreextForKind[kind as keyof typeof Addresses.PreextForKind]}\.json`))
    }
  })
})

/** The throwaway directory this test's repository is in */
const suite = { root: '' }

/**
 * What a command says, run in the repository: the real git, and the real `jq`.
 *
 * The genuine article rather than a double is the point: the README promises a reader with
 * nothing but git and jq that this is how the hunt comes back whole.
 */
function sayIn(command: string, args: readonly string[]): string {
  return execFileSync(command, args, { cwd: suite.root, encoding: 'utf8' })
}

/** What git says, run in the repository, as committed by nobody in particular */
function gitSays(...args: string[]): string {
  return sayIn('git', ['-c', 'user.name=Triquet', '-c', 'user.email=triquet@localhost', '-c', 'commit.gpgsign=false', ...args])
}

/** Write `files` into the repository, every one, over what was there */
function writeAll(files: Huntfiles.FilesT): void {
  for (const [filepath, body] of files) {
    mkdirSync(path.dirname(path.join(suite.root, filepath)), { recursive: true })
    writeFileSync(path.join(suite.root, filepath), body)
  }
}

/** Write `files` into the repository and commit them */
function commitAll(files: Huntfiles.FilesT, message: string): void {
  writeAll(files)
  gitSays('add', '--all')
  gitSays('commit', '--quiet', '-m', message)
}

describe('in a git repository', () => {
  beforeEach(() => {
    suite.root = mkdtempSync(path.join(tmpdir(), 'triquet-hunt-'))
    gitSays('init', '--quiet', '--initial-branch=main')
  })

  afterEach(() => {
    rmSync(suite.root, { recursive: true, force: true })
  })

  it("finds exactly the merged balls with the README's pathspec, and not the questions alone", () => {
    const held = snapshot()
    commitAll(Huntfiles.huntFiles(held), 'the hunt')
    const listed = gitSays('ls-files', Addresses.MergedPathspec).trim().split('\n')
    const merged = Exporting.ballsOf(held).filter(({ address }) => Addresses.isMerged(address)).map(({ address }) => Addresses.filepathOf(address))
    expect(listed).to.have.members(merged)
    expect(listed.filter((filepath) => filepath.endsWith('questions.qq.json'))).to.deep.eq([])
  })

  it("merges those files back into the hunt whole, as Raw Export emits it", () => {
    const held = snapshot()
    commitAll(Huntfiles.huntFiles(held), 'the hunt')
    const listed = gitSays('ls-files', Addresses.MergedPathspec).trim().split('\n')
    const balls = listed.map((filepath) => JSON.parse(gitSays('show', `HEAD:${filepath}`)) as Jsonball.JsonballT)
    expect(Jsonball.merged(balls)).to.deep.eq(asWritten(Exporting.wholeOf(held)))
  })

  it("merges them the same with the README's own line, jq and all", () => {
    const held = snapshot()
    commitAll(Huntfiles.huntFiles(held), 'the hunt')
    const whole: unknown = JSON.parse(sayIn('sh', ['-c', Huntfiles.MergeCommand]))
    expect(whole).to.deep.eq(asWritten(Exporting.wholeOf(held)))
  })

  it("changes, for a question's edit, only its quiz's JSON and its questions' files, and one line of their table", () => {
    const held = snapshot()
    commitAll(Huntfiles.huntFiles(held), 'the hunt')
    const princes = princesOf(held)
    const edited = { ...princes, questions: princes.questions.map((question) => (question.label === 'nantes' ? { ...question, hint: 'On the Loire' } : question)) }
    writeAll(Huntfiles.huntFiles({ ...held, realms: held.realms.map((realm) => ({ ...realm, quizzes: realm.quizzes.map((quiz) => (quiz === princes ? edited : quiz)) })) }))
    const changed = gitSays('status', '--porcelain').trimEnd().split('\n').map((line) => line.slice(3))
    expect(changed).to.have.members([
      Addresses.filepathOf({ kind: 'quiz', ...Princes }), Addresses.filepathOf({ kind: 'questions', ...Princes }), Addresses.filepathOf({ kind: 'questions', ...Princes }, 'tsv'),
    ])
    expect(gitSays('diff', '--numstat', '--', Addresses.filepathOf({ kind: 'questions', ...Princes }, 'tsv')).split('\t').slice(0, 2)).to.deep.eq(['1', '1'])
  })
})
