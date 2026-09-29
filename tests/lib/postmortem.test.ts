import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import * as Postmortem from '../../src/lib/postmortem'
import { BadValue } from '../../src/lib/errors'

/** An error as the Convex client raises it for a failed call: its path, the request, what the server said */
function convexMessage(letter: string, fnpath: string, said: string): string {
  return `[CONVEX ${letter}(${fnpath})] [Request ID: 5c0f9a] ${said}\n  Called by client`
}

/** A refusal, as a mutation that called `refuse` rejects with */
function refusal(): ConvexError<{ failurekind: string, message: string }> {
  const data = { failurekind: 'reviewNotOpened', message: 'Open your review of this quiz first.' }
  const err = new ConvexError(data)
  err.message = convexMessage('M', 'hunts:perform', `Server Error\nUncaught ConvexError: ${JSON.stringify(data)}\n    at refuse (../../src/lib/refusals.ts:34:0)`)
  return err
}

/** An unplanned error a production deployment keeps to itself */
function hiddenServerError(): Error {
  return new Error(convexMessage('M', 'hunts:perform', 'Server Error'))
}

describe('Postmortem.of', () => {
  it("says a refusal's reason, and which refusal it is", () => {
    const postmortem = Postmortem.of(refusal())
    expect(postmortem.summary).to.eq('refused (reviewNotOpened): Open your review of this quiz first.')
    expect(postmortem.refused).to.eq(true)
    expect(postmortem.failurekind).to.eq('reviewNotOpened')
  })

  it('names the server function and the request, for finding it in the Convex logs', () => {
    const postmortem = Postmortem.of(refusal())
    expect(postmortem.fnpath).to.eq('hunts:perform')
    expect(postmortem.fnkind).to.eq('mutation')
    expect(postmortem.request_id).to.eq('5c0f9a')
  })

  it("says where to look when the server keeps an error's reason to itself", () => {
    const postmortem = Postmortem.of(hiddenServerError())
    expect(postmortem.summary).to.eq('failed on the server, which keeps the reason to itself: find request 5c0f9a in the Convex logs')
    expect(postmortem.hidden).to.eq(true)
    expect(postmortem.refused).to.eq(false)
  })

  it('says what the server said, when it said it, without hiding it', () => {
    const postmortem = Postmortem.of(new Error(convexMessage('Q', 'quizzes:open', 'Server Error\nUncaught Error: no such quiz\n    at handler')))
    expect(postmortem.hidden).to.eq(false)
    expect(postmortem.fnkind).to.eq('query')
    expect(postmortem.summary).to.eq('Error: Server Error')
  })

  it('lists what a refused argument got wrong, with the field it was about', () => {
    const err = new ConvexError({ ZodError: [{ message: 'has weird characters', path: ['action', 'patch', 'comments'] }, { message: 'Too big' }] })
    const postmortem = Postmortem.of(err)
    expect(postmortem.issues).to.deep.eq(['action.patch.comments: has weird characters', 'Too big'])
    expect(postmortem.summary).to.eq('refused (invalid): action.patch.comments: has weird characters; Too big')
  })

  it("says an ordinary error by its name and first line, with a CoreError's story and causes", () => {
    expect(Postmortem.of(new TypeError('x is undefined')).summary).to.eq('TypeError: x is undefined')
    const err = BadValue('bad title', { field: 'title', cause: new RangeError('too long') })
    const postmortem = Postmortem.of(err)
    expect(postmortem.flavor).to.eq('BadValueError')
    expect(postmortem.story).to.deep.eq({ field: 'title' })
    expect(postmortem.causes).to.deep.eq(['RangeError: too long'])
  })

  it('makes do with something thrown that is not an error', () => {
    const postmortem = Postmortem.of('just a string')
    expect(postmortem.summary).to.eq('just a string')
    expect(postmortem.flavor).to.eq('string')
    expect(postmortem.fnpath).to.eq(null)
    expect(Postmortem.of({ why: 'object' }).causes).to.deep.eq([])
  })

  it('follows a chain of causes only so far, so a cycle ends', () => {
    const err = BadValue('outer')
    Object.defineProperty(err, 'cause', { value: err })
    expect(Postmortem.of(err).causes).to.have.lengthOf(8)
  })
})

describe('Postmortem.whereabouts', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('names the commit Vercel built and the backend', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA', '67284e7ab12')
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://prestigious-coyote-542.convex.cloud')
    expect(Postmortem.whereabouts()).to.deep.eq({ build: '67284e7', backend: 'https://prestigious-coyote-542.convex.cloud' })
  })

  it('calls a build Vercel did not make local', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA', undefined)
    expect(Postmortem.whereabouts().build).to.eq('local')
  })
})

describe('Postmortem.report', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('warns of a refusal, leading with what was tried and why it was refused', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => null)
    const err = refusal()
    Postmortem.report('keep a change (set_reviewing)', err, { action: { kind: 'set_reviewing' } })
    const [headline, facts, thrown] = (warn.mock.calls[0] ?? []) as unknown[]
    expect(headline).to.eq('Triquet: could not keep a change (set_reviewing) — refused (reviewNotOpened): Open your review of this quiz first.')
    expect(facts).to.include({ request_id: '5c0f9a', fnpath: 'hunts:perform' })
    expect(facts).to.have.deep.property('action', { kind: 'set_reviewing' })
    expect(facts).to.have.property('build')
    expect(thrown).to.eq(err)
  })

  it('errors on anything else, and hands back the postmortem', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => null)
    const postmortem = Postmortem.report('read the whole hunt for the export', hiddenServerError())
    expect(error).toHaveBeenCalledOnce()
    expect(postmortem.hidden).to.eq(true)
  })
})
