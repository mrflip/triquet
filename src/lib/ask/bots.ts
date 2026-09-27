import * as Credentials from '../credentials'
import { renderPrompt } from './prompts'
import { SeedBots, type BotLabel, type BotT, type Promptkind } from '../../models/bot'
import type { BotStatusT } from '../../models/bot-status'

/**
 * One bot, as this build briefs it.
 *
 * @param label - Which bot.
 * @returns The bot.
 *
 * @example botFor('dumdum').model_tier  // => 'quick'
 */
export function botFor(label: BotLabel): BotT {
  const bot = SeedBots.find((each) => each.label === label)
  if (! bot) { throw new Error(`No bot "${label}"`) }
  return bot
}

/**
 * The prompt `bot` is given for one kind of text, filled in.
 *
 * @param bot - Who is being asked.
 * @param promptkind - What they are being shown.
 * @param fills - Placeholder name to text, without the braces.
 * @returns The prompt as it will be sent.
 * @throws When the bot is never asked about that kind of text.
 *
 * @example promptFor(botFor('dumdum'), 'clueing', { clueing: 'Who?' })
 */
export function promptFor(bot: BotT, promptkind: Promptkind, fills: Record<string, string>): string {
  const template = bot.prompts[promptkind]
  if (template === undefined) { throw new Error(`Bot "${bot.label}" has no ${promptkind} prompt`) }
  return renderPrompt(template, fills)
}

/**
 * Every bot, and whether the server can let it play: only whether a credential exists for
 * its service, never what it is.
 *
 * @returns One status per bot, in label order.
 *
 * @example botStatuses().map((status) => status.credentialed)  // => [true, true], with a key set
 */
export function botStatuses(): BotStatusT[] {
  return SeedBots
    .toSorted((aa, bb) => aa.label.localeCompare(bb.label))
    .map((bot) => ({
      label:        bot.label,
      title:        bot.title,
      servicelabel: bot.servicelabel,
      credentialed: Credentials.has(bot.servicelabel),
    }))
}
