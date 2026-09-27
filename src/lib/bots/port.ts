import { BotStatusValidators, type BotStatusT } from '../../models/bot-status'

/** Where the browser asks which bots can play */
export const BotsRoutepath = '/api/bots'

/**
 * Every bot, and whether it can play, from the server.
 *
 * Never throws. When the server cannot be reached, or answers with something unrecognisable,
 * nothing is known, and nothing is known to be wrong: an empty list means no cell is held back,
 * and an ask that cannot be served says so in its own words.
 *
 * @returns One status per bot, or an empty list.
 *
 * @example (await fetchBotStatuses()).find((status) => status.label === 'dumdum')?.credentialed
 */
export async function fetchBotStatuses(): Promise<BotStatusT[]> {
  try {
    const answer = await fetch(BotsRoutepath, { cache: 'no-store' })
    const parsed = BotStatusValidators.botStatuses.safeParse(await answer.json())
    return parsed.success ? parsed.data.bots : []
  } catch {
    return []
  }
}
