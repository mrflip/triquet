import { describe, expect, it } from 'vitest'
import * as EE from '../../src/lib/errors'

/** Every factory, with the class it mints and the metadata that class declares */
const Factories = [
  // regular usage:
  [EE.Unauthorized,      EE.AuthorizationError,      'Impossible',   'AuthorizationError'],
  [EE.BadValue,          EE.BadValueError,           'Inconsistent', 'BadValueError'],
  [EE.BlankValue,        EE.BlankError,              'Inconsistent', 'BlankError'],
  [EE.Inconsistent,      EE.InconsistentError,       'Unexpected',   'InconsistentError'],
  [EE.FailedOp,          EE.FailedOpError,           'Unexpected',   'FailedOpError'],
  [EE.UnknownTag,        EE.UnknownTagError,         'Unexpected',   'UnknownTagError'],
  [EE.Missing,           EE.MissingError,            'Unexpected',   'MissingError'],
  [EE.Mismatch,          EE.MismatchError,           'Unexpected',   'MismatchError'],
  [EE.NotYet,            EE.NotYetError,             'Bug',          'NotYetError'],
  [EE.EmptyStub,         EE.EmptyStubError,          'Bug',          'EmptyStubError'],
  [EE.Mistyped,          EE.MistypedError,           'Bug',          'MistypedError'],
  [EE.UnableTo,          EE.UnableToError,           'Impossible',   'UnableToError'],
  [EE.RemoteIssue,       EE.RemoteIssueError,        'Impossible',   'RemoteIssueError'],
  [EE.RemoteUnreachable, EE.RemoteUnreachableError,  'Impossible',   'RemoteUnreachableError'],
] as const

describe('error factories', () => {
  for (const [make, Klass, family, flavor] of Factories) {
    describe(flavor, () => {
      it('mints its own class, and is still an Error', () => {
        const err = make('nope')
        expect(err).to.be.instanceOf(Klass)
        expect(err).to.be.instanceOf(EE.CoreError)
        expect(err).to.be.instanceOf(Error)
      })
      it('carries its family, flavor and subhead as its own properties', () => {
        const err = make('nope')
        expect(err.family).to.eq(family)
        expect(err.flavor).to.eq(flavor)
        expect(err.subhead).to.eq(Klass.subhead)
        expect(err.subhead).to.be.a('string').and.have.length.greaterThan(0)
      })
      it('returns the error rather than throwing it', () => {
        expect(() => make('nope')).to.not.throw()
      })
      it('reports its flavor as its name, so a bare log line says what it was', () => {
        expect(make('nope').name).to.eq(flavor)
        expect(String(make('nope'))).to.eq(`${flavor}: nope`)
      })
    })
  }

  it('gives every flavor a distinct subhead', () => {
    const subheads = Factories.map(([, Klass]) => Klass.subhead)
    expect(new Set(subheads).size).to.eq(subheads.length)
  })
})

describe('CoreError', () => {
  describe('message and story', () => {
    it('keeps the message', () => {
      expect(EE.BadValue('the lumens are wrong').message).to.eq('the lumens are wrong')
    })
    it('keeps the story, and leaves it enumerable so it can reach a log', () => {
      const err = EE.BadValue('nope', { lumens: 400 })
      expect(err.story).to.eql({ lumens: 400 })
      expect(Object.keys(err)).to.include('story')
      expect(Object.assign({}, err)).property('story').to.eql({ lumens: 400 })
    })
    it('defaults story and backstory to empty bags', () => {
      const err = EE.BadValue('nope')
      expect(err.story).to.eql({})
      expect(err.backstory).to.eql({})
    })
    it('does not merge backstory into story', () => {
      const err = EE.BadValue('nope', { aa: 1 }, { bb: 2 })
      expect(err.story).to.eql({ aa: 1 })
      expect(err.backstory).to.eql({ bb: 2 })
    })
  })

  describe('cause', () => {
    it('is lifted off the story onto the Error, where it belongs', () => {
      const root = new Error('the disk went away')
      const err  = EE.FailedOp('could not save', { cause: root, quizid: 'abc' })
      expect(err.cause).to.eq(root)
    })
    it('is not left behind in the story as a second copy', () => {
      const root = new Error('the disk went away')
      const err  = EE.FailedOp('could not save', { cause: root, quizid: 'abc' })
      expect(err.story).to.eql({ quizid: 'abc' })
      expect(err.story).to.not.have.property('cause')
    })
    it('leaves no cause property at all when none was given', () => {
      const err = EE.FailedOp('could not save', { quizid: 'abc' })
      expect(Object.prototype.hasOwnProperty.call(err, 'cause')).to.eq(false)
    })
    it('does not disturb the story when there is nothing else in it', () => {
      const root = new Error('root')
      expect(EE.FailedOp('nope', { cause: root }).story).to.eql({})
    })
    it('does not mutate the bag the caller handed in', () => {
      const story = { cause: new Error('root'), quizid: 'abc' }
      EE.FailedOp('nope', story)
      expect(story).to.have.property('cause')
    })
    it('chains, so a wrapped error still leads back to the original', () => {
      const root  = new Error('the disk went away')
      const outer = EE.FailedOp('could not save', { cause: EE.Missing('no quiz', { cause: root }) })
      expect(outer.cause).to.be.instanceOf(EE.MissingError)
      expect((outer.cause as EE.MissingError).cause).to.eq(root)
    })
    it('stays out of a serialised error, as Error itself intends', () => {
      const err = EE.FailedOp('nope', { cause: new Error('sekrit root') })
      expect(JSON.stringify(err)).to.not.match(/sekrit/)
    })
  })

  describe('backstory stays out of sight', () => {
    const err = EE.BadValue('nope', { safe: 'yes' }, { token: 'sekrit' })

    it('is readable when you go looking', () => {
      expect(err.backstory).to.eql({ token: 'sekrit' })
    })
    it('is not enumerable, so a spread leaves it behind', () => {
      expect(Object.keys(err)).to.not.include('backstory')
      expect(Object.assign({}, err)).to.not.have.property('backstory')
    })
    it('does not survive JSON, so it cannot ride along to a client', () => {
      expect(JSON.stringify(err)).to.not.match(/sekrit/)
      expect(JSON.stringify(err)).to.match(/safe/)
    })
    it('is read-only', () => {
      expect(Object.getOwnPropertyDescriptor(err, 'backstory')).property('writable').to.eq(false)
    })
  })

  describe('inheritance', () => {
    it('reaches through an intermediate class', () => {
      const err = EE.EmptyStub('nope')
      expect(err).to.be.instanceOf(EE.EmptyStubError)
      expect(err).to.be.instanceOf(EE.NotYetError)
      expect(err).to.be.instanceOf(EE.CoreError)
    })
    it('lets a subclass inherit a family it does not restate', () => {
      // RemoteIssueError declares no family of its own; it takes UnableToError's.
      expect(EE.RemoteIssue('nope').family).to.eq('Impossible')
      expect(EE.RemoteIssueError.family).to.eq('Impossible')
    })
    it('reads its metadata off the most-derived class, not the base', () => {
      expect(EE.EmptyStub('nope').flavor).to.eq('EmptyStubError')
      expect(EE.EmptyStub('nope').subhead).to.eq(EE.EmptyStubError.subhead)
      expect(EE.EmptyStubError.subhead).to.not.eq(EE.NotYetError.subhead)
    })
    it('can still be built directly, taking the base metadata', () => {
      const err = new EE.CoreError('nope')
      expect(err.family).to.eq('Unexpected')
      expect(err.flavor).to.eq('CoreError')
    })
  })

  describe('stack', () => {
    it('has one', () => {
      expect(EE.BadValue('nope').stack).to.be.a('string').and.match(/errors\.test\.ts/)
    })
    // V8 only, and vitest runs on V8. Elsewhere the frame stays and costs a reader one line.
    it('does not name the factory that built it', () => {
      expect(EE.BadValue('nope').stack).to.not.match(/at BadValue\b/)
    })
    it('points at the caller instead', () => {
      const err = EE.Missing('nope')
      expect(err.stack?.split('\n', 2)[1]).to.match(/errors\.test\.ts/)
    })
  })

  describe('families', () => {
    it('every flavor claims one of the declared families', () => {
      for (const [, Klass] of Factories) {
        expect(EE.ErrfamilyVals).to.include(Klass.family)
      }
    })
    it('the family list is sorted and free of duplicates', () => {
      expect([...EE.ErrfamilyVals]).to.eql([...EE.ErrfamilyVals].toSorted((aa, bb) => aa.localeCompare(bb)))
      expect(new Set(EE.ErrfamilyVals).size).to.eq(EE.ErrfamilyVals.length)
    })
  })

  it('is throwable and catchable as its own flavor', () => {
    const caught = (() => {
      try { throw EE.NotYet('not built', { step: 'publish' }) } catch (err) { return err }
    })()
    expect(caught).to.be.instanceOf(EE.NotYetError)
    expect(caught).property('story').to.eql({ step: 'publish' })
  })
})
