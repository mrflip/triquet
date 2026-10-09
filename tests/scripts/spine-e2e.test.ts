import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, type SpineContext } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('e2e', () => {
    it("proves a branch whose full run is green, and logs the run", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['e2e'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('2 passed, 0 failed').and.contain(`Proved ${Today}-alpha`)
      const [provedOn] = world.git(root, 'config', `branch.${Today}-alpha.proved`).split(' ', 1)
      expect(provedOn).to.eq(world.git(root, 'config', `branch.${Today}-alpha.spinebase`))
      const [entry] = world.logged()
      expect(entry).to.include({ branch: `${Today}-alpha`, kind: 'full', committed: true, cache: 'cold', status: 0, proved: true, lane: 1, test_seconds: 3 })
      expect(entry?.counts).to.include({ passed: 2, failed: 0 })
    })

    it("holds what a full run failed until it passes alone, calls it a flake, and has the bid name it", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const red = world.spine(root, ['e2e'], { FAKE_FAILING: 'b.spec.ts' })
      expect(red.status).to.eq(1)
      expect(red.said).to.contain('1 passed, 1 failed').and.contain('Outstanding').and.contain('b.spec.ts › works')
      expect(world.spine(root, ['land']).said).to.contain('has no e2e proof')
      const rerun = world.spine(root, ['e2e', '--last-failed', '--workers=1'], { FAKE_RAN: 'b.spec.ts' })
      expect(rerun.status, rerun.said).to.eq(0)
      expect(rerun.said).to.contain('A flake: b.spec.ts › works').and.contain('Proved')
      expect(world.logged().map(({ kind, cleared }) => [kind, cleared])).to.deep.eq([['full', []], ['rerun', [{ spec: 'b.spec.ts › works', how: 'flake' }]]])
      const ran = world.spine(root, ['land'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain("Flakes, for the PR's Tests: line: b.spec.ts › works.")
    })

    it("calls a spec repaired when the code changed before it passed", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.spine(root, ['e2e'], { FAKE_FAILING: 'a.spec.ts' })
      world.commit(root, 'alpha.txt', 'alpha, repaired\n')
      const ran = world.spine(root, ['e2e', 'e2e/a.spec.ts'], { FAKE_RAN: 'a.spec.ts' })
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('Repaired: a.spec.ts › works').and.contain('Proved')
      expect(world.logged().at(-1)).to.include({ kind: 'chosen', proved: true })
    })

    it("keeps outstanding what a rerun fails again, and what a chosen spec newly fails", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.spine(root, ['e2e'], { FAKE_FAILING: 'a.spec.ts' })
      const ran = world.spine(root, ['e2e', '--last-failed'], { FAKE_RAN: 'a.spec.ts,c.spec.ts', FAKE_FAILING: 'a.spec.ts,c.spec.ts' })
      expect(ran.status).to.eq(1)
      expect(world.logged().at(-1)?.still).to.deep.eq(['a.spec.ts › works', 'c.spec.ts › works'])
    })

    it("proves nothing by a rerun with no full run behind it", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['e2e', '--last-failed'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('No finished full or touched run')
      expect(world.spine(root, ['e2e', '--last-failed']).said).not.to.contain('Proved')
    })

    it("proves nothing by a run that broke before its specs finished", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['e2e'], { FAKE_BROKEN: '1' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('0 passed').and.contain('proves nothing')
      expect(world.spine(root, ['e2e', '--last-failed']).said).to.contain('No finished full or touched run')
    })

    it("counts toward no proof over uncommitted changes, though it is logged", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      const ran = world.spine(root, ['e2e'])
      expect(ran.said).to.contain('counts toward no proof')
      expect(world.logged().at(-1)).to.include({ committed: false, proved: false })
      fs.rmSync(path.join(root, 'draft.txt'))
      world.spine(root, ['justify'])
      expect(world.spine(root, ['land']).said).to.contain('has no e2e proof')
    })

    it("takes the proof back when a later full run fails", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.spine(root, ['justify'])
      world.spine(root, ['e2e'])
      world.spine(root, ['e2e'], { FAKE_FAILING: 'a.spec.ts' })
      expect(world.spine(root, ['land']).said).to.contain('has no e2e proof')
    })

    it("summarises the log", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.spine(root, ['e2e'], { FAKE_FAILING: 'a.spec.ts' })
      world.spine(root, ['e2e', '--last-failed'], { FAKE_RAN: 'a.spec.ts' })
      const ran = world.spine(root, ['e2e-log'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('2 runs logged').and.contain('(flakes): 1')
    })
  })
})
