import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import * as CheckReserved from '../../scripts/check-reserved'
import { JanitorStop, type ReachedT } from '../../scripts/janitor'

const Local: ReachedT = { deployment: '127.0.0.1:3431', url: 'http://127.0.0.1:3431' }
const reach = () => Local

/** A deployment answering the check with a count no deployment could */
const answeringAmiss: CheckReserved.RunT = () => ({ counted: -1, refused: [] })

/** A deployment answering `check_reserved:refused` with `report`, and the functions it was asked to run */
function fakeDeployment(report: CheckReserved.ReportT) {
  const calls: string[] = []
  const run: CheckReserved.RunT = (fnpath) => {
    calls.push(fnpath)
    return report
  }
  return { run, calls }
}

/** What the command says, line by line, and what it read */
function said(argv: string[], run: CheckReserved.RunT): { report: CheckReserved.ReportT, lines: string[] } {
  const lines: string[] = []
  const report = CheckReserved.checkReserved(argv, run, (line) => { lines.push(line) }, reach)
  return { report, lines }
}

describe('lineOf', () => {
  it("reads the doc block's example", () => {
    expect(CheckReserved.lineOf({ orglabel: 'google_fan', label: 'privacy', refused: ['orglabel', 'label'] })).to.eq('  ~google_fan/privacy  (its org and its label)')
  })

  it('names only the label the list refuses', () => {
    expect([
      CheckReserved.lineOf({ orglabel: 'pat_smith', label: 'privacy', refused: ['label'] }),
      CheckReserved.lineOf({ orglabel: 'google_fan', label: 'quiet_otter', refused: ['orglabel'] }),
    ]).to.deep.eq(['  ~pat_smith/privacy  (its label)', '  ~google_fan/quiet_otter  (its org)'])
  })
})

describe('checkReserved', () => {
  const Found: CheckReserved.ReportT = {
    counted: 3,
    refused: [
      { orglabel: 'pat_smith', label: 'privacy', refused: ['label'] },
      { orglabel: 'google_fan', label: 'quiet_otter', refused: ['orglabel'] },
    ],
  }

  it('says where it is aimed, how many hunts it read, and each hunt the list would refuse', () => {
    const { run, calls } = fakeDeployment(Found)
    const { report, lines } = said([], run)
    expect(report).to.deep.eq(Found)
    expect(calls).to.deep.eq(['check_reserved:refused'])
    expect(lines).to.deep.eq([
      'Aimed at 127.0.0.1:3431 (http://127.0.0.1:3431): a dry run, which changes nothing.',
      'Read 3 hunts.',
      '2 have a label or org the reserved list keeps from new ones. Each stands at its address, and stays writable:',
      '  ~pat_smith/privacy  (its label)',
      '  ~google_fan/quiet_otter  (its org)',
    ])
  })

  it('says so when it finds none', () => {
    const { run } = fakeDeployment({ counted: 7, refused: [] })
    expect(said([], run).lines.slice(1)).to.deep.eq(['Read 7 hunts.', 'None has a label or org the reserved list keeps from new ones.'])
  })

  it('reads the same named at the deployment it reaches', () => {
    const { run } = fakeDeployment(Found)
    expect(said(['--deployment', '127.0.0.1:3431'], run).report).to.deep.eq(Found)
  })

  it('stops before asking anything when named at another deployment, or given what it does not take', () => {
    const { run, calls } = fakeDeployment(Found)
    expect(() => said(['--deployment', 'careful-otter-123'], run)).to.throw(JanitorStop, /reaches 127\.0\.0\.1:3431/)
    expect(() => said(['--fix'], run)).to.throw(JanitorStop, /Usage/)
    expect(calls).to.deep.eq([])
  })

  it('refuses an answer not shaped as the check answers', () => {
    expect(() => said([], answeringAmiss)).to.throw(Z.ZodError)
  })
})
