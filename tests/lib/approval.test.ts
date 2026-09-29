import * as Z from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Approval from '../../src/lib/approval'
import { AuthorizationError } from '../../src/lib/errors'
import { ApprovalNotices } from '../../src/lib/notices'
import type { IdentT } from '../../src/models/ident'

/** Whatever `attempt` throws, or null when it does not */
function failureOf(attempt: () => unknown): unknown {
  try {
    attempt()
    return null
  } catch (err) {
    return err
  }
}

const Mabel = { _id: 'ident_mabel', label: 'mabel_moss', title: 'Mabel Moss' }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Approval.of', () => {
  const Cases: [string | undefined, boolean, string][] = [
    // regular usage:
    ["allow",         true,   'the variable says allow: approved'],
    [undefined,       false,  'the variable is unset: a deployment that has said nothing says no'],
    // near misses, each a way someone might think they had switched it on:
    ["",              false,  'the variable is empty: not approved'],
    ["Allow",         false,  'allow in the wrong case: not approved'],
    [" allow ",       false,  'allow with whitespace around it: not approved'],
    ["true",          false,  'a truthy word that is not allow: not approved'],
    ["1",             false,  'a truthy number: not approved'],
    ["off",           false,  'an explicit off: not approved'],
  ]
  for (const [envval, expected, describes] of Cases) {
    it(describes, () => {
      vi.stubEnv('ENABLE_ANTHROPIC_BOT', envval)
      expect(Approval.of(null, { act: 'anthropic_bot' })).to.eq(expected)
    })
  }

  it('decides the same for any ident, and whatever the request says', () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
    expect(Approval.of(Mabel, { act: 'anthropic_bot' }, { job: 'guess' })).to.eq(true)
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', undefined)
    expect(Approval.of(Mabel, { act: 'anthropic_bot' }, { job: 'guess' })).to.eq(false)
  })

  const Unknown: [unknown, string][] = [
    [{ act: 'openai_bot' },    'an act we have no switch for'],
    [{ act: 'Anthropic_Bot' }, 'the right act in the wrong case'],
    [{},                       'no act at all'],
    [{ act: 'constructor' },   'a name that only exists on every object'],
  ]
  for (const [action, describes] of Unknown) {
    it(`refuses ${describes}, rather than quietly saying no`, () => {
      vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
      expect(() => Approval.of(null, action as Approval.ApprovalActionDNA)).to.throw(Z.ZodError)
    })
  }

  const NotIdents: [unknown, string][] = [
    [{ label: 'mabel_moss', title: 'Mabel Moss' },                 'an ident with no id'],
    [{ _id: 'ident_mabel', label: 'Mabel Moss', title: 'Mabel' },  'an ident whose label is not an ident label'],
    ["mabel_moss",                                                 'a bare label in place of the ident'],
  ]
  for (const [ident, describes] of NotIdents) {
    it(`refuses ${describes}, even when everything is allowed`, () => {
      vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
      expect(() => Approval.of(ident as IdentT, { act: 'anthropic_bot' })).to.throw(Z.ZodError)
    })
  }

  it('takes an ident as the database hands it back, with fields the check does not look at', () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
    expect(Approval.of({ ...Mabel, _creationTime: 1_759_000_000_000 } as IdentT, { act: 'anthropic_bot' })).to.eq(true)
  })

  it('refuses to run in a browser', () => {
    vi.stubGlobal('window', {})
    expect(() => Approval.of(null, { act: 'anthropic_bot' })).to.throw('only decided on the server')
  })
})

describe('Approval.need', () => {
  it('says allow when the act is allowed', () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
    expect(Approval.need(Mabel, { act: 'anthropic_bot' })).to.eq('allow')
  })

  it("declines with the act's polite sentence when it is not", () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', undefined)
    const failure = failureOf(() => { Approval.need(null, { act: 'anthropic_bot' }) })
    expect(failure).to.be.instanceOf(Approval.NotApprovedError)
    expect(failure).to.be.instanceOf(AuthorizationError)
    expect((failure as Approval.NotApprovedError).message).to.eq(ApprovalNotices.anthropic_bot)
    expect((failure as Approval.NotApprovedError).story).to.deep.eq({ action: { act: 'anthropic_bot' }, ident: null })
  })

  it('tells who asked in its story, and keeps what else the request said in the backstory, out of anything serialised', () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'off')
    const failure = failureOf(() => { Approval.need(Mabel, { act: 'anthropic_bot' }, { userAgent: 'curious-crawler' }) }) as Approval.NotApprovedError
    expect(failure.story).to.deep.eq({ action: { act: 'anthropic_bot' }, ident: Mabel })
    expect(failure.backstory).to.deep.eq({ moreinfo: { userAgent: 'curious-crawler' } })
    expect(JSON.stringify(failure)).not.to.contain('curious-crawler')
  })

  it('refuses an act we have no switch for, even when everything is allowed', () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
    expect(() => { Approval.need(null, { act: 'openai_bot' } as unknown as Approval.ApprovalActionDNA) }).to.throw(Z.ZodError)
  })
})
