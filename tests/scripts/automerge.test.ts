import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Automerge from '../../scripts/automerge'
import type { PrT } from '../../scripts/automerge'

const AutomergeScript = path.resolve(import.meta.dirname, '../../scripts/automerge.ts')
const Tsx = path.resolve(import.meta.dirname, '../../node_modules/.bin/tsx')

/** A PR as gh describes it, open on main from this repository unless `extra` says otherwise */
const prOf = (number: number, branch: string, sha: string, extra: Partial<PrT> = {}): PrT => ({
  number, title: `PR ${String(number)}`, body: '', state: 'OPEN', isDraft: false, isCrossRepository: false,
  baseRefName: 'main', headRefName: branch, headRefOid: sha, ...extra,
})

// A history standing in for git's: each commit's ancestors, itself included.
const Ancestry: Record<string, string[]> = {
  aaa: ['aaa'],
  bbb: ['aaa', 'bbb'],
  ccc: ['aaa', 'bbb', 'ccc'],
  ddd: ['aaa', 'bbb', 'ddd'],
}
const holds = (upper: string, lower: string) => (Ancestry[upper] ?? []).includes(lower)

describe('Automerge.lineOf', () => {
  it('finds the PRs beneath and above, bottom first, and leaves out those beside', () => {
    const open = [prOf(3, 'three', 'ccc'), prOf(1, 'one', 'aaa'), prOf(2, 'two', 'bbb')]
    expect(Automerge.lineOf(open[2]!, open, holds).map((pr) => pr.number)).to.deep.eq([1, 2, 3])
    expect(Automerge.lineOf(open[1]!, open, holds).map((pr) => pr.number)).to.deep.eq([1, 2, 3])
  })

  it('is the PR alone when nothing stacks with it', () => {
    const open = [prOf(1, 'one', 'aaa')]
    expect(Automerge.lineOf(open[0]!, open, holds).map((pr) => pr.number)).to.deep.eq([1])
  })

  it('stops when two stacks stand on the PR', () => {
    const open = [prOf(2, 'two', 'bbb'), prOf(3, 'three', 'ccc'), prOf(4, 'four', 'ddd')]
    expect(() => Automerge.lineOf(open[0]!, open, holds)).to.throw('#2 carries two stacks (#3, #4)')
  })

  it('takes a fork above as no concern of a PR beneath it', () => {
    const open = [prOf(3, 'three', 'ccc'), prOf(4, 'four', 'ddd')]
    expect(Automerge.lineOf(open[0]!, open, holds).map((pr) => pr.number)).to.deep.eq([3])
  })
})

describe('Automerge.movedHeads', () => {
  const line = [prOf(1, 'one', 'aaa'), prOf(2, 'two', 'ccc')]

  it('moves each head to the commit in its place', () => {
    expect(Automerge.movedHeads(line, ['aaa', 'bbb', 'ccc'], ['AAA', 'BBB', 'CCC'])).to.deep.eq([
      { branch: 'one', from: 'aaa', to: 'AAA' },
      { branch: 'two', from: 'ccc', to: 'CCC' },
    ])
  })

  it('stops when the replay dropped a commit', () => {
    expect(() => Automerge.movedHeads(line, ['aaa', 'bbb', 'ccc'], ['BBB', 'CCC'])).to.throw('made 2 commits of 3')
  })
})

describe('Automerge.holdupsOf', () => {
  it('finds nothing in a PR of views and docs', () => {
    expect(Automerge.holdupsOf([prOf(1, 'one', 'aaa')], ['src/components/Stats.tsx', 'notes/deploy.md'], '')).to.deep.eq([])
  })

  it('holds up a schema change, a new backfill, a Serial Deploy and a stated precondition', () => {
    const prs = [prOf(1, 'one', 'aaa', { title: 'Viz (Serial Deploy: viz)' }), prOf(2, 'two', 'bbb', { body: '1. **Before merging**, check production' })]
    const diff = '+export const backfillViz = migrations.define({\n'
    expect(Automerge.holdupsOf(prs, ['convex/schema.ts', 'convex/migrations.ts'], diff)).to.deep.eq([
      'it changes convex/schema.ts: a schema push',
      'it defines a backfill',
      '#1 is a Serial Deploy',
      '#2 asks for something before merging',
    ])
  })

  it('lets a change to migrations.ts that defines no backfill through', () => {
    expect(Automerge.holdupsOf([prOf(1, 'one', 'aaa')], ['convex/migrations.ts'], '+export const Backfills = [internal.migrations.backfillHuntOrglabels]\n')).to.deep.eq([])
  })

  it('holds up a draft, a fork and another base', () => {
    const prs = [prOf(1, 'one', 'aaa', { isDraft: true, isCrossRepository: true, baseRefName: 'next' })]
    expect(Automerge.holdupsOf(prs, [], '')).to.deep.eq(['#1 is a draft', '#1 comes from a fork', '#1 is based on next, not main'])
  })
})

describe('Automerge.requiredChecksOf', () => {
  it('reads the checks every required_status_checks rule names', () => {
    const rules = [
      { type: 'deletion', parameters: null },
      { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'lint-typecheck' }, { context: 'e2e (1)' }] } },
    ]
    expect(Automerge.requiredChecksOf(JSON.stringify(rules))).to.deep.eq(['lint-typecheck', 'e2e (1)'])
  })

  it('is empty when main requires none', () => {
    expect(Automerge.requiredChecksOf('[{"type":"required_status_checks","parameters":{"required_status_checks":[]}}]')).to.deep.eq([])
  })
})

// A gh that answers from files in $FAKE_GH, and writes down what it was asked to merge.
const FakeGh = [
  '#!/bin/sh',
  'case "$1 $2" in',
  '  "pr view") cat "$FAKE_GH/pr-$3.json" ;;',
  '  "pr list") cat "$FAKE_GH/open.json" ;;',
  '  "api repos/{owner}/{repo}/rules/branches/main") cat "$FAKE_GH/rules.json" ;;',
  '  "pr merge") echo "$*" >> "$FAKE_GH/merged.log" ;;',
  '  *) echo "fake gh was asked: $*" >&2; exit 1 ;;',
  'esac',
  '',
].join('\n')

const Required = [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'lint-typecheck' }] } }]

/**
 * A bare origin; a main checkout of it on `main`; a stack of two PRs on origin, #1 (`one`) and #2
 * (`two`, on `one`), cut before main moved on; and a fake gh that knows them.
 */
const makeWorld = (scratch: string) => {
  const fakes = path.join(scratch, 'gh')
  fs.mkdirSync(fakes)
  fs.writeFileSync(path.join(fakes, 'gh'), FakeGh, { mode: 0o755 })
  const env = {
    ...process.env,
    HOME:                scratch,
    XDG_CONFIG_HOME:     scratch,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME:     'Tess Ter',
    GIT_AUTHOR_EMAIL:    'tess@example.com',
    GIT_COMMITTER_NAME:  'Tess Ter',
    GIT_COMMITTER_EMAIL: 'tess@example.com',
    PATH:                `${fakes}${path.delimiter}${process.env.PATH ?? ''}`,
    FAKE_GH:             fakes,
  }
  const git = (cwd: string, ...args: string[]) => (
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- the installed git, as the script under test runs it
    execFileSync('git', args, { cwd, encoding: 'utf8', env }).trim()
  )
  const commit = (cwd: string, filename: string, body: string) => {
    fs.writeFileSync(path.join(cwd, filename), body)
    git(cwd, 'add', filename)
    git(cwd, 'commit', '--quiet', '--message', `feat: ${filename}`)
    return git(cwd, 'rev-parse', 'HEAD')
  }
  const fake = (filename: string, content: unknown) => {
    fs.writeFileSync(path.join(fakes, filename), JSON.stringify(content))
  }
  const automerge = (args: string[]) => {
    const ran = spawnSync(Tsx, [AutomergeScript, ...args], { cwd: main, encoding: 'utf8', env })
    return { status: ran.status, said: `${ran.stdout}${ran.stderr}` }
  }
  const merged = () => (fs.existsSync(path.join(fakes, 'merged.log')) ? fs.readFileSync(path.join(fakes, 'merged.log'), 'utf8').trim() : '')
  const origin = path.join(scratch, 'origin.git')
  const main = path.join(scratch, 'main')
  git(scratch, 'init', '--quiet', '--bare', '--initial-branch', 'main', origin)
  fs.mkdirSync(main)
  git(main, 'init', '--quiet', '--initial-branch', 'main')
  git(main, 'remote', 'add', 'origin', origin)
  commit(main, 'shared.txt', 'one\n')
  git(main, 'push', '--quiet', '--set-upstream', 'origin', 'main')
  git(main, 'switch', '--quiet', '--create', 'one')
  const one = commit(main, 'one.txt', 'one\n')
  git(main, 'switch', '--quiet', '--create', 'two')
  const two = commit(main, 'two.txt', 'two\n')
  git(main, 'push', '--quiet', 'origin', 'one', 'two')
  git(main, 'switch', '--quiet', 'main')
  commit(main, 'later.txt', 'later\n')
  git(main, 'push', '--quiet', 'origin', 'main')
  const prs = [prOf(1, 'one', one), prOf(2, 'two', two)]
  fake('pr-1.json', prs[0])
  fake('pr-2.json', prs[1])
  fake('open.json', prs)
  fake('rules.json', Required)
  return { scratch, main, git, commit, fake, automerge, merged, one, two }
}

describe('pnpm automerge, in a repository with a stack of PRs', () => {
  let world: ReturnType<typeof makeWorld>
  beforeEach(() => {
    const made = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-automerge-test-'))
    world = makeWorld(fs.realpathSync(made))
  })
  afterEach(() => {
    fs.rmSync(world.scratch, { recursive: true, force: true })
  })

  const onOrigin = (branch: string) => world.git(world.main, 'rev-parse', `refs/remotes/origin/${branch}`)
  const isOnMain = (branch: string) => world.git(world.main, 'merge-base', `origin/${branch}`, 'origin/main') === world.git(world.main, 'rev-parse', 'origin/main')

  it('replays the whole line onto main, pushes it, and sets the PR to merge at its new head', () => {
    const ran = world.automerge(['2'])
    expect(ran.status, ran.said).to.eq(0)
    expect(isOnMain('one') && isOnMain('two')).to.be.true
    expect(world.git(world.main, 'rev-parse', 'origin/two~1')).to.eq(onOrigin('one'))
    expect(world.merged()).to.eq(`pr merge 2 --auto --merge --match-head-commit ${onOrigin('two')}`)
    expect(ran.said).to.include('#2 will merge').and.to.include('#1 with it')
    expect(world.git(world.main, 'rev-parse', 'two')).to.eq(onOrigin('two'))
  })

  it('keeps the PRs above the one merging stacked on it', () => {
    const ran = world.automerge(['1'])
    expect(ran.status, ran.said).to.eq(0)
    expect(world.git(world.main, 'rev-parse', 'origin/two~1')).to.eq(onOrigin('one'))
    expect(world.merged()).to.eq(`pr merge 1 --auto --merge --match-head-commit ${onOrigin('one')}`)
  })

  it('only sets auto-merge when the line is up to date', () => {
    expect(world.automerge(['2']).status).to.eq(0)
    const head = onOrigin('two')
    world.fake('pr-2.json', prOf(2, 'two', head))
    world.fake('open.json', [prOf(1, 'one', onOrigin('one')), prOf(2, 'two', head)])
    const ran = world.automerge(['2'])
    expect(ran.status, ran.said).to.eq(0)
    expect(ran.said).to.include('up to date with main')
    expect(onOrigin('two')).to.eq(head)
  })

  it('pushes and sets nothing on a dry run, and leaves no scratch worktree', () => {
    const ran = world.automerge(['2', '--dry-run'])
    expect(ran.status, ran.said).to.eq(0)
    expect(ran.said).to.include('Would push one, two').and.to.include('Would set #2')
    expect(onOrigin('two')).to.eq(world.two)
    expect(world.merged()).to.eq('')
    expect(world.git(world.main, 'worktree', 'list').split('\n')).to.have.length(1)
  })

  it('stops on a conflict, pushing and setting nothing', () => {
    world.git(world.main, 'switch', '--quiet', 'main')
    world.commit(world.main, 'one.txt', 'main says otherwise\n')
    world.git(world.main, 'push', '--quiet', 'origin', 'main')
    const ran = world.automerge(['2'])
    expect(ran.status).to.eq(1)
    expect(ran.said).to.include('conflicted (one.txt)')
    expect(onOrigin('two')).to.eq(world.two)
    expect(world.merged()).to.eq('')
    expect(world.git(world.main, 'worktree', 'list').split('\n')).to.have.length(1)
  })

  it('stops on a schema change before replaying anything', () => {
    world.git(world.main, 'switch', '--quiet', 'two')
    fs.mkdirSync(path.join(world.main, 'convex'))
    const head = world.commit(world.main, 'convex/schema.ts', 'export default {}\n')
    world.git(world.main, 'push', '--quiet', 'origin', 'two')
    world.git(world.main, 'switch', '--quiet', 'main')
    world.fake('pr-2.json', prOf(2, 'two', head))
    world.fake('open.json', [prOf(1, 'one', world.one), prOf(2, 'two', head)])
    const ran = world.automerge(['2'])
    expect(ran.status).to.eq(1)
    expect(ran.said).to.include('it changes convex/schema.ts')
    expect(onOrigin('two')).to.eq(head)
  })

  it('stops when main requires no checks, since auto-merge would not wait for CI', () => {
    world.fake('rules.json', [])
    const ran = world.automerge(['2'])
    expect(ran.status).to.eq(1)
    expect(ran.said).to.include('requires no status checks')
    expect(onOrigin('two')).to.eq(world.two)
  })

  it('replays a line on the spine by restacking it, under the hold', () => {
    world.git(world.main, 'switch', '--quiet', '--create', 'spiny', 'origin/main')
    const before = world.commit(world.main, 'spiny.txt', 'spiny\n')
    world.git(world.main, 'push', '--quiet', '--set-upstream', 'origin', 'spiny')
    const elsewhere = path.join(world.scratch, 'elsewhere')
    world.git(world.scratch, 'clone', '--quiet', path.join(world.scratch, 'origin.git'), elsewhere)
    world.commit(elsewhere, 'other.txt', 'other\n')
    world.git(elsewhere, 'push', '--quiet', 'origin', 'main')
    world.git(world.main, 'fetch', '--quiet', 'origin')
    world.fake('pr-3.json', prOf(3, 'spiny', before))
    world.fake('open.json', [prOf(3, 'spiny', before)])
    const ran = world.automerge(['3'])
    expect(ran.status, ran.said).to.eq(0)
    expect(ran.said).to.include('Replayed the spine (spiny)')
    expect(isOnMain('spiny')).to.be.true
    expect(world.git(world.main, 'rev-parse', 'HEAD')).to.eq(onOrigin('spiny'))
    expect(world.merged()).to.eq(`pr merge 3 --auto --merge --match-head-commit ${onOrigin('spiny')}`)
  })
})
