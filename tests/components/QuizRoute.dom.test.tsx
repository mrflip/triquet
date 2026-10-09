import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as EST from 'es-toolkit'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QuizRoute } from '../../src/components/QuizRoute'
import { workbenchOffers } from '../../src/components/offers'
import { useReorderable } from '../../src/components/use-reorder'
import * as Actor from '../../src/lib/actor'
import { AibotFormulary } from '../../src/lib/formulary/aibot'
import * as Runner from '../../src/lib/formulary/runner'
import { CellNotices } from '../../src/lib/notices'
import type { SeenQuestionT } from '../../src/lib/rows'
import { SeedWidgets } from '../../src/models/seeds'
import { AlarmsProvider } from '../../src/state/alarms'
import { ShownHuntProvider } from '../../src/state/shown-hunt'
import type { Id } from '../../convex/_generated/dataModel'
import { bigHuntFor, bigQuiz, bigReadingsOf } from '../support/big-quiz'
import { FakeServer, resetFakeServer } from '../support/fake-convex-react'

/*
 * What one change draws again, on the quiz's screen as a smith works it, for a quiz of forty
 * questions (`bigQuiz`): the route, rendered in a DOM over a stand-in for the Convex client
 * (`fake-convex-react`), its watches answered from the quiz's readings. A change is made in the grid as
 * the author makes it; the stand-in server carries it out as Convex does, the question's reading
 * new and every other result as it was. Counted: the Workbench (by its offers, worked out once a
 * render), the question rows (by their grips, one a render), and the runs of the quiz.
 */

vi.mock('convex/react', async () => {
  const fake = await import('../support/fake-convex-react')
  return fake.FakeConvexReact
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: EST.noop, replace: EST.noop }) }))
vi.mock('../../src/state/use-session', () => ({ useSession: () => ({ ready: true }) }))
vi.mock('../../src/state/hunt-feed', () => ({ useHuntFeed: EST.noop }))
vi.mock('../../src/state/use-bots', () => ({ useBots: () => ({ unavailableNotice: () => null }) }))
// Its markdown is compiled by Next, which the test has not.
vi.mock('../../src/components/FullHistoryDownload', () => ({ FullHistoryDownload: () => null }))
vi.mock('../../src/components/offers', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/components/offers')>()
  return { ...real, workbenchOffers: vi.fn(real.workbenchOffers) }
})
vi.mock('../../src/components/use-reorder', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/components/use-reorder')>()
  return { ...real, useReorderable: vi.fn(real.useReorderable) }
})
vi.mock('../../src/lib/formulary/runner', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/lib/formulary/runner')>()
  return { ...real, runQuiz: vi.fn(real.runQuiz) }
})

/** What a change cost: the Workbench's renders, the rows', and the runs */
type CountsT = { workbenches: number, rows: number, runs: number }

/** The counts since they were last cleared */
function countsNow(): CountsT {
  return { workbenches: vi.mocked(workbenchOffers).mock.calls.length, rows: vi.mocked(useReorderable).mock.calls.length, runs: vi.mocked(Runner.runQuiz).mock.calls.length }
}

/** Every count cleared */
function clearCounts(): void {
  vi.mocked(workbenchOffers).mockClear()
  vi.mocked(useReorderable).mockClear()
  vi.mocked(Runner.runQuiz).mockClear()
}

const quiz = bigQuiz()
const { hunt } = bigHuntFor(quiz)
const ident = { _id: 'idents_smith' as Id<'idents'>, label: 'seed_smith', title: 'Seed Smith' }
const actor = Actor.asIdent('users_smith' as Id<'users'>, ident, true)
const labels = { hunt: hunt.label, realm: 'home', quiz: quiz.label }
const AskGuess = 'button[aria-label="Ask Quick-model guess"]'

/** A change as the screen sends it, as far as the stand-in server carries it out */
type SentActionT =
  | { kind: 'edit_question', question_id: string, patch: Record<string, unknown> }
  | { kind: 'record_widgeted', widgeted: { question_id: string, widgeting_label: string, status: string, value: unknown } }

/** A question's reading, as far as a change to it reads it */
type HeldReadingT = SeenQuestionT & { stored: Record<string, unknown> }

/** The reading `was` comes to once `action` is carried out on it */
function readingAfter(was: HeldReadingT, action: SentActionT, widgeting_ids: Readonly<Record<string, string>>): HeldReadingT {
  if (action.kind === 'edit_question') { return { ...was, ...action.patch } }
  const row = { status: action.widgeted.status, value: action.widgeted.value, message: null, result_meta: {}, _creationTime: 9.5 }
  return { ...was, stored: { ...was.stored, [widgeting_ids[action.widgeted.widgeting_label] ?? '']: { newest: row, ok: row } } }
}

/**
 * Answer every watch the quiz's screen makes, every answer the very same object until it changes,
 * and hold a change sent until it is let land: its question's reading then replaced, and the
 * mutation answered, as Convex answers one once the watches it touched are current.
 *
 * @returns Let the change on its way land.
 */
function serve(): () => Promise<void> {
  const { frame, readings } = bigReadingsOf(quiz)
  const held = new Map(readings as Map<string, HeldReadingT>)
  const current = { ident, actor }
  const opening = { why: null, hunt }
  const reviews: never[] = []
  FakeServer.answer('idents:current', () => current)
  FakeServer.answer('hunts:open', () => opening)
  FakeServer.answer('quizzes:open', () => frame)
  FakeServer.answer('questions:open', (args) => held.get(args.question_id as string))
  FakeServer.answer('reviews:forQuiz', () => reviews)
  FakeServer.answer('widgets:library', () => SeedWidgets)
  const gate = Promise.withResolvers<null>()
  FakeServer.perform = async (_fnname, args) => {
    const { action } = args as { action: SentActionT }
    await gate.promise
    const question_id = action.kind === 'edit_question' ? action.question_id : action.widgeted.question_id
    const was = held.get(question_id)
    if (was) { held.set(question_id, readingAfter(was, action, frame.widgeting_ids)) }
    FakeServer.changed()
    return null
  }
  return () => settled(() => { gate.resolve(null) })
}

/** Do `work`, and wait for React to draw what came of it, promises it set going included */
async function settled(work: () => void): Promise<void> {
  await act(async () => {
    work()
    await Promise.resolve()
  })
}

/** Type `text` into a box and leave it, as the author commits a change */
function typeAndLeave(box: Element, text: string): void {
  // Through the box's own setter, under the one React watches for, as typing sets it.
  Reflect.set(Object.getPrototypeOf(box) as object, 'value', text, box)
  box.dispatchEvent(new Event('input', { bubbles: true }))
  box.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
}

/** The `idx`th of the elements `selector` finds in `host`, which the test needs there */
function nth(host: ParentNode, selector: string, idx: number): Element {
  const found = host.querySelectorAll(selector)[idx]
  if (! found) { throw new Error(`no ${selector} at ${String(idx)}`) }
  return found
}

/** Whether `host`'s screen says a change is still being written */
function unsavedIn(host: ParentNode): string | undefined {
  return host.querySelector('main')?.dataset.unsaved
}

describe("the quiz's screen, one change at a time", () => {
  const holder: { root: Root | null, host: HTMLElement | null } = { root: null, host: null }

  /** The quiz's screen, rendered into a fresh host, its counts cleared */
  const openScreen = async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    holder.root = root
    holder.host = host
    await settled(() => {
      root.render(<AlarmsProvider><ShownHuntProvider><QuizRoute org={hunt.org} labels={labels} mode="edit" /></ShownHuntProvider></AlarmsProvider>)
    })
    expect(host.querySelectorAll('input[aria-label="Title"]')).to.have.lengthOf(40)
    clearCounts()
    return host
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    resetFakeServer()
  })
  afterEach(() => {
    act(() => { holder.root?.unmount() })
    holder.host?.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("draws the frame once, and only the question's row, for a question's title committed", async () => {
    const land = serve()
    const host = await openScreen()
    await settled(() => { typeAndLeave(nth(host, 'input[aria-label="Title"]', 4), 'Fifth, retitled') })
    expect(unsavedIn(host)).to.eq('true')
    expect(countsNow()).to.deep.eq({ workbenches: 0, rows: 0, runs: 0 })
    await land()

    expect(countsNow()).to.deep.eq({ workbenches: 1, rows: 1, runs: 1 })
    expect(nth(host, 'input[aria-label="Title"]', 4)).to.have.property('value', 'Fifth, retitled')
    expect(unsavedIn(host)).to.eq('false')
  })

  it("draws the frame once, and only the question's row, for a question's bot asked and answered", async () => {
    const land = serve()
    const answered = Promise.withResolvers<null>()
    const run = vi.spyOn(AibotFormulary, 'run').mockImplementation(async (_widget, widgeting) => {
      await answered.promise
      return { input: {}, widgeted: { widgeting_label: widgeting.label, status: 'ok', value: { guess: 'Prince Five', explanation: 'Asked.' }, message: null, result_meta: {} } } as never
    })
    const host = await openScreen()
    await settled(() => { nth(host, AskGuess, 4).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) })
    expect(run.mock.calls).to.have.lengthOf(1)
    expect(nth(host, AskGuess, 4).textContent).to.eq(CellNotices.thinking)
    expect(countsNow()).to.deep.eq({ workbenches: 0, rows: 1, runs: 0 })
    await settled(() => { answered.resolve(null) })
    await land()

    // The row drawn as the ask began, as its answer landed, and as the ask ended.
    expect(countsNow()).to.deep.eq({ workbenches: 1, rows: 3, runs: 1 })
    expect(nth(host, AskGuess, 4).textContent).to.contain('Prince Five')
    expect(unsavedIn(host)).to.eq('false')
  })
})
