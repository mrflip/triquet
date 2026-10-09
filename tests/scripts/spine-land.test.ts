import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, type SpineContext } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('land', () => {
    it('folds a branch in: the main checkout stands on it, and origin has it', ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.bid(root)
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Landed ${Today}-alpha on main`)
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(fs.readFileSync(path.join(world.main, 'alpha.txt'), 'utf8')).to.eq('alpha\n')
      expect(world.git(world.main, 'rev-parse', `origin/${Today}-alpha`)).to.eq(world.git(world.main, 'rev-parse', 'HEAD'))
      expect(world.git(root, 'rev-parse', '--abbrev-ref', 'HEAD')).to.eq('HEAD')
    })

    it("stops when typecheck or the tests fail under the hold, leaving the spine alone", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.bid(root, { TRIQUET_LAND_CHECKS: 'false' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('Typecheck or the tests failed').and.contain('The spine is untouched')
      expect(world.top()).to.eq('main')
      const commondir = world.git(world.main, 'rev-parse', '--path-format=absolute', '--git-common-dir')
      expect(fs.existsSync(path.join(commondir, 'triquet-spine.lock'))).to.be.false
    })

    it("refuses a branch never justified, or changed since it was", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      expect(world.spine(root, ['land']).said).to.contain('has not been justified')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      expect(world.spine(root, ['e2e']).status).to.eq(0)
      world.commit(root, 'alpha.txt', 'alpha, amended\n')
      const ran = world.spine(root, ['land'])
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('has changed since it was justified')
      expect(world.top()).to.eq('main')
    })

    it("refuses a branch changing code with no e2e proof", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const ran = world.spine(root, ['land'])
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('has no e2e proof')
    })

    it("lands documents and notes with no e2e proof, still justified and tested", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'notes/idea.md', 'an idea\n')
      world.commit(root, 'whiteboard/20261006-x/shot.png', 'not really a png\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const ran = world.spine(root, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('no e2e proof needed')
      expect(world.top()).to.eq(`${Today}-alpha`)
    })

    it('refuses a worktree holding uncommitted changes', ({ world }) => {
      const root = world.cut('alpha')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      expect(world.spine(root, ['land']).said).to.contain('commit them first')
    })

    it('sweeps the Coach\'s notes onto the spine, on a branch of their own when it stood on main, and leaves other strays alone', ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      fs.mkdirSync(path.join(world.main, 'whiteboard'))
      fs.writeFileSync(path.join(world.main, 'whiteboard', 'plan.md'), '# the plan\n')
      fs.writeFileSync(path.join(world.main, 'stray.txt'), 'mine\n')
      const ran = world.bid(root)
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('Swept from the main checkout: whiteboard/plan.md')
      expect(world.git(world.main, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: alpha.txt', 'docs: swept from the main checkout'])
      expect(world.git(world.main, 'branch', '--list', `${Today}-swept_notes`)).to.contain('swept_notes')
      expect(world.git(world.main, 'status', '--porcelain')).to.eq('?? stray.txt')
    })

    it('stops rather than overwrite the Coach\'s uncommitted edit, putting the worktree back', ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'shared.txt', 'alpha\n')
      fs.writeFileSync(path.join(world.main, 'shared.txt'), 'the Coach, mid-thought\n')
      const ran = world.bid(root)
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('would not switch')
      expect(world.top()).to.eq('main')
      expect(fs.readFileSync(path.join(world.main, 'shared.txt'), 'utf8')).to.eq('the Coach, mid-thought\n')
      expect(world.git(root, 'symbolic-ref', '--short', 'HEAD')).to.eq(`${Today}-alpha`)
    })

    it('carries the Coach\'s uncommitted edit along when the branch leaves that file alone', ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      fs.writeFileSync(path.join(world.main, 'shared.txt'), 'the Coach, mid-thought\n')
      expect(world.bid(root).status).to.eq(0)
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(fs.readFileSync(path.join(world.main, 'shared.txt'), 'utf8')).to.eq('the Coach, mid-thought\n')
    })
  })
})
