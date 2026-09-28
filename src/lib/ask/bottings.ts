import { AskFailureNotices } from '../notices'
import type { AskFailedT, BulkReplyT, GuessReplyT, IshesReplyT, Textkind } from './contract'
import type { BotLabel } from '../../models/bot-label'
import type { BottingRowDNA } from '../../models/botting'
import type { IshItemT } from '../../models/ish'

/** Which cell a reply lands in: the question, the bot, which of its texts was put, and that text as put */
export type AskedCell = {
  question_id: string
  bot_label:   BotLabel
  textkind:    Textkind
  /** The text exactly as put to the bot, trimmed */
  asked_text:  string
}

/** A botting of `cell` with nothing filled in yet */
function blank(cell: Readonly<AskedCell>): BottingRowDNA {
  return {
    ...cell,
    status:             'done',
    reply_text:         null,
    items:              [],
    message:            null,
    response:           null,
    truncated:          false,
    model_tier_applied: null,
    approx_tokens:      null,
  }
}

/**
 * A bot's answer to one text, as the botting to record: dumdum's reply as its text, numnum's as
 * its spans.
 *
 * @param cell - Where it lands.
 * @param reply - What came back.
 * @returns The botting, ready to send.
 *
 * @example bottingFor(cell, { ok: true, job: 'guess', text: 'Leon', ... }).reply_text  // => 'Leon'
 */
export function bottingFor(cell: Readonly<AskedCell>, reply: GuessReplyT | IshesReplyT): BottingRowDNA {
  const answered = { ...blank(cell), truncated: reply.truncated, model_tier_applied: reply.model_tier_applied, approx_tokens: reply.approx_tokens }
  return reply.job === 'guess' ? { ...answered, reply_text: reply.text } : { ...answered, items: reply.items }
}

/**
 * One text's share of a combined run, as the botting to record: its spans, and what the run
 * said of the whole. No token figure: one shared cost split many ways would be an invented
 * number, and the real figure lives on the run.
 *
 * @param cell - Where it lands.
 * @param items - The spans the run found in this text.
 * @param reply - The run's reply as a whole.
 * @returns The botting, ready to send.
 */
export function bulkBottingFor(cell: Readonly<AskedCell>, items: readonly IshItemT[], reply: Pick<BulkReplyT, 'truncated' | 'model_tier_applied'>): BottingRowDNA {
  return { ...blank(cell), items: [...items], truncated: reply.truncated, model_tier_applied: reply.model_tier_applied }
}

/**
 * A failed ask, as the botting to record: the author's sentence for it, and the reply as it
 * came back. It never replaces what the cell held; it rides along until a success clears it.
 *
 * @param cell - Where it lands.
 * @param failed - The failed reply.
 * @returns The botting, ready to send.
 *
 * @example failedBottingFor(cell, { ok: false, failurekind: 'rateLimited' }).message  // => 'Too many requests right now — try again shortly.'
 */
export function failedBottingFor(cell: Readonly<AskedCell>, failed: AskFailedT): BottingRowDNA {
  return { ...blank(cell), status: 'error', message: AskFailureNotices[failed.failurekind], response: failed }
}
