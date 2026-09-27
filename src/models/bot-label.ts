/** Every bot there is: the hasty guesser, and the number spotter */
export const BotLabelVals = ['dumdum', 'numnum'] as const
export type BotLabel = typeof BotLabelVals[number]
