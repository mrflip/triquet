import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, type SpineContext } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('catchup', () => {
    it("rebases the branch onto a top that moved, and records its new base", ({ world }) => {
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

    it("says so when the branch stands on the top already", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['catchup'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('stands on the top already')
    })

    it("sweeps the Coach's notes onto the top, and brings them along", ({ world }) => {
      const root = world.cut('alpha')
      fs.mkdirSync(path.join(world.main, 'notes'))
      fs.writeFileSync(path.join(world.main, 'notes', 'idea.md'), 'an idea\n')
      const ran = world.spine(root, ['catchup'])
      expect(ran.said).to.contain('Swept from the main checkout: notes/idea.md')
      expect(fs.readFileSync(path.join(root, 'notes', 'idea.md'), 'utf8')).to.eq('an idea\n')
    })

    it("stops on a conflict with the rebase left for the worker, and the spine alone", ({ world }) => {
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

    it("refuses a worktree holding uncommitted changes, and the main checkout", ({ world }) => {
      const root = world.cut('alpha')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      expect(world.spine(root, ['catchup']).said).to.contain('commit them first')
      expect(world.spine(world.main, ['catchup']).said).to.contain('happens from a worktree')
    })
  })
})
