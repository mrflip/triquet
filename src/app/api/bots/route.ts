import { botStatuses } from '../../../lib/ask/bots'
import { BotStatusValidators } from '../../../models/bot-status'

/**
 * Every bot, and whether it can play right now.
 *
 * The browser cannot know whether the server holds credentials, and must never be told what
 * they are -- only whether they exist, so a cell can say so calmly instead of failing when it
 * is double-clicked.
 */
export function GET(): Response {
  const bots = botStatuses()
  return Response.json(BotStatusValidators.botStatuses({ bots }))
}
