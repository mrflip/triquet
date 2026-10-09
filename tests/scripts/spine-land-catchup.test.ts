import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, withSpecs, type SpineContext } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('the bid, after its catch-up', () => {
    it("catches up under the hold when the top moved after the proof, keeping a justify the rebase did not change", ({ world }) => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      for (const step of [['justify'], ['e2e']]) { expect(world.spine(beta, step).status).to.eq(0) }
      expect(world.bid(alpha).status).to.eq(0)
      const ran = world.spine(beta, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`The top had moved: rebased onto ${Today}-alpha`).and.contain('No flakes to report')
      expect(world.git(world.main, 'log', '--format=%s', 'main..HEAD').split('\n')).to.deep.eq(['feat: beta.txt', 'feat: alpha.txt'])
    })

    it('reads a scoped proof afresh once it has rebased, so a spec file the top gained in the proved corner is required', ({ world }) => {
      withSpecs(world, 'reviews')
      const root = world.cut('alpha')
      world.commit(root, 'src/components/FoldButton.tsx', 'fold\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      expect(world.spine(root, ['e2e', '--touched']).status).to.eq(0)
      expect(world.logged().at(-1)?.args).to.deep.eq(['e2e/reviews.spec.ts'])
      withSpecs(world, 'grid')
      const refused = world.spine(root, ['land'])
      expect(refused.status, refused.said).to.eq(1)
      expect(refused.said).to.contain(`${Today}-alpha is rebased onto main`).and.contain('src/components/FoldButton.tsx reaches beyond it')
      expect(world.top()).to.eq('main')
      expect(world.git(world.main, 'log', '-1', '--format=%s')).to.eq('feat: e2e/grid.spec.ts')
      const again = world.spine(root, ['e2e', '--touched'])
      expect(again.status, again.said).to.eq(0)
      expect(world.logged().at(-1)?.args).to.deep.eq(['e2e/grid.spec.ts', 'e2e/reviews.spec.ts'])
      const landed = world.spine(root, ['land'])
      expect(landed.status, landed.said).to.eq(0)
    })

    it('passes on what the proof read afresh says, its flakes among it', ({ world }) => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(beta, 'beta.txt', 'beta\n')
      expect(world.spine(beta, ['justify']).status).to.eq(0)
      expect(world.spine(beta, ['e2e'], { FAKE_FAILING: 'b.spec.ts' }).status).to.eq(1)
      expect(world.spine(beta, ['e2e', '--last-failed'], { FAKE_RAN: 'b.spec.ts' }).status).to.eq(0)
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      expect(world.bid(alpha).status).to.eq(0)
      const ran = world.spine(beta, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('The top had moved').and.contain("Flakes, for the PR's Tests: line: b.spec.ts › works.")
    })
  })
})
