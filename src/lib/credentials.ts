import { Validator } from './validator'

/** Every outside service the app can hold credentials for */
export const ServicelabelVals = ['claude'] as const
export type Servicelabel = typeof ServicelabelVals[number]

/** Which environment variable holds each service's credential. Doppler fills these; no file in the repo ever does. */
const EnvvarFor: Record<Servicelabel, string> = {
  claude: 'ANTHROPIC_API_KEY',
}

const CredentialsValidators = Validator(({ oneof }) => {
  const servicelabel = oneof(ServicelabelVals)
    .describe('Which outside service a credential is for.')
  return { servicelabel }
})

/**
 * Whether the environment holds a credential for `servicelabel`.
 *
 * Server-only. A credential set to nothing but whitespace counts as absent.
 *
 * @param servicelabel - One of `ServicelabelVals`.
 * @returns True when `get` would succeed.
 * @throws When `servicelabel` names no service we know, or this runs in a browser.
 *
 * @example Credentials.has('claude')  // => false, where ANTHROPIC_API_KEY is not set
 */
export function has(servicelabel: string): boolean {
  return envvalOf(servicelabel) !== undefined
}

/**
 * The credential for `servicelabel`, straight from the environment.
 *
 * Server-only. Never logged and never included in an error: a failure names the variable to
 * set, and nothing else.
 *
 * @param servicelabel - One of `ServicelabelVals`.
 * @returns The credential, exactly as the environment holds it.
 * @throws When `servicelabel` names no service we know, when the environment holds no credential for it, or when this runs in a browser.
 *
 * @example Credentials.get('claude')  // => the value of ANTHROPIC_API_KEY
 */
export function get(servicelabel: string): string {
  const val = envvalOf(servicelabel)
  if (val === undefined) {
    throw new Error(`No credentials for "${servicelabel}": ${EnvvarFor[CredentialsValidators.servicelabel.parse(servicelabel)]} is not set`)
  }
  return val
}

/** The environment's value for `servicelabel`'s variable, or undefined when it is unset or blank */
function envvalOf(servicelabel: string): string | undefined {
  if (typeof window !== 'undefined') { throw new Error('Credentials are only available on the server') }
  const raw = process.env[EnvvarFor[CredentialsValidators.servicelabel.parse(servicelabel)]]
  return raw === undefined || raw.trim() === '' ? undefined : raw
}
