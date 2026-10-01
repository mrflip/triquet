import * as PA from '../vv/patterns'
import * as UU from '../useful'
import { AskContract, type AskFailedT, type AskReplyT } from './contract'
import type { JsonT } from '../../models/widgeted'

/** A JSON object, as a model's answer must be */
export type AnswerT = Record<string, JsonT>

/** What opens and closes a code fence, which a model wraps its JSON in now and then though asked not to */
const Fence = '```'

/**
 * `text`, cut to what a textish field holds, and otherwise untouched.
 *
 * @example clipText('x'.repeat(5000)).length  // => 3600
 */
export function clipText(text: string): string {
  return text.slice(0, PA.Textish.max)
}

/**
 * The JSON object a model's answer holds, or the failure it amounts to.
 *
 * Space around the object and a code fence around it are forgiven; anything else -- prose before
 * it, a list, a bare string -- is unreadable. An answer that ran out of room before its object
 * closed is said to have been cut short, which giving the widget more tokens would mend.
 *
 * @param text - The answer's text, as it came back.
 * @param truncated - Whether the model stopped for want of room.
 * @returns The object, or the failed reply.
 *
 * @example answerOf('{"guess": "Leon"}', false)  // => { ok: true, value: { guess: 'Leon' } }
 * @example answerOf('{"guess": "Le', true)        // => { ok: false, failurekind: 'cutShort' }
 * @example answerOf('Leon', false)                // => { ok: false, failurekind: 'unreadable' }
 */
export function answerOf(text: string, truncated: boolean): AskFailedT | { ok: true, value: AnswerT } {
  const trimmed = text.trim()
  if (trimmed === '') { return { ok: false, failurekind: truncated ? 'cutShort' : 'emptyAnswer' } }
  const parsed = parsedJson(unfenced(trimmed))
  if (isObject(parsed)) { return { ok: true, value: parsed as AnswerT } }
  return { ok: false, failurekind: truncated ? 'cutShort' : 'unreadable' }
}

/**
 * A model's reply made ready to keep: every string it wrote clipped to length, then held to the
 * shape the database and the browser rely on.
 *
 * Nothing is trimmed or cleaned. A reply that cannot be kept as it stands -- a control character
 * in a string is the likely one, and a sign somebody is probing; a key the database refuses; an
 * object nested past reason, or too large to keep -- becomes an unreadable failure rather than
 * something stored.
 *
 * @param reply - What the route put together from the model's answer.
 * @returns The reply, clipped and checked; or an unreadable failure.
 *
 * @example vetReply({ ok: true, value: { guess: 'Le\u{1}on' }, ... })  // => { ok: false, failurekind: 'unreadable' }
 */
export function vetReply(reply: AskReplyT): AskReplyT {
  if (! reply.ok) { return reply }
  const issue = shapeIssue(reply.value, 0)
  const checked = issue === null ? AskContract.askReply.safeParse({ ...reply, value: clipStrings(reply.value) }) : null
  if (checked?.success) { return checked.data }
  console.warn('A model reply was refused before it could be kept:', issue ?? checked?.error.issues[0]?.message)
  return { ok: false, failurekind: 'unreadable' }
}

/**
 * Why `val`, at `depth` levels down, cannot be kept as it stands, or null when it can.
 *
 * @example shapeIssue({ $set: 1 }, 0)  // => 'the key "$set" is not a key the tool can keep'
 */
export function shapeIssue(val: JsonT, depth: number): string | null {
  if (typeof val === 'string') { return PA.Textish.re.test(val) ? null : `a string ${PA.Textish.msg}` }
  if (val === null || typeof val !== 'object') { return null }
  if (depth >= PA.ReplyShape.depth) { return `it nests deeper than ${String(PA.ReplyShape.depth)} levels` }
  const entries = Array.isArray(val) ? val.map((item): [string, JsonT] => ['', item]) : Object.entries(val)
  if (entries.length > PA.ReplyShape.items) { return `one level holds more than ${String(PA.ReplyShape.items)} items` }
  for (const [key, item] of entries) {
    if (! Array.isArray(val) && ! keyFits(key)) { return `the key ${UU.jsonify(key)} ${PA.Replykey.msg}` }
    const issue = shapeIssue(item, depth + 1)
    if (issue !== null) { return issue }
  }
  return null
}

/** Whether `key` is one the database keeps */
function keyFits(key: string): boolean {
  return key.length <= PA.Replykey.max && PA.Replykey.re.test(key)
}

/** `val` with every string in it clipped */
function clipStrings<VT extends JsonT>(val: VT): VT {
  if (typeof val === 'string') { return clipText(val) as VT }
  if (val === null || typeof val !== 'object') { return val }
  if (Array.isArray(val)) { return val.map((item) => clipStrings(item)) as VT }
  return Object.fromEntries(Object.entries(val).map(([key, item]) => [key, clipStrings(item)])) as VT
}

/**
 * `text` without the code fence around it, when it has one: the lines between the opening fence
 * (with whatever language it names) and the closing one.
 *
 * @example unfenced('```json\n{"aa": 1}\n```')  // => '{"aa": 1}'
 */
function unfenced(text: string): string {
  if (! (text.startsWith(Fence) && text.endsWith(Fence) && text.length > 2 * Fence.length)) { return text }
  const body = text.slice(0, -Fence.length)
  const breakIdx = body.indexOf('\n')
  return breakIdx === -1 ? body.slice(Fence.length) : body.slice(breakIdx + 1)
}

/** `text` parsed as JSON, or undefined when it is not JSON */
function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** Whether `val` is a plain object rather than a list or a scalar */
function isObject(val: unknown): boolean {
  return typeof val === 'object' && val !== null && ! Array.isArray(val)
}
