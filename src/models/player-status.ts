import * as Z from 'zod'
import { Validator } from '../lib/validator'

export const PlayerStatusValidators = Validator(({ obj, arr, str, titleish, bool }) => {
  const playerStatus = obj({
    label:        str.min(1)
      .describe('Which player, as `players.label` has it.'),
    title:        titleish
      .describe('What the author sees the player called.'),
    servicelabel: str.min(1)
      .describe('Which outside service serves the player.'),
    credentialed: bool
      .describe('Whether the server holds credentials for that service, and so whether the player can play at all. Says nothing about the credentials themselves.'),
  })
    .describe('One player, and whether it can play right now. Deliberately loose about labels: this crosses to the browser, which only compares them and has no use for the lists behind them.')

  const playerStatuses = obj({ players: arr(playerStatus) })
    .describe('What the players route answers: every player, with whether each can play.')

  return { playerStatus, playerStatuses }
})

export type PlayerStatusT   = Z.output<typeof PlayerStatusValidators.playerStatus>
export type PlayerStatusesT = Z.output<typeof PlayerStatusValidators.playerStatuses>
