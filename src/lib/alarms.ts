import * as Postmortem from './postmortem'
import { noticeOf } from './refusals'

/**
 * A failure the author must see wherever they are on the page: raised app-wide, and shown until
 * they dismiss it. What failed, why, and, when the failure was not one the server meant, the
 * request to send us.
 */
export type AlarmT = {
  /** What failed, in a few words */
  headline:   string
  /** Why, as a sentence: a notice */
  notice:     string
  /** Convex's id for the failed call, to find it in the logs; null for a refusal, which says its own reason */
  request_id: string | null
}

/**
 * The alarm to raise for `err`: its notice, and, unless the server refused on purpose, the
 * request it was.
 *
 * @param headline - What failed, in a few words.
 * @param err - What the call rejected with.
 * @returns The alarm.
 *
 * @example of(AppNotices.changeNotKept, refusal).notice  // => 'This quiz is locked — unlock it to change it.'
 * @example of(AppNotices.changeNotKept, hiddenServerError).request_id  // => '5c0f9a'
 */
export function of(headline: string, err: unknown): AlarmT {
  const postmortem = Postmortem.of(err)
  return { headline, notice: noticeOf(err), request_id: postmortem.refused ? null : postmortem.request_id }
}
