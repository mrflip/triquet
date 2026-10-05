import nodeFs from 'node:fs'
import path from 'node:path'
import _ from 'es-toolkit/compat'
import { unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Huntfiles from '../../src/lib/huntfiles'
import * as Huntgit from '../../src/lib/huntgit'
import * as PA from '../../src/lib/vv/patterns'
import { gitIn, scratch, unzipInto, type ScratchT } from '../support/gitfs'
import { present } from '../support/present'

/** The throwaway directory this test is working in */
const suite = { at: null as ScratchT | null }
const here = () => present(suite.at, 'a scratch directory')

beforeEach(() => { suite.at = scratch() })
afterEach(() => { here().cleanup() })

/** The hunt every test commits to */
const Hunt = { _id: 'hunt_one', label: 'deep_lake' }

/** What the real git says about the hunt's repository */
function gitSays(...args: string[]): string {
  return gitIn(path.join(here().root, Huntgit.repopathFor(Hunt)), args)
}

/** Files by path, from pairs */
function filesOf(bag: Readonly<Record<string, string>>): Huntfiles.FilesT {
  return new Map(Object.entries(bag))
}

/** Commit `bag` as the hunt whole, on `branch` */
async function commitAll(bag: Readonly<Record<string, string>>, branch = 'main', message = 'start'): Promise<string | null> {
  return await Huntgit.commitWhole(here().fs, Hunt, branch, filesOf(bag), { keep: () => false, message })
}

/** Commit the change from `ante` to `post`, as only the files that differ, on `branch` */
async function commitStep(ante: Readonly<Record<string, string>>, post: Readonly<Record<string, string>>, branch = 'main', message = 'step'): Promise<string | null> {
  return await Huntgit.commitFiles(here().fs, Hunt, branch, Huntfiles.changesBetween(filesOf(ante), filesOf(post)), message)
}

const Start = { 'hunt.tqh.json': '{"label":"deep_lake"}\n', 'quizzes/home/legends.tqq.json': '{"title":"Legends"}\n', 'quizzes/home/paris.tqq.json': '{"title":"Paris"}\n' }

describe('repopathFor', () => {
  it("reads the doc block's example", () => {
    expect(Huntgit.repopathFor({ _id: 'j97abc' })).to.eq('/hunts/j97abc')
  })
})

describe('tagFor', () => {
  it("reads the doc block's examples", () => {
    expect(Huntgit.tagFor('main', 'legends', 'milestone', new Date('2026-09-18T18:45:04.123Z'))).to.eq('main_legends_m_20260918184504z')
    expect(Huntgit.tagFor('draft_two', 'legends', 'import', new Date('2026-09-18T18:45:04.123Z'))).to.eq('draft_two_legends_import_20260918184504z')
  })

  it("names a deletion of questions as such", () => {
    expect(Huntgit.tagFor('main', 'legends', 'delete', new Date('2026-01-01T00:00:00.000Z'))).to.eq('main_legends_delete_20260101000000z')
  })

  it("follows the label rule, as a ref an address names must", () => {
    for (const markkind of Huntgit.MarkkindVals) {
      expect(Huntgit.tagFor('draft_2', 'q1_legends', markkind, new Date())).to.match(PA.Label.re)
    }
  })

  it("sorts as text in the order the moments happened", () => {
    const earlier = Huntgit.tagFor('main', 'legends', 'milestone', new Date('2026-09-18T09:00:00Z'))
    const later = Huntgit.tagFor('main', 'legends', 'milestone', new Date('2026-09-18T10:00:00Z'))
    expect(_.sortBy([later, earlier])).to.deep.eq([earlier, later])
  })
})

describe('commitWhole', () => {
  it("starts the history on the hunt's branch, README and all, as a repository the real git reads", async () => {
    expect(await commitAll(Start, 'playtest')).to.be.a('string')
    expect(gitSays('rev-parse', '--abbrev-ref', 'HEAD')).to.eq('playtest')
    expect(gitSays('ls-files').split('\n')).to.deep.eq(['README.md', 'hunt.tqh.json', 'quizzes/home/legends.tqq.json', 'quizzes/home/paris.tqq.json'])
    expect(gitSays('show', 'HEAD:README.md')).to.eq(Huntfiles.Readme.trimEnd())
    expect(gitSays('status', '--porcelain')).to.eq('')
  })

  it("commits nothing when the tip already holds the files", async () => {
    await commitAll(Start)
    expect(await commitAll(Start, 'main', 'again')).to.be.null
    expect(gitSays('rev-list', '--count', 'HEAD')).to.eq('1')
  })

  it("commits what differs from the tip, and removes what the files no longer hold, the README kept", async () => {
    await commitAll(Start)
    await commitAll({ 'hunt.tqh.json': Start['hunt.tqh.json'], 'quizzes/home/legends.tqq.json': '{"title":"Legends, again"}\n' }, 'main', 'catch up')
    expect(gitSays('show', '--name-status', '--format=%s', 'HEAD').split('\n')).to.deep.eq(['catch up', '', 'M\tquizzes/home/legends.tqq.json', 'D\tquizzes/home/paris.tqq.json'])
    expect(gitSays('ls-files')).to.include('README.md')
  })

  it("leaves the paths it is told to keep as the tip has them", async () => {
    await commitAll(Start)
    const files = filesOf({ 'hunt.tqh.json': '{"label":"deep_lake","title":"Deep"}\n' })
    await Huntgit.commitWhole(here().fs, Hunt, 'main', files, { keep: (filepath) => filepath.includes('/paris'), message: 'catch up' })
    expect(gitSays('ls-files').split('\n')).to.deep.eq(['README.md', 'hunt.tqh.json', 'quizzes/home/paris.tqq.json'])
  })
})

describe('commitFiles', () => {
  it("commits only the files whose body changed, with the message it is handed", async () => {
    await commitAll(Start)
    const post = { ...Start, 'quizzes/home/legends.tqq.json': '{"title":"Legends, again"}\n' }
    expect(await commitStep(Start, post, 'main', 'legends: quiz ~title')).to.be.a('string')
    expect(gitSays('show', '--name-only', '--format=%s', 'HEAD').split('\n')).to.deep.eq(['legends: quiz ~title', '', 'quizzes/home/legends.tqq.json'])
    expect(gitSays('status', '--porcelain')).to.eq('')
  })

  it("commits nothing when the tip already holds the change, as when another tab committed it first", async () => {
    await commitAll(Start)
    const post = { ...Start, 'quizzes/home/legends.tqq.json': '{"title":"Legends, again"}\n' }
    await commitStep(Start, post)
    expect(await commitStep(Start, post)).to.be.null
    expect(gitSays('rev-list', '--count', 'HEAD')).to.eq('2')
  })

  it("removes a file, and passes over the removal of one the tip does not hold", async () => {
    await commitAll(Start)
    await commitStep({ ...Start, 'quizzes/home/gone.tqq.json': '{}\n' }, _.omit(Start, ['quizzes/home/paris.tqq.json']))
    expect(gitSays('ls-files').split('\n')).to.deep.eq(['README.md', 'hunt.tqh.json', 'quizzes/home/legends.tqq.json'])
  })

  it("starts a branch from the tip when the hunt moves to a new one, leaving the old line of work where it was", async () => {
    await commitAll(Start)
    await commitStep(Start, { ...Start, 'hunt.tqh.json': '{"branch":"draft_two"}\n' }, 'draft_two')
    expect(gitSays('rev-parse', '--abbrev-ref', 'HEAD')).to.eq('draft_two')
    expect(gitSays('rev-list', '--count', 'main')).to.eq('1')
    expect(gitSays('rev-list', '--count', 'draft_two')).to.eq('2')
  })

  it("returns to a branch it has seen before, its files as that branch left them", async () => {
    await commitAll(Start)
    const drafted = { ...Start, 'quizzes/home/paris.tqq.json': '{"title":"Drafted"}\n' }
    await commitStep(Start, drafted, 'draft_two')
    const renamed = { ...Start, 'quizzes/home/legends.tqq.json': '{"title":"Renamed"}\n' }
    await commitStep(Start, renamed, 'main')
    expect(gitSays('rev-parse', '--abbrev-ref', 'HEAD')).to.eq('main')
    expect(gitSays('show', 'HEAD:quizzes/home/paris.tqq.json')).to.eq('{"title":"Paris"}')
    expect(gitSays('status', '--porcelain')).to.eq('')
  })
})

describe('markTip', () => {
  const At = new Date('2026-09-18T18:45:04.123Z')

  it("tags the tip of the hunt's branch, naming the quiz it was marked from", async () => {
    await commitAll(Start)
    const tag = await Huntgit.markTip(here().fs, Hunt, 'main', 'legends', 'milestone', At)
    expect(tag).to.eq('main_legends_m_20260918184504z')
    expect(gitSays('rev-list', '-n', '1', String(tag))).to.eq(gitSays('rev-parse', 'HEAD'))
  })

  it("does not clobber an earlier tag of the same second", async () => {
    await commitAll(Start)
    const first = await Huntgit.markTip(here().fs, Hunt, 'main', 'legends', 'import', At)
    const second = await Huntgit.markTip(here().fs, Hunt, 'main', 'legends', 'import', At)
    expect(second).to.eq(`${String(first)}_2`)
    expect(second).to.match(PA.Label.re)
  })

  it("starts the branch a hunt was switched to since its last commit, so the tag marks where it begins", async () => {
    await commitAll(Start)
    const tag = await Huntgit.markTip(here().fs, Hunt, 'playtest', 'legends', 'milestone', At)
    expect(tag).to.eq('playtest_legends_m_20260918184504z')
    expect(gitSays('rev-parse', '--abbrev-ref', 'HEAD')).to.eq('playtest')
  })

  it("says there was nothing to tag where the hunt has no history yet", async () => {
    expect(await Huntgit.markTip(here().fs, Hunt, 'main', 'legends', 'milestone')).to.be.null
  })
})

describe('hasHistory', () => {
  it("is false before the first commit and true after", async () => {
    expect(await Huntgit.hasHistory(here().fs, Hunt)).to.be.false
    await commitAll(Start)
    expect(await Huntgit.hasHistory(here().fs, Hunt)).to.be.true
  })
})

describe('zipHuntRepo', () => {
  it("packages a repository that git still recognises once unzipped, in a folder named for the hunt", async () => {
    await commitAll(Start)
    await commitStep(Start, { ...Start, 'quizzes/home/paris.tqq.json': '{"title":"Paris, again"}\n' }, 'main', 'paris: quiz ~title')
    await Huntgit.markTip(here().fs, Hunt, 'main', 'paris', 'milestone', new Date('2026-09-18T18:45:04.123Z'))

    const unpacked = path.join(here().root, 'unpacked')
    unzipInto(await Huntgit.zipHuntRepo(here().fs, Hunt), unpacked)
    const clone = path.join(unpacked, 'deep_lake')
    expect(gitIn(clone, ['log', '--format=%s']).split('\n')).to.deep.eq(['paris: quiz ~title', 'start'])
    expect(gitIn(clone, ['tag', '--list'])).to.eq('main_paris_m_20260918184504z')
    expect(gitIn(clone, ['status', '--porcelain'])).to.eq('')
  })
})

// --- The per-quiz repositories of before

/** A per-quiz repository of before, as the app once wrote it, for the quiz `id` labelled `label`: one commit, made by the real git */
function legacyRepo(id: string, label: string, message: string): void {
  const dir = path.join(here().root, Huntgit.QuizReposRoot, id)
  const filepath = `tq/hunt/deep_lake/realm/home/quiz/${label}.tq.json`
  nodeFs.mkdirSync(path.join(dir, path.dirname(filepath)), { recursive: true })
  nodeFs.writeFileSync(path.join(dir, filepath), '{}\n')
  gitIn(dir, ['init', '--quiet', '--initial-branch=main'])
  gitIn(dir, ['add', '.'])
  gitIn(dir, ['-c', 'user.name=Triquet', '-c', 'user.email=triquet@localhost', 'commit', '--quiet', '-m', message])
}

/** A repository summary for the quiz `id`, with nothing in it that the test is not about */
function summaryOf(id: string): Huntgit.RepoSummary {
  return { id, label: id, branch: 'main', message: null, committed_at: null }
}

describe('listQuizRepos', () => {
  it("finds nothing where no history was kept", async () => {
    expect(await Huntgit.listQuizRepos(here().fs)).to.deep.eq([])
  })

  it("summarises each repository: its quiz, branch and latest commit", async () => {
    legacyRepo('quiz_one', 'quiet_otter', '+quiz')
    const [repo] = await Huntgit.listQuizRepos(here().fs)
    expect(repo).to.include({ id: 'quiz_one', label: 'quiet_otter', branch: 'main', message: '+quiz' })
    expect(repo?.committed_at).to.be.closeTo(Date.now(), 60_000)
  })

  it("leaves out a directory that is not a repository, and the hunts' repositories", async () => {
    nodeFs.mkdirSync(path.join(here().root, Huntgit.QuizReposRoot, 'stray'), { recursive: true })
    await commitAll(Start)
    expect(await Huntgit.listQuizRepos(here().fs)).to.deep.eq([])
  })
})

describe('orphansAmong', () => {
  it("keeps the repositories no quiz answers to, in the order given", () => {
    const repos = ['gone', 'kept', 'lost'].map((id) => summaryOf(id))
    expect(Huntgit.orphansAmong(repos, new Set(['kept'])).map((repo) => repo.id)).to.deep.eq(['gone', 'lost'])
  })

  it("finds no orphans where every repository has its quiz", () => {
    expect(Huntgit.orphansAmong([summaryOf('kept')], new Set(['kept', 'other']))).to.deep.eq([])
  })
})

/** Every path in the zip of the quiz `quiz_one`'s repository, foldered under `label` */
async function pathsIn(label: string | null): Promise<string[]> {
  const zipped = await Huntgit.zipQuizRepo(here().fs, { id: 'quiz_one', label })
  return Object.keys(unzipSync(zipped))
}

describe('zipQuizRepo', () => {
  it("folders a repository of before under its quiz's label, or its id when it has none", async () => {
    legacyRepo('quiz_one', 'quiet_otter', '+quiz')
    expect(await pathsIn('quiet_otter')).to.include('quiet_otter/.git/HEAD')
    expect(await pathsIn(null)).to.include('quiz_one/.git/HEAD')
  })
})
