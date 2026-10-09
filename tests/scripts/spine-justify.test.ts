import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, type SpineContext } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('justify', () => {
    it("records the branch's patch-id when green over committed work", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['justify'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Justified ${Today}-alpha`)
      expect(world.git(root, 'config', `branch.${Today}-alpha.justified`)).to.match(/^[\da-f]{40}$/)
    })

    it("records nothing over uncommitted changes", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      fs.writeFileSync(path.join(root, 'draft.txt'), 'half done\n')
      const ran = world.spine(root, ['justify'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('nothing is recorded')
      expect(world.spine(root, ['land']).said).to.contain('commit them first')
      fs.rmSync(path.join(root, 'draft.txt'))
      expect(world.spine(root, ['land']).said).to.contain('has not been justified')
    })

    it("stops red, recording nothing", ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const ran = world.spine(root, ['justify'], { TRIQUET_JUSTIFY: 'false' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain('Justify failed')
      expect(world.spine(root, ['land']).said).to.contain('has not been justified')
    })
  })
})
