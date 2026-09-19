import type * as TY from './types'

/** Coarse grouping, for deciding how loudly to react rather than what to say */
export const ErrfamilyVals = ['Bug', 'Impossible', 'Inconsistent', 'Unexpected'] as const
export type  Errfamily     = typeof ErrfamilyVals[number]

/** Context about an error. Non-sensitive only: this enters logs */
export type Story = TY.AnyBag

/**
 * V8 keeps the frame that built an error; nobody wants to read about the factory.
 *
 * Present in node and Chrome, absent in Firefox and Safari, and this file ships to the browser.
 * Where it is missing the factory frame simply stays in the trace, which costs a reader one line.
 * `@types/node` declares it required, hence the widening -- on the client it genuinely is not.
 */
function trimFactoryFrame(err: Error, factory: (...args: never[]) => unknown): void {
  // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties -- non-standard is the point; that is what the guard is for
  const capture = (Error as Partial<ErrorConstructor>).captureStackTrace
  capture?.(err, factory)
}

/**
 * Base of the error family: an `Error` that carries structured context in two tiers.
 *
 * `story` is for things safe to write down -- ids, counts, the name of the step that failed. It
 * is an ordinary enumerable property, so it serialises and reaches logs. `backstory` is for the
 * bulky or the sensitive: it is non-enumerable and read-only, so it survives a debugger but not
 * a `JSON.stringify`, and never travels to a client by accident.
 *
 * Reach for a factory (`BadValue`, `Missing`, ...) rather than constructing directly: each
 * returns the error rather than throwing it, so a caller can `throw BadValue(...)` at a guard or
 * hand one back as a value.
 *
 * @param message - What went wrong, phrased for whoever reads the log.
 * @param story - Context safe to log.
 * @param backstory - Context to keep out of logs and off the wire.
 */
export class CoreError extends Error {
  /** Coarse grouping; mirrors the static of the most-derived class */
  declare family:    Errfamily
  /** This error's own name, spelled out so minification cannot eat it */
  declare flavor:    string
  /** Sentence explaining the class of problem, for a human */
  declare subhead:   string
  /** Context about the error. Non-sensitive data only. Enters logs */
  declare story:     Story
  /** Deep context about the error. Inspectable, not logged or sent to a client */
  declare backstory: Story

  static readonly family:  Errfamily = 'Unexpected'
  static readonly flavor:  string    = 'CoreError'
  static readonly subhead: string    = 'Issue carrying out this process'

  constructor(message: string, story: Story = {}, backstory: Story = {}) {
    super(message)
    // `new.target` is the most-derived constructor, so a subclass declares its metadata once as
    // statics and every instance still carries them as ordinary, serialisable properties.
    const klass  = new.target
    this.name    = klass.flavor
    this.family  = klass.family
    this.flavor  = klass.flavor
    this.subhead = klass.subhead
    this.story   = story
    Object.defineProperty(this, 'backstory', {
      value: backstory, enumerable: false, configurable: true, writable: false,
    })
  }
}

export class AuthorizationError extends CoreError {
  static override readonly family:  Errfamily = 'Impossible'
  static override readonly flavor:  string    = 'AuthorizationError'
  static override readonly subhead: string    = 'This request does not have the appropriate permissions level'
}

export class BadValueError extends CoreError {
  static override readonly family:  Errfamily = 'Inconsistent'
  static override readonly flavor:  string    = 'BadValueError'
  static override readonly subhead: string    = 'An essential piece of information did not have the correct form'
}

export class BlankError extends CoreError {
  static override readonly family:  Errfamily = 'Inconsistent'
  static override readonly flavor:  string    = 'BlankError'
  static override readonly subhead: string    = 'An essential piece of information was unexpectedly absent'
}

export class InconsistentError extends CoreError {
  static override readonly family:  Errfamily = 'Unexpected'
  static override readonly flavor:  string    = 'InconsistentError'
  static override readonly subhead: string    = 'The safety checks required before data changes occur showed an issue'
}

export class FailedOpError extends CoreError {
  static override readonly family:  Errfamily = 'Unexpected'
  static override readonly flavor:  string    = 'FailedOpError'
  static override readonly subhead: string    = 'An essential step did not complete'
}

export class UnknownTagError extends CoreError {
  static override readonly family:  Errfamily = 'Unexpected'
  static override readonly flavor:  string    = 'UnknownTagError'
  static override readonly subhead: string    = 'Received a term that is not on the menu of values we can act on'
}

export class MissingError extends CoreError {
  static override readonly family:  Errfamily = 'Unexpected'
  static override readonly flavor:  string    = 'MissingError'
  static override readonly subhead: string    = 'Could not access information essential to completing this process'
}

export class MismatchError extends CoreError {
  static override readonly family:  Errfamily = 'Unexpected'
  static override readonly flavor:  string    = 'MismatchError'
  static override readonly subhead: string    = 'Part of this request did not have correctly-shaped values'
}

export class NotYetError extends CoreError {
  static override readonly family:  Errfamily = 'Bug'
  static override readonly flavor:  string    = 'NotYetError'
  static override readonly subhead: string    = 'Very sorry, we cannot yet complete this process'
}

export class EmptyStubError extends NotYetError {
  static override readonly family:  Errfamily = 'Bug'
  static override readonly flavor:  string    = 'EmptyStubError'
  static override readonly subhead: string    = 'Reached an unimplemented process'
}

export class MistypedError extends CoreError {
  static override readonly family:  Errfamily = 'Bug'
  static override readonly flavor:  string    = 'MistypedError'
  static override readonly subhead: string    = 'The data had an unexpected type'
}

export class UnableToError extends CoreError {
  static override readonly family:  Errfamily = 'Impossible'
  static override readonly flavor:  string    = 'UnableToError'
  static override readonly subhead: string    = 'The request was phrased correctly, and our robots did their best, but the process cannot proceed'
}

export class RemoteIssueError extends UnableToError {
  static override readonly flavor:  string    = 'RemoteIssueError'
  static override readonly subhead: string    = 'Our robots did their best, but an external service we depend on is not operating correctly'
}

export class RemoteUnreachableError extends UnableToError {
  static override readonly flavor:  string    = 'RemoteUnreachableError'
  static override readonly subhead: string    = 'Our robots did their best, but an external service we depend on is not responding to requests'
}

/** Caller lacks the rights for what they asked */
export function Unauthorized(message: string, story: Story = {}, backstory: Story = {}): AuthorizationError {
  const err = new AuthorizationError(message, story, backstory); trimFactoryFrame(err, Unauthorized); return err
}
/** A value arrived in the wrong shape */
export function BadValue(message: string, story: Story = {}, backstory: Story = {}): BadValueError {
  const err = new BadValueError(message, story, backstory); trimFactoryFrame(err, BadValue); return err
}
/** A required value was absent */
export function BlankValue(message: string, story: Story = {}, backstory: Story = {}): BlankError {
  const err = new BlankError(message, story, backstory); trimFactoryFrame(err, BlankValue); return err
}
/** A precondition check failed before changing data */
export function Inconsistent(message: string, story: Story = {}, backstory: Story = {}): InconsistentError {
  const err = new InconsistentError(message, story, backstory); trimFactoryFrame(err, Inconsistent); return err
}
/** A step that had to finish did not */
export function FailedOp(message: string, story: Story = {}, backstory: Story = {}): FailedOpError {
  const err = new FailedOpError(message, story, backstory); trimFactoryFrame(err, FailedOp); return err
}
/** A term arrived that is not on the menu of values we act on */
export function UnknownTag(message: string, story: Story = {}, backstory: Story = {}): UnknownTagError {
  const err = new UnknownTagError(message, story, backstory); trimFactoryFrame(err, UnknownTag); return err
}
/** Something essential could not be reached */
export function Missing(message: string, story: Story = {}, backstory: Story = {}): MissingError {
  const err = new MissingError(message, story, backstory); trimFactoryFrame(err, Missing); return err
}
/** Parts of a request disagreed with each other */
export function Mismatch(message: string, story: Story = {}, backstory: Story = {}): MismatchError {
  const err = new MismatchError(message, story, backstory); trimFactoryFrame(err, Mismatch); return err
}
/** Not built yet */
export function NotYet(message: string, story: Story = {}, backstory: Story = {}): NotYetError {
  const err = new NotYetError(message, story, backstory); trimFactoryFrame(err, NotYet); return err
}
/** Reached a stub that has no implementation behind it */
export function EmptyStub(message: string, story: Story = {}, backstory: Story = {}): EmptyStubError {
  const err = new EmptyStubError(message, story, backstory); trimFactoryFrame(err, EmptyStub); return err
}
/** The request made sense but cannot be carried out */
export function UnableTo(message: string, story: Story = {}, backstory: Story = {}): UnableToError {
  const err = new UnableToError(message, story, backstory); trimFactoryFrame(err, UnableTo); return err
}
/** A value was of the wrong type */
export function Mistyped(message: string, story: Story = {}, backstory: Story = {}): MistypedError {
  const err = new MistypedError(message, story, backstory); trimFactoryFrame(err, Mistyped); return err
}
/** A service we depend on answered, badly */
export function RemoteIssue(message: string, story: Story = {}, backstory: Story = {}): RemoteIssueError {
  const err = new RemoteIssueError(message, story, backstory); trimFactoryFrame(err, RemoteIssue); return err
}
/** A service we depend on did not answer */
export function RemoteUnreachable(message: string, story: Story = {}, backstory: Story = {}): RemoteUnreachableError {
  const err = new RemoteUnreachableError(message, story, backstory); trimFactoryFrame(err, RemoteUnreachable); return err
}
