import * as Credentials from '../credentials'
import type { ServiceStatusT } from '../../models/service-status'

/**
 * Every outside service, and whether the server can put a prompt to it: only whether a
 * credential exists for it, never what it is.
 *
 * @returns One status per service, in label order.
 *
 * @example serviceStatuses().map((status) => status.credentialed)  // => [true], with a key set
 */
export function serviceStatuses(): ServiceStatusT[] {
  return Credentials.ServicelabelVals.toSorted((aa, bb) => aa.localeCompare(bb)).map((servicelabel) => ({ servicelabel, credentialed: Credentials.has(servicelabel) }))
}
