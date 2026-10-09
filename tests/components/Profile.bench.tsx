import { test, vi } from 'vitest'
import * as EST from 'es-toolkit'
import { renderToString } from 'react-dom/server'
import { Workbench } from '../../src/components/Workbench'
import * as Runner from '../../src/lib/formulary/runner'
import { SeedWidgets } from '../../src/models/seeds'
import { bigHuntFor, bigQuiz, smithClaimsOn } from '../support/big-quiz'

/*
 * What the quiz's screen costs, for a quiz of forty questions (`bigQuiz`): the run, and the whole
 * Workbench rendered once around it, as React first renders a page, with no DOM and no effects.
 * The hooks that reach the network, the router and the bots are stood in for. Run with
 * `pnpm vitest bench --run --project 'unit (bench)' --reporter=default Workbench`; never part of the
 * unit suite.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: EST.noop, replace: EST.noop }) }))
vi.mock('../../src/state/use-asking', () => ({ useAsking: () => ({ asking: () => false, ask: EST.noop }) }))
vi.mock('../../src/state/use-bots', () => ({ useBots: () => ({ unavailableNotice: () => null }) }))
vi.mock('../../src/state/use-library-actions', () => ({ useLibraryActions: () => ({ dispatch: EST.noop, unsaved: false }) }))
// Its markdown is compiled by Next, which the bench has not.
vi.mock('../../src/content/full-history.md', () => ({ default: () => null }))
vi.mock('../../src/state/use-whole-hunt', () => ({ useWholeHunt: () => ({ whole: null, asking: false, failed: false, prepare: EST.noop }) }))

const quiz = bigQuiz()
const { hunt, realm } = bigHuntFor(quiz)
const claims = smithClaimsOn(hunt, quiz)
const place = Runner.placeOf(hunt, realm)

import { Session } from 'node:inspector/promises'
import { writeFileSync } from 'node:fs'
test('profile', async () => {
  const render = () => renderToString(<Workbench hunt={hunt} realm={realm} quiz={quiz} library={SeedWidgets} claims={claims} reviews={[]} dispatch={EST.noop} carryOut={() => Promise.resolve(true)} unsaved={false} saveNotice={null} />)
  for (let ii = 0; ii < 5; ii++) { render() }
  const session = new Session()
  session.connect()
  await session.post('Profiler.enable')
  await session.post('Profiler.start')
  for (let ii = 0; ii < 20; ii++) { render() }
  const { profile } = await session.post('Profiler.stop')
  writeFileSync('/tmp/claude-1000/-workspace-triquet/dbf3db2e-9437-4d68-ad40-cc26d79fc9e2/scratchpad/render_caches/prof/render.cpuprofile', JSON.stringify(profile))
})
