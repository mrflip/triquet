import { execFileSync } from 'node:child_process'
import nodeFs, { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import _ from 'es-toolkit/compat'
import { unzipSync } from 'fflate'
import Papa from 'papaparse'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Changes from '../../src/lib/changes'
import * as Exporting from '../../src/lib/exporting'
import * as Quizgit from '../../src/lib/quizgit'
import { Question, type QuestionT } from '../../src/models/question'
import { classicLayout } from '../support/layouts'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SeedWidgets } from '../../src/models/seeds'
import { Widget } from '../../src/models/widget'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'
import { Here, placeAt } from '../support/places'
import { runOf } from '../support/runs'

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
  return await Quizgit.commitQuiz(suite.fs, quiz, [], Here, Changes.quizChanges(null, quiz))
}

/** Commit the step from `before` to `after`, as the app itself would */
async function commitStep(before: QuizT, after: QuizT): Promise<string | null> {
  return await Quizgit.commitQuiz(suite.fs, after, [], Here, Changes.quizChanges(before, after))
}

beforeEach(() => {
  suite.root = mkdtempSync(path.join(tmpdir(), 'triquet-git-'))
  suite.fs = fsRootedAt(suite.root)
})

afterEach(() => {
  rmSync(suite.root, { recursive: true, force: true })
})

const OursDir = 'tq/hunt/deep_lake/realm/home/quiz'
const OursTsv = `${OursDir}/ours.qq.tsv`
const OursJson = `${OursDir}/ours.tq.json`

/** The whole-quiz export as `quizFiles` writes it, for a quiz labelled `ours` */
const jsonOf = (quiz: QuizT) => Quizgit.quizFiles(quiz, [], Here).get(OursJson) ?? ''

/** The questions file as `quizFiles` writes it, for a quiz labelled `ours` */
const tsvOf = (quiz: QuizT) => Quizgit.quizFiles(quiz, [], Here).get(OursTsv) ?? ''

describe('quizPathsFor', () => {
  it('nests both files under the hunt and realm, each named for the quiz', () => {
    expect(Quizgit.quizPathsFor({ label: 'quiet_otter', forced_label: null }, Here)).to.deep.eq({
      tsv:  'tq/hunt/deep_lake/realm/home/quiz/quiet_otter.qq.tsv',
      json: 'tq/hunt/deep_lake/realm/home/quiz/quiet_otter.tq.json',
    })
  })

  it('follows an author\'s override rather than the generated label', () => {
    expect(Quizgit.quizPathsFor({ label: 'quiet_otter', forced_label: 'ours' }, Here)).to.deep.eq({ tsv: OursTsv, json: OursJson })
  })

  it('moves with the hunt and the realm', () => {
    expect(Quizgit.quizPathsFor({ label: 'ours', forced_label: null }, placeAt('high_tarn', 'finals')).json).to.eq('tq/hunt/high_tarn/realm/finals/quiz/ours.tq.json')
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
    const source = questionOf('the_source', { title: 'Source', chains_to: target._id })
    const rows = tsvOf(quizOf([source, target])).split('\n')
    expect(rows[1]?.split('\t', 2)[1]).to.eq('the_target')
  })

  it("has a column for each widgeting the quiz has, and its exposed fields only, in their alphabetical place", () => {
    const widgetings = [Widgeting.fill({ widget_label: 'answer_reversed', label: 'aaa' })]
    const withWidget = { ...quizOf([questionOf('one_a', { full_answer: 'stressed' })]), widgetings }
    const lines = Quizgit.quizFiles(withWidget, SeedWidgets, Here).get(OursTsv)?.split('\n') ?? []
    expect(lines[0]?.split('\t', 3)).to.deep.eq(['aaa.status', 'aaa.value', 'question.alt_text'])
    expect(lines[1]?.split('\t', 2)).to.deep.eq(['ok', 'desserts'])
  })

  it("names each widgeting's status and value, the widgetings before the questions' own fields", () => {
    const header = tsvOf(quizOf([], classicLayout())).split('\n', 1)[0]?.split('\t') ?? []
    const at = (colkey: string) => header.indexOf(colkey)
    expect(at('clueing_full.value')).to.eq(at('clueing_full.status') + 1)
    expect(at('clueing_full.value')).to.be.below(at('question.alt_text'))
    expect(header).to.have.lengthOf((classicLayout().widgetings.length * 2) + 9)
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

/** The labels of the seed widgets `quiz` works */
const labelsWorked = (quiz: Pick<QuizT, 'widgetings'>) => Quizgit.worked(quiz, SeedWidgets).map((widget) => widget.label)

/** A quiz labelled `ours` holding `questions`, working the widget `shout` as `loud` */
const shouting = (questions: QuestionT[] = []) => quizOf(questions, { widgetings: [Widgeting.fill({ widget_label: 'shout', label: 'loud' })] })

describe('widgetPathFor', () => {
  it("files a widget under its scope and label, beside the hunt tree", () => {
    expect(Quizgit.widgetPathFor({ scope: 'pub', label: 'dumdum' })).to.eq('tq/widget/pub/dumdum.tqwidget.json')
  })
})

describe('worked', () => {
  it("is the widgets the quiz's widgetings work, in library order", () => {
    expect(labelsWorked(classicLayout()).slice(0, 2)).to.deep.eq(['dumdum', 'numnum_clueing'])
    expect(labelsWorked(classicLayout())).to.have.lengthOf(classicLayout().widgetings.length)
  })

  it("names a widget once, however many widgetings work it, and leaves out the ones none does", () => {
    const widgetings = [
      Widgeting.fill({ widget_label: 'answer_reversed', label: 'backwards' }),
      Widgeting.fill({ widget_label: 'dumdum', label: 'dumdum' }),
      Widgeting.fill({ widget_label: 'answer_reversed', label: 'backwards_again' }),
    ]
    expect(labelsWorked({ widgetings })).to.deep.eq(['dumdum', 'answer_reversed'])
  })

  it("leaves out a widgeting whose widget the library lacks", () => {
    expect(labelsWorked({ widgetings: [Widgeting.fill({ widget_label: 'nowhere_widget', label: 'lost' })] })).to.deep.eq([])
  })

  it("is nothing for a quiz with no widgetings", () => {
    expect(labelsWorked({ widgetings: [] })).to.deep.eq([])
  })
})

describe('the widget files', () => {
  const shout = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)', description: 'Loud.' })
  const whisper = Widget.fill({ label: 'whisper', formulary: 'jsonata', formula: '$lowercase(qn.title)' })
  const ShoutPath = 'tq/widget/pub/shout.tqwidget.json'

  it("holds each widget the quiz works as sorted, pretty-printed JSON", () => {
    const written = Quizgit.quizFiles(shouting(), [shout, whisper], Here).get(ShoutPath) ?? ''
    expect(JSON.parse(written)).to.deep.eq(structuredClone(shout))
    expect(written).to.include('\n  "description": "Loud.",\n  "formula": ')
    expect(written.endsWith('\n')).to.be.true
  })

  it("holds only the widgets the quiz works", () => {
    const paths = Quizgit.quizFiles(shouting(), [shout, whisper], Here).keys().toArray()
    expect(paths.filter((filepath) => filepath.startsWith('tq/widget/'))).to.deep.eq([ShoutPath])
  })

  it("is committed with the quiz, and a commit follows a change to a widget alone", async () => {
    const quiz = shouting([questionOf('quiet_otter', { clueing: 'Who?' })])
    await Quizgit.commitQuiz(suite.fs, quiz, [shout], Here, Changes.quizChanges(null, quiz))
    const louder = { ...shout, formula: "$uppercase(qn.title) & '!'" }
    const changed = await Quizgit.commitQuiz(suite.fs, quiz, [louder], Here, Changes.widgetChanges([shout], [louder]))
    expect(changed).to.be.a('string')
    expect(gitSays(quiz, 'show', `HEAD:${ShoutPath}`)).to.include("& '!'")
    expect(gitSays(quiz, 'log', '-1', '--format=%s')).to.eq('widgets ~shout')
  })

  it("leaves the repository when the quiz stops working it", async () => {
    const before = shouting([questionOf('quiet_otter')])
    await Quizgit.commitQuiz(suite.fs, before, [shout], Here, Changes.quizChanges(null, before))
    const after = { ...before, widgetings: [] }
    await Quizgit.commitQuiz(suite.fs, after, [shout], Here, Changes.quizChanges(before, after))
    expect(gitSays(after, 'ls-files').split('\n')).to.deep.eq([OursTsv, OursJson])
    expect(gitSays(after, 'status', '--porcelain')).to.eq('')
  })
})

describe('quizFiles', () => {
  it("is the questions table and the whole quiz at their nested paths, and nothing else for a quiz working no widgets", () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    expect(Quizgit.quizFiles(quiz, SeedWidgets, Here).keys().toArray()).to.deep.eq([OursTsv, OursJson])
  })

  it("adds a file per widget the quiz works, after the quiz's own", () => {
    const widgetings = ['dumdum', 'clueing_full'].map((label) => Widgeting.fill({ widget_label: label, label }))
    const quiz = quizOf([questionOf('quiet_otter')], { widgetings })
    expect(Quizgit.quizFiles(quiz, SeedWidgets, Here).keys().toArray()).to.deep.eq([
      OursTsv, OursJson, 'tq/widget/pub/dumdum.tqwidget.json', 'tq/widget/pub/clueing_full.tqwidget.json',
    ])
  })

  it('holds the whole quiz as JSON, which the TSV alone could never give back, as a smith is handed it', () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?', hint: 'BUT NOT a stoat', qnum: '3' })])
    const exported = Exporting.quizExported(quiz, runOf(quiz, [], Here))
    expect(JSON.parse(jsonOf(quiz))).to.deep.eq(structuredClone(exported))
  })

  it('pretty-prints it, so a diff reads as lines rather than as one enormous one', () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    const written = jsonOf(quiz)
    expect(written.split('\n').length).to.be.greaterThan(20)
    expect(written).to.include('\n  "title": ')
    expect(written).to.not.include('"id"')
    expect(written.endsWith('\n')).to.be.true
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
    expect(earlier).to.not.eq(later)
    expect(_.sortBy([later, earlier])).to.deep.eq([earlier, later])
  })
})

describe('commitFirst', () => {
  it('opens a history that has none, with the quiz as it stands', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    expect(await Quizgit.commitFirst(suite.fs, quiz, [], Here)).to.be.a('string')
    expect(gitSays(quiz, 'log', '--oneline')).to.include('+quiz')
    expect(gitSays(quiz, 'status', '--porcelain')).to.eq('')
  })

  it('does nothing where the history is already under way, so asking twice leaves one commit', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    await Quizgit.commitFirst(suite.fs, quiz, [], Here)
    expect(await Quizgit.commitFirst(suite.fs, quiz, [], Here)).to.be.null
    expect(gitSays(quiz, 'rev-list', '--count', 'HEAD')).to.eq('1')
  })

  it('leaves a history that an edit began exactly as the edit made it', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    const after = { ...before, questions: [{ ...present(before.questions[0]), clueing: 'Who dithers?' }] }
    await commitFresh(before)
    await commitStep(before, after)
    expect(await Quizgit.commitFirst(suite.fs, after, [], Here)).to.be.null
    expect(gitSays(after, 'rev-list', '--count', 'HEAD')).to.eq('2')
  })
})

describe('markTagFor', () => {
  it('reads as a milestone tag does, with the markkind where the m was', () => {
    expect(Quizgit.markTagFor('main', 'import', new Date('2026-09-18T18:45:04.123Z'))).to.eq('main-import-20260918184504z')
    expect(Quizgit.markTagFor('main', 'delete', new Date('2026-09-18T18:45:04.123Z'))).to.eq('main-delete-20260918184504z')
  })

  it('carries the version, however much it looks like the marker', () => {
    expect(Quizgit.markTagFor('m_two', 'import', new Date('2026-01-01T00:00:00.000Z'))).to.eq('m_two-import-20260101000000z')
  })

  it('sorts as text in the order the moments happened', () => {
    const earlier = Quizgit.markTagFor('main', 'delete', new Date('2026-09-18T09:00:00Z'))
    const later = Quizgit.markTagFor('main', 'delete', new Date('2026-09-18T10:00:00Z'))
    expect(earlier).to.not.eq(later)
    expect(_.sortBy([later, earlier])).to.deep.eq([earlier, later])
  })
})

describe('commitQuiz', () => {
  it('commits nothing at all when nothing changed', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    expect(await commitStep(quiz, quiz)).to.be.null
  })

  it('writes a repository the real git can read', async () => {
    const quiz = quizOf([questionOf('quiet_otter', { clueing: 'Who dithers?' })])
    await commitFresh(quiz)
    expect(gitSays(quiz, 'log', '--oneline')).to.include('+quiz')
    expect(gitSays(quiz, 'status', '--porcelain')).to.eq('')
  })

  it("tracks the quiz's files at their paths", async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    await commitFresh(quiz)
    expect(gitSays(quiz, 'ls-files').split('\n')).to.deep.eq([OursTsv, OursJson])
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
      'tq/hunt/deep_lake/realm/home/quiz/renamed.qq.tsv',
      'tq/hunt/deep_lake/realm/home/quiz/renamed.tq.json',
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

describe('markChange', () => {
  it('tags the commit the change landed in, leaving the commit before it untagged', async () => {
    const before = quizOf([questionOf('quiet_otter')])
    const after = { ...before, questions: [{ ...present(before.questions[0]), clueing: 'Imported' }] }
    await commitFresh(before)
    await commitStep(before, after)
    const tag = await Quizgit.markChange(suite.fs, after, 'import', new Date('2026-09-18T18:45:04.123Z'))

    expect(tag).to.eq('main-import-20260918184504z')
    const tagged = gitSays(after, 'rev-parse', present(tag))
    expect(tagged).to.eq(gitSays(after, 'rev-parse', 'HEAD'))
    expect(tagged).to.not.eq(gitSays(after, 'rev-parse', 'HEAD~1'))
  })

  it('does not clobber an earlier change of that kind made in the same second', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    await commitFresh(quiz)
    const at = new Date('2026-09-18T18:45:04.123Z')
    const first = await Quizgit.markChange(suite.fs, quiz, 'delete', at)
    const second = await Quizgit.markChange(suite.fs, quiz, 'delete', at)
    expect(second).to.eq(`${present(first)}-2`)
  })

  it('says there was nothing to tag where the quiz has no history yet', async () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    expect(await Quizgit.markChange(suite.fs, quiz, 'import')).to.be.null
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
    expect(saysHere('ls-files').split('\n')).to.deep.eq([OursTsv, OursJson])
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
    expect(Object.keys(entries).some((filepath) => filepath.startsWith('ours/.git/'))).to.be.true
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
    expect(repo).to.include({ id: quiz._id, label: 'ours', branch: 'main' })
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
      { id: quiz._id, label: null, branch: 'main', message: null, committed_at: null },
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
