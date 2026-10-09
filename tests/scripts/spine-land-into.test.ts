import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, type SpineContext, type WorldT } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

/** Justifies and proves the branch at `root`, then bids to land it into `into`: the land's exit status and what it printed */
const landingInto = (world: WorldT, root: string, into: string) => {
  for (const step of [['justify'], ['e2e']]) {
    const ran = world.spine(root, step)
    expect(ran.status, ran.said).to.eq(0)
  }
  return world.spine(root, ['land', '--into', into])
}

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('land --into', () => {
    it('lands into the top: its branch takes the commits, origin has them, and the working branch is gone', ({ world }) => {
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

    it('refuses to land into a branch beneath the top, leaving the spine alone', ({ world }) => {
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

    it('refuses to land into main', ({ world }) => {
      const more = world.cut('more')
      world.commit(more, 'more.txt', 'more\n')
      const ran = landingInto(world, more, 'main')
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('never main')
      expect(world.git(world.main, 'rev-parse', 'main')).to.eq(world.git(world.main, 'rev-parse', 'origin/main'))
    })
  })
})
