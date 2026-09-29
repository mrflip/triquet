import { describe, expect, it } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { AskContract } from '../../../src/lib/ask/contract'
import { failureReplyFor, failurekindFor } from '../../../src/lib/ask/failures'

describe('failurekindFor', () => {
  it('reads an error nobody recognises as unknown, rather than guessing at a cause', () => {
    expect(failurekindFor(new Error('boom'))).to.eq('unknown')
    expect(failurekindFor('a string')).to.eq('unknown')
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

  it('carries nothing but the kind for something that is not an error', () => {
    expect(failureReplyFor('a string')).to.deep.eq({ ok: false, failurekind: 'unknown', detail: {} })
  })

  it('cuts a long message to what a reply may carry, so the reply still validates', () => {
    const reply = failureReplyFor(new Error('x'.repeat(5000)))
    expect(reply.detail?.message).to.have.length(600)
    expect(AskContract.askReply.safeParse(reply).success).to.eq(true)
  })
})
