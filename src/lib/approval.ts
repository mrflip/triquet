import type * as Z from 'zod'
import { Validator } from './validator'
import { AuthorizationError, type Story } from './errors'
import { ApprovalNotices } from './notices'
import { IdentValidators, type IdentT } from '../models/ident'

/** Every act the server keeps switched off until its environment says otherwise */
export const ApprovalActVals = ['anthropic_bot'] as const
export type  ApprovalAct     = typeof ApprovalActVals[number]

/** Which environment variable switches each act on. Doppler fills these; no file in the repo ever does. */
const EnvvarFor: Record<ApprovalAct, string> = {
  anthropic_bot: 'ENABLE_ANTHROPIC_BOT',
}

/** The one value that switches an act on: anything else, or nothing, leaves it off */
const Allowed = 'allow'

const ApprovalValidators = Validator(({ obj, oneof, rec, str, unk, arr, bool }) => {
  const act = oneof(ApprovalActVals)
    .describe('What the caller wants to do.')
  const action = obj({ act })
    .describe('What approval is being asked for.')
  const ident = IdentValidators.row.extend({ _id: str }).nullable()
    .describe('Who is asking; null when the request does not say.')
  const moreinfo = rec(str, unk)
    .describe("Details of the request, kept in a refusal's backstory.")
  // Named for `of`, which is too short a name for a schema
  const approvalOf = obj({ ident, action, moreinfo })
    .describe('One request for approval: who is asking, to do what, and whatever else the request said.')

  const verdicts = arr(bool).nonempty().describe('List of permission check results')
  return { act, action, approvalOf, verdicts }
})

export type ApprovalActionDNA = Z.input<typeof ApprovalValidators.action>

/** Details of the request an approval was asked for. Kept off the wire and out of logs: see `NotApprovedError` */
export type RequestInfo = Story

/**
 * The server declined an act it keeps switched off. Its message is a sentence for the author
 * (`ApprovalNotices`), safe to send back to the browser; the ident and request ride in the
 * backstory, which never is.
 */
export class NotApprovedError extends AuthorizationError {
  static override readonly flavor:  string = 'NotApprovedError'
  static override readonly subhead: string = 'This server has not switched on what the request asked for'
}

/**
 * Whether `ident` may carry out `action.act` here, as this server's environment decides it.
 *
 * Server-only. An act is on only when its variable holds exactly `allow`; unset, blank, or any
 * other word leaves it off, so a deployment that has said nothing says no.
 *
 * @param ident - Who is asking; null when the request does not say. Every ident is treated alike, for now.
 * @param action - The act, as `{ act }`.
 * @param moreinfo - Details of the request. Every request is treated alike, for now.
 * @returns True when the act may go ahead.
 * @throws When `action.act` names no act we know, `ident` is not an ident, or this runs in a browser.
 *
 * @example Approval.of(null, { act: 'anthropic_bot' })  // => true, where ENABLE_ANTHROPIC_BOT=allow
 * @example Approval.of(null, { act: 'anthropic_bot' })  // => false, where ENABLE_ANTHROPIC_BOT is unset
 */
export function of(ident: IdentT | null, action: ApprovalActionDNA, moreinfo: RequestInfo = {}): boolean {
  const { action: { act } } = ApprovalValidators.approvalOf({ ident, action, moreinfo })
  if (typeof window !== 'undefined') { throw new Error('Approval is only decided on the server') }
  return process.env[EnvvarFor[act]] === Allowed
}

/**
 * Go ahead only when `ident` may carry out `action.act` (see `of`); otherwise decline politely.
 *
 * @param ident - Who is asking; null when the request does not say.
 * @param action - The act, as `{ act }`.
 * @param moreinfo - Details of the request, kept in the refusal's backstory.
 * @returns `'allow'`, when the act may go ahead.
 * @throws `NotApprovedError`, with the act's `ApprovalNotices` sentence, when the act is off.
 *
 * @example Approval.need(null, { act: 'anthropic_bot' })  // => 'allow', where ENABLE_ANTHROPIC_BOT=allow
 * @example Approval.need(null, { act: 'anthropic_bot' })  // throws "Asking Claude is switched off on this server ...", where ENABLE_ANTHROPIC_BOT is unset
 */
export function need(ident: IdentT | null, action: ApprovalActionDNA, moreinfo: RequestInfo = {}): 'allow' {
  if (of(ident, action, moreinfo)) { return 'allow' }
  throw new NotApprovedError(ApprovalNotices[action.act], { action, ident }, { moreinfo })
}

/** Whether all the `verdicts` are true.
 * @param verdicts - The verdicts to check -- booleans or promises of booleans.
 * @returns Whether all the `verdicts` are true.
 */
export async function every(verdicts: (boolean | Promise<boolean>)[]): Promise<boolean> {
  const verdictsA = await Promise.all(verdicts)
  return ApprovalValidators.verdicts(verdictsA).every(Boolean)
}