import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Spine from '../../scripts/spine'

const RepoRoot = path.resolve(import.meta.dirname, '../..')

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
