import { ServiceStatusValidators, type ServiceStatusT } from '../../models/service-status'

/** Where the browser asks which services can be put a prompt */
export const BotsRoutepath = '/api/bots'

/**
 * Every outside service, and whether it can be asked, from the server.
 *
 * Never throws. When the server cannot be reached, or answers with something unrecognisable,
 * nothing is known, and nothing is known to be wrong: an empty list means no cell is held back,
 * and an ask that cannot be served says so in its own words.
 *
 * @returns One status per service, or an empty list.
 *
 * @example (await fetchServiceStatuses()).find((status) => status.servicelabel === 'claude')?.credentialed
 */
export async function fetchServiceStatuses(): Promise<ServiceStatusT[]> {
  try {
    const answer = await fetch(BotsRoutepath, { cache: 'no-store' })
    const parsed = ServiceStatusValidators.serviceStatuses.safeParse(await answer.json())
    return parsed.success ? parsed.data.services : []
  } catch {
    return []
  }
}
