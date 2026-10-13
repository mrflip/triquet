import { afterEach, describe, expect, it, vi } from 'vitest'
import * as EST from 'es-toolkit'
import type { Id } from '../../convex/_generated/dataModel'
import { VerifyScreen } from '../../src/components/VerifyScreen'
import * as Actor from '../../src/lib/actor'
import { AppNotices, keepHandleNotice } from '../../src/lib/notices'
import type { MeHandle } from '../../src/state/use-me'
import type { ShownT } from '../../src/state/shown'
import { renderedText } from '../support/rendering'
import { userActor } from '../support/actors'

// What the sign-in page says, by who is looking: the page's hooks stood in for. Sending everyone
// else on is the e2e suite's, as it takes the browser.

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: EST.noop, replace: EST.noop }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/signin' }))
vi.mock('../../src/state/use-me', () => ({ useMe: vi.fn() }))
vi.mock('../../src/state/shown', () => ({ useShown: () => ({ hunt: null, quiz: null, quizActs: null, user: { user: null, onRetitle: EST.noop, own: null, google: { offered: true, start: EST.asyncNoop }, onSignOut: EST.asyncNoop } }) satisfies ShownT }))

const { useMe } = await import('../../src/state/use-me')

const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
const Me = { _id: user_id, userlabel: 'mrflip', title: 'Flip' }

/** The page told who is looking */
function meAs(handle: MeHandle): void {
  vi.mocked(useMe).mockReturnValue(handle)
}

describe("VerifyScreen", () => {
  afterEach(() => { vi.mocked(useMe).mockReset() })

  it("tells a standalone account it has limits, and offers a verified account under its handle", () => {
    meAs({ user: Me, actor: userActor(user_id, 'mrflip', { anonymous: true }), loaded: true })
    const text = renderedText(<VerifyScreen />).replaceAll('&#x27;', "'")
    expect(text).to.include(AppNotices.standaloneTitle)
    expect(text).to.include(`${AppNotices.standaloneHave} ${AppNotices.standaloneLimits}.`)
    expect(text).to.include(keepHandleNotice('mrflip'))
    expect(text).to.include('Continue with Google')
  })

  it("only says it is opening to a user signed in with Google, who is sent on", () => {
    meAs({ user: Me, actor: userActor(user_id, 'mrflip'), loaded: true })
    expect(renderedText(<VerifyScreen />)).to.eq(AppNotices.opening)
  })

  it("only says it is opening to a visitor holding no handle, who is sent to the front door", () => {
    meAs({ user: null, actor: Actor.unlabelled, loaded: true })
    expect(renderedText(<VerifyScreen />)).to.eq(AppNotices.opening)
  })
})
