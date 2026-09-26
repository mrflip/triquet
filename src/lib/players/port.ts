import { PlayerStatusValidators, type PlayerStatusT } from '../../models/player-status'

/** Where the browser asks which players can play */
export const PlayersRoutepath = '/api/players'

/**
 * Every player, and whether it can play, from the server.
 *
 * Never throws. When the server cannot be reached, or answers with something unrecognisable,
 * nothing is known, and nothing is known to be wrong: an empty list means no cell is held back,
 * and an ask that cannot be served says so in its own words.
 *
 * @returns One status per player, or an empty list.
 *
 * @example (await fetchPlayerStatuses()).find((status) => status.label === 'dumdum')?.credentialed
 */
export async function fetchPlayerStatuses(): Promise<PlayerStatusT[]> {
  try {
    const answer = await fetch(PlayersRoutepath, { cache: 'no-store' })
    const parsed = PlayerStatusValidators.playerStatuses.safeParse(await answer.json())
    return parsed.success ? parsed.data.players : []
  } catch {
    return []
  }
}
