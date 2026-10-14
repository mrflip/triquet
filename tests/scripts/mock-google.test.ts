import { createHash, randomBytes } from 'node:crypto'
import { decodeJwt } from 'jose'
import type { OAuth2Server } from 'oauth2-mock-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as MockGoogle from '../../scripts/mock-google'

/** An account as a spec names one, with every claim the app keeps */
const Ada: MockGoogle.MockAccountT = { sub: '1098', email: 'ada@example.org', email_verified: true, name: 'Ada Lovelace', picture: 'https://example.org/ada.png', locale: 'en-GB', hd: 'example.org' }

describe("MockGoogle.freshMockAccount", () => {
  it("makes an account nobody has used, its email verified", () => {
    const [one, two] = [MockGoogle.freshMockAccount(), MockGoogle.freshMockAccount()]
    expect(one.sub).to.match(/^mock_[0-9a-f]{12}$/)
    expect(one.email).to.eq(`${one.sub}@example.com`)
    expect(one.email_verified).to.be.true
    expect(one.sub).not.to.eq(two.sub)
    expect(MockGoogle.MockAccount.parse(one)).to.deep.eq(one)
  })

  it("lays the overrides over it", () => {
    expect(MockGoogle.freshMockAccount({ email_verified: false }).email_verified).to.be.false
    expect(MockGoogle.freshMockAccount({ name: 'Ada' }).name).to.eq('Ada')
  })
})

describe("MockGoogle.encodeSignIn and decodeSignIn", () => {
  it("write a refusal as base64url JSON", () => {
    expect(MockGoogle.encodeSignIn({ kind: 'refused' })).to.eq('eyJraW5kIjoicmVmdXNlZCJ9')
    expect(MockGoogle.decodeSignIn('eyJraW5kIjoicmVmdXNlZCJ9')).to.deep.eq({ kind: 'refused' })
  })

  it("carry an account through, whatever its name holds", () => {
    const said: MockGoogle.MockSignInT = { kind: 'account', account: { ...Ada, name: 'Ada Lovelace, Countess of Lovelace — “Enchantress of Numbers”' } }
    const header = MockGoogle.encodeSignIn(said)
    expect(header).to.match(/^[A-Za-z0-9_-]+$/)
    expect(MockGoogle.decodeSignIn(header)).to.deep.eq(said)
  })

  it("read no header as nothing said", () => {
    expect(MockGoogle.decodeSignIn(undefined)).to.be.null
  })

  it("refuse a value encodeSignIn never writes", () => {
    expect(() => MockGoogle.decodeSignIn('not-json')).to.throw(SyntaxError)
    expect(() => MockGoogle.decodeSignIn(Buffer.from(JSON.stringify({ kind: 'account', account: { sub: '1' } })).toString('base64url'))).to.throw(/email/)
  })
})

describe("MockGoogle.answerConsent", () => {
  it("puts Google's error in place of the code for a refusal, keeping the state", () => {
    const redirect = new URL('http://127.0.0.1:3543/api/auth/callback/google?code=c1&state=s')
    const accounts = new Map<string, MockGoogle.MockAccountT>()
    MockGoogle.answerConsent(redirect, { kind: 'refused' }, accounts)
    expect(redirect.href).to.eq('http://127.0.0.1:3543/api/auth/callback/google?state=s&error=access_denied')
    expect(accounts.size).to.eq(0)
  })

  it("holds the account named against the code, leaving the address as it was", () => {
    const redirect = new URL('http://127.0.0.1:3543/api/auth/callback/google?code=c1&state=s')
    const accounts = new Map<string, MockGoogle.MockAccountT>()
    MockGoogle.answerConsent(redirect, { kind: 'account', account: Ada }, accounts)
    expect(redirect.searchParams.get('code')).to.eq('c1')
    expect(accounts.get('c1')).to.deep.eq(Ada)
  })

  it("holds a fresh account against the code where none was named", () => {
    const accounts = new Map<string, MockGoogle.MockAccountT>()
    MockGoogle.answerConsent(new URL('http://127.0.0.1:3543/cb?code=c1'), null, accounts)
    expect(accounts.get('c1')?.sub).to.match(/^mock_/)
  })

  it("leaves an address holding no code alone", () => {
    const redirect = new URL('http://127.0.0.1:3543/cb?error=unsupported_response_type')
    const accounts = new Map<string, MockGoogle.MockAccountT>()
    MockGoogle.answerConsent(redirect, { kind: 'refused' }, accounts)
    expect([redirect.href, accounts.size]).to.deep.eq(['http://127.0.0.1:3543/cb?error=unsupported_response_type', 0])
  })
})

describe("MockGoogle.issuerUrlFor and backendEnvFor", () => {
  it("name the stand-in on 127.0.0.1", () => {
    expect(MockGoogle.issuerUrlFor(3643)).to.eq('http://127.0.0.1:3643')
  })

  it("point a backend at it, with keys of its own", () => {
    expect(MockGoogle.backendEnvFor(3643)).to.deep.eq({ AUTH_GOOGLE_ID: 'triquet-e2e-mock-google', AUTH_GOOGLE_SECRET: 'not-a-secret-mock-google', TRIQUET_MOCK_GOOGLE_ISSUER: 'http://127.0.0.1:3643' })
  })
})

/** The verifier a browser keeps for its sign-in, and the challenge it sends Google, as PKCE has them */
function pkcePair(): { verifier: string, challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

describe("MockGoogle.serveMockGoogle", () => {
  let server: OAuth2Server
  let issuer: string

  beforeAll(async () => {
    server = await MockGoogle.serveMockGoogle(0)
    issuer = MockGoogle.issuerUrlFor(server.address().port)
  })
  afterAll(async () => { await server.stop() })

  /** Go through the consent step as a browser would, saying `said`; where it sends the browser back to */
  async function consent(challenge: string, said?: MockGoogle.MockSignInT): Promise<URL> {
    const query = new URLSearchParams({ client_id: MockGoogle.MockClientId, redirect_uri: 'http://127.0.0.1:9/cb', response_type: 'code', scope: 'openid email profile', state: 's1', nonce: 'n1', code_challenge: challenge, code_challenge_method: 'S256' })
    const response = await fetch(`${issuer}/authorize?${query.toString()}`, { redirect: 'manual', headers: said ? { [MockGoogle.SignInHeader]: MockGoogle.encodeSignIn(said) } : {} })
    expect(response.status).to.eq(302)
    return new URL(String(response.headers.get('location')))
  }

  /** Exchange `code` as the backend would; the ID token's claims */
  async function exchange(code: string, verifier: string): Promise<Record<string, unknown>> {
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: 'http://127.0.0.1:9/cb' })
    const basic = Buffer.from(`${MockGoogle.MockClientId}:${MockGoogle.MockClientSecret}`).toString('base64')
    const response = await fetch(`${issuer}/token`, { method: 'POST', body, headers: { Authorization: `Basic ${basic}` } })
    const tokens = await response.json() as { id_token: string }
    return decodeJwt(tokens.id_token)
  }

  it("names itself, in its discovery, at the address the backend is given", async () => {
    const response = await fetch(`${issuer}/.well-known/openid-configuration`)
    const discovered = await response.json() as Record<string, unknown>
    expect([discovered.issuer, discovered.authorization_endpoint, discovered.token_endpoint]).to.deep.eq([issuer, `${issuer}/authorize`, `${issuer}/token`])
  })

  it("signs in as the account the consent step was told of, its ID token carrying the account's claims for our client and nonce", async () => {
    const { verifier, challenge } = pkcePair()
    const back = await consent(challenge, { kind: 'account', account: Ada })
    expect(back.searchParams.get('state')).to.eq('s1')
    const claims = await exchange(String(back.searchParams.get('code')), verifier)
    expect(claims).to.deep.include({ ...Ada, iss: issuer, aud: MockGoogle.MockClientId, nonce: 'n1' })
  })

  it("signs in as a fresh account where the consent step was told of none", async () => {
    const { verifier, challenge } = pkcePair()
    const back = await consent(challenge)
    const claims = await exchange(String(back.searchParams.get('code')), verifier)
    expect(claims.sub).to.match(/^mock_/)
    expect(claims.email_verified).to.be.true
  })

  it("sends the browser back with Google's error, and no code, when consent is refused", async () => {
    const back = await consent(pkcePair().challenge, { kind: 'refused' })
    expect([back.searchParams.get('code'), back.searchParams.get('error'), back.searchParams.get('state')]).to.deep.eq([null, 'access_denied', 's1'])
  })

  it("refuses a code presented with the wrong verifier, as Google does", async () => {
    const back = await consent(pkcePair().challenge, { kind: 'account', account: Ada })
    const body = new URLSearchParams({ grant_type: 'authorization_code', code: String(back.searchParams.get('code')), code_verifier: pkcePair().verifier, redirect_uri: 'http://127.0.0.1:9/cb', client_id: MockGoogle.MockClientId })
    const response = await fetch(`${issuer}/token`, { method: 'POST', body })
    expect(response.ok).to.be.false
  })
})
