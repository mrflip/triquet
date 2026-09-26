/** Every player there is: the hasty guesser, and the number spotter */
export const PlayerLabelVals = ['dumdum', 'numnum'] as const
export type PlayerLabel = typeof PlayerLabelVals[number]
