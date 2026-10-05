import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Spine from '../../scripts/spine'

const SpineScript = path.resolve(import.meta.dirname, '../../scripts/spine.ts')
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
  TQ_WORKTREES:        path.join(home, 'worktrees'),
  TRIQUET_LAND_CHECKS: 'true',
  TRIQUET_LAND_E2E:    'true',
})

interface WorldT {
  scratch: string
  main:    string
  git:     (cwd: string, ...args: string[]) => string
  /** Runs scripts/spine.ts in `cwd`; returns its exit status and everything it printed */
  spine:   (cwd: string, args: string[], env?: Record<string, string>) => { status: number | null, said: string }
  /** Writes `body` to `filename` in `cwd` and commits it */
  commit:  (cwd: string, filename: string, body: string) => void
  /** Cuts a worktree for `label` and returns its root */
  cut:     (label: string) => string
  /** The branch the main checkout stands on */
  top:     () => string
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
  const commit = (cwd: string, filename: string, body: string) => {
    fs.mkdirSync(path.dirname(path.join(cwd, filename)), { recursive: true })
    fs.writeFileSync(path.join(cwd, filename), body)
    git(cwd, 'add', filename)
    git(cwd, 'commit', '--quiet', '--message', `feat: ${filename}`)
  }
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
  return { scratch, main, git, spine, commit, cut, top }
}

/**
 * Lands alpha, then has the Coach merge its PR as GitHub does after "Update branch" by rebase:
 * alpha's commits reach main under new SHAs. With `deleted`, origin then drops the branch.
 * Returns the commit origin's alpha held.
 */
const mergeRebased = (world: WorldT, deleted: boolean) => {
  const alpha = world.cut('alpha')
  world.commit(alpha, 'alpha.txt', 'alpha\n')
  expect(world.spine(alpha, ['land']).status).to.eq(0)
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

describe('node scripts/spine.ts, in a repository with worktrees', () => {
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
      const ran = world.spine(root, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Landed ${Today}-alpha on main`)
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(fs.readFileSync(path.join(world.main, 'alpha.txt'), 'utf8')).to.eq('alpha\n')
      expect(world.git(world.main, 'rev-parse', `origin/${Today}-alpha`)).to.eq(world.git(world.main, 'rev-parse', 'HEAD'))
      expect(world.git(root, 'rev-parse', '--abbrev-ref', 'HEAD')).to.eq('HEAD')
    })

    it('stacks the second of two parallel threads on the first', () => {
      const alpha = world.cut('alpha')
      const beta = world.cut('beta')
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      expect(world.spine(alpha, ['land']).status).to.eq(0)
      const ran = world.spine(beta, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(world.top()).to.eq(`${Today}-beta`)
      expect(world.git(world.main, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: beta.txt', 'feat: alpha.txt'])
    })

    it('stops on a conflict with what landed first, leaving the spine alone, and lands once it is repaired', () => {
      const alpha = world.cut('alpha')
      const beta = world.cut('beta')
      world.commit(alpha, 'shared.txt', 'alpha\n')
      world.commit(beta, 'shared.txt', 'beta\n')
      expect(world.spine(alpha, ['land']).status).to.eq(0)
      const stopped = world.spine(beta, ['land'])
      expect(stopped.status).to.eq(1)
      expect(stopped.said).to.contain('conflicted; the spine is untouched')
      expect(world.top()).to.eq(`${Today}-alpha`)
      fs.writeFileSync(path.join(beta, 'shared.txt'), 'alpha, then beta\n')
      world.git(beta, 'add', 'shared.txt')
      world.git(beta, '-c', 'core.editor=true', 'rebase', '--continue')
      const ran = world.spine(beta, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(world.git(world.main, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: shared.txt', 'feat: shared.txt'])
      expect(fs.readFileSync(path.join(world.main, 'shared.txt'), 'utf8')).to.eq('alpha, then beta\n')
    })

    it('stops when the checks fail, leaving the spine alone', () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['land'], { TRIQUET_LAND_CHECKS: 'false' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('The checks failed')
      expect(world.top()).to.eq('main')
    })

    it('stops when e2e fails, leaving the spine alone', () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['land'], { TRIQUET_LAND_E2E: 'false' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('The e2e suite failed')
      expect(world.top()).to.eq('main')
    })

    it('refuses a worktree holding uncommitted changes', () => {
      const root = world.cut('alpha')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      expect(world.spine(root, ['land']).said).to.contain('commit them, then land')
    })

    it('sweeps the Coach\'s notes onto the spine, on a branch of their own when it stood on main, and leaves other strays alone', () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      fs.mkdirSync(path.join(world.main, 'whiteboard'))
      fs.writeFileSync(path.join(world.main, 'whiteboard', 'plan.md'), '# the plan\n')
      fs.writeFileSync(path.join(world.main, 'stray.txt'), 'mine\n')
      const ran = world.spine(root, ['land'])
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
      const ran = world.spine(root, ['land'])
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
      expect(world.spine(root, ['land']).status).to.eq(0)
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(fs.readFileSync(path.join(world.main, 'shared.txt'), 'utf8')).to.eq('the Coach, mid-thought\n')
    })

    it('replays the spine onto origin/main once the Coach has merged its bottom, and pushes what it replayed', () => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      world.spine(alpha, ['land'])
      world.spine(beta, ['land'])
      // The Coach merges alpha's PR, and something else lands on main too.
      const elsewhere = path.join(world.scratch, 'elsewhere')
      world.git(world.scratch, 'clone', '--quiet', path.join(world.scratch, 'origin.git'), elsewhere)
      world.git(elsewhere, 'merge', '--quiet', '--no-ff', '--message', 'Merge alpha', `origin/${Today}-alpha`)
      world.commit(elsewhere, 'other.txt', 'other\n')
      world.git(elsewhere, 'push', '--quiet', 'origin', 'main')
      const gamma = world.cut('gamma')
      world.commit(gamma, 'gamma.txt', 'gamma\n')
      const ran = world.spine(gamma, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(world.git(world.main, 'log', '--format=%s', 'origin/main..HEAD').split('\n')).to.deep.eq(['feat: gamma.txt', 'feat: beta.txt'])
      expect(world.git(world.main, 'rev-parse', `origin/${Today}-beta`)).to.eq(world.git(world.main, 'rev-parse', `${Today}-beta`))
      expect(world.git(world.main, 'merge-base', '--is-ancestor', 'origin/main', `${Today}-beta`)).to.eq('')
    })
  })

  describe('sweep', () => {
    it('says so when there is nothing to sweep', () => {
      expect(world.spine(world.main, ['sweep']).said.trim()).to.eq('Nothing to sweep.')
    })

    it('commits the Coach\'s notes onto the top it stands on', () => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.spine(root, ['land'])
      fs.mkdirSync(path.join(world.main, 'notes'))
      fs.writeFileSync(path.join(world.main, 'notes', 'idea.md'), 'an idea\n')
      expect(world.spine(world.main, ['sweep']).said.trim()).to.eq('Swept from the main checkout: notes/idea.md.')
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(world.git(world.main, 'log', '-1', '--format=%s')).to.eq('docs: swept from the main checkout')
    })

    it('sweeps a note already committed and edited since, whose status line starts with a space', () => {
      const root = world.cut('alpha')
      world.commit(root, 'notes/idea.md', 'an idea\n')
      world.spine(root, ['land'])
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

    it('goes back to main when it already stands on origin/main on another branch', () => {
      world.git(world.main, 'switch', '--quiet', '--create', 'leftover')
      const ran = world.spine(world.main, ['restack'])
      expect(ran.said.trim()).to.eq('The whole spine has merged: the main checkout stands on main again, and leftover is done.')
      expect(world.top()).to.eq('main')
    })

    it('stays put when local main holds commits origin lacks', () => {
      world.commit(world.main, 'local.txt', 'local\n')
      world.git(world.main, 'switch', '--quiet', '--create', 'leftover', 'origin/main')
      expect(world.spine(world.main, ['restack']).said).to.contain('local main holds commits origin/main lacks')
      expect(world.top()).to.eq('leftover')
    })

    it('lets the first thread after a fresh start land on main, starting the spine', () => {
      mergeRebased(world, true)
      const beta = world.cut('beta')
      world.commit(beta, 'beta.txt', 'beta\n')
      const ran = world.spine(beta, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('stacked on nothing')
      expect(world.top()).to.eq(`${Today}-beta`)
      expect(world.git(world.main, 'log', '--format=%s', 'origin/main..HEAD')).to.eq('feat: beta.txt')
    })

    it('forgets a branch origin deleted on merging it, rather than leasing a push against it', () => {
      const alpha = world.cut('alpha')
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.spine(alpha, ['land'])
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
