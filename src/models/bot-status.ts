import * as Z from 'zod'
import { Validator } from '../lib/validator'

export const BotStatusValidators = Validator(({ obj, arr, str, titleish, bool }) => {
  const botStatus = obj({
    label:        str.min(1)
      .describe('Which bot, as `bots.label` has it.'),
    title:        titleish
      .describe('What the author sees the bot called.'),
    servicelabel: str.min(1)
      .describe('Which outside service serves the bot.'),
    credentialed: bool
      .describe('Whether the server holds credentials for that service, and so whether the bot can play at all. Says nothing about the credentials themselves.'),
  })
    .describe('One bot, and whether it can play right now. Deliberately loose about labels: this crosses to the browser, which only compares them and has no use for the lists behind them.')

  const botStatuses = obj({ bots: arr(botStatus) })
    .describe('What the bots route answers: every bot, with whether each can play.')

  return { botStatus, botStatuses }
})

export type BotStatusT   = Z.output<typeof BotStatusValidators.botStatus>
export type BotStatusesT = Z.output<typeof BotStatusValidators.botStatuses>
