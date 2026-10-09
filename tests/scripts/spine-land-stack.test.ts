import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, type SpineContext } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('land, beside other branches', () => {
    it('stacks the second of two parallel threads on the first', ({ world }) => {
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

    it('stops on a conflict with what landed first, leaving the spine alone, and lands once it is repaired', ({ world }) => {
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

    it('replays the spine onto origin/main once the Coach has merged its bottom, and pushes what it replayed', ({ world }) => {
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
})
