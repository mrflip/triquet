import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { SeedWidgets } from '../../src/models/seeds'
import { callerOf, identified, openTester, seedHunt, signedIn } from '../support/convex'
import { classicHunt } from '../support/layouts'

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
    const { act, smith } = await seedHunt(tt, classicHunt())
    await act({ kind: 'add_widget', widget: { label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' } })
    await act({ kind: 'move_widget', label: 'answer_reversed', onto_idx: 0 })
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
  it("counts, for a smith, the widgetings working a widget across every hunt, the quizzes and the hunts", async () => {
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

  it("is null for a reviewer, a stranger, a session that has asserted no username, and a request with no session", async () => {
    const tt = openTester()
    const { join } = await seedHunt(tt, classicHunt())
    const reviewer = await join('bob_reviews', 'reviewer')
    const stranger = await identified(tt, 'carol_strays')
    const session = await signedIn(tt)
    const usages = await Promise.all([reviewer, stranger, session, tt].map(async (by) => await callerOf(by).query(api.widgets.usage, { widget_label: 'dumdum' })))
    expect(usages).to.deep.eq([null, null, null, null])
  })

  it("refuses a widget label that is not one", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, classicHunt())
    await expect(smith.as.query(api.widgets.usage, { widget_label: 'Not A Label!' })).rejects.toThrow()
  })
})
