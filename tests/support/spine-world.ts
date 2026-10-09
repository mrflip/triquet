/**
 * The scratch world the tests of `node scripts/spine.ts` run it in: a bare origin, a main checkout
 * standing on `main`, worktrees cut beside them, and a stand-in for the e2e suite, all under one
 * temporary directory that is its own `HOME`. Nothing in a world is shared with another, so the
 * spine's test files run side by side.
 *
 * `SpineFixtures` hands each test a world of its own as its `world` fixture and removes it after;
 * `withSpecs` acts on a world for a story more than one file tells.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect } from 'vitest'
import * as E2eLog from '../../scripts/e2e-log'
import * as Spine from '../../scripts/spine'

/** This checkout's root */
export const RepoRoot = path.resolve(import.meta.dirname, '../..')

const SpineScript = path.join(RepoRoot, 'scripts', 'spine.ts')
const LanesScript = path.join(RepoRoot, 'scripts', 'lanes.ts')

/**
 * How long a test of the spine may take: it runs git and node dozens of times over, and under a
 * loaded machine (another worktree's e2e suite) vitest's five seconds are not enough.
 */
export const SpineTimeout = 60_000

/** Today's datestamp, as branch names lead */
export const Today = new Date().toLocaleDateString('sv').replaceAll('-', '')

/**
 * A git that reads no one's own config, and names a fixed author; the spine's commands stubbed by
 * shell or by the fake suite. Given `compileCache`, the node it runs keeps its compiled scripts
 * there (`NODE_COMPILE_CACHE`), which halves what a spine run costs once the first has compiled it.
 */
export const isolatedEnv = (home: string, compileCache?: string) => ({
  ...process.env,
  ...(compileCache !== undefined && { NODE_COMPILE_CACHE: compileCache }),
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

export interface WorldT {
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
 * scripts/lanes.ts as the project does. Worktrees go under the scratch directory; the node it
 * runs keeps its compiled scripts in `compileCache`, if given.
 */
export const makeWorld = (scratch: string, compileCache?: string): WorldT => {
  const env = isolatedEnv(scratch, compileCache)
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

/** What each test of the spine is handed */
export interface SpineContext {
  /** A world of the test's own, removed once it is done */
  world:        WorldT
  /**
   * Where the spine runs of one test file keep their compiled scripts: a temporary directory made
   * for the file and removed after it. Node keys its cache by path, and every world's copy of
   * lanes.ts lies at a path of its own, so a cache kept from run to run would only grow.
   */
  compileCache: string
}

/** How a fixture hands its value to the test, and waits for the test to be done with it */
type Lend<TT> = (value: TT) => Promise<void>

/**
 * The fixtures of `SpineContext`. Each file extends vitest's `test` with them itself, so that the
 * linter sees its tests as tests.
 *
 * @example const it = test.extend<SpineContext>(SpineFixtures)
 */
export const SpineFixtures: {
  compileCache: [(context: object, lend: Lend<string>) => Promise<void>, { scope: 'file' }]
  world:        (context: Pick<SpineContext, 'compileCache'>, lend: Lend<WorldT>) => Promise<void>
} = {
  compileCache: [
    // eslint-disable-next-line no-empty-pattern -- vitest reads a fixture's needs from its first argument's pattern, and the cache needs nothing
    async ({}, lend) => {
      const compileCache = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-spine-compiled-'))
      await lend(compileCache)
      fs.rmSync(compileCache, { recursive: true, force: true })
    },
    { scope: 'file' },
  ],
  world: async ({ compileCache }, lend) => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-spine-'))
    const world = makeWorld(fs.realpathSync(scratch), compileCache)
    await lend(world)
    fs.rmSync(world.scratch, { recursive: true, force: true })
  },
}

/** Commits an empty spec file of each name onto the world's main, so worktrees cut after have them to run */
export const withSpecs = (world: WorldT, ...specnames: string[]) => {
  for (const specname of specnames) { world.commit(world.main, `e2e/${specname}.spec.ts`, '') }
}
