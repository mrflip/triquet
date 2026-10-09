import { describe, expect, test } from 'vitest'
import { SpineTimeout, SpineFixtures, withSpecs, type SpineContext, type WorldT } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

/** A branch on alpha in `world`, its corner proved by a touched run over the alarms spec */
const provedOverAlarms = (world: WorldT) => {
  withSpecs(world, 'alarms', 'reviews')
  const root = world.cut('alpha')
  world.commit(root, 'src/components/AlarmSnackbar.tsx', 'alarm\n')
  world.commit(root, 'tests/components/AlarmSnackbar.test.ts', 'test\n')
  expect(world.spine(root, ['justify']).status).to.eq(0)
  const ran = world.spine(root, ['e2e', '--touched'])
  expect(ran.status, ran.said).to.eq(0)
  return { root, ran }
}

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('e2e --touched', () => {
    it('runs only the corner the branch reaches, says which corner each path chose, and proves the branch over it, for the bid to take', ({ world }) => {
      const { root, ran } = provedOverAlarms(world)
      expect(ran.said).to.match(/src\/components\/AlarmSnackbar\.tsx\s+the alarms: alarms\n/)
      expect(ran.said).to.match(/tests\/components\/AlarmSnackbar\.test\.ts\s+nothing e2e notices\n/)
      expect(ran.said).to.contain('e2e, touched: 1 passed, 0 failed').and.contain('over its corner alone (alarms)')
      expect(world.logged().at(-1)).to.deep.include({ kind: 'touched', args: ['e2e/alarms.spec.ts'], proved: true })
      const landed = world.spine(root, ['land'])
      expect(landed.status, landed.said).to.eq(0)
      expect(landed.said).to.contain('over its corner (alarms), which still holds every path the branch changes')
    })

    it('refuses the bid once the branch reaches past the corner it proved, naming the path, unless the bid says why e2e has nothing to tell it', ({ world }) => {
      const { root } = provedOverAlarms(world)
      world.commit(root, 'src/components/ReviewScreen.tsx', 'review\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const refused = world.spine(root, ['land'])
      expect(refused.status).to.eq(1)
      expect(refused.said).to.contain('scoped to its corner (alarms), and src/components/ReviewScreen.tsx reaches beyond it').and.contain('pnpm e2e --touched` again')
      expect(world.top()).to.eq('main')
      const skipped = world.spine(root, ['land', '--skip-e2e', 'I read it and no spec could tell'])
      expect(skipped.status, skipped.said).to.eq(0)
      expect(skipped.said).to.contain('e2e skipped: I read it and no spec could tell')
    })

    it('stands again once a second touched run covers the wider corner', ({ world }) => {
      const { root } = provedOverAlarms(world)
      world.commit(root, 'src/components/ReviewScreen.tsx', 'review\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const ran = world.spine(root, ['e2e', '--touched'])
      expect(ran.status, ran.said).to.eq(0)
      expect(world.logged().at(-1)?.args).to.deep.eq(['e2e/alarms.spec.ts', 'e2e/reviews.spec.ts'])
      expect(world.spine(root, ['land']).status).to.eq(0)
    })

    it('runs the whole suite, as a full run, when a path reaches it, and the bid takes that as a full proof', ({ world }) => {
      withSpecs(world, 'alarms')
      const root = world.cut('alpha')
      world.commit(root, 'src/components/AlarmSnackbar.tsx', 'alarm\n')
      world.commit(root, 'convex/schema.ts', 'schema\n')
      expect(world.spine(root, ['justify']).status).to.eq(0)
      const ran = world.spine(root, ['e2e', '--touched'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.match(/convex\/schema\.ts\s+the whole suite\n/).and.contain('A path reaches the whole suite, so the whole suite runs, as a full run.')
      expect(world.logged().at(-1)).to.deep.include({ kind: 'full', args: [] })
      const landed = world.spine(root, ['land'])
      expect(landed.status, landed.said).to.eq(0)
      expect(landed.said).not.to.contain('over its corner')
    })

    it('skips a spec file not written yet, and runs the whole suite for a corner with none', ({ world }) => {
      withSpecs(world, 'reviews')
      const root = world.cut('alpha')
      world.commit(root, 'src/components/FoldButton.tsx', 'fold\n')
      expect(world.spine(root, ['e2e', '--touched']).status).to.eq(0)
      expect(world.logged().at(-1)?.args).to.deep.eq(['e2e/reviews.spec.ts'])
      world.commit(root, 'src/components/Stats.tsx', 'stats\n')
      const ran = world.spine(root, ['e2e', '--touched'])
      expect(ran.said).to.contain('the whole suite, as the stats page has no spec file yet')
      expect(world.logged().at(-1)?.kind).to.eq('full')
    })

    it('runs nothing when no path is one e2e notices, and says how to land without', ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'tests/lib/useful.test.ts', 'test\n')
      const ran = world.spine(root, ['e2e', '--touched'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('so no spec runs').and.contain('--skip-e2e')
      expect(world.logged()).to.deep.eq([])
    })

    it('takes no other arguments', ({ world }) => {
      const root = world.cut('alpha')
      expect(world.spine(root, ['e2e', '--touched', '--workers=1']).said).to.contain('takes nothing else')
    })

    it('keeps the scope through a rerun that repairs it', ({ world }) => {
      withSpecs(world, 'alarms')
      const root = world.cut('alpha')
      world.commit(root, 'src/components/AlarmSnackbar.tsx', 'alarm\n')
      expect(world.spine(root, ['e2e', '--touched'], { FAKE_FAILING: 'alarms.spec.ts' }).status).to.eq(1)
      const rerun = world.spine(root, ['e2e', '--last-failed'], { FAKE_RAN: 'alarms.spec.ts' })
      expect(rerun.status, rerun.said).to.eq(0)
      expect(rerun.said).to.contain('A flake: alarms.spec.ts › works').and.contain('over its corner alone (alarms)')
    })
  })
})
