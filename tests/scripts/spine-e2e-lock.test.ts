import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, type SpineContext, type WorldT } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

/** Starts a full run in `root` that holds the e2e lock until `open` is called, once it has taken the lock */
const holdingE2eLock = async (world: WorldT, root: string) => {
  const gate = path.join(world.scratch, `gate-${path.basename(root)}`)
  const run = world.started(root, ['e2e'], { FAKE_UNTIL: gate })
  await vi.waitFor(() => { expect(fs.existsSync(world.e2eLock.notefile), run.said()).to.be.true }, { timeout: 20_000, interval: 50 })
  return { ...run, open: () => { fs.writeFileSync(gate, '') } }
}

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('the e2e lock', () => {
    it('makes a second full run wait, saying whose run holds it, then catch up with what landed meanwhile before it runs', async ({ world }) => {
      const [alpha, beta, gamma] = [world.cut('alpha'), world.cut('beta'), world.cut('gamma')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      world.commit(gamma, 'notes/gamma.md', 'gamma\n')
      const first = await holdingE2eLock(world, alpha)
      const second = world.started(beta, ['e2e'])
      await vi.waitFor(() => { expect(second.said()).to.contain('The e2e lock is held') }, { timeout: 20_000, interval: 50 })
      expect(second.said()).to.contain(`held by lane 1's full run of ${Today}-alpha (${alpha}, pid `)
      expect(second.said()).to.contain(`this run catches ${Today}-beta up with the top first`)
      expect(world.spine(gamma, ['justify']).status).to.eq(0)
      expect(world.spine(gamma, ['land']).status).to.eq(0)
      first.open()
      expect(await first.exited, first.said()).to.eq(0)
      expect(await second.exited, second.said()).to.eq(0)
      expect(second.said()).to.contain('Took the e2e lock, after').and.contain(`Rebased ${Today}-beta onto ${Today}-gamma`).and.contain(`Proved ${Today}-beta`)
      const [provedOn] = world.git(beta, 'config', `branch.${Today}-beta.proved`).split(' ', 1)
      expect(provedOn).to.eq(world.git(world.main, 'rev-parse', `${Today}-gamma`))
      const runs = world.logged()
      expect(runs.map(({ branch, waited_s }) => [branch, waited_s === undefined ? 'none' : 'some'])).to.deep.eq([[`${Today}-alpha`, 'some'], [`${Today}-beta`, 'some']])
      expect(runs[0]?.waited_s).to.eq(0)
      expect(fs.existsSync(world.e2eLock.lockdir) || fs.existsSync(world.e2eLock.notefile)).to.be.false
    })

    it('lets a rerun, chosen specs and a run in CI go by without it', async ({ world }) => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      const first = await holdingE2eLock(world, alpha)
      for (const [args, extra] of [[['e2e', '--last-failed'], {}], [['e2e', 'e2e/a.spec.ts'], {}], [['e2e'], { CI: 'true' }]] as const) {
        const ran = world.spine(beta, [...args], extra)
        expect(ran.status, ran.said).to.eq(0)
        expect(ran.said).not.to.contain('The e2e lock is held')
      }
      expect(world.logged().map(({ kind, waited_s }) => [kind, waited_s])).to.deep.eq([['rerun', undefined], ['chosen', undefined], ['full', undefined]])
      first.open()
      expect(await first.exited, first.said()).to.eq(0)
    })

    it('stops a waiting run whose catch-up conflicts, freeing the lock and running nothing', async ({ world }) => {
      const [alpha, beta, gamma] = [world.cut('alpha'), world.cut('beta'), world.cut('gamma')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'notes/shared.md', 'beta\n')
      world.commit(gamma, 'notes/shared.md', 'gamma\n')
      const first = await holdingE2eLock(world, alpha)
      const second = world.started(beta, ['e2e'])
      await vi.waitFor(() => { expect(second.said()).to.contain('The e2e lock is held') }, { timeout: 20_000, interval: 50 })
      expect(world.spine(gamma, ['justify']).status).to.eq(0)
      expect(world.spine(gamma, ['land']).status).to.eq(0)
      first.open()
      expect(await first.exited, first.said()).to.eq(0)
      expect(await second.exited).to.eq(1)
      expect(second.said()).to.contain('conflicted').and.contain('so the suite has not run; the e2e lock is free again')
      expect(fs.existsSync(world.e2eLock.lockdir)).to.be.false
      expect(world.logged().map(({ branch }) => branch)).to.deep.eq([`${Today}-alpha`])
    })
  })
})
