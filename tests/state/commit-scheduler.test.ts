import * as Z from 'zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShallowHuntT } from '../../src/lib/rows'
import { createCommitScheduler, type CommitFn } from '../../src/state/commit-scheduler'
import type { HuntReadingT } from '../../src/state/hunt-feed'

/** What each commit was handed, in order: the hunt's title as the wait began (null for the hunt whole), and as it had become */
type Landed = { was: string | null, now: string }

/**
 * A reading of the hunt `hunt_id`, told apart from another by its title alone: these tests are
 * about when a reading is committed, not what it holds.
 */
function readingOf(title: string, { hunt_id = 'deep_lake', branch = 'main', first = false } = {}): HuntReadingT {
  return { hunt: { _id: hunt_id, title, branch } as unknown as ShallowHuntT, parts: new Map(), files: new Map(), first, unread: new Map() }
}

/** A commit that notes what it was handed, having done nothing else */
function recordInto(landed: Landed[]): CommitFn {
  return async (was, now) => {
    await Promise.resolve()
    landed.push({ was: was?.hunt.title ?? null, now: now.hunt.title })
  }
}

/** A scheduler that records what it commits, with `seconds` as its wait */
function schedulerOf(seconds: number, landed: Landed[], commit?: CommitFn) {
  return createCommitScheduler({ seconds, commit: commit ?? recordInto(landed) })
}

const sec = async (seconds: number) => { await vi.advanceTimersByTimeAsync(seconds * 1000) }

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("createCommitScheduler, at the customer-facing 30 seconds", () => {
  it("commits once, thirty seconds after the first change and not a moment before", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(30, landed)
    scheduler.note(readingOf('One', { first: true }))
    scheduler.note(readingOf('Two'))

    await vi.advanceTimersByTimeAsync(29_999)
    expect(landed).to.deep.eq([{ was: null, now: 'One' }])
    await vi.advanceTimersByTimeAsync(1)
    expect(landed).to.deep.eq([{ was: null, now: 'One' }, { was: 'One', now: 'Two' }])
  })
})

describe("createCommitScheduler, at 2 seconds", () => {
  it("commits nothing while nothing has moved", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    await sec(60)
    expect(landed).to.deep.eq([])
    expect(scheduler.pendingCount()).to.eq(0)
  })

  it("rejects a wait outside 2 to 600", () => {
    // By type, not by wording -- see tests/models/mirror-settings.test.ts.
    expect(() => schedulerOf(1, [])).to.throw(Z.ZodError)
    expect(() => schedulerOf(601, [])).to.throw(Z.ZodError)
  })

  it("commits a tab's first reading at once, whole, without waiting out the clock", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    scheduler.note(readingOf('One', { first: true }))
    await sec(0)
    expect(landed).to.deep.eq([{ was: null, now: 'One' }])
    expect(scheduler.pendingCount()).to.eq(0)
  })

  it("shares one commit among a burst of changes, describing the whole burst", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    scheduler.note(readingOf('One', { first: true }))
    for (const title of ['Two', 'Three', 'Four']) { scheduler.note(readingOf(title)) }
    await sec(2)
    expect(landed).to.deep.eq([{ was: null, now: 'One' }, { was: 'One', now: 'Four' }])
  })

  it("does not restart the clock on later changes, so continuous work is still committed on time", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    scheduler.note(readingOf('One', { first: true }))
    scheduler.note(readingOf('Two'))
    await sec(1)
    scheduler.note(readingOf('Three'))
    await sec(1)
    expect(landed.at(-1)).to.deep.eq({ was: 'One', now: 'Three' })
  })

  it("starts a fresh wait for changes after a commit, from where that commit left the hunt", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    scheduler.note(readingOf('One', { first: true }))
    scheduler.note(readingOf('Two'))
    await sec(2)
    scheduler.note(readingOf('Three'))
    await sec(2)
    expect(landed.slice(1)).to.deep.eq([{ was: 'One', now: 'Two' }, { was: 'Two', now: 'Three' }])
  })

  it("keeps separate hunts on separate clocks and in separate commits", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    scheduler.note(readingOf('Alpha', { hunt_id: 'alpha', first: true }))
    scheduler.note(readingOf('Beta', { hunt_id: 'beta', first: true }))
    scheduler.note(readingOf('Alpha!', { hunt_id: 'alpha' }))
    await sec(1)
    scheduler.note(readingOf('Beta!', { hunt_id: 'beta' }))
    await sec(1)
    expect(landed.slice(2)).to.deep.eq([{ was: 'Alpha', now: 'Alpha!' }])
    await sec(1)
    expect(landed.slice(2)).to.deep.eq([{ was: 'Alpha', now: 'Alpha!' }, { was: 'Beta', now: 'Beta!' }])
  })

  it("commits what was waiting before a later first reading's catch-up, as when the hunt's feed starts over", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    scheduler.note(readingOf('One', { first: true }))
    scheduler.note(readingOf('Two'))
    scheduler.note(readingOf('Two, relabelled', { first: true }))
    await sec(0)
    expect(landed.slice(1)).to.deep.eq([{ was: 'One', now: 'Two' }, { was: 'Two', now: 'Two, relabelled' }])
    expect(scheduler.pendingCount()).to.eq(0)
  })

  it("commits what was waiting on its own branch when the hunt moves to another, and waits afresh from there", async () => {
    const landed: Landed[] = []
    const branches: string[] = []
    const recording = recordInto(landed)
    const scheduler = schedulerOf(2, landed, async (was, now) => { branches.push(now.hunt.branch); await recording(was, now) })
    scheduler.note(readingOf('One', { first: true }))
    scheduler.note(readingOf('Two'))
    scheduler.note(readingOf('Three', { branch: 'draft_two' }))
    await sec(0)
    expect(landed.slice(1)).to.deep.eq([{ was: 'One', now: 'Two' }])
    await sec(2)
    expect(landed.slice(1)).to.deep.eq([{ was: 'One', now: 'Two' }, { was: 'Two', now: 'Three' }])
    expect(branches).to.deep.eq(['main', 'main', 'draft_two'])
  })

  it("flush commits at once, resolves when the commit is done, and cancels the wait", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    scheduler.note(readingOf('One', { first: true }))
    scheduler.note(readingOf('Two'))
    await scheduler.flush('deep_lake')
    expect(landed.at(-1)).to.deep.eq({ was: 'One', now: 'Two' })
    await sec(5)
    expect(landed).to.have.lengthOf(2)
  })

  it("flush of a hunt with nothing waiting does nothing", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    await scheduler.flush('deep_lake')
    expect(landed).to.deep.eq([])
  })

  it("flushAll commits every hunt that is waiting", async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    scheduler.note(readingOf('Alpha!', { hunt_id: 'alpha' }))
    scheduler.note(readingOf('Beta!', { hunt_id: 'beta' }))
    await scheduler.flushAll()
    expect(landed).to.have.lengthOf(2)
    expect(scheduler.pendingCount()).to.eq(0)
  })

  it("carries on committing after a commit fails", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => null)
    const landed: Landed[] = []
    const recording = recordInto(landed)
    const tries = { count: 0 }
    const scheduler = schedulerOf(2, landed, async (was, now) => {
      tries.count += 1
      if (tries.count === 1) { throw new Error('the disk is full') }
      await recording(was, now)
    })
    scheduler.note(readingOf('One', { first: true }))
    await sec(0)
    scheduler.note(readingOf('Two'))
    await sec(2)
    expect(tries.count).to.eq(2)
    expect(landed).to.deep.eq([{ was: 'One', now: 'Two' }])
  })
})
