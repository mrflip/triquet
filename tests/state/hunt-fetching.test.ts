import { getFunctionName, type FunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import type { ReviewedT } from '../../src/lib/rows'
import type { HuntAffirmsDNA } from '../../src/models/actions'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SignalGrainMs, type SignalT } from '../../src/models/signal'
import { Pace, dueAt, huntFetching, isStale, seenNow, type FetcherT, type FetchedT, type HuntFetchingT, type SeenSignalT } from '../../src/state/hunt-fetching'
import { testClock, type TestClockT } from '../support/clocks'

/** The moment the tests begin at */
const Early = Date.UTC(2026, 9, 6, 9)

describe('seenNow', () => {
  const now = Early
  it("dates a signal heard for the first time by its own time: settled already when older than the settling and the clock's slack, or when there is none", () => {
    expect(seenNow(undefined, null, now, Pace)).to.deep.eq({ changed_at: null, settledBy: 0 })
    expect(seenNow(undefined, now - Pace.settleMs - Pace.clockSlackMs - 1, now, Pace).settledBy).to.eq(0)
    expect(seenNow(undefined, now - Pace.settleMs - Pace.clockSlackMs + 1, now, Pace).settledBy).to.eq(now + Pace.settleMs)
  })

  it("leaves a signal that says what it said as it was, the very same", () => {
    const was = { changed_at: 5, settledBy: 9 }
    expect(seenNow(was, 5, now, Pace)).to.eq(was)
  })

  it("settles a signal seen to move `settleMs` from now, however it moved: on, back, or away", () => {
    for (const changed_at of [6, 4, null]) {
      expect(seenNow({ changed_at: 5, settledBy: 0 }, changed_at, now, Pace)).to.deep.eq({ changed_at, settledBy: now + Pace.settleMs })
    }
  })

  it("reads the doc block's examples", () => {
    expect(seenNow(undefined, null, 9000, Pace)).to.deep.eq({ changed_at: null, settledBy: 0 })
    expect(seenNow({ changed_at: 1, settledBy: 0 }, 2, 9000, Pace)).to.deep.eq({ changed_at: 2, settledBy: 9000 + Pace.settleMs })
  })
})

/** How far a quiz has been fetched, as a test spells it */
function fetchedAs(tried: number | null, covered: number | null = tried, inFlight = false, movedSince: number | null = null): FetchedT {
  return { tried, covered, inFlight, movedSince }
}

describe('isStale', () => {
  const seen: SeenSignalT = { changed_at: 1, settledBy: 100 }
  it("wants a quiz never fetched, or last fetched before its signal had settled", () => {
    expect(isStale(fetchedAs(null, null), seen)).to.be.true
    expect(isStale(fetchedAs(99, 99), seen)).to.be.true
    expect(isStale(fetchedAs(120, 99), seen)).to.be.true
    expect(isStale(fetchedAs(100, 100), seen)).to.be.false
  })

  it("reads the doc block's example", () => {
    expect(isStale({ tried: 5, covered: 5, inFlight: false, movedSince: null }, { changed_at: 1, settledBy: 9 })).to.be.true
  })
})

describe('dueAt', () => {
  const seen: SeenSignalT = { changed_at: 1, settledBy: 200 }

  it("is never for a quiz being fetched, or holding what its signal says", () => {
    expect(dueAt(fetchedAs(100, 100, true), seen, null, Pace)).to.be.null
    expect(dueAt(fetchedAs(200), seen, null, Pace)).to.be.null
  })

  it("is at once for a quiz never tried", () => {
    expect(dueAt(fetchedAs(null), seen, null, Pace)).to.eq(0)
  })

  it("is once the signal has settled and the batch window has passed, whichever is later", () => {
    expect(dueAt(fetchedAs(100), seen, null, Pace)).to.eq(100 + Pace.fetchEveryMs)
    expect(dueAt(fetchedAs(100), { changed_at: 1, settledBy: 100 + Pace.fetchEveryMs + 5 }, null, Pace)).to.eq(100 + Pace.fetchEveryMs + 5)
  })

  it("is no later than a window after the signal was first seen to move, however it keeps moving", () => {
    expect(dueAt(fetchedAs(100, 100, false, 150), { changed_at: 1, settledBy: 999_999 }, null, Pace)).to.eq(150 + Pace.fetchEveryMs)
    expect(dueAt(fetchedAs(100, 100, false, 150), { changed_at: 1, settledBy: 200 }, null, Pace)).to.eq(100 + Pace.fetchEveryMs)
  })

  it("waives the batch window once for a tab shown since the last try, not the settling", () => {
    expect(dueAt(fetchedAs(100), seen, 150, Pace)).to.eq(200)
    expect(dueAt(fetchedAs(100), { changed_at: 1, settledBy: 120 }, 150, Pace)).to.eq(120)
    expect(dueAt(fetchedAs(160), { changed_at: 1, settledBy: 200 }, 150, Pace)).to.eq(160 + Pace.fetchEveryMs)
  })

  it("is to try again, a window on, for a quiz whose fetch failed", () => {
    expect(dueAt(fetchedAs(100, null), { changed_at: null, settledBy: 0 }, null, Pace)).to.eq(100 + Pace.fetchEveryMs)
  })

  it("reads the doc block's examples", () => {
    expect(dueAt({ tried: null, covered: null, inFlight: false, movedSince: null }, { changed_at: 1, settledBy: 9 }, null, Pace)).to.eq(0)
    expect(dueAt({ tried: 100, covered: 100, inFlight: false, movedSince: 150 }, { changed_at: 1, settledBy: 200 }, null, Pace)).to.eq(100 + Pace.fetchEveryMs)
  })
})

// --- The fetching, over a fetcher that answers as a test says

const Princes = 'princes_id' as Id<'quizzes'>
const Paris = 'paris_id' as Id<'quizzes'>
const Affirms = { ident_id: 'ident', hunt_id: 'hunt', standing: 'smith' } as unknown as HuntAffirmsDNA

/** A fetcher that answers every fetch with the quiz as `quizzes` holds it now (or fails, for one in `failing`), counting the fetches of each quiz */
function servedFrom(quizzes: Map<string, QuizT>): { fetcher: FetcherT, fetches: (quiz_id: string) => number, failing: Set<string> } {
  const counted = new Map<string, number>()
  const failing = new Set<string>()
  const query = async (fn: FunctionReference<'query'>, args: { affirms: { quiz_id: string } }): Promise<unknown> => {
    await Promise.resolve()
    const { quiz_id } = args.affirms
    if (getFunctionName(fn) === 'reviews:forQuiz') { return [] as ReviewedT[] }
    counted.set(quiz_id, (counted.get(quiz_id) ?? 0) + 1)
    if (failing.has(quiz_id)) { throw new Error('Too many reads') }
    return quizzes.get(quiz_id) ?? null
  }
  return { fetcher: { query } as unknown as FetcherT, fetches: (quiz_id) => counted.get(quiz_id) ?? 0, failing }
}

/** A fetching under test: two quizzes served, princes and paris, each made a source; its clock; and how often each was fetched */
type UnderTestT = {
  fetching: HuntFetchingT
  clock:    TestClockT
  quizzes:  Map<string, QuizT>
  fetches:  (quiz_id: string) => number
  failing:  Set<string>
  sources:  Map<string, ReturnType<HuntFetchingT['source']>>
  told:     { fetched: number }
  /** Hear the signals say `signals`, and let what that starts finish */
  hear:     (signals: readonly SignalT[] | undefined) => Promise<void>
  /** Move the clock on, and let what that starts finish */
  pass:     (ms: number) => Promise<void>
}

/** Let fetches under way answer */
async function answered(): Promise<void> {
  for (let round = 0; round < 5; round++) { await Promise.resolve() }
}

function underTest(): UnderTestT {
  const quizzes = new Map([[Princes, Quiz.blank('Princes', 'princes')], [Paris, Quiz.blank('Paris', 'paris')]])
  const { fetcher, fetches, failing } = servedFrom(quizzes)
  const clock = testClock()
  const told = { fetched: 0 }
  const fetching = huntFetching({ client: fetcher, affirms: Affirms, hunt_label: 'quiet_otter', clock, pace: Pace, onFetched: () => { told.fetched += 1 } })
  const sources = new Map([Princes, Paris].map((quiz_id) => [quiz_id as string, fetching.source(quiz_id, null)]))
  return {
    fetching, clock, quizzes, fetches, failing, sources, told,
    hear: async (signals) => {
      fetching.heard(signals, false)
      await answered()
    },
    pass: async (ms) => {
      clock.advance(ms)
      await answered()
    },
  }
}

describe('huntFetching', () => {
  beforeEach(() => { vi.useFakeTimers({ now: Early, toFake: ['Date'] }) })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("fetches nothing until the signals are heard, then each quiz at once, and tells of each", async () => {
    const tested = underTest()
    await answered()
    expect(tested.fetches(Princes)).to.eq(0)
    expect(tested.sources.get(Princes)?.awaiting()).to.be.true
    await tested.hear([])
    expect([tested.fetches(Princes), tested.fetches(Paris), tested.told.fetched]).to.deep.eq([1, 1, 2])
    expect(tested.sources.get(Princes)?.quiz()?.label).to.eq('princes')
    expect(tested.sources.get(Princes)?.reviews()).to.deep.eq([])
    expect(tested.sources.get(Princes)?.awaiting()).to.be.false
  })

  it("fetches a quiz again only once its signal moves and has settled: a burst of moves is one fetch", async () => {
    const tested = underTest()
    await tested.hear([])
    await tested.pass(Pace.fetchEveryMs)
    expect(tested.fetches(Paris)).to.eq(1)
    for (let move = 1; move <= 8; move++) {
      await tested.hear([{ quiz_id: Paris, changed_at: Date.now() }])
      await tested.pass(SignalGrainMs)
    }
    expect(tested.fetches(Paris)).to.eq(1)
    await tested.pass(Pace.settleMs)
    expect([tested.fetches(Paris), tested.fetches(Princes)]).to.deep.eq([2, 1])
    await tested.pass(Pace.fetchEveryMs * 3)
    expect(tested.fetches(Paris)).to.eq(2)
  })

  it("fetches a quiz whose signal never stops moving once a window, all the same", async () => {
    const tested = underTest()
    await tested.hear([])
    for (let move = 1; move <= (Pace.fetchEveryMs * 3) / SignalGrainMs; move++) {
      await tested.pass(SignalGrainMs)
      await tested.hear([{ quiz_id: Paris, changed_at: Date.now() }])
    }
    expect(tested.fetches(Paris)).to.be.within(3, 4)
  })

  it("waits out the settling after a move before it fetches", async () => {
    const tested = underTest()
    await tested.hear([])
    await tested.pass(Pace.fetchEveryMs * 2)
    await tested.hear([{ quiz_id: Paris, changed_at: Date.now() }])
    await tested.pass(Pace.settleMs - 1)
    expect(tested.fetches(Paris)).to.eq(1)
    await tested.pass(1)
    expect(tested.fetches(Paris)).to.eq(2)
  })

  it("keeps the very same quiz when a fetch answers what the last did", async () => {
    const tested = underTest()
    await tested.hear([])
    const before = tested.sources.get(Paris)?.quiz()
    await tested.hear([{ quiz_id: Paris, changed_at: Date.now() }])
    await tested.pass(Pace.fetchEveryMs)
    expect(tested.fetches(Paris)).to.eq(2)
    expect(tested.sources.get(Paris)?.quiz()).to.eq(before)
    tested.quizzes.set(Paris, Quiz.blank('Paris, France', 'paris'))
    await tested.hear([{ quiz_id: Paris, changed_at: Date.now() + 1 }])
    await tested.pass(Pace.fetchEveryMs)
    expect(tested.sources.get(Paris)?.quiz()?.title).to.eq('Paris, France')
  })

  it("follows a first fetch of a quiz whose signal is recent with another once it has settled; not one long settled", async () => {
    const tested = underTest()
    await tested.hear([{ quiz_id: Paris, changed_at: Date.now() - 1000 }, { quiz_id: Princes, changed_at: Date.now() - Pace.settleMs - Pace.clockSlackMs - 1 }])
    expect([tested.fetches(Paris), tested.fetches(Princes)]).to.deep.eq([1, 1])
    await tested.pass(Pace.fetchEveryMs)
    expect([tested.fetches(Paris), tested.fetches(Princes)]).to.deep.eq([2, 1])
  })

  it("fetches at once whatever wants it and has not been tried since, for whoever waits, the window and the settling waived", async () => {
    const tested = underTest()
    await tested.hear([])
    await tested.pass(1000)
    await tested.hear([{ quiz_id: Paris, changed_at: Date.now() }])
    const since = Date.now()
    tested.fetching.fetchNow(since)
    await answered()
    expect([tested.fetches(Paris), tested.fetches(Princes)]).to.deep.eq([2, 1])
    tested.fetching.fetchNow(since)
    await answered()
    expect(tested.fetches(Paris)).to.eq(2)
    // Begun before the move had settled, it is followed by another once it has.
    await tested.pass(Pace.fetchEveryMs)
    expect(tested.fetches(Paris)).to.eq(3)
  })

  it("starts a quiz handed over from the screen as read now, fetching it only once its signal moves", async () => {
    const tested = underTest()
    await tested.hear([])
    const handed = tested.fetching.source('kings_id' as Id<'quizzes'>, { quiz: Quiz.blank('Kings', 'kings'), reviews: [] })
    await tested.pass(Pace.fetchEveryMs * 2)
    expect([tested.fetches('kings_id'), handed.quiz()?.label, handed.awaiting()]).to.deep.eq([0, 'kings', false])
  })

  it("reports a failing fetch once, holds what it last read, and tries again a window on", async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => null)
    const tested = underTest()
    await tested.hear([])
    const before = tested.sources.get(Paris)?.quiz()
    tested.failing.add(Paris)
    await tested.hear([{ quiz_id: Paris, changed_at: Date.now() }])
    await tested.pass(Pace.fetchEveryMs)
    await tested.pass(Pace.fetchEveryMs)
    expect(tested.fetches(Paris)).to.eq(3)
    expect(logged).toHaveBeenCalledOnce()
    expect([tested.sources.get(Paris)?.failed(), tested.sources.get(Paris)?.quiz()]).to.deep.eq([true, before])
    tested.failing.delete(Paris)
    await tested.pass(Pace.fetchEveryMs)
    expect(tested.sources.get(Paris)?.failed()).to.be.false
  })

  it("stands as last seen when the signals fail, fetching only what was never fetched", async () => {
    const tested = underTest()
    await tested.hear([{ quiz_id: Paris, changed_at: Date.now() - (Pace.clockSlackMs * 2) }])
    tested.fetching.heard(undefined, true)
    await tested.pass(Pace.fetchEveryMs * 2)
    expect([tested.fetches(Paris), tested.fetches(Princes)]).to.deep.eq([1, 1])
  })

  it("fetches nothing while the tab is hidden, and what moved meanwhile at once when it is shown, the window waived", async () => {
    const page = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('document', page)
    const tested = underTest()
    await tested.hear([])
    page.visibilityState = 'hidden'
    await tested.hear([{ quiz_id: Paris, changed_at: Date.now() }])
    await tested.pass(Pace.fetchEveryMs * 2)
    expect(tested.fetches(Paris)).to.eq(1)
    await tested.pass(Pace.fetchEveryMs * 2)
    page.visibilityState = 'visible'
    page.dispatchEvent(new Event('visibilitychange'))
    await answered()
    expect([tested.fetches(Paris), tested.fetches(Princes)]).to.deep.eq([2, 1])
    tested.fetching.stop()
  })

  it("drops what a fetch under way brings once stopped, and fetches nothing more", async () => {
    const tested = underTest()
    tested.fetching.heard([], false)
    tested.fetching.stop()
    await answered()
    expect([tested.told.fetched, tested.sources.get(Paris)?.quiz()]).to.deep.eq([0, undefined])
    await tested.hear([{ quiz_id: Paris, changed_at: Date.now() }])
    await tested.pass(Pace.fetchEveryMs * 2)
    expect(tested.fetches(Paris)).to.eq(1)
  })
})
