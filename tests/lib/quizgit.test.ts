import { execFileSync } from 'node:child_process'
import nodeFs, { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import _ from 'es-toolkit/compat'
import { unzipSync } from 'fflate'
import Papa from 'papaparse'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Changes from '../../src/lib/changes'
import { Expression } from '../../src/models/expression'
import * as Quizgit from '../../src/lib/quizgit'
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
  return await Quizgit.commitQuiz(suite.fs, quiz, [], Changes.quizChanges(null, quiz))
}

/** Commit the step from `before` to `after`, as the app itself would */
async function commitStep(before: QuizT, after: QuizT): Promise<string | null> {
  return await Quizgit.commitQuiz(suite.fs, after, [], Changes.quizChanges(before, after))
}

beforeEach(() => {
  suite.root = mkdtempSync(path.join(tmpdir(), 'triquet-git-'))
  suite.fs = fsRootedAt(suite.root)
})

afterEach(() => {
  rmSync(suite.root, { recursive: true, force: true })
})

const OursDir = 'tq/hunt/ours/ours/puz/ours/quiz'
const OursTsv = `${OursDir}/ours.qq.tsv`
const OursJson = `${OursDir}/ours.tq.json`

/** The whole-quiz export as `quizFiles` writes it, for a quiz labelled `ours` */
const jsonOf = (quiz: QuizT) => Quizgit.quizFiles(quiz, []).get(OursJson) ?? ''

/** The questions file as `quizFiles` writes it, for a quiz labelled `ours` */
const tsvOf = (quiz: QuizT) => Quizgit.quizFiles(quiz, []).get(OursTsv) ?? ''

describe('quizPathsFor', () => {
  it('nests both files under the hunt, puzzle and quiz levels, each named for the quiz for now', () => {
    expect(Quizgit.quizPathsFor({ label: 'quiet_otter', forced_label: null })).to.deep.eq({
      tsv:  'tq/hunt/quiet_otter/quiet_otter/puz/quiet_otter/quiz/quiet_otter.qq.tsv',
      json: 'tq/hunt/quiet_otter/quiet_otter/puz/quiet_otter/quiz/quiet_otter.tq.json',
    })
  })

  it('follows an author\'s override rather than the generated label', () => {
    expect(Quizgit.quizPathsFor({ label: 'quiet_otter', forced_label: 'ours' })).to.deep.eq({ tsv: OursTsv, json: OursJson })
  })
})

describe('questionsTsv', () => {
  const HeaderLine = 'question.alt_text\tquestion.chains_to\tquestion.clueing\tquestion.full_answer\tquestion.hint\tquestion.label\tquestion.notes\tquestion.qnum\tquestion.title'

  it('opens with a header line naming every exposed field, alphabetically by widget and then by field', () => {
    expect(tsvOf(quizOf([])).split('\n', 1)[0]).to.eq(HeaderLine)
  })

  it('is the header alone, and a newline, for a quiz with no questions', () => {
    expect(tsvOf(quizOf([]))).to.eq(`${HeaderLine}\n`)
  })

  it('writes one line per question, in order of label rather than the order the quiz holds them', () => {
    const quiz = quizOf([
      questionOf('second_b', { title: 'Nantes', clueing: 'Which port?' }),
      questionOf('first_a', { title: 'Leon', qnum: '3' }),
    ])
    expect(tsvOf(quiz).split('\n')).to.deep.eq([
      HeaderLine,
      '\t\t\t\t\tfirst_a\t\t3\tLeon',
      '\t\tWhich port?\t\t\tsecond_b\t\t\tNantes',
      '',
    ])
  })

  it('does not change a line when the questions are dragged about', () => {
    const [aa, bb] = [questionOf('first_a', { title: 'A' }), questionOf('second_b', { title: 'B' })]
    expect(tsvOf(quizOf([aa, bb]))).to.eq(tsvOf(quizOf([bb, aa])))
  })

  it('names a chain target by its label, not its id', () => {
    const target = questionOf('the_target', { title: 'Target' })
    const source = questionOf('the_source', { title: 'Source', chains_to: target.id })
    const rows = tsvOf(quizOf([source, target])).split('\n')
    expect(rows[1]?.split('\t', 2)[1]).to.eq('the_target')
  })

  it('has a column for each widget the quiz has, and its exposed fields only, in their alphabetical place', () => {
    const widgets = [{ kind: 'expressing' as const, label: 'aaa', expression_label: 'answer_reversed', description: '' }]
    const withWidget = { ...quizOf([questionOf('one_a', { full_answer: 'stressed' })]), widgets }
    const expressions = [Expression.fill({ label: 'answer_reversed', formula: '$join($reverse($split(qn.full_answer, "")))' })]
    const lines = Quizgit.quizFiles(withWidget, expressions).get(OursTsv)?.split('\n') ?? []
    expect(lines[0]?.split('\t', 2)).to.deep.eq(['aaa.value', 'question.alt_text'])
    expect(lines[1]?.split('\t', 1)).to.deep.eq(['desserts'])
  })

  // A tab, a quote or a line break inside a field must never leak into the row structure:
  const AwkwardFieldCases: [string, string][] = [
    ['a\tb',                   'a tab inside a field'],
    ['say "hi"',                'quotation marks'],
    ['line one\nline two',     'a line break'],
    ['line one\r\nline two',   'a Windows line break'],
    ['Zoë 🎉 你好 ñ',           'accents, emoji and CJK survive untouched'],
    ['',                        'an empty field'],
  ]
  for (const [awkward, describes] of AwkwardFieldCases) {
    it(`keeps one row per question despite ${describes}`, () => {
      const quiz = quizOf([questionOf('quiet_otter', { clueing: awkward })])
      const parsed = Papa.parse<string[]>(tsvOf(quiz), { delimiter: '\t', skipEmptyLines: true })
      expect(parsed.errors).to.deep.eq([])
      expect(parsed.data).to.have.lengthOf(2)
      expect(present(parsed.data[1])[2]).to.eq(awkward)
    })
  }
})

describe('the expressions file', () => {
  const expressions = [Expression.fill({ label: 'shout', formula: '$uppercase(qn.title)', description: 'Loud.' })]

  it('holds the workspace\'s expressions as sorted, pretty-printed JSON', () => {
    const written = Quizgit.quizFiles(quizOf([]), expressions).get(Quizgit.ExpressionsPath) ?? ''
    expect(JSON.parse(written)).to.deep.eq(structuredClone(expressions))
    expect(written).to.include('\n    "description": "Loud."')
    expect(written.endsWith('\n')).to.eq(true)
  })

  it('lives at tq/widgets/my.tqexpressions.json in every quiz\'s repository', () => {
    expect(Quizgit.ExpressionsPath).to.eq('tq/widgets/my.tqexpressions.json')
  })

  it('is committed with the quiz, and a commit follows a change to it alone', async () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who?' })])
    await Quizgit.commitQuiz(suite.fs, quiz, [], Changes.quizChanges(null, quiz))
    const changed = await Quizgit.commitQuiz(suite.fs, quiz, expressions, Changes.expressionChanges([], expressions))
    expect(changed).to.be.a('string')
    expect(gitSays(quiz, 'show', 'HEAD:tq/widgets/my.tqexpressions.json')).to.include('"shout"')
    expect(gitSays(quiz, 'log', '-1', '--format=%s')).to.eq('widgets ~expressions')
  })
})

describe('quizFiles', () => {
  it('is the questions table and the whole quiz at their nested paths, and the workspace\'s expressions beside them', () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    expect(Quizgit.quizFiles(quiz, []).keys().toArray()).to.deep.eq([OursTsv, OursJson, 'tq/widgets/my.tqexpressions.json'])
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
const MilestoneTagCases: [string, string, string, string][] = [
  // regular usage:
  ['main',      '2026-09-18T18:45:04.123Z', 'main-m-20260918184504z',      'a version, an m, and the UTC moment as bare digits: no dashes, colons or t'],
  ['draft_two', '2026-01-01T00:00:00.000Z', 'draft_two-m-20260101000000z', 'midnight keeps its zeroes rather than collapsing'],
  // not-quite-absurd cases:
  ['main',      '2026-12-31T23:59:59.999Z', 'main-m-20261231235959z',      'a moment a millisecond before the year turns does not round up into it'],
]

describe('milestoneTagFor', () => {
  for (const [version, iso, expected, describes] of MilestoneTagCases) {
    it(describes, () => {
      expect(Quizgit.milestoneTagFor(version, new Date(iso))).to.eq(expected)
    })
  }

  it('sorts as text in the order the moments happened', () => {
    const earlier = Quizgit.milestoneTagFor('main', new Date('2026-09-18T09:00:00Z'))
    const later = Quizgit.milestoneTagFor('main', new Date('2026-09-18T10:00:00Z'))
    expect(earlier < later).to.eq(true)
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

  it('tracks the quiz\'s files and the expressions, at their paths', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    await commitFresh(quiz)
    expect(gitSays(quiz, 'ls-files').split('\n')).to.deep.eq([OursTsv, OursJson, Quizgit.ExpressionsPath])
  })

  it('makes the shorthand the whole message, with no body repeating the quiz', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    await commitFresh(before)
    const after = { ...before, questions: [{ ...present(before.questions[0]), clueing: 'Who dithers?' }] }
    await commitStep(before, after)

    expect(gitSaysExactly(after, 'log', '-1', '--format=%B')).to.eq('quiet_otter +clueing')
  })

  it('records a later edit as that one file updating', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    await commitFresh(before)
    const after = { ...before, questions: [{ ...present(before.questions[0]), clueing: 'Who dithers?' }] }
    await commitStep(before, after)

    expect(gitSays(after, 'log', '--format=%s').split('\n')).to.deep.eq(['quiet_otter +clueing', '+quiz'])
    const touched = gitSays(after, 'show', '--stat', '--format=', 'HEAD')
    expect(touched).to.include('ours.qq.tsv')
    expect(touched).to.include('ours.tq.json')
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

    expect(gitSays(after, 'ls-files').split('\n')).to.deep.eq([
      'tq/hunt/renamed/renamed/puz/renamed/quiz/renamed.qq.tsv',
      'tq/hunt/renamed/renamed/puz/renamed/quiz/renamed.tq.json',
      Quizgit.ExpressionsPath,
    ])
    expect(gitSays(after, 'status', '--porcelain')).to.eq('')
  })
})

describe('milestoneQuiz', () => {
  it('tags the commit the quiz is sitting on', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    await commitFresh(quiz)
    const tag = await Quizgit.milestoneQuiz(suite.fs, quiz, new Date('2026-09-18T18:45:04.123Z'))

    expect(tag).to.eq('main-m-20260918184504z')
    expect(gitSays(quiz, 'tag', '--list')).to.eq('main-m-20260918184504z')
    expect(gitSays(quiz, 'rev-parse', present(tag))).to.eq(gitSays(quiz, 'rev-parse', 'HEAD'))
  })

  it('takes the version from the quiz, so a milestone says which line of work it marked', async () => {
    const quiz = quizOf([questionOf('quiet_otter')], { version: 'draft_two' })
    await commitFresh(quiz)
    expect(await Quizgit.milestoneQuiz(suite.fs, quiz, new Date('2026-09-18T18:45:04.123Z'))).to.eq('draft_two-m-20260918184504z')
  })

  it('does not clobber an earlier milestone made in the same second', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    await commitFresh(quiz)
    const at = new Date('2026-09-18T18:45:04.123Z')
    const first = await Quizgit.milestoneQuiz(suite.fs, quiz, at)
    const second = await Quizgit.milestoneQuiz(suite.fs, quiz, at)

    expect(second).to.eq(`${present(first)}-2`)
    expect(gitSays(quiz, 'tag', '--list').split('\n')).to.have.lengthOf(2)
  })
})

describe('zipQuizRepo', () => {
  it('packages a repository that git still recognises once unzipped', async () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    await commitFresh(quiz)
    await Quizgit.milestoneQuiz(suite.fs, quiz, new Date('2026-09-18T18:45:04.123Z'))

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
    expect(saysHere('tag', '--list')).to.eq('main-m-20260918184504z')
    expect(saysHere('ls-files').split('\n')).to.deep.eq([OursTsv, OursJson, Quizgit.ExpressionsPath])
    expect(saysHere('show', `HEAD:${OursTsv}`)).to.eq(tsvOf(quiz).slice(0, -1))
    expect(saysHere('status', '--porcelain')).to.eq('')
  })

  it('carries the whole history, not just the last state', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    await commitFresh(before)
    const after = { ...before, questions: [{ ...present(before.questions[0]), clueing: 'Who dithers?' }] }
    await commitStep(before, after)

    const entries = unzipSync(await Quizgit.zipQuizRepo(suite.fs, after))
    expect(Object.keys(entries)).to.include(`ours/${OursTsv}`)
    expect(Object.keys(entries).some((filepath) => filepath.startsWith('ours/.git/'))).to.eq(true)
  })
})

describe('listRepos', () => {
  it('finds nothing where no history has been kept', async () => {
    expect(await Quizgit.listRepos(suite.fs)).to.deep.eq([])
  })

  it('summarises each repository: its quiz, branch and latest commit', async () => {
    const quiz = quizOf([questionOf('q1', { clueing: 'Who?' })])
    await commitFresh(quiz)
    const [repo] = await Quizgit.listRepos(suite.fs)
    expect(repo).to.include({ id: quiz.id, label: 'ours', branch: 'main' })
    expect(repo?.message).to.eq(Changes.shorthandFor(Changes.quizChanges(null, quiz)))
    expect(repo?.committed_at).to.be.closeTo(Date.now(), 60_000)
  })

  it('reports the branch the history is on, and the latest commit on it', async () => {
    const quiz = quizOf([questionOf('q1')])
    await commitFresh(quiz)
    const revised = { ...quiz, questions: [{ ...quiz.questions[0]!, clueing: 'Who now?' }], version: 'draft' }
    await commitStep(quiz, revised)
    const [repo] = await Quizgit.listRepos(suite.fs)
    expect(repo).to.include({ branch: 'draft', message: Changes.shorthandFor(Changes.quizChanges(quiz, revised)) })
  })

  it('lists a quiz whose history has only just begun, as a repository with nothing committed', async () => {
    const quiz = quizOf([])
    await Quizgit.milestoneQuiz(suite.fs, quiz)
    expect(await Quizgit.listRepos(suite.fs)).to.deep.eq([
      { id: quiz.id, label: null, branch: 'main', message: null, committed_at: null },
    ])
  })

  it('lists every quiz, the newest work first', async () => {
    const [older, newer] = [quizOf([], { title: 'Older' }), quizOf([], { title: 'Newer' })]
    await commitFresh(older)
    await commitFresh({ ...newer, forced_label: 'newer' })
    await new Promise((resolve) => { setTimeout(resolve, 1100) })
    await commitStep(older, { ...older, title: 'Older, revised' })
    const repos = await Quizgit.listRepos(suite.fs)
    expect(repos.map((repo) => repo.label)).to.deep.eq(['ours', 'newer'])
  })

  it('leaves out a directory that is not a repository', async () => {
    await nodeFs.promises.mkdir(path.join(suite.root, Quizgit.RepoRoot, 'stray'), { recursive: true })
    expect(await Quizgit.listRepos(suite.fs)).to.deep.eq([])
  })
})
