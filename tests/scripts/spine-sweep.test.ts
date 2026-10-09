import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { SpineTimeout, Today, SpineFixtures, type SpineContext } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('sweep', () => {
    it('says so when there is nothing to sweep', ({ world }) => {
      expect(world.spine(world.main, ['sweep']).said.trim()).to.eq('Nothing to sweep.')
    })

    it('commits the Coach\'s notes onto the top it stands on', ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      world.bid(root)
      fs.mkdirSync(path.join(world.main, 'notes'))
      fs.writeFileSync(path.join(world.main, 'notes', 'idea.md'), 'an idea\n')
      expect(world.spine(world.main, ['sweep']).said.trim()).to.eq('Swept from the main checkout: notes/idea.md.')
      expect(world.top()).to.eq(`${Today}-alpha`)
      expect(world.git(world.main, 'log', '-1', '--format=%s')).to.eq('docs: swept from the main checkout')
    })

    it('sweeps a note already committed and edited since, whose status line starts with a space', ({ world }) => {
      const root = world.cut('alpha')
      world.commit(root, 'notes/idea.md', 'an idea\n')
      world.bid(root)
      fs.writeFileSync(path.join(world.main, 'notes', 'idea.md'), 'a better idea\n')
      expect(world.spine(world.main, ['sweep']).said.trim()).to.eq('Swept from the main checkout: notes/idea.md.')
      expect(world.git(world.main, 'show', 'HEAD:notes/idea.md')).to.eq('a better idea')
    })
  })
})
