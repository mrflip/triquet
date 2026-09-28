import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { ConvexError } from 'convex/values'
import { failurekindOf, noticeOf, refusalFor, refuse, refusingInvalid } from '../../src/lib/refusals'
import { AppNotices, RefusalNotices } from '../../src/lib/notices'

/** What `run` threw; fails the test if it threw nothing */
function thrownBy(run: () => unknown): unknown {
  try {
    run()
  } catch (err) {
    return err
  }
  throw new Error('expected a throw')
}

/** The data a ConvexError carries; null for any other error */
function dataOf(err: unknown): unknown {
  return err instanceof ConvexError ? err.data : null
}

/** A Zod error, as a row validator refusing a title throws it */
function zodError(): Z.ZodError {
  const outcome = Z.object({ title: Z.string().max(3) }).safeParse({ title: 'Princes' })
  if (outcome.success) { throw new Error('expected the parse to fail') }
  return outcome.error
}

describe('RefusalNotices', () => {
  it('say every refusal as a sentence', () => {
    const unsaid = Object.entries(RefusalNotices).filter(([, sentence]) => ! /^[A-Z].*\.$/.test(sentence))
    expect(unsaid).to.deep.eq([])
  })
})

describe('refuse', () => {
  it('throws a ConvexError naming the refusal, with its sentence', () => {
    const err = thrownBy(() => refuse('quizLocked'))
    expect(err).to.be.instanceOf(ConvexError)
    expect(dataOf(err)).to.deep.eq({ failurekind: 'quizLocked', message: RefusalNotices.quizLocked })
  })
})

describe('refusalFor', () => {
  it('makes a Zod error a refusal for something invalid, saying where and why, with its issues', () => {
    const refusal = refusalFor(zodError())
    expect(refusal).to.be.instanceOf(ConvexError)
    const data = Z.object({ failurekind: Z.string(), message: Z.string(), ZodError: Z.array(Z.unknown()) }).parse(dataOf(refusal))
    expect([data.failurekind, data.ZodError.length]).to.deep.eq(['invalid', 1])
    expect(data.message).to.include('title')
  })

  it('hands back anything else as it was', () => {
    const err = new Error('the database fell over')
    expect(refusalFor(err)).to.eq(err)
  })
})

describe('refusingInvalid', () => {
  it('hands back what the handler returns', async () => {
    expect(await refusingInvalid(() => Promise.resolve(7))).to.eq(7)
  })

  it('turns a Zod error the handler throws into a refusal, and lets anything else through', async () => {
    await expect(refusingInvalid(async () => { await Promise.reject(zodError()) })).rejects.toThrow(ConvexError)
    await expect(refusingInvalid(async () => { await Promise.reject(new Error('fell over')) })).rejects.toThrow('fell over')
  })
})

describe('refuse, with a sentence of its own', () => {
  it('carries the sentence given in place of the refusal\'s own', () => {
    expect(dataOf(thrownBy(() => refuse('identUnknown', 'No ident is labelled "bob_reviews".')))).to.deep.eq({ failurekind: 'identUnknown', message: 'No ident is labelled "bob_reviews".' })
  })
})

describe('failurekindOf', () => {
  const Cases: [unknown, string | null, string][] = [
    [thrownBy(() => refuse('labelTaken')),                                   'labelTaken', 'a refusal: its kind'],
    [refusalFor(zodError()),                                                'invalid',    'something invalid'],
    [new ConvexError({ ZodError: [{ message: 'should match pattern' }] }),   null,         'a refused argument, which is a caller\'s bug'],
    [new Error('Server Error'),                                             null,         'an error the server did not mean to say'],
  ]
  for (const [err, failurekind, describes] of Cases) {
    it(`reads ${describes}`, () => {
      expect(failurekindOf(err)).to.eq(failurekind)
    })
  }
})

describe('noticeOf', () => {
  const Cases: [unknown, string, string][] = [
    [thrownBy(() => refuse('lastQuiz')),                                        RefusalNotices.lastQuiz,        'a refusal: its own sentence'],
    [refusalFor(zodError()),                                                   "title «'Princes'» is too long: «7» characters vs «3» available", 'something invalid: where and why'],
    [new ConvexError({ ZodError: [{ message: 'should match pattern' }] }),      'should match pattern',         'a refused argument: its message'],
    [new ConvexError({ something: 'else' }),                                   AppNotices.changeFailed,        'a ConvexError of another shape: nothing was altered'],
    [new Error('Server Error'),                                                AppNotices.changeFailed,        'an error the server did not mean to say: nothing was altered'],
    [null,                                                                     AppNotices.changeFailed,        'nothing at all: nothing was altered'],
  ]
  for (const [err, notice, describes] of Cases) {
    it(`reads ${describes}`, () => {
      expect(noticeOf(err)).to.eq(notice)
    })
  }
})
