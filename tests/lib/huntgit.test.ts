import nodeFs from 'node:fs'
import path from 'node:path'
import _ from 'es-toolkit/compat'
import { unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// --- Every hunt's repository this browser holds

/** The hunt that is not `Hunt`, for the listings */
const OtherHunt = { _id: 'hunt_two', label: 'high_moor' }

/** Commit `bag` as `hunt` whole, at the moment `at` */
async function commitAt(hunt: Readonly<Huntgit.RepoKeyT>, bag: Readonly<Record<string, string>>, at: string, message = 'start'): Promise<void> {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(at) })
  try {
    await Huntgit.commitWhole(here().fs, hunt, 'main', filesOf(bag), { keep: () => false, message })
  } finally {
    vi.useRealTimers()
  }
}

/** A repository summary for the hunt `_id`, with nothing in it that the test is not about */
function summaryOf(_id: string): Huntgit.HuntRepoT {
  return { _id, label: _id, branch: 'main', message: 'start', committed_at: 0 }
}

describe('listHuntRepos', () => {
  it("finds nothing where no history was kept", async () => {
    expect(await Huntgit.listHuntRepos(here().fs)).to.deep.eq([])
  })

  it("summarises each repository: its hunt by the label at the tip, its branch, and its latest commit's first line", async () => {
    await commitAt(Hunt, Start, '2026-10-05T12:00:00Z')
    await commitAt(Hunt, { ...Start, 'hunt.tqh.json': '{"label":"deeper_lake"}\n' }, '2026-10-05T12:01:00Z', '~hunt\n\nhunt: ~label')
    expect(await Huntgit.listHuntRepos(here().fs)).to.deep.eq([
      { _id: 'hunt_one', label: 'deeper_lake', branch: 'main', message: '~hunt', committed_at: Date.parse('2026-10-05T12:01:00Z') },
    ])
  })

  it("lists the newest work first", async () => {
    await commitAt(Hunt, Start, '2026-10-05T12:00:00Z')
    await commitAt(OtherHunt, { 'hunt.tqh.json': '{"label":"high_moor"}\n' }, '2026-10-05T13:00:00Z')
    const repos = await Huntgit.listHuntRepos(here().fs)
    expect(repos.map((repo) => repo.label)).to.deep.eq(['high_moor', 'deep_lake'])
  })

  it("names a repository by its hunt's id where the tip holds no hunt file fit to read", async () => {
    await commitAt(Hunt, { 'quizzes/home/legends.tqq.json': '{}\n' }, '2026-10-05T12:00:00Z')
    await commitAt(OtherHunt, { 'hunt.tqh.json': '{"label":"Not A Label"}\n' }, '2026-10-05T12:00:00Z')
    const repos = await Huntgit.listHuntRepos(here().fs)
    expect(repos.map((repo) => repo.label)).to.have.members(['hunt_one', 'hunt_two'])
  })

  it("leaves out a directory that is not a repository, one with nothing committed, and the per-quiz repositories of before", async () => {
    nodeFs.mkdirSync(path.join(here().root, Huntgit.RepoRoot, 'stray'), { recursive: true })
    const empty = path.join(here().root, Huntgit.repopathFor(OtherHunt))
    nodeFs.mkdirSync(empty, { recursive: true })
    gitIn(empty, ['init', '--quiet', '--initial-branch=main'])
    const legacy = path.join(here().root, 'quizzes', 'quiz_one')
    nodeFs.mkdirSync(legacy, { recursive: true })
    gitIn(legacy, ['init', '--quiet', '--initial-branch=main'])
    expect(await Huntgit.listHuntRepos(here().fs)).to.deep.eq([])
  })
})

describe('orphansAmong', () => {
  it("keeps the repositories no hunt answers to, in the order given", () => {
    const repos = ['gone', 'kept', 'lost'].map((_id) => summaryOf(_id))
    expect(Huntgit.orphansAmong(repos, new Set(['kept'])).map((repo) => repo._id)).to.deep.eq(['gone', 'lost'])
  })

  it("finds no orphans where every repository has its hunt", () => {
    expect(Huntgit.orphansAmong([summaryOf('kept')], new Set(['kept', 'other']))).to.deep.eq([])
  })
})

describe('zipHuntRepo, of a listed repository', () => {
  it("folders it under the label the listing gives it", async () => {
    await commitAt(Hunt, { ...Start, 'hunt.tqh.json': '{"label":"deeper_lake"}\n' }, '2026-10-05T12:00:00Z')
    const [repo] = await Huntgit.listHuntRepos(here().fs)
    const zipped = await Huntgit.zipHuntRepo(here().fs, present(repo, 'a listed repository'))
    expect(Object.keys(unzipSync(zipped))).to.include('deeper_lake/.git/HEAD')
  })
})
