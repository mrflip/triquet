import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { RepoRoot, SpineTimeout, Today, SpineFixtures, isolatedEnv, type SpineContext } from '../support/spine-world'

const it = test.extend<SpineContext>(SpineFixtures)

describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, () => {
  describe('installing on a move', () => {
    it('installs in the main checkout once a bid folds in another lockfile, and in a worktree a catch-up brings it to', ({ world }) => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      const landed = world.bid(alpha)
      expect(landed.status, landed.said).to.eq(0)
      expect(landed.said).to.contain(`pnpm-lock.yaml changed when ${world.main} moved onto`)
      expect(world.installs()).to.deep.eq([world.main])
      const ran = world.spine(beta, ['catchup'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Rebased ${Today}-beta`).and.contain(`pnpm-lock.yaml changed when ${beta} moved onto`)
      expect(world.installs()).to.deep.eq([world.main, beta])
    })

    it("installs in a worktree the bid rebases onto another lockfile, before the bid's checks, and not again in the main checkout", ({ world }) => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      expect(world.bid(alpha).status).to.eq(0)
      // The checks pass only where the packages were installed.
      const ran = world.bid(beta, { TRIQUET_LAND_CHECKS: `grep -qx "$PWD" ${path.join(world.scratch, 'installs.log')}` })
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`pnpm-lock.yaml changed when ${beta} moved onto`).and.not.contain(`when ${world.main} moved`)
      expect(world.installs()).to.deep.eq([world.main, beta])
    })

    it('installs in the main checkout when a restack replays it onto another lockfile', ({ world }) => {
      const elsewhere = path.join(world.scratch, 'elsewhere')
      world.git(world.scratch, 'clone', '--quiet', path.join(world.scratch, 'origin.git'), elsewhere)
      world.commit(elsewhere, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      world.git(elsewhere, 'push', '--quiet', 'origin', 'main')
      const ran = world.spine(world.main, ['restack'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain('fast-forwarded').and.contain(`pnpm-lock.yaml changed when ${world.main} moved onto`)
      expect(world.installs()).to.deep.eq([world.main])
    })

    it('installs nothing for a move that leaves the lockfile as it was, though the branch changes its own', ({ world }) => {
      world.commit(world.main, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'alpha.txt', 'alpha\n')
      world.commit(beta, 'pnpm-lock.yaml', 'lockfileVersion: 9\nimporters: {}\n')
      expect(world.bid(alpha).status).to.eq(0)
      const ran = world.spine(beta, ['catchup'])
      expect(ran.status, ran.said).to.eq(0)
      expect(ran.said).to.contain(`Rebased ${Today}-beta`).and.not.contain('pnpm-lock.yaml changed')
      expect(world.installs()).to.deep.eq([])
    })

    it("stops a catch-up whose install fails, but lets a landing stand, saying the main checkout's failed", ({ world }) => {
      const [alpha, beta] = [world.cut('alpha'), world.cut('beta')]
      world.commit(alpha, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')
      world.commit(beta, 'beta.txt', 'beta\n')
      const landed = world.bid(alpha, { TRIQUET_INSTALL: 'false' })
      expect(landed.status, landed.said).to.eq(0)
      expect(landed.said).to.contain('installing its packages there failed, as above: tell the Coach').and.contain(`Landed ${Today}-alpha`)
      const ran = world.spine(beta, ['catchup'], { TRIQUET_INSTALL: 'false' })
      expect(ran.status).to.eq(1)
      expect(ran.said).to.contain(`pnpm-lock.yaml changed when ${beta} moved onto`).and.contain('installing its packages there failed')
    })

    it('reaches proper-lockfile only for the e2e lock, so the other commands run where it is not installed', ({ world }) => {
      // The spine's scripts alone, with no packages anywhere above them.
      const bare = path.join(world.scratch, 'bare', 'scripts')
      fs.mkdirSync(bare, { recursive: true })
      for (const script of ['spine.ts', 'e2e-log.ts', 'lanes.ts']) { fs.copyFileSync(path.join(RepoRoot, 'scripts', script), path.join(bare, script)) }
      fs.writeFileSync(path.join(bare, 'package.json'), '{ "type": "module" }\n')
      const root = world.cut('alpha')
      world.commit(root, 'alpha.txt', 'alpha\n')
      const bareSpine = (cwd: string, args: string[]) => {
        // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running these tests, whichever it is
        const ran = spawnSync('node', [path.join(bare, 'spine.ts'), ...args], { cwd, encoding: 'utf8', env: isolatedEnv(world.scratch) })
        return { status: ran.status, said: `${ran.stdout}${ran.stderr}` }
      }
      for (const [cwd, args] of [[world.main, ['top']], [world.main, ['sweep']], [root, ['catchup']], [root, ['justify']], [root, ['e2e', '--last-failed']], [root, ['land', '--skip-e2e', 'a test of the spine']]] as const) {
        const ran = bareSpine(cwd, [...args])
        expect(ran.status, `${args.join(' ')}: ${ran.said}`).to.eq(0)
      }
      expect(world.top()).to.eq(`${Today}-alpha`)
      const locking = bareSpine(world.main, ['e2e'])
      expect(locking.status).to.eq(1)
      expect(locking.said).to.contain('proper-lockfile')
    })
  })
})
