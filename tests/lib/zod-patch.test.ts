import { describe, expect, it } from 'vitest'
import * as Z from 'zod'

/**
 * Guards `patches/zod@4.6.5.patch`, which flips `reportInput` to default on.
 *
 * Without it every issue arrives stripped of the value that caused it, and the error reporter
 * has nothing to talk about. A version bump whose patch no longer applies fails here rather
 * than quietly producing messages with a hole where the value should be.
 */
describe('zod patch: issues carry their input by default', () => {
  it('a plain safeParse carries the offending value', () => {
    const res = Z.string().min(3).safeParse('x')
    expect(res.error?.issues[0]).property('input').to.eq('x')
  })

  it('a nested leaf carries its own value, alongside its path', () => {
    const res = Z.object({ aa: Z.object({ bb: Z.string() }) }).safeParse({ aa: { bb: 42 } })
    const issue = res.error?.issues[0]
    expect(issue).property('path').to.eql(['aa', 'bb'])
    expect(issue).property('input').to.eq(42)
  })

  it('a ZodError thrown by parse carries it too', () => {
    const thrown = (() => {
      try {
        Z.object({ aa: Z.string() }).parse({ aa: 42 })
        return null
      } catch (err) { return err as Z.ZodError }
    })()
    expect(thrown).to.be.an('error')
    expect(thrown?.issues[0]).property('input').to.eq(42)
  })

  it('union and record branches carry it', () => {
    expect(Z.union([Z.string(), Z.number()]).safeParse(true).error?.issues[0]).property('input').to.eq(true)
    expect(Z.record(Z.string(), Z.number()).safeParse({ kk: 'nope' }).error?.issues[0]).property('input').to.eq('nope')
  })

  it('the escape hatch survives: reportInput false still withholds it', () => {
    const res = Z.string().min(3).safeParse('x', { reportInput: false })
    expect('input' in (res.error?.issues[0] ?? {})).to.eq(false)
  })

  // Not fixed by the patch, and worth pinning so nobody assumes otherwise: zod reports a
  // missing key and a present-but-undefined one identically. Telling them apart means asking
  // the input object, which is the reporter's job.
  it('does NOT distinguish a missing key from a present-undefined one', () => {
    const shape   = Z.object({ aa: Z.string() })
    const missing = shape.safeParse({}).error?.issues[0]
    const undef   = shape.safeParse({ aa: undefined }).error?.issues[0]
    expect(missing).to.eql(undef)
    expect(missing).property('input').to.eq(undefined)
  })
})
