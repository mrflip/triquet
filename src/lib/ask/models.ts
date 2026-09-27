import type { ModelTier } from '../../models/ask'
import type { BotLabel } from '../../models/bot'
import type { AskRequestT } from './contract'

/**
 * Which model answers for each tier.
 *
 * The two tiers are a feature, not a cost dodge. The ambiguity guess wants a fast, literal
 * first instinct, and spending a careful model on it would answer the wrong question -- the
 * author already knows the careful answer. Extraction is the opposite: catching a spelled-out
 * numeral in French or a magnitude phrase is worth the extra cost.
 */
export const ModelForTier: Record<ModelTier, string> = {
  quick:   'claude-haiku-4-5',
  careful: 'claude-opus-5',
}

/** How much room each job is given to answer */
export const MaxTokensForJob = {
  guess:      256,
  ishes:      4000,
  bulk_ishes: 32_000,
} as const

/** Which bot each job is put to */
export const BotForJob = {
  guess:      'dumdum',
  ishes:      'numnum',
  bulk_ishes: 'numnum',
} as const satisfies Record<AskRequestT['job'], BotLabel>
