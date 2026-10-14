import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import * as CheckReserved from '../../scripts/check-reserved'
import { JanitorStop, type ReachedT } from '../../scripts/janitor'

const Local: ReachedT = { deployment: '127.0.0.1:3431', url: 'http://127.0.0.1:3431' }
const reach = () => Local

/** A deployment answering the check with what no deployment holds */
const answeringAmiss: CheckReserved.RunT = () => ({ users: 'flip_kromer', ghostings: [], hunts: [] })

/** A deployment answering `check_reserved:held` with `held`, and the functions it was asked to run */
function fakeDeployment(held: CheckReserved.HeldT) {
  const calls: string[] = []
  const run: CheckReserved.RunT = (fnpath) => {
    calls.push(fnpath)
    return held
  }
  return { run, calls }
}

/** What the command says, line by line, and what it found */
function said(argv: string[], run: CheckReserved.RunT): { report: CheckReserved.ReportT, lines: string[] } {
  const lines: string[] = []
  const report = CheckReserved.checkReserved(argv, run, (line) => { lines.push(line) }, reach)
  return { report, lines }
}

/** A deployment holding a user, a ghosting and hunts the list keeps, beside some it does not */
const Holding: CheckReserved.HeldT = {
  users:     ['flip_kromer', 'google_fan'],
  ghostings: ['support_me', 'anon_alice'],
  hunts:     [
    { orglabel: 'pat_smith', label: 'quiet_otter' },
    { orglabel: 'pat_smith', label: 'privacy' },
    { orglabel: 'google_fan', label: 'loud_heron' },
    { orglabel: 'support_desk', label: 'handle' },
  ],
}

describe("lineOf", () => {
  it("reads the doc block's example", () => {
    expect(CheckReserved.lineOf({ orglabel: 'google_fan', label: 'privacy', refused: ['orglabel', 'label'] })).to.eq('  ~google_fan/privacy  (its org and its label)')
  })

  it("names only the label the list refuses", () => {
    expect([
      CheckReserved.lineOf({ orglabel: 'pat_smith', label: 'privacy', refused: ['label'] }),
      CheckReserved.lineOf({ orglabel: 'google_fan', label: 'quiet_otter', refused: ['orglabel'] }),
    ]).to.deep.eq(['  ~pat_smith/privacy  (its label)', '  ~google_fan/quiet_otter  (its org)'])
  })
})

describe("reportOf", () => {
  it("reads the doc block's example", () => {
    expect(CheckReserved.reportOf({ users: ['flip_kromer', 'google_fan'], ghostings: [], hunts: [{ orglabel: 'pat_smith', label: 'privacy' }] })).to.deep.eq({
      counted: { users: 2, ghostings: 0, hunts: 1 }, users: ['google_fan'], ghostings: [], hunts: [{ orglabel: 'pat_smith', label: 'privacy', refused: ['label'] }],
    })
  })

  it("judges by the list of this checkout, top-level words, prefixes and the words every label is kept from alike", () => {
    expect(CheckReserved.reportOf({ users: ['pricing', 'helpful_one', 'position', 'quiz_ids', 'flip_kromer'], ghostings: [], hunts: [] }).users).to.deep.eq(['pricing', 'helpful_one', 'position', 'quiz_ids'])
  })
})

describe("checkReserved", () => {
  it("says where it is aimed, how much it read, each holder the list here would lock out, and each hunt label it keeps from new ones", () => {
    const { run, calls } = fakeDeployment(Holding)
    const { report, lines } = said([], run)
    expect(report).to.deep.eq(CheckReserved.reportOf(Holding))
    expect(calls).to.deep.eq(['check_reserved:held'])
    expect(lines).to.deep.eq([
      'Aimed at 127.0.0.1:3431 (http://127.0.0.1:3431): a dry run, which changes nothing.',
      'Read the userlabels of 2 users and 2 ghostings, and 4 hunts.',
      'These hold a userlabel or org the reserved list here keeps. Deploy the list only once each has moved; until then it would lock them out:',
      "  ~google_fan  (a user's userlabel)",
      "  ~support_me  (retired by a merge: a ghosting's)",
      '  ~google_fan/loud_heron  (its org)',
      '  ~support_desk/handle  (its org and its label)',
      'These hunts have a label the list here keeps from new ones. Each keeps it at its address, writable while the word is a top-level one; a word every label is kept from locks the hunt:',
      '  ~pat_smith/privacy  (its label)',
    ])
  })

  it("says so when nothing holds a word it keeps", () => {
    const { run } = fakeDeployment({ users: ['flip_kromer'], ghostings: [], hunts: [{ orglabel: 'flip_kromer', label: 'quiet_otter' }] })
    expect(said([], run).lines.slice(1)).to.deep.eq([
      'Read the userlabels of 1 users and 0 ghostings, and 1 hunts.',
      'Nothing holds a userlabel or org the reserved list here keeps: it may be deployed.',
    ])
  })

  it("reads the same named at the deployment it reaches", () => {
    const { run } = fakeDeployment(Holding)
    expect(said(['--deployment', '127.0.0.1:3431'], run).report).to.deep.eq(CheckReserved.reportOf(Holding))
  })

  it("stops before asking anything when named at another deployment, or given what it does not take", () => {
    const { run, calls } = fakeDeployment(Holding)
    expect(() => said(['--deployment', 'careful-otter-123'], run)).to.throw(JanitorStop, /reaches 127\.0\.0\.1:3431/)
    expect(() => said(['--fix'], run)).to.throw(JanitorStop, /Usage/)
    expect(calls).to.deep.eq([])
  })

  it("refuses an answer not shaped as the check answers", () => {
    expect(() => said([], answeringAmiss)).to.throw(Z.ZodError)
  })
})
