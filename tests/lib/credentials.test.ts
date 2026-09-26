import * as Z from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Credentials from '../../src/lib/credentials'

/** Whatever `attempt` throws, or null when it does not */
function failureOf(attempt: () => unknown): unknown {
  try {
    attempt()
    return null
  } catch (err) {
    return err
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Credentials.get', () => {
  it('hands back the value of the service\'s environment variable, untouched', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', ' sk-test ')
    expect(Credentials.get('claude')).to.eq(' sk-test ')
  })

  it('says which variable to set when there is nothing, and never anything else', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(() => Credentials.get('claude')).to.throw('No credentials for "claude": ANTHROPIC_API_KEY is not set')
  })

  it('does not put a credential in the error it throws for the wrong service', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-secret')
    const failure = failureOf(() => Credentials.get('gemini'))
    expect(failure).to.be.instanceOf(Z.ZodError)
    expect(String(failure)).not.to.contain('sk-secret')
  })

  const Unknown: [string, string][] = [
    ['gemini', 'a service we have no variable for'],
    ['Claude', 'the right service in the wrong case'],
    ['',       'nothing at all'],
    ['constructor', 'a name that only exists on every object'],
  ]
  for (const [servicelabel, describes] of Unknown) {
    it(`refuses ${describes}`, () => {
      expect(() => Credentials.get(servicelabel)).to.throw(Z.ZodError)
    })
  }

  it('refuses to run in a browser', () => {
    vi.stubGlobal('window', {})
    expect(() => Credentials.get('claude')).to.throw('only available on the server')
  })
})

describe('Credentials.has', () => {
  const Cases: [string | undefined, boolean, string][] = [
    ["sk-test",       true,   'a value is set: credentials exist'],
    [undefined,       false,  'the variable is unset: no credentials'],
    ["",              false,  'the variable is empty: no credentials'],
    [" ".repeat(3),   false,  'the variable is only whitespace: no credentials'],
  ]
  for (const [envval, expected, describes] of Cases) {
    it(describes, () => {
      if (envval === undefined) { vi.stubEnv('ANTHROPIC_API_KEY', undefined) } else { vi.stubEnv('ANTHROPIC_API_KEY', envval) }
      expect(Credentials.has('claude')).to.eq(expected)
    })
  }

  it('refuses a service we have never heard of, rather than quietly saying no', () => {
    expect(() => Credentials.has('gemini')).to.throw(Z.ZodError)
  })

  it('refuses to run in a browser', () => {
    vi.stubGlobal('window', {})
    expect(() => Credentials.has('claude')).to.throw('only available on the server')
  })
})
