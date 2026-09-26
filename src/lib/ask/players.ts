import * as Credentials from '../credentials'
import { renderPrompt } from './prompts'
import { SeedPlayers, type PlayerLabel, type PlayerT, type Promptkind } from '../../models/player'
import type { PlayerStatusT } from '../../models/player-status'

/**
 * One player, as this build briefs it.
 *
 * @param label - Which player.
 * @returns The player.
 *
 * @example playerFor('dumdum').model_tier  // => 'quick'
 */
export function playerFor(label: PlayerLabel): PlayerT {
  const player = SeedPlayers.find((each) => each.label === label)
  if (! player) { throw new Error(`No player "${label}"`) }
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
 * @example promptFor(playerFor('dumdum'), 'clueing', { clueing: 'Who?' })
 */
export function promptFor(player: PlayerT, promptkind: Promptkind, fills: Record<string, string>): string {
  const template = player.prompts[promptkind]
  if (template === undefined) { throw new Error(`Player "${player.label}" has no ${promptkind} prompt`) }
  return renderPrompt(template, fills)
}

/**
 * Every player, and whether the server can let it play: only whether a credential exists for
 * its service, never what it is.
 *
 * @returns One status per player, in label order.
 *
 * @example playerStatuses().map((status) => status.credentialed)  // => [true, true], with a key set
 */
export function playerStatuses(): PlayerStatusT[] {
  return SeedPlayers
    .toSorted((aa, bb) => aa.label.localeCompare(bb.label))
    .map((player) => ({
      label:        player.label,
      title:        player.title,
      servicelabel: player.servicelabel,
      credentialed: Credentials.has(player.servicelabel),
    }))
}
