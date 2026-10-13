import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import * as Adopt from '../../scripts/adopt.ts' // the extension, as the bash wrapper beside it is scripts/adopt
import { JanitorStop, type ReachedT } from '../../scripts/janitor'
import type { AdoptedT } from '../../src/models/adoption'

const Local: ReachedT = { deployment: '127.0.0.1:3431', url: 'http://127.0.0.1:3431' }
const reach = () => Local

const UserId = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as AdoptedT['user']['user_id']

/** When the users here were made, 2026-10-12T14:03:07.000Z */
const MadeAt = 1_791_813_787_000

/** The Coach's command line, as the pre-plan writes it */
const CoachArgv = ['--email', 'flip@example.com', '--userlabel', 'mrflip', '--admin', '--smith-all']

/** What the deployment answers the Coach's command with, on production after the clear */
const CoachAdopted: AdoptedT = {
  user:    { user_id: UserId, userlabel: null, title: null, anonymous: false, admin: false, name: 'Flip Kromer', created_at: MadeAt, email_verified_at: MadeAt },
  changes: [
    { kind: 'userlabel', from: null, to: 'mrflip', title: 'Mrflip', huntships: 0, leaves: null },
    { kind: 'admin', to: true },
    { kind: 'huntship', org: 'mrflip', hunt: 'quiet_otter', role: 'smith', from: null },
    { kind: 'huntship', org: 'pat_smith', hunt: 'loud_heron', role: 'smith', from: 'reviewer' },
  ],
  kept:    1,
  skipped: 0,
}

/** A deployment answering every function with `outcome`, and the functions it was asked to run, with what */
function fakeDeployment(outcome: unknown) {
  const calls: [string, Record<string, unknown>][] = []
  const run: Adopt.RunT = (fnpath, args) => {
    calls.push([fnpath, args])
    return outcome
  }
  return { run, calls }
}

/** What the command says, line by line */
function said(argv: string[], run: Adopt.RunT): string[] {
  const lines: string[] = []
  Adopt.adopt(argv, run, (line) => { lines.push(line) }, reach)
  return lines
}

describe('huntAt', () => {
  it("reads a hunt's address, with or without its leading slash", () => {
    expect(Adopt.huntAt('~pat_smith/quiet_otter')).to.deep.eq({ org: 'pat_smith', hunt: 'quiet_otter' })
    expect(Adopt.huntAt('/~pat_smith/quiet_otter')).to.deep.eq({ org: 'pat_smith', hunt: 'quiet_otter' })
  })

  it("refuses what is not a hunt's address: an org, a quiz, an address with no org", () => {
    for (const raw of ['~pat_smith', '~pat_smith/quiet_otter/quizzes/home/legends', 'pat_smith/quiet_otter', '~pat_smith/Quiet Otter']) {
      expect(() => Adopt.huntAt(raw)).to.throw(JanitorStop, /is not a hunt's address/)
    }
  })
})

describe('requestFrom', () => {
  it("reads the Coach's command line", () => {
    expect(Adopt.requestFrom(CoachArgv)).to.deep.eq({ find: { email: 'flip@example.com' }, userlabel: 'mrflip', admin: true, grants: [{ role: 'smith', hunts: 'every' }] })
  })

  it('finds the user by its userlabel or its id, and asks nothing else unless told', () => {
    expect(Adopt.requestFrom(['--holding', 'flippy_kromer'])).to.deep.eq({ find: { userlabel: 'flippy_kromer' }, grants: [] })
    expect(Adopt.requestFrom(['--id', UserId])).to.deep.eq({ find: { user_id: UserId }, grants: [] })
  })

  it('reads a title, a cleared admin flag, and grants on hunts by address, smiths first', () => {
    const argv = ['--holding', 'flippy_kromer', '--title', 'Flip', '--no-admin', '--reviewer', '~pat_smith/loud_heron', '--smith', '~mrflip/quiet_otter', '--reviewer-all', '--smith', '/~mrflip/brisk_finch']
    expect(Adopt.requestFrom(argv)).to.deep.eq({
      find:   { userlabel: 'flippy_kromer' },
      title:  'Flip',
      admin:  false,
      grants: [
        { role: 'smith',    hunts: { org: 'mrflip', hunt: 'quiet_otter' } },
        { role: 'smith',    hunts: { org: 'mrflip', hunt: 'brisk_finch' } },
        { role: 'reviewer', hunts: 'every' },
        { role: 'reviewer', hunts: { org: 'pat_smith', hunt: 'loud_heron' } },
      ],
    })
  })

  const Refused: [string[], RegExp, string][] = [
    [[],                                                     /Name the user one way/,  'no way to find the user'],
    [['--email', 'flip@example.com', '--holding', 'mrflip'], /Name the user one way/,  'two ways to find the user'],
    [['--holding', 'mrflip', '--admin', '--no-admin'],       /not both/,               'both --admin and --no-admin'],
    [['--holding', 'mrflip', '--smith-everything'],          /Unknown option/,         'a flag it does not take'],
    [['--holding', 'mrflip', 'quiet_otter'],                 /positional/,             'a word that is no flag'],
    [['--holding'],                                          /argument missing/,       'a flag missing its value'],
    [['--holding', 'mrflip', '--smith', '~mrflip'],          /is not a hunt's address/, "a hunt's address that is an org's"],
  ]
  for (const [argv, said, describes] of Refused) {
    it(`stops for ${describes}`, () => {
      expect(() => Adopt.requestFrom(argv)).to.throw(JanitorStop, said)
    })
  }
})

describe('userLine', () => {
  it("reads the doc block's examples, naming the user by its Google name and when it was made", () => {
    expect(Adopt.userLine({ user_id: UserId, userlabel: 'flippy_kromer', title: 'Flip', anonymous: false, admin: false, name: 'Flip Kromer', created_at: MadeAt, email_verified_at: MadeAt })).to.eq(`The user ${UserId}: @flippy_kromer (Flip), signed in with Google as "Flip Kromer", not an admin; made 2026-10-12T14:03:07.000Z; email verified 2026-10-12T14:03:07.000Z.`)
    expect(Adopt.userLine({ user_id: UserId, userlabel: 'flippy_kromer', title: 'Flip', anonymous: false, admin: false, name: 'Flip Kromer', created_at: MadeAt, email_verified_at: null })).to.match(/; email not verified\.$/)
    expect(Adopt.userLine({ user_id: UserId, userlabel: null, title: null, anonymous: true, admin: false, name: null, created_at: MadeAt, email_verified_at: null })).to.eq(`The user ${UserId}: no userlabel, anonymous, not an admin; made 2026-10-12T14:03:07.000Z.`)
  })

  it('says when the user is an admin', () => {
    expect(Adopt.userLine({ user_id: UserId, userlabel: 'mrflip', title: 'Flip', anonymous: false, admin: true, name: 'Flip Kromer', created_at: MadeAt, email_verified_at: null })).to.match(/, an admin; made /)
  })

  it('says when Google sent no name', () => {
    expect(Adopt.userLine({ user_id: UserId, userlabel: 'mrflip', title: 'Flip', anonymous: false, admin: false, name: null, created_at: MadeAt, email_verified_at: null })).to.match(/signed in with Google with no name sent, not an admin/)
  })
})

describe('changeLine', () => {
  const ChangeCases: [Parameters<typeof Adopt.changeLine>[0], string, string][] = [
    [{ kind: 'userlabel', from: null, to: 'mrflip', title: 'Mrflip', huntships: 0, leaves: null },                "  userlabel mrflip, titled \"Mrflip\" (it held none)",                                           'a first userlabel'],
    [{ kind: 'userlabel', from: 'flippy_kromer', to: 'mrflip', title: 'Flip', huntships: 2, leaves: 'free' },     "  userlabel mrflip, titled \"Flip\" (it held flippy_kromer), and the copies on its 2 huntships; flippy_kromer is left free for anyone to claim", 'a userlabel in place of another, its copies rewritten, the old one left free'],
    [{ kind: 'userlabel', from: 'flippy_kromer', to: 'mrflip', title: 'Flip', huntships: 2, leaves: 'address' },  "  userlabel mrflip, titled \"Flip\" (it held flippy_kromer), and the copies on its 2 huntships; flippy_kromer stays held by its hunts' address, ~flippy_kromer/…, so only this command gives it out", "a userlabel in place of another, the old one still a hunt's address"],
    [{ kind: 'userlabel', from: 'flippy_kromer', to: 'flippy_kromer', title: 'Flip', huntships: 0, leaves: null }, "  userlabel flippy_kromer, titled \"Flip\" (it held flippy_kromer)",                            'a retitle, the userlabel kept'],
    [{ kind: 'admin', to: true },                                                                   "  an admin",                                                                                     'the flag set'],
    [{ kind: 'admin', to: false },                                                                  "  no longer an admin",                                                                           'the flag cleared'],
    [{ kind: 'huntship', org: 'pat_smith', hunt: 'quiet_otter', role: 'smith', from: 'reviewer' }, "  Smith of ~pat_smith/quiet_otter (a Reviewer there until now)",                               'a reviewer made a smith'],
    [{ kind: 'huntship', org: 'mrflip', hunt: 'quiet_otter', role: 'reviewer', from: null },       "  Reviewer of ~mrflip/quiet_otter",                                                              'a new place on a hunt'],
  ]
  for (const [change, expected, describes] of ChangeCases) {
    it(`says ${describes}`, () => {
      expect(Adopt.changeLine(change)).to.eq(expected)
    })
  }
})

describe('outcomeLines', () => {
  it('says there is nothing to change, and how much was held already', () => {
    expect(Adopt.outcomeLines({ ...CoachAdopted, changes: [], kept: 4 }, true).slice(1)).to.deep.eq(['Nothing to change.', 'Held already: 4 of what was asked.'])
  })

  it('says nothing of what was held when nothing was', () => {
    expect(Adopt.outcomeLines({ ...CoachAdopted, kept: 0 }, true).at(-1)).to.eq('  Smith of ~pat_smith/loud_heron (a Reviewer there until now)')
  })

  it("says how many anonymous users' sandboxes a grant on every hunt passed over", () => {
    expect(Adopt.outcomeLines({ ...CoachAdopted, skipped: 2 }, false).slice(-2)).to.deep.eq(['Held already: 1 of what was asked.', "Passed over 2 anonymous users' sandboxes, which sealing keeps their own."])
    expect(Adopt.outcomeLines({ ...CoachAdopted, changes: [], kept: 0, skipped: 1 }, true).slice(1)).to.deep.eq(['Nothing to change.', "Passed over 1 anonymous user's sandbox, which sealing keeps its own."])
  })
})

describe('adopt', () => {
  it('on a dry run, asks adopt:plan, says where it is aimed, what would change, and how to act', () => {
    const { run, calls } = fakeDeployment(CoachAdopted)
    expect(said(CoachArgv, run)).to.deep.eq([
      'Aimed at 127.0.0.1:3431 (http://127.0.0.1:3431): a dry run, which changes nothing.',
      `The user ${UserId}: no userlabel, signed in with Google as "Flip Kromer", not an admin; made 2026-10-12T14:03:07.000Z; email verified 2026-10-12T14:03:07.000Z.`,
      'Would change it to:',
      '  userlabel mrflip, titled "Mrflip" (it held none)',
      '  an admin',
      '  Smith of ~mrflip/quiet_otter',
      '  Smith of ~pat_smith/loud_heron (a Reviewer there until now)',
      'Held already: 1 of what was asked.',
      'A dry run: nothing was changed. To act on 127.0.0.1:3431, run again with --deployment 127.0.0.1:3431.',
    ])
    expect(calls).to.deep.eq([['adopt:plan', Adopt.requestFrom(CoachArgv)]])
  })

  it('named at the deployment it reaches, asks adopt:perform, and says what changed', () => {
    const { run, calls } = fakeDeployment(CoachAdopted)
    const lines = said([...CoachArgv, '--deployment', '127.0.0.1:3431'], run)
    expect([lines[0], lines[2], lines.at(-1)]).to.deep.eq(['Aimed at 127.0.0.1:3431 (http://127.0.0.1:3431), as --deployment names it: acting.', 'Changed it to:', 'Held already: 1 of what was asked.'])
    expect(calls.map(([fnpath]) => fnpath)).to.deep.eq(['adopt:perform'])
  })

  it('stops before asking anything when named at another deployment, or given what it does not take', () => {
    const { run, calls } = fakeDeployment(CoachAdopted)
    expect(() => said([...CoachArgv, '--deployment', 'careful-otter-123'], run)).to.throw(JanitorStop, /reaches 127\.0\.0\.1:3431/)
    expect(() => said(['--admin'], run)).to.throw(JanitorStop, /Name the user one way/)
    expect(calls).to.deep.eq([])
  })

  it('refuses an answer not shaped as an adoption', () => {
    const { run } = fakeDeployment({ ...CoachAdopted, kept: -1 })
    expect(() => said(CoachArgv, run)).to.throw(Z.ZodError)
  })
})
