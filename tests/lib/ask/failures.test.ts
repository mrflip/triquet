import { describe, expect, it } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { AskContract } from '../../../src/lib/ask/contract'
import { failureReplyFor, failurekindFor } from '../../../src/lib/ask/failures'
import * as Approve from '../../../src/lib/approve'
import { RefusalNotices } from '../../../src/lib/notices'

describe('failurekindFor', () => {
  it('reads an error nobody recognises as unknown, rather than guessing at a cause', () => {
    expect(failurekindFor(new Error('boom'))).to.eq('unknown')
    expect(failurekindFor('a string')).to.eq('unknown')
  })

  it("reads the server's declining to ask as not permitted", () => {
    expect(failurekindFor(new Approve.NotApprovedError('botsOff'))).to.eq('notPermitted')
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

  it("leaves out a status that is no HTTP status, which the reply could not carry", () => {
    const reply = failureReplyFor(new Anthropic.APIError(0, { type: 'error' }, 'no status', new Headers()))
    expect(reply.detail).not.to.have.property('status')
    expect(AskContract.askReply.safeParse(reply).success).to.be.true
  })

  it("carries the polite sentence of a declined approval, and none of the request behind it", () => {
    const reply = failureReplyFor(new Approve.NotApprovedError('botsOff', { policy: 'ask_anthropic_bot' }, { evidence: ['off'] }))
    expect(reply).to.deep.eq({ ok: false, failurekind: 'notPermitted', detail: { name: 'NotApprovedError', message: RefusalNotices.botsOff } })
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
