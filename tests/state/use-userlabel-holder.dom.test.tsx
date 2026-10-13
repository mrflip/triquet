import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { UserlabelHolderT } from '../../src/models/user'
import { FakeServer, resetFakeServer } from '../support/fake-convex-react'

// How the front door's watch of who holds a handle follows the field: asked only once the handle
// has stood a moment, and only for that handle. Over the stand-in for `convex/react`, the session
// ready.

vi.mock('convex/react', async () => {
  const fake = await import('../support/fake-convex-react')
  return fake.FakeConvexReact
})
vi.mock('../../src/state/use-session', () => ({ useSession: () => ({ ready: true }) }))

const { HolderSettleMs, useUserlabelHolder } = await import('../../src/state/use-userlabel-holder')

/** What the hook hands back, render by render */
function Probe({ userlabel, seen }: { userlabel: string | null, seen: (UserlabelHolderT | undefined)[] }) {
  seen.push(useUserlabelHolder(userlabel))
  return null
}

describe('useUserlabelHolder', () => {
  // The handles the stand-in server was asked of: once a render, as the stand-in answers each read afresh
  const held: { root: Root | null, asked: string[] } = { root: null, asked: [] }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.useFakeTimers()
    held.asked = []
    FakeServer.answer('users:holder', (args) => {
      const userlabel = String(args.userlabel)
      held.asked.push(userlabel)
      return userlabel === 'flip_kromer' ? 'verified' : null
    })
  })

  afterEach(() => {
    act(() => { held.root?.unmount() })
    held.root = null
    vi.useRealTimers()
    resetFakeServer()
  })

  /** Render the probe for `userlabel`, as the field holds it now */
  function show(userlabel: string | null, seen: (UserlabelHolderT | undefined)[]): void {
    held.root ??= createRoot(document.createElement('div'))
    act(() => { held.root?.render(<Probe userlabel={userlabel} seen={seen} />) })
  }

  it('asks nothing while the handle is being typed, then asks once it has stood a moment', () => {
    const seen: (UserlabelHolderT | undefined)[] = []
    show('flip_kro', seen)
    show('flip_krome', seen)
    show('flip_kromer', seen)
    expect(held.asked).to.deep.eq([])
    expect(seen.at(-1)).to.be.undefined
    act(() => { vi.advanceTimersByTime(HolderSettleMs) })
    expect(new Set(held.asked)).to.deep.eq(new Set(['flip_kromer']))
    expect(seen.at(-1)).to.eq('verified')
  })

  it('hands back nothing of the handle it asked of once the field has changed', () => {
    const seen: (UserlabelHolderT | undefined)[] = []
    show('flip_kromer', seen)
    act(() => { vi.advanceTimersByTime(HolderSettleMs) })
    expect(seen.at(-1)).to.eq('verified')
    show('flip_kromer_2', seen)
    expect(seen.at(-1)).to.be.undefined
    act(() => { vi.advanceTimersByTime(HolderSettleMs) })
    expect(seen.at(-1)).to.be.null
  })

  it('asks nothing of no handle', () => {
    const seen: (UserlabelHolderT | undefined)[] = []
    show(null, seen)
    act(() => { vi.advanceTimersByTime(HolderSettleMs) })
    expect(held.asked).to.deep.eq([])
    expect(seen.at(-1)).to.be.undefined
  })
})
