import { describe, expect, it } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { AskContract } from '../../../src/lib/ask/contract'
import { failureReplyFor, failurekindFor } from '../../../src/lib/ask/failures'
import * as Approval from '../../../src/lib/approval'
import { ApprovalNotices } from '../../../src/lib/notices'

describe('failurekindFor', () => {
  it('reads an error nobody recognises as unknown, rather than guessing at a cause', () => {
    expect(failurekindFor(new Error('boom'))).to.eq('unknown')
    expect(failurekindFor('a string')).to.eq('unknown')
  })

  it("reads the server's declining to ask as not permitted", () => {
    expect(failurekindFor(new Approval.NotApprovedError('off'))).to.eq('notPermitted')
  })

  it('reads a connection error as one', () => {
    expect(failurekindFor(new Anthropic.APIConnectionError({ message: 'down' }))).to.eq('connection')
  })
})

describe('failureReplyFor', () => {
  it('carries the kind and what the error said', () => {
    expect(failureReplyFor(new Error('boom'))).to.deep.eq({ ok: false, failurekind: 'unknown', detail: { name: 'Error', message: 'boom' } })
  })

  it('carries the status an API error came back with', () => {
    const reply = failureReplyFor(new Anthropic.RateLimitError(429, { type: 'error' }, 'slow down', new Headers()))
    expect(reply).to.deep.include({ failurekind: 'rateLimited' })
    expect(reply.detail?.status).to.eq(429)
  })

  it("carries the polite sentence of a declined approval, and none of the request behind it", () => {
    const reply = failureReplyFor(new Approval.NotApprovedError(ApprovalNotices.anthropic_bot, { action: { act: 'anthropic_bot' }, ident: null }, { moreinfo: { userAgent: 'curious-crawler' } }))
    expect(reply).to.deep.eq({ ok: false, failurekind: 'notPermitted', detail: { name: 'NotApprovedError', message: ApprovalNotices.anthropic_bot } })
  })

  it('carries nothing but the kind for something that is not an error', () => {
    expect(failureReplyFor('a string')).to.deep.eq({ ok: false, failurekind: 'unknown', detail: {} })
  })

  it('cuts a long message to what a reply may carry, so the reply still validates', () => {
    const reply = failureReplyFor(new Error('x'.repeat(5000)))
    expect(reply.detail?.message).to.have.length(600)
    expect(AskContract.askReply.safeParse(reply).success).to.be.true
  })
})
