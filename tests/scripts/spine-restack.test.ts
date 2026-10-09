import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, type SpineContext, type WorldT } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

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

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('restack', () => {
    it('says so when the spine already stands on origin/main', ({ world }) => {
      expect(world.spine(world.main, ['restack']).said.trim()).to.eq('The spine already stands on origin/main.')
    })

    it('starts the spine afresh on main once all of it has merged, and pushes no branch origin has deleted', ({ world }) => {
      mergeRebased(world, true)
      const ran = world.spine(world.main, ['restack'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('the main checkout stands on main again').and.not.contain('Pushed')
      expect(world.top()).to.eq('main')
      expect(world.git(world.main, 'rev-parse', 'HEAD')).to.eq(world.git(world.main, 'rev-parse', 'origin/main'))
      expect(world.git(world.main, 'ls-remote', 'origin', `${Today}-alpha`)).to.eq('')
    })

    it('leaves alone a branch the replay emptied, though origin still has it', ({ world }) => {
      const pushedBefore = mergeRebased(world, false)
      const ran = world.spine(world.main, ['restack'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).not.to.contain('Pushed')
      expect(world.git(world.main, 'ls-remote', 'origin', `${Today}-alpha`)).to.contain(pushedBefore)
    })

    it('goes back to main when it already stands on origin/main, on a branch origin has deleted', ({ world }) => {
      standOnMergedBranch(world)
      const ran = world.spine(world.main, ['restack'])
      expect(ran.said.trim()).to.eq('The whole spine has merged: the main checkout stands on main again, and leftover is done.')
      expect(world.top()).to.eq('main')
    })

    it('leaves the Coach on a branch they cut by hand, though it stands on origin/main', ({ world }) => {
      world.git(world.main, 'switch', '--quiet', '--create', 'mine')
      expect(world.spine(world.main, ['restack']).said.trim()).to.eq('The spine already stands on origin/main.')
      expect(world.top()).to.eq('mine')
      world.git(world.main, 'switch', '--quiet', '--create', 'mine_too', 'origin/main')
      world.spine(world.main, ['restack'])
      expect(world.top()).to.eq('mine_too')
    })

    it('stays put when local main holds commits origin lacks', ({ world }) => {
      world.commit(world.main, 'local.txt', 'local\n')
      standOnMergedBranch(world)
      expect(world.spine(world.main, ['restack']).said).to.contain('local main holds commits origin/main lacks')
      expect(world.top()).to.eq('leftover')
    })

    it('lets the first thread after a fresh start land on main, starting the spine', ({ world }) => {
      mergeRebased(world, true)
      const beta = world.cut('beta')
      world.commit(beta, 'beta.txt', 'beta\n')
      const ran = world.bid(beta)
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('stacked on nothing')
      expect(world.top()).to.eq(`${Today}-beta`)
      expect(world.git(world.main, 'log', '--format=%s', 'origin/main..HEAD')).to.eq('feat: beta.txt')
    })

    it('forgets a branch origin deleted on merging it, rather than leasing a push against it', ({ world }) => {
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
