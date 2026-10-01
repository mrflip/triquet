import type { AskFailedT, AskReplyT } from './contract'

/** Which job a reply is expected to be an answer to */
export type Askjob = Exclude<AskReplyT, AskFailedT>['job']

/**
 * The failure `reply` amounts to for an ask of `job`, or null when it is the answer wanted.
 *
 * A reply that is a success, but for some other job, is a failure of a kind: an answer this
 * build could not read.
 *
 * @param reply - What came back.
 * @param job - What was asked for.
 * @returns The failed reply to record, or null.
 *
 * @example failureOf({ ok: false, failurekind: 'connection' }, 'guess')  // => that same reply
 */
export function failureOf(reply: AskReplyT, job: Askjob): AskFailedT | null {
  if (! reply.ok) { return reply }
  return reply.job === job ? null : { ok: false, failurekind: 'unreadable' }
}
