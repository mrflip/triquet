import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { Id } from '../../convex/_generated/dataModel'
import * as CheckReserved from '../../scripts/check-reserved'
import { JanitorStop, type ReachedT } from '../../scripts/janitor'
import * as PA from '../../src/lib/vv/patterns'
import { HuntValidators } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { RealmValidators } from '../../src/models/realm'
import { UserValidators } from '../../src/models/user'
import { WidgetingValidators } from '../../src/models/widgeting'
import { present } from '../support/present'

const Local: ReachedT = { deployment: '127.0.0.1:3431', url: 'http://127.0.0.1:3431' }
const reach = () => Local

/** A row id, as a UUID: the `ordinal`th */
function idOf(ordinal: number): string {
  return `00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`
}

const [HuntId, RealmId, QuizId] = [idOf(1), idOf(2), idOf(3)] as [Id<'hunts'>, Id<'realms'>, Id<'quizzes'>]

/** A row as the deployment holds it: what its validator makes of `fields`, with an id */
function held(_id: string, fields: object): CheckReserved.RowT {
  return { _id, _creationTime: 1_760_000_000_000, ...fields }
}

/** A deployment holding one hunt, `~pat_smith/quiet_otter`, its quiz `home/loud_heron`, two questions, and a user: nothing the list keeps */
const Clean: CheckReserved.HeldT = {
  users:     [held(idOf(10), UserValidators.row({ userlabel: 'pat_smith', title: 'Pat', isAnonymous: false }))],
  hunts:     [held(HuntId, HuntValidators.row({ label: 'quiet_otter', orglabel: 'pat_smith', title: 'Quiet Otter', branch: 'main' }))],
  realms:    [held(RealmId, RealmValidators.row({ hunt_id: HuntId, label: 'home', title: 'Home', position: 0 }))],
  quizzes:   [held(QuizId, Quiz.blankRow({ hunt_id: HuntId, realm_id: RealmId }, '', 'loud_heron'))],
  questions: [
    held(idOf(20), Question.blankRow({ hunt_id: HuntId, quiz_id: QuizId }, 'leon')),
    held(idOf(21), Question.blankRow({ hunt_id: HuntId, quiz_id: QuizId }, 'pippin')),
  ],
}

/** `Clean`, but holding what the list here keeps: a question chained to a base word, a user named by a top-level one, a hunt labelled by one */
const Holding: CheckReserved.HeldT = {
  ...Clean,
  users:     [held(idOf(10), { userlabel: 'google_fan', title: 'Pat', isAnonymous: false })],
  hunts:     [held(HuntId, { label: 'privacy', orglabel: 'pat_smith', title: 'Quiet Otter', branch: 'main' })],
  questions: [{ ...Clean.questions?.[0], chains_to: 'constructor' }, ...(Clean.questions ?? []).slice(1)],
}

/** Where `Clean`'s quiz lives */
const QuizAt = '/~pat_smith/quiet_otter/quizzes/home/loud_heron'

/** A deployment holding `held`, answering a page of `pagesize` rows at a time, and every page it was asked for */
function fakeDeployment(rows: CheckReserved.HeldT, pagesize = 100) {
  const calls: { table: string, cursor: string | null }[] = []
  const run: CheckReserved.RunT = (fnpath, args) => {
    expect(fnpath).to.eq('check_reserved:page')
    const { table, cursor } = args as { table: CheckReserved.TablenameT, cursor: string | null }
    calls.push({ table, cursor })
    const all = rows[table]
    if (all === undefined) { return null }
    const start = Number(cursor ?? 0)
    const end = start + pagesize
    return { page: all.slice(start, end), isDone: end >= all.length, continueCursor: String(end) }
  }
  return { run, calls }
}

/** A deployment answering a page Convex cut short */
const answeringShort: CheckReserved.RunT = () => ({ page: [], isDone: false, continueCursor: '1', pageStatus: 'SplitRequired' })

/** What the command says, line by line, and what it found */
async function said(argv: string[], run: CheckReserved.RunT): Promise<{ report: CheckReserved.ReportT, lines: string[] }> {
  const lines: string[] = []
  const report = await CheckReserved.checkReserved(argv, run, (line) => { lines.push(line) }, reach)
  return { report, lines }
}

/** `held`, with every table it lacks held empty */
function everyTable(rows: CheckReserved.HeldT): CheckReserved.HeldT {
  return Object.fromEntries(CheckReserved.Tablenames.map((table) => [table, rows[table] ?? []]))
}

describe("heldFrom", () => {
  it("reads every table a page at a time, from each page's cursor, until it is done", async () => {
    const { run, calls } = fakeDeployment(everyTable(Clean), 1)
    expect(await CheckReserved.heldFrom(run)).to.deep.eq(everyTable(Clean))
    expect(calls.filter((call) => call.table === 'questions')).to.deep.eq([
      { table: 'questions', cursor: null }, { table: 'questions', cursor: '1' },
    ])
    expect(new Set(calls.map((call) => call.table))).to.deep.eq(new Set(CheckReserved.Tablenames))
  })

  it("leaves out a table the deployment does not hold", async () => {
    const { run } = fakeDeployment(Clean)
    const held = await CheckReserved.heldFrom(run)
    expect(new Set(Object.keys(held))).to.deep.eq(new Set(['hunts', 'questions', 'quizzes', 'realms', 'users']))
  })

  it("stops at a page Convex says came back short, rather than judge what it read", async () => {
    await expect(CheckReserved.heldFrom(answeringShort)).rejects.toThrow(JanitorStop)
  })

  it("refuses an answer not shaped as a page", async () => {
    await expect(CheckReserved.heldFrom(() => ({ page: 'quiet_otter', isDone: true, continueCursor: '' }))).rejects.toThrow(Z.ZodError)
  })
})

describe("placesOf", () => {
  it("reads the doc block's example", () => {
    expect(CheckReserved.placesOf({ hunts: [{ _id: 'h1', orglabel: 'pat_smith', label: 'quiet_otter' }] }).hunts.get('h1')?.label).to.eq('quiet_otter')
  })
})

describe("whereOf", () => {
  const places = CheckReserved.placesOf(Clean)

  it("places a row of a quiz at its quiz's address", () => {
    expect(CheckReserved.whereOf('questions', { hunt_id: HuntId, quiz_id: QuizId }, places)).to.eq(QuizAt)
  })

  it("places a quiz at its own address, and a hunt or realm, or a row of a hunt alone, at the hunt's", () => {
    expect([
      CheckReserved.whereOf('quizzes', present(Clean.quizzes?.[0]), places),
      CheckReserved.whereOf('hunts', present(Clean.hunts?.[0]), places),
      CheckReserved.whereOf('realms', present(Clean.realms?.[0]), places),
      CheckReserved.whereOf('huntships', { hunt_id: HuntId, userlabel: 'pat_smith' }, places),
    ]).to.deep.eq([QuizAt, '/~pat_smith/quiet_otter', '/~pat_smith/quiet_otter', '/~pat_smith/quiet_otter'])
  })

  it("places a row belonging to no hunt nowhere, as one whose hunt is not held", () => {
    expect([
      CheckReserved.whereOf('users', { userlabel: 'pat_smith' }, places),
      CheckReserved.whereOf('widgets', { scope: 'pub', label: 'dumdum' }, places),
      CheckReserved.whereOf('questions', { hunt_id: idOf(99), quiz_id: idOf(98) }, places),
    ]).to.deep.eq([null, null, null])
  })
})

describe("reportOf", () => {
  it("reads the doc block's example", () => {
    expect(CheckReserved.reportOf({ users: [{ _id: 'u1', userlabel: 'google_fan' }] }).refused).to.deep.eq([
      { table: 'users', where: null, row: 'google_fan', field: 'userlabel', val: 'google_fan', reason: PA.UnreservedToplevel.msg },
    ])
  })

  it("refuses nothing a deployment holding no reserved word holds, and counts what it read", () => {
    expect(CheckReserved.reportOf(Clean)).to.deep.eq({
      counted:  { users: 1, hunts: 1, realms: 1, quizzes: 1, questions: 2 },
      absent:   CheckReserved.Tablenames.filter((table) => ! Object.hasOwn(Clean, table)),
      refused:  [],
      standing: [],
    })
  })

  it("judges every label as its field is when written: a userlabel by both lists, any other by the words every label is kept from, a hunt's own label as standing", () => {
    const report = CheckReserved.reportOf(Holding)
    expect(report.refused).to.deep.eq([
      { table: 'users',     where: null,   row: 'google_fan', field: 'userlabel', val: 'google_fan',  reason: PA.UnreservedToplevel.msg },
      { table: 'questions', where: QuizAt.replace('quiet_otter', 'privacy'), row: 'leon', field: 'chains_to', val: 'constructor', reason: PA.Unreserved.msg },
    ])
    expect(report.standing).to.deep.eq(['/~pat_smith/privacy'])
  })

  it("names a hunt refused already once, as refused, and not again as standing", () => {
    const report = CheckReserved.reportOf({ hunts: [held(HuntId, { label: 'privacy', orglabel: 'google_fan', title: '', branch: 'main' })] })
    expect([report.refused.map(({ field }) => field), report.standing]).to.deep.eq([['orglabel'], []])
  })

  it("names a reserved word a record's key holds by the key's own reason, and a widgeting's label by its own namespace's", () => {
    const widgeting = WidgetingValidators.row({ hunt_id: HuntId, quiz_id: QuizId, widget_label: 'dumdum', label: 'dumdum', description: '', params: {}, tier: 'question', position: 0 })
    const { refused } = CheckReserved.reportOf({ ...Clean, widgetings: [held(idOf(30), { ...widgeting, label: 'rank', params: { data: 1, min: 2 } })] })
    expect(refused.map(({ where, field, val, reason }) => [where, field, val, reason])).to.deep.eq([
      [QuizAt, 'label',       'rank', 'is a name a question, its cells or the bag already answer to: add to it, as my_label or label_2'],
      [QuizAt, 'params.data', 'data', PA.Unreserved.msg],
    ])
  })
})

describe("lineOf", () => {
  it("reads the doc block's example", () => {
    expect(CheckReserved.lineOf({ table: 'questions', where: QuizAt, row: 'leon', field: 'chains_to', val: 'constructor', reason: 'is a word the tool keeps' }))
      .to.eq(`  ${QuizAt}  questions leon  chains_to "constructor": is a word the tool keeps`)
  })

  it("leaves out the place of a row that has none, and cuts a long value short", () => {
    expect(CheckReserved.lineOf({ table: 'users', where: null, row: 'google_fan', field: 'userlabel', val: 'x'.repeat(90), reason: 'is kept' }))
      .to.eq(`  users google_fan  userlabel "${'x'.repeat(56)}...: is kept`)
  })
})

describe("checkReserved", () => {
  it("says where it is aimed, how much it read, what it would refuse and where, and each hunt label it keeps from new ones", async () => {
    const { run } = fakeDeployment(everyTable(Holding))
    const { report, lines } = await said([], run)
    const counts = CheckReserved.Tablenames.map((table) => `${table} ${String(everyTable(Holding)[table]?.length)}`)
    expect(report).to.deep.eq(CheckReserved.reportOf(everyTable(Holding)))
    expect(lines).to.deep.eq([
      'Aimed at 127.0.0.1:3431 (http://127.0.0.1:3431): a dry run, which changes nothing.',
      `Read every row of ${String(CheckReserved.Tablenames.length)} tables: ${counts.join(', ')}.`,
      'These rows hold what the validators here refuse. Deploy only once each has moved; until then each is locked, and a userlabel or org so held locks out its holder or its hunts:',
      `  users google_fan  userlabel "google_fan": ${PA.UnreservedToplevel.msg}`,
      `  /~pat_smith/privacy/quizzes/home/loud_heron  questions leon  chains_to "constructor": ${PA.Unreserved.msg}`,
      'These hunts have a label the list here keeps from new ones. Each keeps it at its address, and needs nothing done:',
      '  /~pat_smith/privacy',
    ])
  })

  it("says so when nothing held is refused, and names a table the deployment does not hold yet", async () => {
    const { run } = fakeDeployment(Clean)
    const { lines } = await said([], run)
    expect(lines.slice(1)).to.deep.eq([
      'Read every row of 5 tables: users 1, hunts 1, realms 1, quizzes 1, questions 2.',
      `The deployment holds no table ${CheckReserved.Tablenames.filter((table) => ! Object.hasOwn(Clean, table)).join(', ')} yet: nothing there to judge.`,
      'Nothing held is refused by the validators here, the reserved lists among them: they may be deployed.',
    ])
  })

  it("reads the same named at the deployment it reaches", async () => {
    const { run } = fakeDeployment(Holding)
    const { report } = await said(['--deployment', '127.0.0.1:3431'], run)
    expect(report).to.deep.eq(CheckReserved.reportOf(Holding))
  })

  it("stops before asking anything when named at another deployment, or given what it does not take", async () => {
    const { run, calls } = fakeDeployment(Holding)
    await expect(said(['--deployment', 'careful-otter-123'], run)).rejects.toThrow(JanitorStop)
    await expect(said(['--deployment', 'careful-otter-123'], run)).rejects.toThrow(/reaches 127\.0\.0\.1:3431/)
    await expect(said(['--fix'], run)).rejects.toThrow(/Usage/)
    expect(calls).to.deep.eq([])
  })
})
