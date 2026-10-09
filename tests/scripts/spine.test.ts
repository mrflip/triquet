import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as E2eLog from '../../scripts/e2e-log'
import * as Spine from '../../scripts/spine'

const RepoRoot = path.resolve(import.meta.dirname, '../..')
const SpineScript = path.join(RepoRoot, 'scripts', 'spine.ts')
const LanesScript = path.resolve(import.meta.dirname, '../../scripts/lanes.ts')

/** Today's datestamp, as branch names lead */
const Today = new Date().toLocaleDateString('sv').replaceAll('-', '')

describe('Spine.mainCheckoutOf', () => {
  it('names the checkout git worktree lists first', () => {
    const porcelain = 'worktree /workspace/triquet\nHEAD 1a2b\nbranch refs/heads/x\n\nworktree /home/node/worktrees/triquet/y\nHEAD 3c4d\n'
    expect(Spine.mainCheckoutOf(porcelain)).to.eq('/workspace/triquet')
  })

  it('refuses a listing naming no checkout', () => {
    expect(() => Spine.mainCheckoutOf('')).to.throw('named no checkout')
  })
})

describe('Spine.pathsOfStatus', () => {
  const StatusCases: [string, string[], string][] = [
    ['?? whiteboard/a.md\0',                        ['whiteboard/a.md'],                         'an untracked file'],
    [' M notes/b.md\0D  human/c.md\0',              ['notes/b.md', 'human/c.md'],                'a modified file and a deleted one'],
    ['?? whiteboard/a.md\0R  notes/new.md\0notes/old.md\0', ['whiteboard/a.md', 'notes/new.md', 'notes/old.md'], 'both sides of a rename'],
    ['',                                            [],                                          'nothing at all'],
  ]
  for (const [porcelain, expected, blurb] of StatusCases) {
    it(blurb, () => {
      expect(Spine.pathsOfStatus(porcelain)).to.deep.eq(expected)
    })
  }
})

describe('Spine.isLabel', () => {
  it('takes a branch label, and refuses what newb would', () => {
    expect(Spine.isLabel('grid_fix')).to.be.true
    expect(Spine.isLabel('Grid-Fix')).to.be.false
    expect(Spine.isLabel('9lives')).to.be.false
    expect(Spine.isLabel('double__underscore')).to.be.false
  })
})

describe('Spine.isDocsOnly', () => {
  const DocsCases: [string[], boolean, string][] = [
    [['notes/stack.md', 'whiteboard/20261006-x/shot.png'], true,  'notes, and anything at all under whiteboard/'],
    [['human/20261006-x.md', 'README.md'],                 true,  'human/ entries and a top-level document'],
    [['.claude/agents/thread-worker.md'],                  true,  "an agent's definition, which is a document"],
    [[],                                                   true,  'a branch changing nothing'],
    [['src/content/about.md'],                             false, 'app content the build compiles, though it is markdown'],
    [['notes/stack.md', 'scripts/spine.ts'],               false, 'a document beside code'],
    [['human.ts'],                                         false, 'a file only named like a docs directory'],
  ]
  for (const [filepaths, expected, blurb] of DocsCases) {
    it(blurb, () => {
      expect(Spine.isDocsOnly(filepaths)).to.eq(expected)
    })
  }
})

describe('Spine.e2eWatched', () => {
  const WatchedCases: [string[], string[], string][] = [
    // paths e2e cannot notice:
    [['tests/scripts/spine.test.ts', 'scripts/git-attic', 'notes/stack.md'], [],                                    'a unit test, a housekeeping script and a note'],
    [['.claude/skills/sprint/SKILL.md', 'eslint.config.mjs'],                [],                                    "an agent's skill, and the lint configuration"],
    [['tests/support/convex.ts'],                                            [],                                    'the support of the unit tests'],
    [[],                                                                     [],                                    'a branch changing nothing'],
    // paths it runs on or exercises:
    [['scripts/spine.ts', 'src/lib/useful.ts', 'tests/lib/useful.test.ts'],  ['scripts/spine.ts', 'src/lib/useful.ts'], 'the harness and app code, beside a test of it'],
    [['e2e/widgets.spec.ts'],                                                ['e2e/widgets.spec.ts'],               'an e2e spec'],
    [['convex/schema.ts'],                                                   ['convex/schema.ts'],                  "the server's functions"],
    [['scripts/convex_dev', 'scripts/lanes.ts', 'scripts/doppledo'],         ['scripts/convex_dev', 'scripts/lanes.ts', 'scripts/doppledo'], 'the scripts the suite starts its backend and its lane with'],
    [['package.json', 'pnpm-lock.yaml'],                                     ['package.json', 'pnpm-lock.yaml'],    'the dependencies'],
    [['src/content/about.md'],                                               ['src/content/about.md'],              'app content, though it is markdown'],
    [['.github/workflows/ci.yml'],                                           ['.github/workflows/ci.yml'],          "CI's own configuration"],
    // weird cases:
    [['scripts/brand_new_script'],                                           ['scripts/brand_new_script'],          'a script nobody has listed, which is watched until someone says otherwise'],
    [['tests.ts', 'human.ts'],                                               ['tests.ts', 'human.ts'],              'files only named like the directories that are not watched'],
  ]
  for (const [filepaths, expected, blurb] of WatchedCases) {
    it(`finds ${expected.length === 0 ? 'nothing in' : 'the watched among'} ${blurb}`, () => {
      expect(Spine.e2eWatched(filepaths)).to.deep.equal(expected)
    })
  }
})

/** The spec files of the specs named, as `reachOf` lists them */
const specfiles = (...specnames: string[]) => specnames.map((specname) => `e2e/${specname}.spec.ts`)

/** Every spec file there, as the map's checks of what exists see it */
const Everywhere = () => true

/** No spec file there */
const Nowhere = () => false

/** The review spec alone there */
const OnlyReviews = (specfile: string) => specfile === 'e2e/reviews.spec.ts'

describe('Spine.reachOf', () => {
  const GridFiles = specfiles('grid', 'chaining', 'ordering', 'archiving', 'ishes', 'estimates', 'entries')
  const RoutingFiles = specfiles('routing', 'brand', 'failing-pages')
  const ReachCases: [string, string, string[] | 'all', string][] = [
    // a corner:
    ['src/components/QuestionRow.tsx',      'the grid',                     GridFiles,                                     'a row of the grid reaches the specs that drive the rows'],
    ['src/components/cells/chain.tsx',      'the chain cell',               [...GridFiles, 'e2e/reviews.spec.ts'],         'a cell a review shows too reaches the review spec besides'],
    ['src/components/SortableList.tsx',     'the gear',                     specfiles('widgets', 'prompts', 'entries', 'quizzes', 'quiz-entries'), 'a list only the gear drags, though it sounds like the grid'],
    ['src/components/QuizSwitcher.tsx',     'the quiz switcher',            specfiles('quizzes', 'routing'),               'the doc block example'],
    ['src/app/(synced)/error.tsx',          'the error boundary',           specfiles('failing-pages'),                    'the error boundary, though it sits among the synced pages'],
    ['src/app/(synced)/stats/page.tsx',     'the stats page',               specfiles('stats'),                            'the stats page, though it sits among the synced pages'],
    ['src/app/(synced)/page.tsx',           'the way in and the addresses', RoutingFiles,                                  'the front door'],
    ['src/app/(synced)/my/hunts/page.tsx',  'the hunts',                    [...RoutingFiles, 'e2e/quiz-history.spec.ts'], 'the hunts list'],
    ['src/app/api/ask/route.ts',            'asking',                       specfiles('asking', 'bots', 'failures', 'prompts', 'ishes', 'client-first'), 'the one server function'],
    ['src/components/panels/spread-chart.ts', 'the category spread',        specfiles('estimates', 'panels'),              'a file of a family named by its prefix'],
    ['public/brand/mark.svg',               'the brand',                    specfiles('brand'),                            'a file under a directory the brand owns'],
    // a spec:
    ['e2e/grid.spec.ts',                    'its own spec',                 ['e2e/grid.spec.ts'],                          'a spec reaches itself'],
    // nothing:
    ['tests/scripts/spine.test.ts',         'nothing e2e notices',          [],                                            'a unit test'],
    ['notes/testing.md',                    'nothing e2e notices',          [],                                            'a note'],
    // the whole suite:
    ['convex/schema.ts',                    'the whole suite',              'all',                                         "the server's schema"],
    ['src/models/question.ts',              'the whole suite',              'all',                                         'a model'],
    ['src/components/use-draft.ts',         'the whole suite',              'all',                                         'the draft every screen edits through'],
    ['src/state/hunt-mirror.ts',            'the whole suite',              'all',                                         'the history mirror every write of every quiz screen is tracked through'],
    ['src/state/hunt-feed.ts',              'the whole suite',              'all',                                         'the feed every quiz screen runs into the mirror'],
    ['src/state/commit-scheduler.ts',       'the whole suite',              'all',                                         "the mirror's commit scheduler, beneath every quiz screen"],
    ['src/lib/huntgit.ts',                  'the whole suite',              'all',                                         "the mirror's git, beneath every quiz screen"],
    ['src/lib/huntfiles.ts',                'the whole suite',              'all',                                         'the files the feed writes, beneath every quiz screen'],
    ['src/components/HuntBranch.tsx',       'the quiz history',             specfiles('quiz-history', 'panels'),           "the hunt page's branch switcher, which no quiz screen draws"],
    ['src/components/FullHistoryDownload.tsx', 'the whole suite',           'all',                                         "the history download, which every quiz screen's Export tab mounts"],
    ['src/content/full-history.md',         'the whole suite',              'all',                                         'the help the history download opens, beneath every quiz screen'],
    ['src/components/HuntRepoList.tsx',     'the hunt histories listed',    specfiles('quiz-history', 'routing'),          'the histories a browser holds, which a quiz screen lists only when its quiz is missing'],
    ['src/components/cells/fields.tsx',     'the whole suite',              'all',                                         'the text fields every screen has, though a cell'],
    ['src/app/(synced)/layout.tsx',         'the whole suite',              'all',                                         'the layout every synced page opens in'],
    ['src/app/(synced)/[org]/[hunt]/quizzes/[realm]/[quiz]/page.tsx', 'the whole suite', 'all',                          'the quiz page every grid spec works on'],
    ['src/components/QuizRoute.tsx',        'the whole suite',              'all',                                         'the frame of every quiz screen'],
    ['src/state/use-ident.ts',              'the whole suite',              'all',                                         'who the visitor is, which every quiz screen asks'],
    ['src/lib/routes.ts',                   'the whole suite',              'all',                                         'the addresses every quiz screen is opened by'],
    ['src/components/SiteHeader.tsx',       'the whole suite',              'all',                                         'the header every page draws'],
    ['e2e/support.ts',                      'the whole suite',              'all',                                         'the support every spec imports'],
    ['scripts/spine.ts',                    'the whole suite',              'all',                                         'the harness the suite runs through'],
    ['package.json',                        'the whole suite',              'all',                                         'the dependencies'],
    // weird cases:
    ['src/components/Brandnew.tsx',         'the whole suite',              'all',                                         'a component no corner names yet'],
    ['e2e/grid.spec.tsx',                   'the whole suite',              'all',                                         'a file only named like a spec'],
  ]
  for (const [filepath, corner, specs, blurb] of ReachCases) {
    it(blurb, () => {
      expect(Spine.reachOf(filepath, Everywhere)).to.deep.eq({ corner, specs })
    })
  }

  it("reads the doc block's example of the whole suite", () => {
    expect(Spine.reachOf('convex/schema.ts', Everywhere)).to.deep.eq({ corner: 'the whole suite', specs: 'all' })
  })

  it('skips the spec files of a corner that are not there', () => {
    expect(Spine.reachOf('src/components/FoldButton.tsx', OnlyReviews)).to.deep.eq({ corner: 'the fold buttons', specs: ['e2e/reviews.spec.ts'] })
  })

  it('reaches the whole suite from a corner none of whose spec files are there yet, and from a spec removed', () => {
    expect(Spine.reachOf('src/components/Stats.tsx', Nowhere)).to.deep.eq({ corner: 'the whole suite, as the stats page has no spec file yet', specs: 'all' })
    expect(Spine.reachOf('e2e/gone.spec.ts', Nowhere)).to.deep.eq({ corner: 'the whole suite, for a spec removed', specs: 'all' })
  })
})

describe('Spine.scopeOf and reachingWhole', () => {
  it("reads the doc blocks' examples", () => {
    expect(Spine.scopeOf(['src/components/QuizSwitcher.tsx', 'tests/lib/useful.test.ts'], Everywhere)).to.deep.eq(specfiles('quizzes', 'routing'))
    expect(Spine.reachingWhole(['src/components/QuizSwitcher.tsx', 'convex/schema.ts'], Everywhere)).to.deep.eq(['convex/schema.ts'])
  })

  it('takes the union of the corners reached, each spec file once, sorted', () => {
    const scope = Spine.scopeOf(['src/components/QuizSwitcher.tsx', 'src/components/QuizHeader.tsx', 'e2e/brand.spec.ts'], Everywhere)
    expect(scope).to.deep.eq(specfiles('brand', 'grid', 'quizzes', 'routing'))
  })

  it('is empty when nothing reaches a spec, and leaves the whole suite to reachingWhole', () => {
    expect(Spine.scopeOf(['tests/a.test.ts', 'notes/b.md'], Everywhere)).to.deep.eq([])
    expect(Spine.scopeOf(['convex/schema.ts'], Everywhere)).to.deep.eq([])
    expect(Spine.reachingWhole(['tests/a.test.ts', 'src/components/Logo.tsx'], Everywhere)).to.deep.eq([])
  })
})

describe('Spine.outsideScope', () => {
  const Proved = specfiles('quizzes', 'routing')
  it("reads the doc block's example", () => {
    expect(Spine.outsideScope(['src/components/QuizSwitcher.tsx', 'src/components/Logo.tsx'], Proved, Everywhere)).to.deep.eq(['src/components/Logo.tsx'])
  })

  it('finds nothing outside when every path reaches inside the scope, or reaches nothing', () => {
    expect(Spine.outsideScope(['src/components/QuizSwitcher.tsx', 'e2e/quizzes.spec.ts', 'tests/a.test.ts'], Proved, Everywhere)).to.deep.eq([])
  })

  it('names a path reaching the whole suite, and one whose corner only overlaps the scope', () => {
    expect(Spine.outsideScope(['convex/schema.ts', 'src/components/QuizHeader.tsx'], Proved, Everywhere)).to.deep.eq(['convex/schema.ts', 'src/components/QuizHeader.tsx'])
  })
})

describe('Spine.SpecCorners', () => {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the installed git, as the script under test runs
  const tracked = execFileSync('git', ['ls-files'], { cwd: RepoRoot, encoding: 'utf8' }).split('\n').filter(Boolean)
  const specnames = tracked.flatMap((filepath) => /^e2e\/([^/]+)\.spec\.ts$/.exec(filepath)?.slice(1, 2) ?? [])
  const named = new Set(Spine.SpecCorners.flatMap(({ specs }) => specs))
  /** Spec files the map names ahead of their being written */
  const NotYetWritten = new Set(['stats', 'failing-pages'])

  it('names only paths the tree holds, so a rename cannot leave a corner looking at nothing', () => {
    const missing = Spine.SpecCorners.flatMap(({ paths }) => paths).filter((prefix) => tracked.every((filepath) => ! filepath.startsWith(prefix)))
    expect(missing).to.deep.eq([])
  })

  it('names only spec files the suite has, or that are being written beside it', () => {
    expect([...named].filter((specname) => ! specnames.includes(specname) && ! NotYetWritten.has(specname))).to.deep.eq([])
  })

  it('puts every spec file of the suite in some corner, so a new one is given its place', () => {
    expect(specnames.filter((specname) => ! named.has(specname))).to.deep.eq([])
  })
})

describe('the smoke tier `pnpm e2e:smoke` runs', () => {
  it('tags exactly one test of each spec file @smoke', () => {
    const specdir = path.join(RepoRoot, 'e2e')
    const tagged = fs.readdirSync(specdir).filter((filename) => filename.endsWith('.spec.ts'))
      .map((filename) => [filename, fs.readFileSync(path.join(specdir, filename), 'utf8').match(/tag: '@smoke'/g)?.length ?? 0] as const)
    expect(tagged.filter(([, count]) => count !== 1)).to.deep.eq([])
  })
})

describe('Spine.skippingE2e', () => {
  const Quiet = ['tests/scripts/spine.test.ts', 'scripts/git-attic']
  const Watched = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts', 'src/f.ts']

  it('refuses with no reason, saying how to skip when e2e could notice nothing', () => {
    const refuse = () => Spine.skippingE2e('20261006-x', Quiet, undefined)
    expect(refuse).to.throw(Spine.SpineStop, /no e2e proof/)
    expect(refuse).to.throw(/None of the paths it changes is one the e2e suite runs on or exercises/)
    expect(refuse).to.throw(/--skip-e2e "<why>"/)
    expect(refuse).to.throw(/When e2e is not worth running/)
  })

  it('refuses with no reason, naming a few of the paths e2e could notice, and telling the branch to run it', () => {
    expect(() => Spine.skippingE2e('20261006-x', Watched, undefined)).to.throw(/exercises 6 of the paths it changes \(src\/a\.ts, src\/b\.ts, src\/c\.ts, src\/d\.ts, and 2 more\): run it\./)
    expect(() => Spine.skippingE2e('20261006-x', Watched, undefined)).not.to.throw(/--skip-e2e "<why>"/)
  })

  it('goes without a proof, given a reason, and says to put the reason in the PR', () => {
    expect(Spine.skippingE2e('20261006-x', Quiet, ' only a script of housekeeping ')).to.deep.equal([
      "e2e skipped: only a script of housekeeping. Say so in the PR's Tests: line; CI runs the suite on the PR.",
    ])
  })

  it('goes without a proof on a reason even when e2e could notice the paths, and warns that it could', () => {
    const said = Spine.skippingE2e('20261006-x', ['src/a.ts', 'src/b.ts'], 'I read it and it cannot')
    expect(said).to.have.lengthOf(2)
    expect(said[1]).to.equal('Careful: e2e runs on or exercises src/a.ts, src/b.ts. A red CI e2e is yours to repair.')
  })

  it('refuses a reason that is blank', () => {
    expect(() => Spine.skippingE2e('20261006-x', Quiet, '  ')).to.throw(Spine.SpineStop, /takes the reason/)
  })
})

describe('Spine.skipE2eOf', () => {
  it('is nothing when `land` is given nothing', () => {
    expect(Spine.skipE2eOf([])).to.be.undefined
  })

  it('is the reason that follows --skip-e2e', () => {
    expect(Spine.skipE2eOf(['--skip-e2e', 'only a script'])).to.equal('only a script')
    expect(Spine.skipE2eOf(['--skip-e2e=only a script'])).to.equal('only a script')
  })

  const RefusedCases: [string[], string][] = [
    [['--skip-e2e'],               'the option with no reason after it'],
    [['--bogus'],                  'an option `land` does not have'],
    [['whatever'],                 'a word that is not an option'],
  ]
  for (const [args, blurb] of RefusedCases) {
    it(`refuses ${blurb}`, () => {
      expect(() => Spine.skipE2eOf(args)).to.throw(Spine.SpineStop, /Usage/)
    })
  }
})

describe('Spine.landOptionsOf', () => {
  it('is nothing of either when `land` is given nothing', () => {
    expect(Spine.landOptionsOf([])).to.deep.equal({ skipE2e: undefined, into: undefined })
  })

  it('is the branch that follows --into, beside the reason that follows --skip-e2e', () => {
    expect(Spine.landOptionsOf(['--into', '20261008-alpha'])).to.deep.equal({ skipE2e: undefined, into: '20261008-alpha' })
    expect(Spine.landOptionsOf(['--skip-e2e', 'only a script', '--into=20261008-alpha'])).to.deep.equal({ skipE2e: 'only a script', into: '20261008-alpha' })
  })

  const RefusedCases: [string[], string][] = [
    [['--into'],                   'the option with no branch after it'],
    [['--bogus'],                  'an option `land` does not have'],
    [['20261008-alpha'],           'a branch not named by --into'],
  ]
  for (const [args, blurb] of RefusedCases) {
    it(`refuses ${blurb}`, () => {
      expect(() => Spine.landOptionsOf(args)).to.throw(Spine.SpineStop, /Usage/)
    })
  }
})

describe('Spine.takesE2eLock', () => {
  const cases = [
    ['a full run', [], {}, true],
    ['a touched run', ['--touched'], {}, true],
    ['a rerun', ['--last-failed', '--workers=1'], {}, false],
    ['chosen specs', ['e2e/grid.spec.ts'], {}, false],
    ['the smoke tier', ['--grep', '@smoke'], {}, false],
    ['a full run in CI', [], { CI: 'true' }, false],
    ['a full run started by one holding the lock for it', [], { TRIQUET_E2E_WAITED_S: '0' }, false],
    ['a full run where CI is set but empty', [], { CI: '' }, true],
  ] as const
  for (const [blurb, args, env, expected] of cases) {
    it(`is ${String(expected)} for ${blurb}`, () => {
      expect(Spine.takesE2eLock(args, env)).to.eq(expected)
    })
  }
})

describe('Spine.e2eWaitSaid', () => {
  const now = Date.parse('2026-10-07T12:05:00.000Z')
  const holder = { pid: 4242, lane: 2, branch: '20261007-other', root: '/home/node/worktrees/triquet/other', kind: 'full', since: '2026-10-07T12:02:00.000Z' } as const
  const waiter = { branch: '20261007-mine', kind: 'full', inMain: false } as const

  it("reads the doc block's example: a holder that has not written its note", () => {
    expect(Spine.e2eWaitSaid(undefined, waiter, now, true)[0]).to.eq('The e2e lock is held, by a run that has not yet said whose.')
  })

  it('names the holder by lane, run, branch, checkout and process, says since when, and what this run does next', () => {
    const said = Spine.e2eWaitSaid(holder, waiter, now, true).join('\n')
    expect(said).to.contain("held by lane 2's full run of 20261007-other (/home/node/worktrees/triquet/other, pid 4242), since ").and.contain(', 3 min ago.')
    expect(said).to.contain('catches 20261007-mine up with the top first (`pnpm catchup`)').and.contain('then runs the whole suite')
    expect(said).not.to.contain('process is gone')
  })

  it('says when the holder is gone, a touched run that it chooses its corner afresh, and the main checkout that it catches up with nothing', () => {
    const said = Spine.e2eWaitSaid(holder, { branch: 'main-ish', kind: 'touched', inMain: true }, now, false).join('\n')
    expect(said).to.contain('Its process is gone, so the lock frees itself within 30 s.')
    expect(said).to.contain('this run, in the main checkout, chooses its corner afresh and runs it').and.not.contain('catchup')
  })
})

describe('Spine.withSpineHeld', () => {
  let scratch: string
  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-spine-lock-'))
  })
  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true })
  })

  it('holds the spine while acting, and lets go after', () => {
    const held = Spine.withSpineHeld(scratch, 'testing', () => fs.existsSync(path.join(scratch, 'triquet-spine.lock')))
    expect(held).to.be.true
    expect(fs.existsSync(path.join(scratch, 'triquet-spine.lock'))).to.be.false
  })

  it('lets go when the act throws', () => {
    expect(() => Spine.withSpineHeld(scratch, 'testing', () => { throw new Error('boom') })).to.throw('boom')
    expect(fs.existsSync(path.join(scratch, 'triquet-spine.lock'))).to.be.false
  })

  it('takes over a hold whose process is gone', () => {
    const lockdir = path.join(scratch, 'triquet-spine.lock')
    fs.mkdirSync(lockdir)
    fs.writeFileSync(path.join(lockdir, 'holder'), JSON.stringify({ pid: (2 ** 22) + 1, purpose: 'long gone' }))
    expect(Spine.withSpineHeld(scratch, 'testing', () => 'acted')).to.eq('acted')
  })
})

// A git that reads no one's own config, and names a fixed author.
const isolatedEnv = (home: string) => ({
  ...process.env,
  HOME:                home,
  XDG_CONFIG_HOME:     home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME:     'Tess Ter',
  GIT_AUTHOR_EMAIL:    'tess@example.com',
  GIT_COMMITTER_NAME:  'Tess Ter',
  GIT_COMMITTER_EMAIL: 'tess@example.com',
  TRIQUET_LANE:        '',
  CI:                  '',
  TQ_WORKTREES:        path.join(home, 'worktrees'),
  TRIQUET_LAND_CHECKS: 'true',
  TRIQUET_JUSTIFY:     'true',
  TRIQUET_E2E:         `node ${path.join(home, 'fake-e2e.mjs')}`,
  TRIQUET_INSTALL:     `pwd >> ${path.join(home, 'installs.log')}`,
})

/**
 * A stand-in for the e2e suite: it writes a Playwright JSON report where `pnpm e2e` asks for one,
 * a spec called `works`, taking a second and a half, in each spec file it is given, or else in each
 * file FAKE_RAN names (a.spec.ts and b.spec.ts unless it names others), failing in each file
 * FAKE_FAILING names, and exits red if any failed. FAKE_BROKEN exits red with no report, as a run
 * whose web server never started does. FAKE_UNTIL names a file it waits for before it begins, so
 * a test can hold a run open.
 */
const FakeE2e = `import fs from 'node:fs'
import path from 'node:path'
if (process.env.FAKE_BROKEN) { process.exit(1) }
while (process.env.FAKE_UNTIL && ! fs.existsSync(process.env.FAKE_UNTIL)) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50) }
const listed = (envname, fallback) => (process.env[envname] ?? fallback).split(',').filter(Boolean)
const given = process.argv.slice(2).filter((arg) => arg.endsWith('.spec.ts')).map((arg) => path.basename(arg))
const ran = given.length > 0 ? given : listed('FAKE_RAN', 'a.spec.ts,b.spec.ts')
const failing = listed('FAKE_FAILING', '').filter((file) => ran.includes(file))
const suites = ran.map((file) => ({ title: file, file, specs: [{ title: 'works', file, tests: [{ status: failing.includes(file) ? 'unexpected' : 'expected', expectedStatus: 'passed', results: [{ duration: 1500 }] }] }] }))
fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify({ suites }))
process.exit(failing.length > 0 ? 1 : 0)
`

interface WorldT {
  scratch: string
  main:    string
  git:     (cwd: string, ...args: string[]) => string
  /** Runs scripts/spine.ts in `cwd`; returns its exit status and everything it printed */
  spine:   (cwd: string, args: string[], env?: Record<string, string>) => { status: number | null, said: string }
  /** Starts scripts/spine.ts in `cwd` and lets it run: what it has printed so far, and its exit status once it exits */
  started: (cwd: string, args: string[], env?: Record<string, string>) => { said: () => string, exited: Promise<number | null> }
  /** The e2e lock's directory and its holder's note, beside the e2e log */
  e2eLock: { lockdir: string, notefile: string }
  /** Writes `body` to `filename` in `cwd` and commits it */
  commit:  (cwd: string, filename: string, body: string) => void
  /** Cuts a worktree for `label` and returns its root */
  cut:     (label: string) => string
  /** Justifies the branch at `root`, proves it by e2e, and bids: the land's exit status and what it printed */
  bid:     (root: string, env?: Record<string, string>) => { status: number | null, said: string }
  /** Every line of the e2e log */
  logged:  () => E2eLog.Entry[]
  /** The branch the main checkout stands on */
  top:     () => string
  /** The checkouts whose packages the spine has installed, in order */
  installs: () => string[]
}

/**
 * A bare origin holding `main`, and a main checkout of it standing on `main`, carrying
 * scripts/lanes.ts as the project does. Worktrees go under the scratch directory.
 */
const makeWorld = (scratch: string): WorldT => {
  const env = isolatedEnv(scratch)
  const git = (cwd: string, ...args: string[]) => (
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- naming an absolute git would make these tests machine-specific, and the script under test runs the installed git too
    execFileSync('git', args, { cwd, encoding: 'utf8', env }).trim()
  )
  const spine = (cwd: string, args: string[], extra: Record<string, string> = {}) => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running these tests, whichever it is
    const ran = spawnSync('node', [SpineScript, ...args], { cwd, encoding: 'utf8', env: { ...env, ...extra } })
    return { status: ran.status, said: `${ran.stdout}${ran.stderr}` }
  }
  const started = (cwd: string, args: string[], extra: Record<string, string> = {}) => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running these tests, whichever it is
    const child = spawn('node', [SpineScript, ...args], { cwd, env: { ...env, ...extra } })
    let said = ''
    child.stdout.on('data', (chunk: Buffer) => { said += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { said += chunk.toString() })
    const exited = new Promise<number | null>((resolve) => { child.on('close', resolve) })
    return { said: () => said, exited }
  }
  const commit = (cwd: string, filename: string, body: string) => {
    fs.mkdirSync(path.dirname(path.join(cwd, filename)), { recursive: true })
    fs.writeFileSync(path.join(cwd, filename), body)
    git(cwd, 'add', filename)
    git(cwd, 'commit', '--quiet', '--message', `feat: ${filename}`)
  }
  fs.writeFileSync(path.join(scratch, 'fake-e2e.mjs'), FakeE2e)
  const origin = path.join(scratch, 'origin.git')
  const main = path.join(scratch, 'main')
  git(scratch, 'init', '--quiet', '--bare', '--initial-branch', 'main', origin)
  fs.mkdirSync(main)
  git(main, 'init', '--quiet', '--initial-branch', 'main')
  fs.mkdirSync(path.join(main, 'scripts'))
  fs.copyFileSync(LanesScript, path.join(main, 'scripts', 'lanes.ts'))
  commit(main, 'shared.txt', 'one\n')
  git(main, 'add', 'scripts')
  git(main, 'commit', '--quiet', '--message', 'chore: lanes')
  git(main, 'remote', 'add', 'origin', origin)
  git(main, 'push', '--quiet', '--set-upstream', 'origin', 'main')
  const cut = (label: string) => {
    const ran = spine(main, ['worktree', label, '--no-install'])
    expect(ran.status, ran.said).to.eq(0)
    return path.join(scratch, 'worktrees', label)
  }
  const top = () => git(main, 'symbolic-ref', '--short', 'HEAD')
  const bid = (root: string, extra: Record<string, string> = {}) => {
    for (const step of [['justify'], ['e2e']]) {
      const ran = spine(root, step, extra)
      expect(ran.status, ran.said).to.eq(0)
    }
    return spine(root, ['land'], extra)
  }
  const logged = () => E2eLog.read(E2eLog.logfileOf(path.join(scratch, 'worktrees')))
  const e2eLock = Spine.e2eLockOf(path.join(scratch, 'worktrees'))
  const installlog = path.join(scratch, 'installs.log')
  const installs = () => (fs.existsSync(installlog) ? fs.readFileSync(installlog, 'utf8').split('\n').filter(Boolean) : [])
  return { scratch, main, git, spine, started, e2eLock, commit, cut, top, bid, logged, installs }
}

/**
 * Lands alpha, then has the Coach merge its PR as GitHub does after "Update branch" by rebase:
 * alpha's commits reach main under new SHAs. With `deleted`, origin then drops the branch.
 * Returns the commit origin's alpha held.
 */
const mergeRebased = (world: WorldT, deleted: boolean) => {
  const alpha = world.cut('alpha')
  world.commit(alpha, 'alpha.txt', 'alpha\n')
  expect(world.bid(alpha).status).to.eq(0)
  const elsewhere = path.join(world.scratch, 'elsewhere')
  world.git(world.scratch, 'clone', '--quiet', path.join(world.scratch, 'origin.git'), elsewhere)
  world.commit(elsewhere, 'other.txt', 'other\n')
  world.git(elsewhere, 'switch', '--quiet', '--create', 'rebased', `origin/${Today}-alpha`)
  world.git(elsewhere, 'rebase', '--quiet', 'main')
  world.git(elsewhere, 'switch', '--quiet', 'main')
  world.git(elsewhere, 'merge', '--quiet', '--no-ff', '--message', 'Merge alpha', 'rebased')
  world.git(elsewhere, 'push', '--quiet', 'origin', 'main')
  if (deleted) { world.git(elsewhere, 'push', '--quiet', 'origin', '--delete', `${Today}-alpha`) }
  return world.git(world.main, 'rev-parse', `origin/${Today}-alpha`)
}

/** Stands the main checkout on `leftover` at origin/main, tracking a branch of its own name origin no longer has: a merged spine branch's state */
const standOnMergedBranch = (world: WorldT) => {
  world.git(world.main, 'switch', '--quiet', '--create', 'leftover', 'origin/main')
  world.git(world.main, 'config', 'branch.leftover.remote', 'origin')
  world.git(world.main, 'config', 'branch.leftover.merge', 'refs/heads/leftover')
}

/** Justifies and proves the branch at `root`, then bids to land it into `into`: the land's exit status and what it printed */
const landingInto = (world: WorldT, root: string, into: string) => {
  for (const step of [['justify'], ['e2e']]) {
    const ran = world.spine(root, step)
    expect(ran.status, ran.said).to.eq(0)
  }
  return world.spine(root, ['land', '--into', into])
}

/** Commits an empty spec file of each name onto the world's main, so worktrees cut after have them to run */
const withSpecs = (world: WorldT, ...specnames: string[]) => {
  for (const specname of specnames) { world.commit(world.main, `e2e/${specname}.spec.ts`, '') }
}

/** A branch on alpha in `world`, its corner proved by a touched run over the alarms spec */
const provedOverAlarms = (world: WorldT) => {
  withSpecs(world, 'alarms', 'reviews')
  const root = world.cut('alpha')
  world.commit(root, 'src/components/AlarmSnackbar.tsx', 'alarm\n')
  world.commit(root, 'tests/components/AlarmSnackbar.test.ts', 'test\n')
  expect(world.spine(root, ['justify']).status).to.eq(0)
  const ran = world.spine(root, ['e2e', '--touched'])
  expect(ran.status, ran.said).to.eq(0)
  return { root, ran }
}

/** Starts a full run in `root` that holds the e2e lock until `open` is called, once it has taken the lock */
const holdingE2eLock = async (world: WorldT, root: string) => {
  const gate = path.join(world.scratch, `gate-${path.basename(root)}`)
  const run = world.started(root, ['e2e'], { FAKE_UNTIL: gate })
  await vi.waitFor(() => { expect(fs.existsSync(world.e2eLock.notefile), run.said()).to.be.true }, { timeout: 20_000, interval: 50 })
  return { ...run, open: () => { fs.writeFileSync(gate, '') } }
}

// Each test here runs git and node dozens of times over: under a loaded machine (another
// worktree's e2e suite), vitest's five seconds are not enough.
describe('node scripts/spine.ts, in a repository with worktrees', { timeout: 60_000 }, () => {
  let world: WorldT
  beforeEach(() => {
    const made = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-spine-'))
    world = makeWorld(fs.realpathSync(made))
  })
  afterEach(() => {
    fs.rmSync(world.scratch, { recursive: true, force: true })
  })

  describe('worktree', () => {
    it('cuts a branch from the top into a worktree with a lane of its own', () => {
      const root = world.cut('alpha')
      expect(world.git(root, 'symbolic-ref', '--short', 'HEAD')).to.eq(`${Today}-alpha`)
      expect(world.git(root, 'rev-parse', 'HEAD')).to.eq(world.git(world.main, 'rev-parse', 'HEAD'))
      expect(world.git(root, 'config', `branch.${Today}-alpha.spinebase`)).to.eq(world.git(world.main, 'rev-parse', 'HEAD'))
      expect(world.spine(root, ['top']).said.trim()).to.eq('main')
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running these tests
      expect(execFileSync('node', [path.join(root, 'scripts', 'lanes.ts'), 'lane'], { cwd: root, encoding: 'utf8', env: isolatedEnv(world.scratch) }).trim()).to.eq('1')
    })

    it("seeds the e2e build cache from the main checkout's, which its first run finds seeded and its next warm", () => {
      fs.mkdirSync(path.join(world.main, '.next-e2e', 'dev', 'cache', 'turbopack'), { recursive: true })
      fs.writeFileSync(path.join(world.main, '.next-e2e', 'dev', 'cache', 'turbopack', 'blob'), 'compiled\n')
      fs.writeFileSync(path.join(world.main, '.gitignore'), '.next-e2e/\n')
      const root = world.cut('alpha')
      expect(fs.readFileSync(path.join(root, '.next-e2e', 'dev', 'cache', 'turbopack', 'blob'), 'utf8')).to.eq('compiled\n')
      world.spine(root, ['e2e'])
      world.spine(root, ['e2e'])
      expect(world.logged().map(({ cache }) => cache)).to.deep.eq(['seeded', 'warm'])
    })

    it('refuses a label that is not one, and a branch that exists', () => {
      expect(world.spine(world.main, ['worktree', 'Bad-Label', '--no-install']).said).to.contain('is not a label')
      world.cut('alpha')
      expect(world.spine(world.main, ['worktree', 'alpha', '--no-install']).said).to.contain('exists already')
    })

    it('removes a clean worktree and frees its lane', () => {
      const root = world.cut('alpha')
      const ran = world.spine(root, ['worktree', '--remove'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('Lane 1 is free.')
      expect(fs.existsSync(root)).to.be.false
      expect(world.git(world.main, 'branch', '--list', `${Today}-alpha`)).to.contain('alpha')
    })

    it('refuses to remove a worktree holding uncommitted work', () => {
      const root = world.cut('alpha')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      const ran = world.spine(root, ['worktree', '--remove'])
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('draft.txt')
      expect(fs.existsSync(path.join(root, 'draft.txt'))).to.be.true
    })
  })

  describe('land', () => {
    it('folds a branch in: the main checkout stands on it, and origin has it', () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.bid(root)
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Landed ${Today}-alpha on main`)
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(fs.readFileSync(path.join(world.main, 'alpha.txt'), 'utf8')).to.eq('alpha\n')
      expect(world.git(world.main, 'rev-parse', `origin/${Today}-alpha`)).to.eq(world.git(world.main, 'rev-parse', 'HEAD'))
      expect(world.git(root, 'rev-parse', '--abbrev-ref', 'HEAD')).to.eq('HEAD')
    })

    it('lands into the top: its branch takes the commits, origin has them, and the working branch is gone', () => {
      const alpha = world.cut('alpha')
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      expect(world.bid(alpha).status).to.eq(0)
      const more = world.cut('more')
      world.commit(more, 'more.txt', 'more\n')
      const ran = landingInto(world, more, `${Today}-alpha`)
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Landed ${Today}-more into ${Today}-alpha`)
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(world.git(world.main, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: more.txt', 'feat: alpha.txt'])
      expect(fs.readFileSync(path.join(world.main, 'more.txt'), 'utf8')).to.eq('more\n')
      expect(world.git(world.main, 'rev-parse', `origin/${Today}-alpha`)).to.eq(world.git(world.main, 'rev-parse', 'HEAD'))
      expect(world.git(world.main, 'branch', '--list', `${Today}-more`)).to.eq('')
      expect(world.git(world.main, 'ls-remote', 'origin', `${Today}-more`)).to.eq('')
      expect(world.spine(more, ['worktree', '--remove']).status).to.eq(0)
    })

    it('refuses to land into a branch beneath the top, leaving the spine alone', () => {
      const alpha = world.cut('alpha')
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      expect(world.bid(alpha).status).to.eq(0)
      const beta = world.cut('beta')
      world.commit(beta, 'beta.txt', 'beta\n')
      expect(world.bid(beta).status).to.eq(0)
      const alphaWas = world.git(world.main, 'rev-parse', `${Today}-alpha`)
      const more = world.cut('more')
      world.commit(more, 'more.txt', 'more\n')
      const ran = landingInto(world, more, `${Today}-alpha`)
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain(`${Today}-alpha is not the top of the spine (${Today}-beta is)`)
      expect(world.top()).to.eq(`${Today}-beta`)
      expect(world.git(world.main, 'rev-parse', `${Today}-alpha`)).to.eq(alphaWas)
      expect(world.git(more, 'symbolic-ref', '--short', 'HEAD')).to.eq(`${Today}-more`)
    })

    it('refuses to land into main', () => {
      const more = world.cut('more')
      world.commit(more, 'more.txt', 'more\n')
      const ran = landingInto(world, more, 'main')
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('never main')
      expect(world.git(world.main, 'rev-parse', 'main')).to.eq(world.git(world.main, 'rev-parse', 'origin/main'))
    })

    it('stacks the second of two parallel threads on the first', () => {
      const alpha = world.cut('alpha')
      const beta = world.cut('beta')
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      expect(world.bid(alpha).status).to.eq(0)
      const ran = world.bid(beta)
      expect(ran.status, ran.said).to.eq(0)
      expect(world.top()).to.eq(`${Today}-beta`)
      expect(world.git(world.main, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: beta.txt', 'feat: alpha.txt'])
    })

    it('stops on a conflict with what landed first, leaving the spine alone, and lands once it is repaired', () => {
      const alpha = world.cut('alpha')
      const beta = world.cut('beta')
      world.commit(alpha, 'shared.txt', 'alpha\n')
      world.commit(beta, 'shared.txt', 'beta\n')
      expect(world.bid(alpha).status).to.eq(0)
      const stopped = world.bid(beta)
      expect(stopped.status).to.eq(1)
      expect(stopped.said).to.contain('conflicted; the spine is untouched')
      expect(world.top()).to.eq(`${Today}-alpha`)
      fs.writeFileSync(path.join(beta, 'shared.txt'), 'alpha, then beta\n')
      world.git(beta, 'add', 'shared.txt')
      world.git(beta, '-c', 'core.editor=true', 'rebase', '--continue')
      const ran = world.bid(beta)
      expect(ran.status, ran.said).to.eq(0)
      expect(world.git(world.main, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: shared.txt', 'feat: shared.txt'])
      expect(fs.readFileSync(path.join(world.main, 'shared.txt'), 'utf8')).to.eq('alpha, then beta\n')
    })

    it("stops when typecheck or the tests fail under the hold, leaving the spine alone", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.bid(root, { TRIQUET_LAND_CHECKS: 'false' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('Typecheck or the tests failed').and.contain('The spine is untouched')
      expect(world.top()).to.eq('main')
      const commondir = world.git(world.main, 'rev-parse', '--path-format=absolute', '--git-common-dir')
      expect(fs.existsSync(path.join(commondir, 'triquet-spine.lock'))).to.be.false
    })

    it("refuses a branch never justified, or changed since it was", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      expect(world.spine(root, ['land']).said).to.contain('has not been justified')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      expect(world.spine(root, ['e2e']).status).to.eq(0)
      world.commit(root, 'alpha.txt', 'alpha, amended\n')
      const ran = world.spine(root, ['land'])
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('has changed since it was justified')
      expect(world.top()).to.eq('main')
    })

    it("refuses a branch changing code with no e2e proof", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const ran = world.spine(root, ['land'])
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('has no e2e proof')
    })

    it("lands documents and notes with no e2e proof, still justified and tested", () => {
      const root = world.cut('alpha')
      world.commit(root, 'notes/idea.md', 'an idea\n')
      world.commit(root, 'whiteboard/20261006-x/shot.png', 'not really a png\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const ran = world.spine(root, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('no e2e proof needed')
      expect(world.top()).to.eq(`${Today}-alpha`)
    })

    it("catches up under the hold when the top moved after the proof, keeping a justify the rebase did not change", () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      for (const step of [['justify'], ['e2e']]) { expect(world.spine(beta, step).status).to.eq(0) }
      expect(world.bid(alpha).status).to.eq(0)
      const ran = world.spine(beta, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`The top had moved: rebased onto ${Today}-alpha`).and.contain('No flakes to report')
      expect(world.git(world.main, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: beta.txt', 'feat: alpha.txt'])
    })

    it('refuses a worktree holding uncommitted changes', () => {
      const root = world.cut('alpha')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      expect(world.spine(root, ['land']).said).to.contain('commit them first')
    })

    it('sweeps the Coach\'s notes onto the spine, on a branch of their own when it stood on main, and leaves other strays alone', () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      fs.mkdirSync(path.join(world.main, 'whiteboard'))
      fs.writeFileSync(path.join(world.main, 'whiteboard', 'plan.md'), '# the plan\n')
      fs.writeFileSync(path.join(world.main, 'stray.txt'), 'mine\n')
      const ran = world.bid(root)
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('Swept from the main checkout: whiteboard/plan.md')
      expect(world.git(world.main, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: alpha.txt', 'docs: swept from the main checkout'])
      expect(world.git(world.main, 'branch', '--list', `${Today}-swept_notes`)).to.contain('swept_notes')
      expect(world.git(world.main, 'status', '--porcelain')).to.eq('?? stray.txt')
    })

    it('stops rather than overwrite the Coach\'s uncommitted edit, putting the worktree back', () => {
      const root = world.cut('alpha')
      world.commit(root, 'shared.txt', 'alpha\n')
      fs.writeFileSync(path.join(world.main, 'shared.txt'), 'the Coach, mid-thought\n')
      const ran = world.bid(root)
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('would not switch')
      expect(world.top()).to.eq('main')
      expect(fs.readFileSync(path.join(world.main, 'shared.txt'), 'utf8')).to.eq('the Coach, mid-thought\n')
      expect(world.git(root, 'symbolic-ref', '--short', 'HEAD')).to.eq(`${Today}-alpha`)
    })

    it('carries the Coach\'s uncommitted edit along when the branch leaves that file alone', () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      fs.writeFileSync(path.join(world.main, 'shared.txt'), 'the Coach, mid-thought\n')
      expect(world.bid(root).status).to.eq(0)
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(fs.readFileSync(path.join(world.main, 'shared.txt'), 'utf8')).to.eq('the Coach, mid-thought\n')
    })

    it('replays the spine onto origin/main once the Coach has merged its bottom, and pushes what it replayed', () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      world.bid(alpha)
      world.bid(beta)
      // The Coach merges alpha's PR, and something else lands on main too.
      const elsewhere = path.join(world.scratch, 'elsewhere')
      world.git(world.scratch, 'clone', '--quiet', path.join(world.scratch, 'origin.git'), elsewhere)
      world.git(elsewhere, 'merge', '--quiet', '--no-ff', '--message', 'Merge alpha', `origin/${Today}-alpha`)
      world.commit(elsewhere, 'other.txt', 'other\n')
      world.git(elsewhere, 'push', '--quiet', 'origin', 'main')
      const gamma = world.cut('gamma')
      world.commit(gamma, 'gamma.txt', 'gamma\n')
      const ran = world.bid(gamma)
      expect(ran.status, ran.said).to.eq(0)
      expect(world.git(world.main, 'log', '--format=%s', 'origin/main..HEAD').split('\n')).to.deep.eq(['feat: gamma.txt', 'feat: beta.txt'])
      expect(world.git(world.main, 'rev-parse', `origin/${Today}-beta`)).to.eq(world.git(world.main, 'rev-parse', `${Today}-beta`))
      expect(world.git(world.main, 'merge-base', '--is-ancestor', 'origin/main', `${Today}-beta`)).to.eq('')
    })
  })

  describe('catchup', () => {
    it("rebases the branch onto a top that moved, and records its new base", () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      expect(world.bid(alpha).status).to.eq(0)
      const ran = world.spine(beta, ['catchup'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Rebased ${Today}-beta onto ${Today}-alpha`).and.contain('justify it again')
      const top = world.git(world.main, 'rev-parse', 'HEAD')
      expect(world.git(beta, 'config', `branch.${Today}-beta.spinebase`)).to.eq(top)
      expect(world.git(beta, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: beta.txt', 'feat: alpha.txt'])
      expect(world.top()).to.eq(`${Today}-alpha`)
    })

    it("says so when the branch stands on the top already", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['catchup'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('stands on the top already')
    })

    it("sweeps the Coach's notes onto the top, and brings them along", () => {
      const root = world.cut('alpha')
      fs.mkdirSync(path.join(world.main, 'notes'))
      fs.writeFileSync(path.join(world.main, 'notes', 'idea.md'), 'an idea\n')
      const ran = world.spine(root, ['catchup'])
      expect(ran.said).to.contain('Swept from the main checkout: notes/idea.md')
      expect(fs.readFileSync(path.join(root, 'notes', 'idea.md'), 'utf8')).to.eq('an idea\n')
    })

    it("stops on a conflict with the rebase left for the worker, and the spine alone", () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'shared.txt', 'alpha\n')
      world.commit(beta, 'shared.txt', 'beta\n')
      expect(world.bid(alpha).status).to.eq(0)
      const ran = world.spine(beta, ['catchup'])
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('conflicted; the spine is untouched')
      const gitdir = world.git(beta, 'rev-parse', '--absolute-git-dir')
      expect(fs.existsSync(path.join(gitdir, 'rebase-merge'))).to.be.true
      expect(world.top()).to.eq(`${Today}-alpha`)
    })

    it("refuses a worktree holding uncommitted changes, and the main checkout", () => {
      const root = world.cut('alpha')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      expect(world.spine(root, ['catchup']).said).to.contain('commit them first')
      expect(world.spine(world.main, ['catchup']).said).to.contain('happens from a worktree')
    })
  })

  describe('justify', () => {
    it("records the branch's patch-id when green over committed work", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['justify'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Justified ${Today}-alpha`)
      expect(world.git(root, 'config', `branch.${Today}-alpha.justified`)).to.match(/^[\da-f]{40}$/)
    })

    it("records nothing over uncommitted changes", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      const ran = world.spine(root, ['justify'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('nothing is recorded')
      expect(world.spine(root, ['land']).said).to.contain('commit them first')
      fs.rmSync(path.join(root, 'draft.txt'))
      expect(world.spine(root, ['land']).said).to.contain('has not been justified')
    })

    it("stops red, recording nothing", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['justify'], { TRIQUET_JUSTIFY: 'false' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('Justify failed')
      expect(world.spine(root, ['land']).said).to.contain('has not been justified')
    })
  })

  describe('e2e', () => {
    it("proves a branch whose full run is green, and logs the run", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['e2e'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('2 passed, 0 failed').and.contain(`Proved ${Today}-alpha`)
      const [provedOn] = world.git(root, 'config', `branch.${Today}-alpha.proved`).split(' ', 1)
      expect(provedOn).to.eq(world.git(root, 'config', `branch.${Today}-alpha.spinebase`))
      const [entry] = world.logged()
      expect(entry).to.include({ branch: `${Today}-alpha`, kind: 'full', committed: true, cache: 'cold', status: 0, proved: true, lane: 1, test_seconds: 3 })
      expect(entry?.counts).to.include({ passed: 2, failed: 0 })
    })

    it("holds what a full run failed until it passes alone, calls it a flake, and has the bid name it", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const red = world.spine(root, ['e2e'], { FAKE_FAILING: 'b.spec.ts' })
      expect(red.status).to.eq(1)
      expect(red.said).to.contain('1 passed, 1 failed').and.contain('Outstanding').and.contain('b.spec.ts › works')
      expect(world.spine(root, ['land']).said).to.contain('has no e2e proof')
      const rerun = world.spine(root, ['e2e', '--last-failed', '--workers=1'], { FAKE_RAN: 'b.spec.ts' })
      expect(rerun.status, rerun.said).to.eq(0)
      expect(rerun.said).to.contain('A flake: b.spec.ts › works').and.contain('Proved')
      expect(world.logged().map(({ kind, cleared }) => [kind, cleared])).to.deep.eq([['full', []], ['rerun', [{ spec: 'b.spec.ts › works', how: 'flake' }]]])
      const ran = world.spine(root, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain("Flakes, for the PR's Tests: line: b.spec.ts › works.")
    })

    it("calls a spec repaired when the code changed before it passed", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.spine(root, ['e2e'], { FAKE_FAILING: 'a.spec.ts' })
      world.commit(root, 'alpha.txt', 'alpha, repaired\n')
      const ran = world.spine(root, ['e2e', 'e2e/a.spec.ts'], { FAKE_RAN: 'a.spec.ts' })
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('Repaired: a.spec.ts › works').and.contain('Proved')
      expect(world.logged().at(-1)).to.include({ kind: 'chosen', proved: true })
    })

    it("keeps outstanding what a rerun fails again, and what a chosen spec newly fails", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.spine(root, ['e2e'], { FAKE_FAILING: 'a.spec.ts' })
      const ran = world.spine(root, ['e2e', '--last-failed'], { FAKE_RAN: 'a.spec.ts,c.spec.ts', FAKE_FAILING: 'a.spec.ts,c.spec.ts' })
      expect(ran.status).to.eq(1)
      expect(world.logged().at(-1)?.still).to.deep.eq(['a.spec.ts › works', 'c.spec.ts › works'])
    })

    it("proves nothing by a rerun with no full run behind it", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['e2e', '--last-failed'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('No finished full or touched run')
      expect(world.spine(root, ['e2e', '--last-failed']).said).not.to.contain('Proved')
    })

    it("proves nothing by a run that broke before its specs finished", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['e2e'], { FAKE_BROKEN: '1' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('0 passed').and.contain('proves nothing')
      expect(world.spine(root, ['e2e', '--last-failed']).said).to.contain('No finished full or touched run')
    })

    it("counts toward no proof over uncommitted changes, though it is logged", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      const ran = world.spine(root, ['e2e'])
      expect(ran.said).to.contain('counts toward no proof')
      expect(world.logged().at(-1)).to.include({ committed: false, proved: false })
      fs.rmSync(path.join(root, 'draft.txt'))
      world.spine(root, ['justify'])
      expect(world.spine(root, ['land']).said).to.contain('has no e2e proof')
    })

    it("takes the proof back when a later full run fails", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.spine(root, ['justify'])
      world.spine(root, ['e2e'])
      world.spine(root, ['e2e'], { FAKE_FAILING: 'a.spec.ts' })
      expect(world.spine(root, ['land']).said).to.contain('has no e2e proof')
    })

    it("summarises the log", () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.spine(root, ['e2e'], { FAKE_FAILING: 'a.spec.ts' })
      world.spine(root, ['e2e', '--last-failed'], { FAKE_RAN: 'a.spec.ts' })
      const ran = world.spine(root, ['e2e-log'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('2 runs logged').and.contain('(flakes): 1')
    })
  })

  describe('e2e --touched', () => {
    it('runs only the corner the branch reaches, says which corner each path chose, and proves the branch over it, for the bid to take', () => {
      const { root, ran } = provedOverAlarms(world)
      expect(ran.said).to.match(/src\/components\/AlarmSnackbar\.tsx\s+the alarms: alarms\n/)
      expect(ran.said).to.match(/tests\/components\/AlarmSnackbar\.test\.ts\s+nothing e2e notices\n/)
      expect(ran.said).to.contain('e2e, touched: 1 passed, 0 failed').and.contain('over its corner alone (alarms)')
      expect(world.logged().at(-1)).to.deep.include({ kind: 'touched', args: ['e2e/alarms.spec.ts'], proved: true })
      const landed = world.spine(root, ['land'])
      expect(landed.status, landed.said).to.eq(0)
      expect(landed.said).to.contain('over its corner (alarms), which still holds every path the branch changes')
    })

    it('refuses the bid once the branch reaches past the corner it proved, naming the path, unless the bid says why e2e has nothing to tell it', () => {
      const { root } = provedOverAlarms(world)
      world.commit(root, 'src/components/ReviewScreen.tsx', 'review\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const refused = world.spine(root, ['land'])
      expect(refused.status).to.eq(1)
      expect(refused.said).to.contain('scoped to its corner (alarms), and src/components/ReviewScreen.tsx reaches beyond it').and.contain('pnpm e2e --touched` again')
      expect(world.top()).to.eq('main')
      const skipped = world.spine(root, ['land', '--skip-e2e', 'I read it and no spec could tell'])
      expect(skipped.status, skipped.said).to.eq(0)
      expect(skipped.said).to.contain('e2e skipped: I read it and no spec could tell')
    })

    it('stands again once a second touched run covers the wider corner', () => {
      const { root } = provedOverAlarms(world)
      world.commit(root, 'src/components/ReviewScreen.tsx', 'review\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const ran = world.spine(root, ['e2e', '--touched'])
      expect(ran.status, ran.said).to.eq(0)
      expect(world.logged().at(-1)?.args).to.deep.eq(['e2e/alarms.spec.ts', 'e2e/reviews.spec.ts'])
      expect(world.spine(root, ['land']).status).to.eq(0)
    })

    it('runs the whole suite, as a full run, when a path reaches it, and the bid takes that as a full proof', () => {
      withSpecs(world, 'alarms')
      const root = world.cut('alpha')
      world.commit(root, 'src/components/AlarmSnackbar.tsx', 'alarm\n')
      world.commit(root, 'convex/schema.ts', 'schema\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const ran = world.spine(root, ['e2e', '--touched'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.match(/convex\/schema\.ts\s+the whole suite\n/).and.contain('A path reaches the whole suite, so the whole suite runs, as a full run.')
      expect(world.logged().at(-1)).to.deep.include({ kind: 'full', args: [] })
      const landed = world.spine(root, ['land'])
      expect(landed.status, landed.said).to.eq(0)
      expect(landed.said).not.to.contain('over its corner')
    })

    it('skips a spec file not written yet, and runs the whole suite for a corner with none', () => {
      withSpecs(world, 'reviews')
      const root = world.cut('alpha')
      world.commit(root, 'src/components/FoldButton.tsx', 'fold\n')
      expect(world.spine(root, ['e2e', '--touched']).status).to.eq(0)
      expect(world.logged().at(-1)?.args).to.deep.eq(['e2e/reviews.spec.ts'])
      world.commit(root, 'src/components/Stats.tsx', 'stats\n')
      const ran = world.spine(root, ['e2e', '--touched'])
      expect(ran.said).to.contain('the whole suite, as the stats page has no spec file yet')
      expect(world.logged().at(-1)?.kind).to.eq('full')
    })

    it('runs nothing when no path is one e2e notices, and says how to land without', () => {
      const root = world.cut('alpha')
      world.commit(root, 'tests/lib/useful.test.ts', 'test\n')
      const ran = world.spine(root, ['e2e', '--touched'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('so no spec runs').and.contain('--skip-e2e')
      expect(world.logged()).to.deep.eq([])
    })

    it('takes no other arguments', () => {
      const root = world.cut('alpha')
      expect(world.spine(root, ['e2e', '--touched', '--workers=1']).said).to.contain('takes nothing else')
    })

    it('keeps the scope through a rerun that repairs it', () => {
      withSpecs(world, 'alarms')
      const root = world.cut('alpha')
      world.commit(root, 'src/components/AlarmSnackbar.tsx', 'alarm\n')
      expect(world.spine(root, ['e2e', '--touched'], { FAKE_FAILING: 'alarms.spec.ts' }).status).to.eq(1)
      const rerun = world.spine(root, ['e2e', '--last-failed'], { FAKE_RAN: 'alarms.spec.ts' })
      expect(rerun.status, rerun.said).to.eq(0)
      expect(rerun.said).to.contain('A flake: alarms.spec.ts › works').and.contain('over its corner alone (alarms)')
    })
  })

  describe('the bid, after its catch-up', () => {
    it('reads a scoped proof afresh once it has rebased, so a spec file the top gained in the proved corner is required', () => {
      withSpecs(world, 'reviews')
      const root = world.cut('alpha')
      world.commit(root, 'src/components/FoldButton.tsx', 'fold\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      expect(world.spine(root, ['e2e', '--touched']).status).to.eq(0)
      expect(world.logged().at(-1)?.args).to.deep.eq(['e2e/reviews.spec.ts'])
      withSpecs(world, 'grid')
      const refused = world.spine(root, ['land'])
      expect(refused.status, refused.said).to.eq(1)
      expect(refused.said).to.contain(`${Today}-alpha is rebased onto main`).and.contain('src/components/FoldButton.tsx reaches beyond it')
      expect(world.top()).to.eq('main')
      expect(world.git(world.main, 'log', '-1', '--format=%s')).to.eq('feat: e2e/grid.spec.ts')
      const again = world.spine(root, ['e2e', '--touched'])
      expect(again.status, again.said).to.eq(0)
      expect(world.logged().at(-1)?.args).to.deep.eq(['e2e/grid.spec.ts', 'e2e/reviews.spec.ts'])
      const landed = world.spine(root, ['land'])
      expect(landed.status, landed.said).to.eq(0)
    })

    it('passes on what the proof read afresh says, its flakes among it', () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(beta, 'beta.txt', 'beta\n')
      expect(world.spine(beta, ['justify']).status).to.eq(0)
      expect(world.spine(beta, ['e2e'], { FAKE_FAILING: 'b.spec.ts' }).status).to.eq(1)
      expect(world.spine(beta, ['e2e', '--last-failed'], { FAKE_RAN: 'b.spec.ts' }).status).to.eq(0)
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      expect(world.bid(alpha).status).to.eq(0)
      const ran = world.spine(beta, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('The top had moved').and.contain("Flakes, for the PR's Tests: line: b.spec.ts › works.")
    })
  })

  describe('the e2e lock', () => {
    it('makes a second full run wait, saying whose run holds it, then catch up with what landed meanwhile before it runs', async () => {
      const [alpha, beta, gamma] = [world.cut('alpha'), world.cut('beta'), world.cut('gamma')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      world.commit(gamma, 'notes/gamma.md', 'gamma\n')
      const first = await holdingE2eLock(world, alpha)
      const second = world.started(beta, ['e2e'])
      await vi.waitFor(() => { expect(second.said()).to.contain('The e2e lock is held') }, { timeout: 20_000, interval: 50 })
      expect(second.said()).to.contain(`held by lane 1's full run of ${Today}-alpha (${alpha}, pid `)
      expect(second.said()).to.contain(`this run catches ${Today}-beta up with the top first`)
      expect(world.spine(gamma, ['justify']).status).to.eq(0)
      expect(world.spine(gamma, ['land']).status).to.eq(0)
      first.open()
      expect(await first.exited, first.said()).to.eq(0)
      expect(await second.exited, second.said()).to.eq(0)
      expect(second.said()).to.contain('Took the e2e lock, after').and.contain(`Rebased ${Today}-beta onto ${Today}-gamma`).and.contain(`Proved ${Today}-beta`)
      const [provedOn] = world.git(beta, 'config', `branch.${Today}-beta.proved`).split(' ', 1)
      expect(provedOn).to.eq(world.git(world.main, 'rev-parse', `${Today}-gamma`))
      const runs = world.logged()
      expect(runs.map(({ branch, waited_s }) => [branch, waited_s === undefined ? 'none' : 'some'])).to.deep.eq([[`${Today}-alpha`, 'some'], [`${Today}-beta`, 'some']])
      expect(runs[0]?.waited_s).to.eq(0)
      expect(fs.existsSync(world.e2eLock.lockdir) || fs.existsSync(world.e2eLock.notefile)).to.be.false
    })

    it('lets a rerun, chosen specs and a run in CI go by without it', async () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      const first = await holdingE2eLock(world, alpha)
      for (const [args, extra] of [[['e2e', '--last-failed'], {}], [['e2e', 'e2e/a.spec.ts'], {}], [['e2e'], { CI: 'true' }]] as const) {
        const ran = world.spine(beta, [...args], extra)
        expect(ran.status, ran.said).to.eq(0)
        expect(ran.said).not.to.contain('The e2e lock is held')
      }
      expect(world.logged().map(({ kind, waited_s }) => [kind, waited_s])).to.deep.eq([['rerun', undefined], ['chosen', undefined], ['full', undefined]])
      first.open()
      expect(await first.exited, first.said()).to.eq(0)
    })

    it('stops a waiting run whose catch-up conflicts, freeing the lock and running nothing', async () => {
      const [alpha, beta, gamma] = [world.cut('alpha'), world.cut('beta'), world.cut('gamma')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'notes/shared.md', 'beta\n')
      world.commit(gamma, 'notes/shared.md', 'gamma\n')
      const first = await holdingE2eLock(world, alpha)
      const second = world.started(beta, ['e2e'])
      await vi.waitFor(() => { expect(second.said()).to.contain('The e2e lock is held') }, { timeout: 20_000, interval: 50 })
      expect(world.spine(gamma, ['justify']).status).to.eq(0)
      expect(world.spine(gamma, ['land']).status).to.eq(0)
      first.open()
      expect(await first.exited, first.said()).to.eq(0)
      expect(await second.exited).to.eq(1)
      expect(second.said()).to.contain('conflicted').and.contain('so the suite has not run; the e2e lock is free again')
      expect(fs.existsSync(world.e2eLock.lockdir)).to.be.false
      expect(world.logged().map(({ branch }) => branch)).to.deep.eq([`${Today}-alpha`])
    })
  })

  describe('installing on a move', () => {
    it('installs in the main checkout once a bid folds in another lockfile, and in a worktree a catch-up brings it to', () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      const landed = world.bid(alpha)
      expect(landed.status, landed.said).to.eq(0)
      expect(landed.said).to.contain(`pnpm-lock.yaml changed when ${world.main} moved onto`)
      expect(world.installs()).to.deep.eq([world.main])
      const ran = world.spine(beta, ['catchup'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Rebased ${Today}-beta`).and.contain(`pnpm-lock.yaml changed when ${beta} moved onto`)
      expect(world.installs()).to.deep.eq([world.main, beta])
    })

    it("installs in a worktree the bid rebases onto another lockfile, before the bid's checks, and not again in the main checkout", () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      expect(world.bid(alpha).status).to.eq(0)
      // The checks pass only where the packages were installed.
      const ran = world.bid(beta, { TRIQUET_LAND_CHECKS: `grep -qx "$PWD" ${path.join(world.scratch, 'installs.log')}` })
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`pnpm-lock.yaml changed when ${beta} moved onto`).and.not.contain(`when ${world.main} moved`)
      expect(world.installs()).to.deep.eq([world.main, beta])
    })

    it('installs in the main checkout when a restack replays it onto another lockfile', () => {
      const elsewhere = path.join(world.scratch, 'elsewhere')
      world.git(world.scratch, 'clone', '--quiet', path.join(world.scratch, 'origin.git'), elsewhere)
      world.commit(elsewhere, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      world.git(elsewhere, 'push', '--quiet', 'origin', 'main')
      const ran = world.spine(world.main, ['restack'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('fast-forwarded').and.contain(`pnpm-lock.yaml changed when ${world.main} moved onto`)
      expect(world.installs()).to.deep.eq([world.main])
    })

    it('installs nothing for a move that leaves the lockfile as it was, though the branch changes its own', () => {
      world.commit(world.main, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'pnpm-lock.yaml', 'lockfileVersion: 9\nimporters: {}\n')
      expect(world.bid(alpha).status).to.eq(0)
      const ran = world.spine(beta, ['catchup'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Rebased ${Today}-beta`).and.not.contain('pnpm-lock.yaml changed')
      expect(world.installs()).to.deep.eq([])
    })

    it("stops a catch-up whose install fails, but lets a landing stand, saying the main checkout's failed", () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      const landed = world.bid(alpha, { TRIQUET_INSTALL: 'false' })
      expect(landed.status, landed.said).to.eq(0)
      expect(landed.said).to.contain('installing its packages there failed, as above: tell the Coach').and.contain(`Landed ${Today}-alpha`)
      const ran = world.spine(beta, ['catchup'], { TRIQUET_INSTALL: 'false' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain(`pnpm-lock.yaml changed when ${beta} moved onto`).and.contain('installing its packages there failed')
    })

    it('reaches proper-lockfile only for the e2e lock, so the other commands run where it is not installed', () => {
      // The spine's scripts alone, with no packages anywhere above them.
      const bare = path.join(world.scratch, 'bare', 'scripts')
      fs.mkdirSync(bare, { recursive: true })
      for (const script of ['spine.ts', 'e2e-log.ts', 'lanes.ts']) { fs.copyFileSync(path.join(RepoRoot, 'scripts', script), path.join(bare, script)) }
      fs.writeFileSync(path.join(bare, 'package.json'), '{ "type": "module" }\n')
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const bareSpine = (cwd: string, args: string[]) => {
        // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running these tests, whichever it is
        const ran = spawnSync('node', [path.join(bare, 'spine.ts'), ...args], { cwd, encoding: 'utf8', env: isolatedEnv(world.scratch) })
        return { status: ran.status, said: `${ran.stdout}${ran.stderr}` }
      }
      for (const [cwd, args] of [[world.main, ['top']], [world.main, ['sweep']], [root, ['catchup']], [root, ['justify']], [root, ['e2e', '--last-failed']], [root, ['land', '--skip-e2e', 'a test of the spine']]] as const) {
        const ran = bareSpine(cwd, [...args])
        expect(ran.status, `${args.join(' ')}: ${ran.said}`).to.eq(0)
      }
      expect(world.top()).to.eq(`${Today}-alpha`)
      const locking = bareSpine(world.main, ['e2e'])
      expect(locking.status).to.eq(1)
      expect(locking.said).to.contain('proper-lockfile')
    })
  })

  describe('sweep', () => {
    it('says so when there is nothing to sweep', () => {
      expect(world.spine(world.main, ['sweep']).said.trim()).to.eq('Nothing to sweep.')
    })

    it('commits the Coach\'s notes onto the top it stands on', () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.bid(root)
      fs.mkdirSync(path.join(world.main, 'notes'))
      fs.writeFileSync(path.join(world.main, 'notes', 'idea.md'), 'an idea\n')
      expect(world.spine(world.main, ['sweep']).said.trim()).to.eq('Swept from the main checkout: notes/idea.md.')
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(world.git(world.main, 'log', '-1', '--format=%s')).to.eq('docs: swept from the main checkout')
    })

    it('sweeps a note already committed and edited since, whose status line starts with a space', () => {
      const root = world.cut('alpha')
      world.commit(root, 'notes/idea.md', 'an idea\n')
      world.bid(root)
      fs.writeFileSync(path.join(world.main, 'notes', 'idea.md'), 'a better idea\n')
      expect(world.spine(world.main, ['sweep']).said.trim()).to.eq('Swept from the main checkout: notes/idea.md.')
      expect(world.git(world.main, 'show', 'HEAD:notes/idea.md')).to.eq('a better idea')
    })
  })

  describe('restack', () => {
    it('says so when the spine already stands on origin/main', () => {
      expect(world.spine(world.main, ['restack']).said.trim()).to.eq('The spine already stands on origin/main.')
    })

    it('starts the spine afresh on main once all of it has merged, and pushes no branch origin has deleted', () => {
      mergeRebased(world, true)
      const ran = world.spine(world.main, ['restack'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('the main checkout stands on main again').and.not.contain('Pushed')
      expect(world.top()).to.eq('main')
      expect(world.git(world.main, 'rev-parse', 'HEAD')).to.eq(world.git(world.main, 'rev-parse', 'origin/main'))
      expect(world.git(world.main, 'ls-remote', 'origin', `${Today}-alpha`)).to.eq('')
    })

    it('leaves alone a branch the replay emptied, though origin still has it', () => {
      const pushedBefore = mergeRebased(world, false)
      const ran = world.spine(world.main, ['restack'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).not.to.contain('Pushed')
      expect(world.git(world.main, 'ls-remote', 'origin', `${Today}-alpha`)).to.contain(pushedBefore)
    })

    it('goes back to main when it already stands on origin/main, on a branch origin has deleted', () => {
      standOnMergedBranch(world)
      const ran = world.spine(world.main, ['restack'])
      expect(ran.said.trim()).to.eq('The whole spine has merged: the main checkout stands on main again, and leftover is done.')
      expect(world.top()).to.eq('main')
    })

    it('leaves the Coach on a branch they cut by hand, though it stands on origin/main', () => {
      world.git(world.main, 'switch', '--quiet', '--create', 'mine')
      expect(world.spine(world.main, ['restack']).said.trim()).to.eq('The spine already stands on origin/main.')
      expect(world.top()).to.eq('mine')
      world.git(world.main, 'switch', '--quiet', '--create', 'mine_too', 'origin/main')
      world.spine(world.main, ['restack'])
      expect(world.top()).to.eq('mine_too')
    })

    it('stays put when local main holds commits origin lacks', () => {
      world.commit(world.main, 'local.txt', 'local\n')
      standOnMergedBranch(world)
      expect(world.spine(world.main, ['restack']).said).to.contain('local main holds commits origin/main lacks')
      expect(world.top()).to.eq('leftover')
    })

    it('lets the first thread after a fresh start land on main, starting the spine', () => {
      mergeRebased(world, true)
      const beta = world.cut('beta')
      world.commit(beta, 'beta.txt', 'beta\n')
      const ran = world.bid(beta)
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('stacked on nothing')
      expect(world.top()).to.eq(`${Today}-beta`)
      expect(world.git(world.main, 'log', '--format=%s', 'origin/main..HEAD')).to.eq('feat: beta.txt')
    })

    it('forgets a branch origin deleted on merging it, rather than leasing a push against it', () => {
      const alpha = world.cut('alpha')
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.bid(alpha)
      // The Coach merges alpha's PR, and origin deletes its branch; then notes are swept onto it.
      const elsewhere = path.join(world.scratch, 'elsewhere')
      world.git(world.scratch, 'clone', '--quiet', path.join(world.scratch, 'origin.git'), elsewhere)
      world.git(elsewhere, 'merge', '--quiet', '--no-ff', '--message', 'Merge alpha', `origin/${Today}-alpha`)
      world.git(elsewhere, 'push', '--quiet', 'origin', 'main', `:${Today}-alpha`)
      fs.mkdirSync(path.join(world.main, 'notes'))
      fs.writeFileSync(path.join(world.main, 'notes', 'idea.md'), 'an idea\n')
      world.spine(world.main, ['sweep'])
      const ran = world.spine(world.main, ['restack'])
      expect(ran.status, ran.said).to.eq(0)
      expect(world.git(world.main, 'for-each-ref', `refs/remotes/origin/${Today}-alpha`)).to.eq('')
      expect(world.git(world.main, 'log', '--format=%s', 'origin/main..HEAD')).to.eq('docs: swept from the main checkout')
    })
  })
})
