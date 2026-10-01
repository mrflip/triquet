import * as PA from '../vv/patterns'
import { AskContract, type AskReplyT } from './contract'
import type { IshItemT } from '../../models/ish'

/**
 * `text`, cut to what a textish field holds, and otherwise untouched.
 *
 * @example clipText('x'.repeat(5000)).length  // => 3600
 */
export function clipText(text: string): string {
  return text.slice(0, PA.Textish.max)
}

/**
 * A model's reply made ready to keep: every string it wrote clipped to length, then held to the
 * contract the browser relies on.
 *
 * Nothing is trimmed or cleaned. A reply the contract refuses -- a control character in an
 * answer is the likely one, and a sign somebody is probing -- becomes an unreadable failure
 * rather than something stored.
 *
 * @param reply - What the route put together from the model's answer.
 * @returns The reply, clipped and checked; or an unreadable failure.
 *
 * @example vetReply({ ok: true, job: 'guess', text: 'Le\u{1}on', ... })  // => { ok: false, failurekind: 'unreadable' }
 */
export function vetReply(reply: AskReplyT): AskReplyT {
  const checked = AskContract.askReply.safeParse(clipReply(reply))
  if (checked.success) { return checked.data }
  console.warn('A model reply was refused before it could be kept', checked.error.issues)
  return { ok: false, failurekind: 'unreadable' }
}

/** Every string the model wrote in `reply`, clipped */
function clipReply(reply: AskReplyT): AskReplyT {
  if (! reply.ok) { return reply }
  switch (reply.job) {
  case 'guess': {
    return { ...reply, text: clipText(reply.text) }
  }
  case 'ishes': {
    return { ...reply, items: clipItems(reply.items) }
  }
  }
}

/** Each span's text, clipped */
function clipItems(items: readonly IshItemT[]): IshItemT[] {
  return items.map((item) => ({ ...item, text: clipText(item.text) }))
}
