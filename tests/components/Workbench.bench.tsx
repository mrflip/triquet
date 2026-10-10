import { test, vi } from 'vitest'
import * as EST from 'es-toolkit'
import { renderToString } from 'react-dom/server'
import { Workbench } from '../../src/components/Workbench'
import * as Runner from '../../src/lib/formulary/runner'
import { SeedWidgets } from '../../src/models/seeds'
import { NoAsks } from '../../src/state/use-asking'
import { bigHuntFor, bigQuiz, smithClaimsOn } from '../support/big-quiz'

/*
 * What the quiz's screen costs, for a quiz of forty questions (`bigQuiz`): the run, and the whole
 * Workbench rendered once around it, as React first renders a page, with no DOM and no effects.
 * The hooks that reach the network, the router and the bots are stood in for. Run with
 * `pnpm vitest bench --run --project 'unit (bench)' --reporter=default Workbench`; never part of the
 * unit suite.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: EST.noop, replace: EST.noop }) }))
vi.mock('../../src/state/use-asking', async (importOriginal) => ({ ...await importOriginal<typeof import('../../src/state/use-asking')>(), useAsking: () => ({ asks: NoAsks, ask: EST.noop }) }))
vi.mock('../../src/state/use-bots', () => ({ useBots: () => ({ unavailableNotice: () => null }) }))
vi.mock('../../src/state/use-library-actions', () => ({ useLibraryActions: () => ({ dispatch: EST.noop }) }))
// Its markdown is compiled by Next, which the bench has not.
vi.mock('../../src/content/full-history.md', () => ({ default: () => null }))
vi.mock('../../src/state/use-whole-hunt', () => ({ useWholeHunt: () => ({ whole: null, asking: false, failed: false, prepare: EST.noop }) }))

const quiz = bigQuiz()
const { hunt, realm } = bigHuntFor(quiz)
const claims = smithClaimsOn(hunt, quiz)
const place = Runner.placeOf(hunt, realm)

test('a quiz of forty questions', async ({ bench }) => {
  await bench.compare(
    bench('runQuiz', () => {
      Runner.runQuiz(Runner.sourceOf(quiz, SeedWidgets, place))
    }),
    bench('the Workbench, rendered whole, its run among it', () => {
      renderToString(
        <Workbench
          hunt={hunt} realm={realm} quiz={quiz} library={SeedWidgets} claims={claims} reviews={[]}
          dispatch={EST.noop} carryOut={() => Promise.resolve(true)} saveNotice={null}
        />,
      )
    }),
  )
})
