import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, isolatedEnv, type SpineContext } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('worktree', () => {
    it('cuts a branch from the top into a worktree with a lane of its own', ({ world }) => {
      const root = world.cut('alpha')
      expect(world.git(root, 'symbolic-ref', '--short', 'HEAD')).to.eq(`${Today}-alpha`)
      expect(world.git(root, 'rev-parse', 'HEAD')).to.eq(world.git(world.main, 'rev-parse', 'HEAD'))
      expect(world.git(root, 'config', `branch.${Today}-alpha.spinebase`)).to.eq(world.git(world.main, 'rev-parse', 'HEAD'))
      expect(world.spine(root, ['top']).said.trim()).to.eq('main')
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running these tests
      expect(execFileSync('node', [path.join(root, 'scripts', 'lanes.ts'), 'lane'], { cwd: root, encoding: 'utf8', env: isolatedEnv(world.scratch) }).trim()).to.eq('1')
    })

    it("seeds the e2e build cache from the main checkout's, which its first run finds seeded and its next warm", ({ world }) => {
      fs.mkdirSync(path.join(world.main, '.next-e2e', 'dev', 'cache', 'turbopack'), { recursive: true })
      fs.writeFileSync(path.join(world.main, '.next-e2e', 'dev', 'cache', 'turbopack', 'blob'), 'compiled\n')
      fs.writeFileSync(path.join(world.main, '.gitignore'), '.next-e2e/\n')
      const root = world.cut('alpha')
      expect(fs.readFileSync(path.join(root, '.next-e2e', 'dev', 'cache', 'turbopack', 'blob'), 'utf8')).to.eq('compiled\n')
      world.spine(root, ['e2e'])
      world.spine(root, ['e2e'])
      expect(world.logged().map(({ cache }) => cache)).to.deep.eq(['seeded', 'warm'])
    })

    it('refuses a label that is not one, and a branch that exists', ({ world }) => {
      expect(world.spine(world.main, ['worktree', 'Bad-Label', '--no-install']).said).to.contain('is not a label')
      world.cut('alpha')
      expect(world.spine(world.main, ['worktree', 'alpha', '--no-install']).said).to.contain('exists already')
    })

    it('removes a clean worktree and frees its lane', ({ world }) => {
      const root = world.cut('alpha')
      const ran = world.spine(root, ['worktree', '--remove'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('Lane 1 is free.')
      expect(fs.existsSync(root)).to.be.false
      expect(world.git(world.main, 'branch', '--list', `${Today}-alpha`)).to.contain('alpha')
    })

    it('refuses to remove a worktree holding uncommitted work', ({ world }) => {
      const root = world.cut('alpha')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      const ran = world.spine(root, ['worktree', '--remove'])
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('draft.txt')
      expect(fs.existsSync(path.join(root, 'draft.txt'))).to.be.true
    })
  })
})
