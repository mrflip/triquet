import { afterEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { Hunt } from '../../src/models/hunt'
import * as PA from '../../src/lib/vv/patterns'
import { EstimatesColumnWidthPx, NewColumnWidthPx } from '../../src/lib/widgeting-edit'
import { AddedColumnWidthPx } from '../../src/models/layout'
import { identified, openTester, seedHunt, type Tester } from '../support/convex'
import { present } from '../support/present'

/** How many rows each table holds that has any */
async function countsIn(tt: Tester): Promise<Record<string, number>> {
  return await tt.run(async (ctx) => {
    const tablenames = ['hunts', 'realms', 'quizzes', 'questions', 'widgets', 'widgetings', 'widgeteds', 'columns', 'idents', 'signals'] as const
    const counts = await Promise.all(tablenames.map(async (tablename) => {
      const rows = await ctx.db.query(tablename).collect()
      return [tablename, rows.length] as const
    }))
    return Object.fromEntries(counts.filter(([, count]) => count > 0))
  })
}

describe("testing.clearAll", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("empties every table of a deployment that may be emptied", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    await seedHunt(tt, Hunt.blank())
    await tt.mutation(internal.testing.clearAll, {})
    expect(await countsIn(tt)).to.deep.eq({})
  })

  it("empties a quiz and its change signal, which the quiz takes away with it", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    await seedHunt(tt, Hunt.blank())
    await tt.run(async (ctx) => {
      const quiz = present(await ctx.db.query('quizzes').first())
      await ctx.db.insert('signals', { hunt_id: quiz.hunt_id, quiz_id: quiz._id, changed_at: Date.now() })
    })
    await tt.mutation(internal.testing.clearAll, {})
    expect(await countsIn(tt)).to.deep.eq({})
  })

  it("refuses a deployment that may not be emptied, deleting nothing", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', '')
    const tt = openTester()
    await seedHunt(tt, Hunt.blank())
    const before = await countsIn(tt)
    await expect(tt.mutation(internal.testing.clearAll, {})).rejects.toThrow(/may not be emptied/)
    expect(await countsIn(tt)).to.deep.eq(before)
  })

  it("deletes a batch of rows a run, leaving the rest for the next, and says none once empty", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    const labels = Array.from({ length: 501 }, (_unused, idx) => `ident_${String(idx)}`)
    await tt.run(async (ctx) => {
      for (const label of labels) { await ctx.db.insert('idents', { label, title: 'Someone', user_id: null }) }
    })
    expect(await tt.mutation(internal.testing.clearAll, {})).to.eq(500)
    expect(await countsIn(tt)).to.deep.eq({ idents: 1 })
    expect(await tt.mutation(internal.testing.clearAll, {})).to.eq(1)
    expect(await tt.mutation(internal.testing.clearAll, {})).to.eq(0)
  })
})

/** What a hunt `makeHunt` made holds, read past authorization: its org and label, its smiths, and its one quiz's layout in order */
async function madeOf(tt: Tester, address: string) {
  const [, org = '', hunt = ''] = address.split('/', 3)
  return await tt.run(async (ctx) => {
    const row = present(await ctx.db.query('hunts').withIndex('by_orglabel_and_label', (cvx) => cvx.eq('orglabel', org.replace(/^~/, '')).eq('label', hunt)).first())
    const huntings = await ctx.db.query('huntings').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', row._id)).collect()
    const quiz = present(await ctx.db.query('quizzes').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', row._id)).first())
    const widgetings = await ctx.db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz._id)).collect()
    const columns = await ctx.db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz._id)).collect()
    return {
      org:        row.orglabel,
      hunt:       row.label,
      quiz:       quiz.label,
      smiths:     huntings.filter((hunting) => hunting.role === 'smith').map((hunting) => hunting.ident_label),
      widgetings: widgetings.map((widgeting) => [widgeting.label, widgeting.widget_label]),
      columns:    columns.map((column) => [column.label, column.title, column.source, column.width_px]),
    }
  })
}

describe("testing.makeHunt", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("makes a hunt of the ident's org with the ident its smith, and hands back where its quiz is worked on", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    await identified(tt, 'tester_maker')
    const address = await tt.mutation(internal.testing.makeHunt, { ident: 'tester_maker' })
    expect(address).to.match(/^\/~tester_maker\/([a-z0-9_]+)\/quizzes\/home\/\1\/!edit$/)
    const made = await madeOf(tt, address)
    expect([made.org, made.smiths, made.quiz]).to.deep.eq(['tester_maker', ['tester_maker'], made.hunt])
    expect(made.widgetings).to.deep.eq([])
    expect(made.columns.map(([label]) => label)).to.deep.eq(['title', 'qnum', 'clueing', 'full_answer', 'notes'])
  })

  it("makes each hunt for one ident a hunt of its own", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    await identified(tt, 'tester_maker')
    const first = await tt.mutation(internal.testing.makeHunt, { ident: 'tester_maker' })
    const second = await tt.mutation(internal.testing.makeHunt, { ident: 'tester_maker' })
    expect(second).not.to.eq(first)
    const made = await madeOf(tt, second)
    expect(made.smiths).to.deep.eq(['tester_maker'])
  })

  it("makes a hunt for an ident whose org holds as many as one username may make", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    await identified(tt, 'tester_maker')
    await tt.run(async (ctx) => {
      const labels = Array.from({ length: PA.HuntsPerOrg.max }, (_unused, idx) => `hunt_${String(idx)}`)
      for (const label of labels) {
        await ctx.db.insert('hunts', { label, orglabel: 'tester_maker', title: '', branch: 'main' })
      }
    })
    const made = await madeOf(tt, await tt.mutation(internal.testing.makeHunt, { ident: 'tester_maker' }))
    expect(made.smiths).to.deep.eq(['tester_maker'])
  })

  it("lays the quiz out as the gear's dialogs would: each widget under its own label with the column it brings, then each field's column", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    await tt.mutation(internal.seeding.seedWidgets, {})
    await identified(tt, 'tester_maker')
    const address = await tt.mutation(internal.testing.makeHunt, { ident: 'tester_maker', widgetings: ['dumdum', 'clueing_full', 'categories', 'dumdum'], columns: ['hint', 'butnot'] })
    const made = await madeOf(tt, address)
    expect(made.widgetings).to.deep.eq([['dumdum', 'dumdum'], ['clueing_full', 'clueing_full'], ['categories', 'categories'], ['dumdum_2', 'dumdum']])
    expect(made.columns.slice(5)).to.deep.eq([
      ['dumdum',       'Dumdum',       'dumdum',           NewColumnWidthPx.aibot],
      ['clueing_full', 'Clueing Full', 'clueing_full',     NewColumnWidthPx.jsonata],
      ['categories',   'Categories',   'categories',       EstimatesColumnWidthPx],
      ['dumdum_2',     'Dumdum 2',     'dumdum_2',         NewColumnWidthPx.aibot],
      ['hint',         'Hint',         'question.hint',    AddedColumnWidthPx],
      ['butnot',       'BUT NOT',      'question.butnot',  AddedColumnWidthPx],
    ])
  })

  it("refuses an ident no session holds, writing nothing", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    await expect(tt.mutation(internal.testing.makeHunt, { ident: 'tester_nobody' })).rejects.toThrow(/No session holds the ident tester_nobody/)
    expect(await countsIn(tt)).to.deep.eq({})
  })

  it("refuses a widget the library lacks, writing nothing", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    await identified(tt, 'tester_maker')
    const before = await countsIn(tt)
    await expect(tt.mutation(internal.testing.makeHunt, { ident: 'tester_maker', widgetings: ['no_such_widget'] })).rejects.toThrow(/no widget no_such_widget/)
    expect(await countsIn(tt)).to.deep.eq(before)
  })

  it("refuses a deployment that may not be made into, writing nothing", async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', '')
    const tt = openTester()
    await identified(tt, 'tester_maker')
    const before = await countsIn(tt)
    await expect(tt.mutation(internal.testing.makeHunt, { ident: 'tester_maker' })).rejects.toThrow(/TRIQUET_CLEARABLE is not yes/)
    expect(await countsIn(tt)).to.deep.eq(before)
  })
})
