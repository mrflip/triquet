import { eq } from 'drizzle-orm'
import { players } from './schema'
import { renderPrompt } from '../lib/ask/prompts'
import type { Db } from './client'
import type { PlayerLabel, PlayerT, Promptkind } from '../models/player'

/**
 * One player, as the database holds it.
 *
 * @param db - Where the players are kept.
 * @param label - Which player.
 * @returns The player.
 * @throws When the database holds no such player, which `openDb` never allows.
 *
 * @example (await playerFor(db, 'dumdum')).model_tier  // => 'quick'
 */
export async function playerFor(db: Db, label: PlayerLabel): Promise<PlayerT> {
  const [player] = await db.select().from(players).where(eq(players.label, label))
  if (! player) { throw new Error(`No player "${label}" in the database`) }
  return player
}

/**
 * The prompt `player` is given for one kind of text, filled in.
 *
 * @param player - Who is being asked.
 * @param promptkind - What they are being shown.
 * @param fills - Placeholder name to text, without the braces.
 * @returns The prompt as it will be sent.
 * @throws When the player is never asked about that kind of text.
 *
 * @example promptFor(dumdum, 'clueing', { clueing: 'Who?' })
 */
export function promptFor(player: PlayerT, promptkind: Promptkind, fills: Record<string, string>): string {
  const template = player.prompts[promptkind]
  if (template === undefined) { throw new Error(`Player "${player.label}" has no ${promptkind} prompt`) }
  return renderPrompt(template, fills)
}
