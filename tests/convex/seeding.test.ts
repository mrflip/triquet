import { describe, expect, it } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { layoutRowsOf, libraryOf, realmsOf } from '../../convex/reading'
import { insertHunt } from '../../convex/writing/quiz_writing'
import { defaultLayout } from '../../src/models/layout'
import { Quiz } from '../../src/models/quiz'
import { DefaultWidgetings, SeedWidgets } from '../../src/models/seeds'
import { Widget } from '../../src/models/widget'
import { present } from '../support/present'
import { openTester, type Tester } from '../support/convex'

// A deployment as thread 3 finds it: quizzes laid out before widgetings were rows, their columns
// naming default widgetings (and the old BUT NOT ishes view, a source today's column validator
// refuses), and a library that may hold some widgets already. Written raw, as no validator of
// today's would write them.

/** One quiz as it stood before the seeding: its label, its columns' sources in order, and any widgetings it already has, each labelled as its widget */
type OldQuiz = { label: string, sources: readonly string[], widgetings?: readonly string[] }

/** A hunt labelled `label`, one realm `home` holding `quizzes`, written raw; the ids of its quizzes, by label */
async function oldHunt(tt: Tester, label: string, quizzes: readonly OldQuiz[]): Promise<Record<string, Id<'quizzes'>>> {
  return await tt.run(async (ctx) => {
    const hunt_id = await ctx.db.insert('hunts', { label, forced_label: null, title: '' })
    const realm_id = await ctx.db.insert('realms', { hunt_id, label: 'home', title: '', position: 0 })
    const ids: Record<string, Id<'quizzes'>> = {}
    for (const quiz of quizzes) {
      const quiz_id = await ctx.db.insert('quizzes', Quiz.blankRow(realm_id, '', quiz.label))
      for (const [position, source] of quiz.sources.entries()) {
        await ctx.db.insert('columns', { quiz_id, label: `col_${String(position)}`, title: '', source, width_px: 80, position })
      }
      const widgetings = quiz.widgetings ?? []
      for (const [position, widget_label] of widgetings.entries()) {
        await ctx.db.insert('widgetings', { quiz_id, widget_label, label: widget_label, description: '', params: {}, position })
      }
      ids[quiz.label] = quiz_id
    }
    return ids
  })
}

/** The quiz `quiz_id`'s widgetings' labels in run order, and its columns' sources in order */
async function layoutOf(tt: Tester, quiz_id: Id<'quizzes'>) {
  const rows = present(await tt.run(async (ctx) => await layoutRowsOf(ctx.db, quiz_id)))
  return { widgetings: rows.widgetings.map((row) => row.label), sources: rows.columns.map((row) => row.source) }
}

/** The library's labels and places, in order */
async function libraryIn(tt: Tester) {
  const library = await tt.run(async (ctx) => await libraryOf(ctx.db))
  return library.map((row) => [row.label, row.position])
}

const seedWidgets = async (tt: Tester) => await tt.mutation(internal.seeding.seedWidgets, {})

const DefaultLabels = DefaultWidgetings.map((widgeting) => widgeting.label)
const SeedLabels    = SeedWidgets.map((widget) => widget.label)

describe("seeding.seedWidgets", () => {
  it("fills an empty library with every seed widget, in seed order", async () => {
    const tt = openTester()
    expect(await seedWidgets(tt)).to.deep.eq({ widgets: SeedLabels, quizzes: [] })
    expect(await libraryIn(tt)).to.deep.eq(SeedLabels.map((label, idx) => [label, idx]))
  })

  it("inserts only the seed widgets the library lacks, at its end, and leaves those it holds as they are", async () => {
    const tt = openTester()
    const shout = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' })
    const dumdum = { ...present(SeedWidgets.find((widget) => widget.label === 'dumdum')), title: 'My own dumdum' }
    await tt.run(async (ctx) => {
      for (const [position, widget] of [shout, dumdum].entries()) { await ctx.db.insert('widgets', { ...widget, position }) }
    })
    const { widgets } = await seedWidgets(tt)
    const absent = SeedLabels.filter((label) => label !== 'dumdum')
    expect(widgets).to.deep.eq(absent)
    expect(await libraryIn(tt)).to.deep.eq([['shout', 0], ['dumdum', 1], ...absent.map((label, idx) => [label, idx + 2])])
    const library = await tt.run(async (ctx) => await libraryOf(ctx.db))
    expect(library.find((row) => row.label === 'dumdum')?.title).to.eq('My own dumdum')
  })

  it("gives a quiz with no widgetings whose columns name any default widgeting the whole default set, its columns as they were", async () => {
    const tt = openTester()
    const { princes } = await oldHunt(tt, 'quiet_otter', [{ label: 'princes', sources: ['question.title', 'clueing_full'] }])
    const done = await seedWidgets(tt)
    expect(done.quizzes).to.deep.eq(['quiet_otter/home/princes'])
    expect(await layoutOf(tt, present(princes))).to.deep.eq({ widgetings: DefaultLabels, sources: ['question.title', 'clueing_full'] })
  })

  it("re-points a column of the old BUT NOT ishes view to the widgeting that shows them now, which it gives the quiz", async () => {
    const tt = openTester()
    const { princes } = await oldHunt(tt, 'quiet_otter', [{ label: 'princes', sources: ['question.title', 'question.butnot_ishes', 'question.butnot'] }])
    await seedWidgets(tt)
    expect(await layoutOf(tt, present(princes))).to.deep.eq({ widgetings: DefaultLabels, sources: ['question.title', 'butnot_ishes', 'question.butnot'] })
  })

  it("leaves a lean quiz, whose columns name no default widgeting, alone", async () => {
    const tt = openTester()
    const { lean } = await oldHunt(tt, 'quiet_otter', [{ label: 'lean', sources: ['question.title', 'question.clueing', 'question.butnot'] }])
    const done = await seedWidgets(tt)
    expect(done.quizzes).to.deep.eq([])
    expect(await layoutOf(tt, present(lean))).to.deep.eq({ widgetings: [], sources: ['question.title', 'question.clueing', 'question.butnot'] })
  })

  it("leaves a quiz made new, laid out with the starter columns, alone", async () => {
    const tt = openTester()
    const hunt_id = await tt.run(async (ctx) => await insertHunt(ctx.db, 'quiet_otter'))
    const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
    const quiz_id = present(present(home).quizzes[0])._id
    const done = await seedWidgets(tt)
    expect(done.quizzes).to.deep.eq([])
    expect(await layoutOf(tt, quiz_id)).to.deep.eq({ widgetings: [], sources: defaultLayout().columns.map((column) => column.source) })
  })

  it("leaves a quiz that already has widgetings alone, the old view's column and all", async () => {
    const tt = openTester()
    const sources = ['clueing_full', 'question.butnot_ishes']
    const { worked } = await oldHunt(tt, 'quiet_otter', [{ label: 'worked', sources, widgetings: ['dumdum'] }])
    const done = await seedWidgets(tt)
    expect(done.quizzes).to.deep.eq([])
    expect(await layoutOf(tt, present(worked))).to.deep.eq({ widgetings: ['dumdum'], sources })
  })

  it("says each quiz it gave widgetings, across hunts, as hunt/realm/quiz by the labels in force", async () => {
    const tt = openTester()
    await oldHunt(tt, 'quiet_otter', [{ label: 'princes', sources: ['clueing_full'] }, { label: 'lean', sources: ['question.title'] }])
    await oldHunt(tt, 'loud_heron', [{ label: 'kings', sources: ['question.butnot_ishes'] }])
    await tt.run(async (ctx) => {
      const heron = present(await ctx.db.query('hunts').withIndex('by_label', (cvx) => cvx.eq('label', 'loud_heron')).first())
      await ctx.db.patch('hunts', heron._id, { forced_label: 'heron_hunt' })
    })
    const { quizzes } = await seedWidgets(tt)
    expect(quizzes).to.deep.eq(['quiet_otter/home/princes', 'heron_hunt/home/kings'])
  })

  it("is harmless to run again: the second run adds nothing, changes nothing, and says so", async () => {
    const tt = openTester()
    const { princes, lean } = await oldHunt(tt, 'quiet_otter', [
      { label: 'princes', sources: ['question.butnot_ishes', 'hint_full'] },
      { label: 'lean', sources: ['question.title'] },
    ])
    await seedWidgets(tt)
    const ante = [await libraryIn(tt), await layoutOf(tt, present(princes)), await layoutOf(tt, present(lean))]
    expect(await seedWidgets(tt)).to.deep.eq({ widgets: [], quizzes: [] })
    expect([await libraryIn(tt), await layoutOf(tt, present(princes)), await layoutOf(tt, present(lean))]).to.deep.eq(ante)
  })
})
