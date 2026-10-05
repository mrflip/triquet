import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Lanes from '../../scripts/lanes'

const LanesScript = path.resolve(import.meta.dirname, '../../scripts/lanes.ts')

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
})

const git = (cwd: string, ...args: string[]): string => (
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- naming an absolute git would make these tests machine-specific, and the script under test runs the installed git too
  execFileSync('git', args, { cwd, encoding: 'utf8', env: isolatedEnv(path.dirname(cwd)) })
)

/** Runs scripts/lanes.ts in `cwd`, with no lane given it; returns what it printed */
const lanes = (cwd: string, ...args: string[]): string => (
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running these tests, whichever it is
  execFileSync('node', [LanesScript, ...args], { cwd, encoding: 'utf8', env: isolatedEnv(path.dirname(cwd)) }).trim()
)

const PortsCases: [Lanes.Role, number, Lanes.Ports, string][] = [
  ['dev',         0, { web: 3000, backend: 3400, site: 3500 }, 'the Coach\'s, in the main checkout, as it has always been'],
  ['agent',       0, { web: 3001, backend: 3401, site: 3501 }, 'the agents\' dev server, in the main checkout'],
  ['e2e-built',   0, { web: 3005, backend: 3405, site: 3505 }, 'the optimized build\'s suite, in the main checkout'],
  ['e2e-agent',   1, { web: 3013, backend: 3413, site: 3513 }, 'every port moves up by ten in lane 1'],
  ['e2e',         9, { web: 3092, backend: 3492, site: 3592 }, 'the last lane stays below the next hundred'],
  ['agent-built', 0, { web: 3004, backend: 3401, site: 3501 }, 'the agents\' built server talks to the agent backend'],
  ['agent-built', 2, { web: 3024, backend: 3421, site: 3521 }, 'and to the agent backend of its own lane'],
]

describe('Lanes.portsOf', () => {
  for (const [role, lane, expected, blurb] of PortsCases) {
    it(blurb, () => {
      expect(Lanes.portsOf(role, lane)).to.deep.eq(expected)
    })
  }

  it('gives every role in every lane ports no other role or lane uses', () => {
    const roles: Lanes.Role[] = ['dev', 'agent', 'e2e', 'e2e-agent', 'e2e-built']
    const ports: number[] = []
    for (let lane = 0; lane <= Lanes.MaxLane; lane++) {
      for (const role of roles) {
        const { web, backend, site } = Lanes.portsOf(role, lane)
        ports.push(web, backend, site)
      }
    }
    expect(new Set(ports).size).to.eq(ports.length)
  })
})

describe('Lanes.envFor', () => {
  it('names the role\'s port and backend in its lane, and the role and lane themselves', () => {
    expect(Lanes.envFor('e2e', 1)).to.deep.eq({ PORT: '3012', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3412', CONVEX_ROLE: 'e2e', TRIQUET_LANE: '1' })
  })
})

describe('Lanes.givenLaneOf', () => {
  it('reads TRIQUET_LANE', () => {
    expect(Lanes.givenLaneOf({ TRIQUET_LANE: '0' })).to.eq(0)
    expect(Lanes.givenLaneOf({ TRIQUET_LANE: '7' })).to.eq(7)
  })

  it('names no lane when TRIQUET_LANE is unset or blank', () => {
    expect(Lanes.givenLaneOf({})).to.be.undefined
    expect(Lanes.givenLaneOf({ TRIQUET_LANE: '' })).to.be.undefined
  })

  it('refuses what is not a lane', () => {
    expect(() => Lanes.givenLaneOf({ TRIQUET_LANE: '10' })).to.throw('TRIQUET_LANE=10 is not a lane: 0 to 9')
    expect(() => Lanes.givenLaneOf({ TRIQUET_LANE: '-1' })).to.throw('is not a lane')
  })
})

describe('claiming lanes', () => {
  let scratch: string
  let claimsdir: string
  /** A directory standing in for a worktree, so its claim is live */
  const worktree = (label: string): string => {
    const root = path.join(scratch, label)
    fs.mkdirSync(root, { recursive: true })
    return root
  }

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-lanes-'))
    claimsdir = path.join(scratch, 'claims')
  })
  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true })
  })

  it('gives the first worktree lane 1, and the next lane 2', () => {
    expect(Lanes.claimLane(claimsdir, worktree('first'))).to.eq(1)
    expect(Lanes.claimLane(claimsdir, worktree('second'))).to.eq(2)
  })

  it('gives a worktree the lane it already holds', () => {
    const root = worktree('first')
    Lanes.claimLane(claimsdir, worktree('other'))
    expect(Lanes.claimLane(claimsdir, root)).to.eq(2)
    expect(Lanes.claimLane(claimsdir, root)).to.eq(2)
  })

  it('takes the lowest lane free, once one is released', () => {
    const first = worktree('first')
    Lanes.claimLane(claimsdir, first)
    Lanes.claimLane(claimsdir, worktree('second'))
    expect(Lanes.releaseLane(claimsdir, first)).to.eq(1)
    expect(Lanes.claimLane(claimsdir, worktree('third'))).to.eq(1)
  })

  it('takes over the lane of a worktree that no longer exists', () => {
    const gone = worktree('gone')
    Lanes.claimLane(claimsdir, gone)
    fs.rmSync(gone, { recursive: true })
    expect(Lanes.claimLane(claimsdir, worktree('next'))).to.eq(1)
  })

  it('refuses a tenth worktree while nine hold lanes', () => {
    for (const label of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9']) { Lanes.claimLane(claimsdir, worktree(label)) }
    expect(() => Lanes.claimLane(claimsdir, worktree('tenth'))).to.throw('Every lane from 1 to 9 is held')
  })

  it('releases nothing for a worktree holding no lane', () => {
    expect(Lanes.releaseLane(claimsdir, worktree('idle'))).to.be.undefined
  })
})

describe('node scripts/lanes.ts, in a repository with a worktree', () => {
  let scratch: string

  beforeEach(() => {
    const made = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-lanes-repo-'))
    scratch = fs.realpathSync(made)
    const main = path.join(scratch, 'main')
    fs.mkdirSync(main)
    git(main, 'init', '--quiet', '--initial-branch=main')
    git(main, 'commit', '--quiet', '--allow-empty', '--message=start')
    git(main, 'worktree', 'add', '--quiet', '-b', 'side', path.join(scratch, 'side'))
  })
  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true })
  })

  it('puts the main checkout in lane 0 and the worktree in lane 1', () => {
    expect(lanes(path.join(scratch, 'main'), 'lane')).to.eq('0')
    expect(lanes(path.join(scratch, 'side'), 'lane')).to.eq('1')
    expect(lanes(path.join(scratch, 'side'), 'ports', 'agent')).to.eq('3011 3411 3511')
  })

  it('frees the worktree\'s lane on release', () => {
    lanes(path.join(scratch, 'side'), 'lane')
    expect(lanes(path.join(scratch, 'side'), 'release')).to.eq('Lane 1 is free.')
    expect(fs.readdirSync(path.join(scratch, 'main', '.git', 'triquet-lanes'))).to.deep.eq([])
  })
})
