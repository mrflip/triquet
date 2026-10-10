import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import * as Actor from '../../src/lib/actor'
import { SeedWidgets } from '../../src/models/seeds'
import { Widget } from '../../src/models/widget'
import { affirmsOf, callerOf, identified, openTester, refusedAs, seedHunt, signedIn } from '../support/convex'
import { classicHunt } from '../support/layouts'

/** Nobody is an admin, as `Actor.isAdmin` says on a deployment that names none */
function nobodyIsAdmin(): void {
  vi.spyOn(Actor, 'isAdmin').mockReturnValue(false)
}

afterEach(() => { vi.restoreAllMocks() })

const Shout = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)' })

/** One action on the library of each kind */
const LibraryActions = [
  { kind: 'add_widget', widget: Shout },
  { kind: 'edit_widget', label: 'dumdum', patch: { description: 'x' } },
  { kind: 'move_widget', label: 'dumdum', onto_idx: 3 },
  { kind: 'delete_widget', label: 'answer_reversed' },
  { kind: 'import_widgets', widgets: [Shout] },
] as const

describe("widgets.library", () => {
  it("reads every widget in the order the library lists them, as widgets without their place", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, classicHunt())
    expect(await smith.as.query(api.widgets.library, {})).to.deep.eq(SeedWidgets)
  })

  it("is read by any browser that has said who it is, on no hunt at all", async () => {
    const tt = openTester()
    await seedHunt(tt, classicHunt())
    const stranger = await identified(tt, 'carol_strays')
    const library = await stranger.as.query(api.widgets.library, {})
    expect(library.map((widget) => widget.label)).to.deep.eq(SeedWidgets.map((widget) => widget.label))
  })

  it("reads nothing for a browser that has not said who it is", async () => {
    const tt = openTester()
    await seedHunt(tt, classicHunt())
    expect(await tt.query(api.widgets.library, {})).to.deep.eq([])
  })

  it("follows the library as it is revised: a widget added, and one moved", async () => {
    const tt = openTester()
    const { actOnLibrary, smith } = await seedHunt(tt, classicHunt())
    await actOnLibrary({ kind: 'add_widget', widget: { label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)' } })
    await actOnLibrary({ kind: 'move_widget', label: 'answer_reversed', onto_idx: 0 })
    const library = await smith.as.query(api.widgets.library, {})
    const labels = library.map((widget) => widget.label)
    expect([labels.at(0), labels.at(-1), labels.length]).to.deep.eq(['answer_reversed', 'shout', SeedWidgets.length + 1])
  })

  it("reads an empty library as empty", async () => {
    const tt = openTester()
    const flip = await identified(tt, 'flip_kromer')
    expect(await flip.as.query(api.widgets.library, {})).to.deep.eq([])
  })

  it("is empty for a session that has asserted no username, and for a request with no session", async () => {
    const tt = openTester()
    await seedHunt(tt, classicHunt())
    const session = await signedIn(tt)
    expect([await session.as.query(api.widgets.library, {}), await tt.query(api.widgets.library, {})]).to.deep.eq([[], []])
  })
})

describe("widgets.usage", () => {
  it("counts, for whoever may change the library, the widgetings working a widget across every hunt, the quizzes and the hunts", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, classicHunt())
    await seedHunt(tt, classicHunt('loud_heron'), { smith: 'dave_smiths' })
    // Each new hunt's quiz works the default widgetings, dumdum among them.
    expect(await smith.as.query(api.widgets.usage, { widget_label: 'dumdum' })).to.deep.eq({ widgetings: 2, quizzes: 2, hunts: 2, at_least: false })
  })

  it("counts nothing for a widget nobody works", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, classicHunt())
    expect(await smith.as.query(api.widgets.usage, { widget_label: 'answer_reversed' })).to.deep.eq({ widgetings: 0, quizzes: 0, hunts: 0, at_least: false })
  })

  it("counts for a reviewer and a stranger to every hunt as for a smith, while everyone with a username is an admin", async () => {
    const tt = openTester()
    const { join } = await seedHunt(tt, classicHunt())
    const reviewer = await join('bob_reviews', 'reviewer')
    const stranger = await identified(tt, 'carol_strays')
    const usages = await Promise.all([reviewer, stranger].map(async (by) => await by.as.query(api.widgets.usage, { widget_label: 'dumdum' })))
    expect(usages).to.deep.eq([{ widgetings: 1, quizzes: 1, hunts: 1, at_least: false }, { widgetings: 1, quizzes: 1, hunts: 1, at_least: false }])
  })

  it("is null for a session that has asserted no username, and a request with no session", async () => {
    const tt = openTester()
    await seedHunt(tt, classicHunt())
    const session = await signedIn(tt)
    const usages = await Promise.all([session, tt].map(async (by) => await callerOf(by).query(api.widgets.usage, { widget_label: 'dumdum' })))
    expect(usages).to.deep.eq([null, null])
  })

  it("is null for everyone once nobody is an admin, a smith included", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, classicHunt())
    nobodyIsAdmin()
    expect(await smith.as.query(api.widgets.usage, { widget_label: 'dumdum' })).to.eq(null)
  })

  it("refuses a widget label that is not one", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, classicHunt())
    await expect(smith.as.query(api.widgets.usage, { widget_label: 'Not A Label!' })).rejects.toThrow()
  })
})

describe("widgets.perform", () => {
  it("changes the library for anyone with a username where every one is an admin (`TRIQUET_ADMINS` `*`): a smith, a reviewer, a stranger to every hunt", async () => {
    const tt = openTester()
    const { actOnLibrary, join, read } = await seedHunt(tt, classicHunt())
    const reviewer = await join('bob_reviews', 'reviewer')
    const stranger = await identified(tt, 'carol_strays')
    await actOnLibrary({ kind: 'add_widget', widget: Shout })
    await actOnLibrary({ kind: 'move_widget', label: 'shout', onto_idx: 0 }, reviewer)
    await actOnLibrary({ kind: 'edit_widget', label: 'shout', patch: { description: 'Loud.' } }, stranger)
    const { library } = await read()
    expect(library[0]).to.deep.eq({ ...Shout, description: 'Loud.' })
  })

  it("needs no hunt: a browser on none changes the library", async () => {
    const tt = openTester()
    const flip = await identified(tt, 'flip_kromer')
    await flip.as.mutation(api.widgets.perform, { action: { kind: 'add_widget', widget: Shout } })
    expect(await flip.as.query(api.widgets.library, {})).to.deep.eq([Shout])
  })

  it("refuses every action, changing nothing, from a session that has asserted no username, or a request with no session", async () => {
    const tt = openTester()
    const { actOnLibrary, read } = await seedHunt(tt, classicHunt())
    const session = await signedIn(tt)
    const ante = await read()
    for (const action of LibraryActions) {
      expect([await refusedAs(actOnLibrary(action, session)), await refusedAs(actOnLibrary(action, tt))]).to.deep.eq(['notIdentified', 'notIdentified'])
    }
    expect(await read()).to.deep.eq(ante)
  })

  it("refuses every action, changing nothing, from everyone once nobody is an admin, a smith included", async () => {
    const tt = openTester()
    const { actOnLibrary, read } = await seedHunt(tt, classicHunt())
    const ante = await read()
    nobodyIsAdmin()
    for (const action of LibraryActions) {
      expect(await refusedAs(actOnLibrary(action))).to.eq('notPermitted')
    }
    expect(await read()).to.deep.eq(ante)
  })

  it("is the only way to change the library: a hunt's mutation does not take a library action", async () => {
    const tt = openTester()
    const { open, smith, read } = await seedHunt(tt, classicHunt())
    const { action: affirms } = await affirmsOf(tt, smith, open)
    const ante = await read()
    for (const action of LibraryActions) {
      // Sent as a browser that still thought it could would send it, past the compiler: Convex's own check of the arguments turns it away.
      await expect(smith.as.mutation(api.hunts.perform, { affirms, action: action as never })).rejects.toThrow('Validator error')
    }
    expect(await read()).to.deep.eq(ante)
  })
})
