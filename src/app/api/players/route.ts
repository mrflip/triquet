import { appDb } from '../../../db/client'
import { playerStatuses } from '../../../db/players'
import { PlayerStatusValidators } from '../../../models/player-status'

/**
 * Every player, and whether it can play right now.
 *
 * The browser cannot know whether the server holds credentials, and must never be told what
 * they are -- only whether they exist, so a cell can say so calmly instead of failing when it
 * is double-clicked.
 */
export async function GET(): Promise<Response> {
  const players = await playerStatuses(await appDb())
  return Response.json(PlayerStatusValidators.playerStatuses({ players }))
}
