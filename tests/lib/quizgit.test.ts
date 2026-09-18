import { execFileSync } from 'node:child_process'
import nodeFs, { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import _ from 'es-toolkit/compat'
import { unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Changes from '../../src/lib/changes'
import * as Quizgit from '../../src/lib/quizgit'
import * as Sheets from '../../src/lib/sheets'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { present } from '../support/present'

/** `node:fs`'s own readFile, rooted under `root`, honouring the encoding isomorphic-git asks for */
function readFileAt(root: string): Quizgit.GitFs['promises']['readFile'] {
  function readFile(filepath: string): Promise<Uint8Array>
  function readFile(filepath: string, opts: { encoding: 'utf8' }): Promise<string>
  async function readFile(filepath: string, opts?: { encoding: 'utf8' }): Promise<Uint8Array | string> {
    const at = path.join(root, filepath)
    return opts === undefined ? await nodeFs.promises.readFile(at) : await nodeFs.promises.readFile(at, opts)
  }
  return readFile
}

/**
 * A real filesystem in a throwaway directory, rooted so that `/quizzes/...` lands inside it.
 *
 * Using the genuine article rather than a double is the point: what this module writes has to be
 * readable by the git anyone already has installed, and only a real repository proves that.
 */
function fsRootedAt(root: string): Quizgit.GitFs {
  const at = (filepath: string) => path.join(root, filepath)
  return {
    promises: {
      readFile:  readFileAt(root),
      writeFile: async (filepath, data, opts) => { await nodeFs.promises.writeFile(at(filepath), data, opts) },
      unlink:    async (filepath) => { await nodeFs.promises.unlink(at(filepath)) },
      readdir:   async (filepath) => await nodeFs.promises.readdir(at(filepath)),
      mkdir:     async (filepath) => { await nodeFs.promises.mkdir(at(filepath)) },
      rmdir:     async (filepath) => { await nodeFs.promises.rmdir(at(filepath)) },
      stat:      async (filepath) => await nodeFs.promises.stat(at(filepath)),
      lstat:     async (filepath) => await nodeFs.promises.lstat(at(filepath)),
      readlink:  async (filepath) => await nodeFs.promises.readlink(at(filepath)),
      symlink:   async (target, filepath) => { await nodeFs.promises.symlink(target, at(filepath)) },
    },
  }
}

function questionOf(forced_label: string, fields: Partial<QuestionT> = {}): QuestionT {
  return { ...Question.blank(), forced_label, ...fields }
}

function quizOf(questions: QuestionT[], fields: Partial<QuizT> = {}): QuizT {
  return { ...Quiz.blank(), title: 'Ours', forced_label: 'ours', questions, ...fields }
}

/** The throwaway directory this test is working in, and the filesystem rooted at it */
const suite = { root: '', fs: fsRootedAt('') }

/**
 * What the real git CLI says, with only trailing newlines taken off.
 *
 * Tab-separated content ends, and often begins, with a tab standing in for an empty field, and
 * a plain trim would eat exactly those.
 */
function gitIn(where: string, args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- naming an absolute git would make these tests machine-specific, and proving the real, installed git reads what we wrote is their entire purpose
  const said = execFileSync('git', ['-C', where, ...args], { encoding: 'utf8' })
  return _.trimEnd(said, '\n')
}

/** What git says about `quiz`'s own repository */
function gitSaysExactly(quiz: QuizT, ...args: string[]): string {
  return gitIn(path.join(suite.root, Quizgit.repopathFor(quiz)), args)
}

/** The same, trimmed, for the answers where surrounding whitespace carries no meaning */
function gitSays(quiz: QuizT, ...args: string[]): string {
  return gitSaysExactly(quiz, ...args).trim()
}

/** Commit `quiz` as the only thing that has ever happened to it */
async function commitFresh(quiz: QuizT): Promise<string | null> {
  return await Quizgit.commitQuiz(suite.fs, quiz, Changes.quizChanges(null, quiz))
}

/** Commit the step from `before` to `after`, as the app itself would */
async function commitStep(before: QuizT, after: QuizT): Promise<string | null> {
  return await Quizgit.commitQuiz(suite.fs, after, Changes.quizChanges(before, after))
}

beforeEach(() => {
  suite.root = mkdtempSync(path.join(tmpdir(), 'triquet-git-'))
  suite.fs = fsRootedAt(suite.root)
})

afterEach(() => {
  rmSync(suite.root, { recursive: true, force: true })
})

describe('quizFilenameFor', () => {
  it('names the file for the label the quiz answers to', () => {
    expect(Quizgit.quizFilenameFor({ label: 'quiet_otter', forced_label: null })).to.eq('quiet_otter.tsv')
  })

  it('follows an author\'s override rather than the generated label', () => {
    expect(Quizgit.quizFilenameFor({ label: 'quiet_otter', forced_label: 'ours' })).to.eq('ours.tsv')
  })
})

/** The whole-quiz export as `quizFiles` writes it, for a quiz labelled `ours` */
const jsonOf = (quiz: QuizT) => Quizgit.quizFiles(quiz).get('ours.triquet.json') ?? ''

describe('quizJsonFilenameFor', () => {
  it('says whose format it is, under the label the quiz answers to', () => {
    expect(Quizgit.quizJsonFilenameFor({ label: 'quiet_otter', forced_label: null })).to.eq('quiet_otter.triquet.json')
  })
})

describe('quizFiles', () => {
  it('is the two files, both under the quiz\'s own label', () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    expect(Quizgit.quizFiles(quiz).keys().toArray()).to.deep.eq(['ours.tsv', 'ours.triquet.json'])
  })

  it('holds exactly what the author would paste into a spreadsheet', () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    expect(Quizgit.quizFiles(quiz).get('ours.tsv')).to.eq(`${Sheets.sheetsExport(quiz.questions)}\n`)
  })

  it('holds the whole quiz as JSON, which the TSV alone could never give back', () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?', hint: 'BUT NOT a stoat', qnum: '3' })])
    expect(JSON.parse(jsonOf(quiz))).to.deep.eq(structuredClone(quiz))
  })

  it('pretty-prints it, so a diff reads as lines rather than as one enormous one', () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    const written = jsonOf(quiz)
    expect(written.split('\n').length).to.be.greaterThan(20)
    expect(written).to.include('\n  "id": ')
    expect(written.endsWith('\n')).to.eq(true)
  })

  it('sorts its keys, so the same quiz is the same bytes however the object was built', () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    const rebuilt = { ...quizOf([]), ...Object.fromEntries(Object.entries(quiz).toReversed()) }
    expect(jsonOf(rebuilt)).to.eq(jsonOf(quiz))
  })
})

// Every stamp has to survive `git check-ref-format`, which forbids a colon outright:
const TagnameCases: [string, string, string, string][] = [
  // regular usage:
  ['main',      '2026-09-18T18:45:04.123Z', 'main-2026-09-18t184504z',      'a version and a moment: colons dropped, millis dropped, all lowercase'],
  ['draft_two', '2026-01-01T00:00:00.000Z', 'draft_two-2026-01-01t000000z', 'midnight keeps its zeroes rather than collapsing'],
  // not-quite-absurd cases:
  ['main',      '2026-12-31T23:59:59.999Z', 'main-2026-12-31t235959z',      'a moment a millisecond before the year turns does not round up into it'],
]

describe('tagnameFor', () => {
  for (const [version, iso, expected, describes] of TagnameCases) {
    it(describes, () => {
      expect(Quizgit.tagnameFor(version, new Date(iso))).to.eq(expected)
    })
  }

  it('never yields a colon, which git refuses in a ref name', () => {
    expect(Quizgit.tagnameFor('main', new Date())).to.not.include(':')
  })
})

describe('commitQuiz', () => {
  it('commits nothing at all when nothing changed', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    expect(await commitStep(quiz, quiz)).to.eq(null)
  })

  it('writes a repository the real git can read', async () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    await commitFresh(quiz)
    expect(gitSays(quiz, 'log', '--oneline')).to.include('+quiz')
    expect(gitSays(quiz, 'status', '--porcelain')).to.eq('')
  })

  it('tracks the one file, named for the quiz', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    await commitFresh(quiz)
    expect(gitSays(quiz, 'ls-files').split('\n')).to.deep.eq(['ours.triquet.json', 'ours.tsv'])
  })

  it('puts the shorthand in the subject and the quiz in the body', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    await commitFresh(before)
    const after = { ...before, questions: [{ ...present(before.questions[0]), clueing: 'Who dithers?' }] }
    await commitStep(before, after)

    expect(gitSays(after, 'log', '-1', '--format=%s')).to.eq('quiet_otter +clueing')
    expect(gitSaysExactly(after, 'log', '-1', '--format=%b')).to.eq(Sheets.sheetsExport(after.questions))
  })

  it('records a later edit as that one file updating', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    await commitFresh(before)
    const after = { ...before, questions: [{ ...present(before.questions[0]), clueing: 'Who dithers?' }] }
    await commitStep(before, after)

    expect(gitSays(after, 'log', '--format=%s').split('\n')).to.deep.eq(['quiet_otter +clueing', '+quiz'])
    const touched = gitSays(after, 'show', '--stat', '--format=', 'HEAD')
    expect(touched).to.include('ours.tsv')
    expect(touched).to.include('ours.triquet.json')
  })

  it('starts on the branch the quiz\'s version names', async () => {
    const quiz = quizOf([questionOf('quiet_otter')], { version: 'main' })
    await commitFresh(quiz)
    expect(gitSays(quiz, 'rev-parse', '--abbrev-ref', 'HEAD')).to.eq('main')
  })

  it('branches when the version changes, leaving the old line of work where it was', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    await commitFresh(before)
    const after = { ...before, version: 'draft_two', questions: [{ ...present(before.questions[0]), clueing: 'Who dithers?' }] }
    await commitStep(before, after)

    expect(gitSays(after, 'rev-parse', '--abbrev-ref', 'HEAD')).to.eq('draft_two')
    expect(gitSays(after, 'log', '--format=%s', 'main')).to.eq('+quiz')
    expect(gitSays(after, 'log', '--format=%s', 'draft_two').split('\n')).to.have.lengthOf(2)
  })

  it('returns to a version it has seen before rather than starting it over', async () => {
    const onMain = quizOf([questionOf('quiet_otter')])
    await commitFresh(onMain)
    const onDraft = { ...onMain, version: 'draft_two' }
    await commitStep(onMain, onDraft)
    const backOnMain = { ...onMain, title: 'Renamed' }
    await commitStep(onMain, backOnMain)

    expect(gitSays(backOnMain, 'rev-parse', '--abbrev-ref', 'HEAD')).to.eq('main')
    expect(gitSays(backOnMain, 'log', '--format=%s', 'main').split('\n')).to.deep.eq(['quiz ~title', '+quiz'])
  })

  it('renames the file when the quiz is relabelled, keeping one file and not two', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    await commitFresh(before)
    const after = { ...before, forced_label: 'renamed' }
    await commitStep(before, after)

    expect(gitSays(after, 'ls-files').split('\n')).to.deep.eq(['renamed.triquet.json', 'renamed.tsv'])
    expect(gitSays(after, 'status', '--porcelain')).to.eq('')
  })
})

describe('saveQuiz', () => {
  it('tags the commit the quiz is sitting on', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    await commitFresh(quiz)
    const tag = await Quizgit.saveQuiz(suite.fs, quiz, new Date('2026-09-18T18:45:04.123Z'))

    expect(tag).to.eq('main-2026-09-18t184504z')
    expect(gitSays(quiz, 'tag', '--list')).to.eq('main-2026-09-18t184504z')
    expect(gitSays(quiz, 'rev-parse', present(tag))).to.eq(gitSays(quiz, 'rev-parse', 'HEAD'))
  })

  it('takes the version from the quiz, so a save says which line of work it saved', async () => {
    const quiz = quizOf([questionOf('quiet_otter')], { version: 'draft_two' })
    await commitFresh(quiz)
    expect(await Quizgit.saveQuiz(suite.fs, quiz, new Date('2026-09-18T18:45:04.123Z'))).to.eq('draft_two-2026-09-18t184504z')
  })

  it('does not clobber an earlier save made in the same second', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    await commitFresh(quiz)
    const at = new Date('2026-09-18T18:45:04.123Z')
    const first = await Quizgit.saveQuiz(suite.fs, quiz, at)
    const second = await Quizgit.saveQuiz(suite.fs, quiz, at)

    expect(second).to.eq(`${present(first)}-2`)
    expect(gitSays(quiz, 'tag', '--list').split('\n')).to.have.lengthOf(2)
  })
})

describe('zipQuizRepo', () => {
  it('packages a repository that git still recognises once unzipped', async () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    await commitFresh(quiz)
    await Quizgit.saveQuiz(suite.fs, quiz, new Date('2026-09-18T18:45:04.123Z'))

    const unpacked = path.join(suite.root, 'unpacked')
    const entries = Object.entries(unzipSync(await Quizgit.zipQuizRepo(suite.fs, quiz)))
    for (const [filepath, bytes] of entries) {
      const target = path.join(unpacked, filepath)
      nodeFs.mkdirSync(path.join(target, '..'), { recursive: true })
      nodeFs.writeFileSync(target, bytes)
    }

    const clone = path.join(unpacked, 'ours')
    const saysHere = (...args: string[]) => gitIn(clone, args)
    expect(saysHere('log', '--format=%s')).to.eq('+quiz')
    expect(saysHere('tag', '--list')).to.eq('main-2026-09-18t184504z')
    expect(saysHere('ls-files').split('\n')).to.deep.eq(['ours.triquet.json', 'ours.tsv'])
    expect(saysHere('show', 'HEAD:ours.tsv')).to.eq(Sheets.sheetsExport(quiz.questions))
    expect(saysHere('status', '--porcelain')).to.eq('')
  })

  it('carries the whole history, not just the last state', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    await commitFresh(before)
    const after = { ...before, questions: [{ ...present(before.questions[0]), clueing: 'Who dithers?' }] }
    await commitStep(before, after)

    const entries = unzipSync(await Quizgit.zipQuizRepo(suite.fs, after))
    expect(Object.keys(entries)).to.include('ours/ours.tsv')
    expect(Object.keys(entries).some((filepath) => filepath.startsWith('ours/.git/'))).to.eq(true)
  })
})
