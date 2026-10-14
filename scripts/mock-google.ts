/**
 * A stand-in for Google's sign-in, for the e2e suite: an OpenID Connect issuer on this machine
 * (`oauth2-mock-server`), with Google's shape of discovery, keys, consent and token exchange, so a
 * spec can sign in with Google all the way through: the browser sent to the issuer and back, and
 * the Convex backend exchanging the code with it, as it would with Google.
 *
 * An e2e role's backend signs in with it (`scripts/convex_dev`), in place of Google: the issuer's
 * address (`TRIQUET_MOCK_GOOGLE_ISSUER`, which `convex/auth.ts` honours only on a local backend)
 * and Google keys of its own, which are no secret. It listens on the role's issuer port in this
 * checkout's lane (`scripts/lanes.ts`), so lanes never meet.
 *
 * Who signs in is the spec's to say, one sign-in at a time: the browser carries a header naming the
 * account (`SignInHeader`, written by `encodeSignIn`) to the issuer's consent step, and the issuer
 * answers as that account, or as Google does when its consent is refused. A sign-in that names none
 * is a fresh account nobody has used.
 *
 *   node scripts/mock-google.ts serve <role>   serve the role's issuer in this checkout's lane, until stopped
 *   node scripts/mock-google.ts env <role>     NAME=value lines for the role's backend: the issuer's address, and its Google keys
 */
import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { Events, OAuth2Server, type MutableRedirectUri, type MutableResponse, type MutableToken, type TokenRequestIncomingMessage } from 'oauth2-mock-server'
import * as Z from 'zod'
import * as Lanes from './lanes.ts'

/** What the stand-in's Google keys call the app: Google's client id, a placeholder that grants nothing */
export const MockClientId = 'triquet-e2e-mock-google'

/** Google's client secret, for the stand-in: a placeholder, which it never checks */
export const MockClientSecret = 'not-a-secret-mock-google'

/** The request header a browser carries to the issuer's consent step, saying how to answer it (`encodeSignIn`) */
export const SignInHeader = 'x-triquet-mock-google'

/**
 * A stand-in Google account: the claims its ID token carries, as Google's would. The app keeps what
 * `googleProfileOf` (`convex/auth.ts`) keeps of them: the email, whether it is verified, the name,
 * picture, locale and Workspace domain (`hd`); `sub` names the account.
 */
export const MockAccount = Z.object({
  sub:            Z.string().min(1),
  email:          Z.email(),
  email_verified: Z.boolean(),
  name:           Z.string(),
  picture:        Z.url().optional(),
  locale:         Z.string().optional(),
  hd:             Z.string().optional(),
})

export type MockAccountT = Z.infer<typeof MockAccount>

/**
 * How the stand-in answers one sign-in: signed in as `account`, or refused at its consent step,
 * sending the browser back with `error=access_denied`, as Google does when someone says no.
 */
export const MockSignIn = Z.discriminatedUnion('kind', [
  Z.object({ kind: Z.literal('account'), account: MockAccount }),
  Z.object({ kind: Z.literal('refused') }),
])

export type MockSignInT = Z.infer<typeof MockSignIn>

/**
 * A stand-in Google account nobody has used: a fresh `sub` and email, verified, with `overrides`
 * laid over it.
 *
 * @example freshMockAccount()                          // => { sub: 'mock_5f0c…', email: 'mock_5f0c…@example.com', email_verified: true, name: 'Mock 5f0c…' }
 * @example freshMockAccount({ email_verified: false })  // => the same, its email unverified
 */
export function freshMockAccount(overrides: Partial<MockAccountT> = {}): MockAccountT {
  const tail = randomUUID().replaceAll('-', '').slice(0, 12)
  return { sub: `mock_${tail}`, email: `mock_${tail}@example.com`, email_verified: true, name: `Mock ${tail}`, ...overrides }
}

/**
 * The header value that tells the stand-in how to answer a sign-in: JSON, in base64url, as a
 * header holds only plain characters and a name may hold any.
 *
 * @example encodeSignIn({ kind: 'refused' })  // => 'eyJraW5kIjoicmVmdXNlZCJ9'
 */
export function encodeSignIn(said: MockSignInT): string {
  return Buffer.from(JSON.stringify(said), 'utf8').toString('base64url')
}

/**
 * How a sign-in asked to be answered, read from its header's value; null where it carried none.
 *
 * @throws For a value that is not one `encodeSignIn` writes: a spec's mistake, said at once.
 *
 * @example decodeSignIn('eyJraW5kIjoicmVmdXNlZCJ9')  // => { kind: 'refused' }
 * @example decodeSignIn(undefined)                   // => null
 */
export function decodeSignIn(val: string | string[] | undefined): MockSignInT | null {
  if (val === undefined) { return null }
  const said = Array.isArray(val) ? val.join('') : val
  return MockSignIn.parse(JSON.parse(Buffer.from(said, 'base64url').toString('utf8')))
}

/**
 * Settle the consent step's answer, in the address the browser is about to be sent back to: for a
 * refusal, Google's error in place of the code; otherwise the code stays, and the account it is
 * for is held against it (`accountsByCode`) until its token is made, a fresh one where none was
 * named.
 *
 * @param redirect - The address the issuer sends the browser back to, holding the code; changed in place.
 * @param said - How the sign-in asked to be answered (`decodeSignIn`), or null.
 * @param accountsByCode - The accounts waiting for their codes to be exchanged; added to.
 *
 * @example answerConsent(new URL('http://127.0.0.1:3543/api/auth/callback/google?code=c1&state=s'), { kind: 'refused' }, accounts)
 *   // the address becomes '…/api/auth/callback/google?state=s&error=access_denied'
 */
export function answerConsent(redirect: URL, said: MockSignInT | null, accountsByCode: Map<string, MockAccountT>): void {
  const code = redirect.searchParams.get('code')
  if (code === null) { return }
  if (said?.kind === 'refused') {
    redirect.searchParams.delete('code')
    redirect.searchParams.set('error', 'access_denied')
    return
  }
  accountsByCode.set(code, said?.account ?? freshMockAccount())
}

/**
 * The stand-in's address, as the backend names its issuer and the issuer names itself in every
 * token. On 127.0.0.1, as the backends are, never `localhost`, which may also mean `::1`.
 *
 * @example issuerUrlFor(3643)  // => 'http://127.0.0.1:3643'
 */
export function issuerUrlFor(port: number): string {
  return `http://127.0.0.1:${String(port)}`
}

/**
 * The settings that point a backend's Google sign-in at the stand-in on `port`: its address and
 * Google keys of its own.
 *
 * @example backendEnvFor(3643)  // => { AUTH_GOOGLE_ID: 'triquet-e2e-mock-google', AUTH_GOOGLE_SECRET: 'not-a-secret-mock-google', TRIQUET_MOCK_GOOGLE_ISSUER: 'http://127.0.0.1:3643' }
 */
export function backendEnvFor(port: number): Record<string, string> {
  return { AUTH_GOOGLE_ID: MockClientId, AUTH_GOOGLE_SECRET: MockClientSecret, TRIQUET_MOCK_GOOGLE_ISSUER: issuerUrlFor(port) }
}

/**
 * Start the stand-in on 127.0.0.1 at `port` (0 for any free one), signing its tokens with a key it
 * makes now. Each consent step is answered as its header says (`answerConsent`), and the token made
 * for its code carries that account's claims.
 *
 * @returns The running server: its address is `issuerUrlFor(server.address().port)`; stop it with `stop()`.
 */
export async function serveMockGoogle(port: number): Promise<OAuth2Server> {
  const server = new OAuth2Server()
  await server.issuer.keys.generate('RS256')
  const accountsByCode = new Map<string, MockAccountT>()
  server.service.on(Events.BeforeAuthorizeRedirect, (redirect: MutableRedirectUri, req: IncomingMessage) => {
    answerConsent(redirect.url, decodeSignIn(req.headers[SignInHeader]), accountsByCode)
  })
  server.service.on(Events.BeforeTokenSigning, (token: MutableToken, req: TokenRequestIncomingMessage) => {
    const account = accountsByCode.get(req.body.code ?? '')
    if (account) { Object.assign(token.payload, account) }
  })
  server.service.on(Events.BeforeResponse, (_response: MutableResponse, req: TokenRequestIncomingMessage) => {
    accountsByCode.delete(req.body.code ?? '')
  })
  await server.start(port, '127.0.0.1')
  server.issuer.url = issuerUrlFor(server.address().port)
  return server
}

const Usage = `Usage: node scripts/mock-google.ts serve | env <role>, with <role> one of ${Object.keys(Lanes.RoleDigits).join(', ')}`

/** The role named on the command line, and its issuer's port in this checkout's lane */
function portFor(rolename: string | undefined): number {
  if (rolename === undefined || ! Lanes.isRole(rolename)) { throw new Error(Usage) }
  return Lanes.portsOf(rolename, Lanes.laneHere(process.env, process.cwd())).issuer
}

if (import.meta.main) {
  const [command, rolename] = process.argv.slice(2)
  try {
    if (command === 'env') {
      const lines = Object.entries(backendEnvFor(portFor(rolename))).map(([envname, val]) => `${envname}=${val}`)
      process.stdout.write(`${lines.join('\n')}\n`)
    } else if (command === 'serve') {
      const server = await serveMockGoogle(portFor(rolename))
      process.stdout.write(`A stand-in for Google answers at ${String(server.issuer.url)}\n`)
      const stop = () => { void server.stop() }
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
    } else {
      throw new Error(Usage)
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
