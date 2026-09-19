export class CoreError extends Error {
  /** context about the error. Non-sensitive data only. Enters logs */
  declare story:     Record<string, any>
  /** deep context about the error. Inspectable, not logged or sent to client */
  declare backstory: Record<string, any>
  static subhead = "Issue carrying out this process"

  // info is compactly appended to the message
  // the two are merged and become the .story property
  constructor(message: string, story: TY.AnyBag = {}, backstory: TY.AnyBag = {}) {
    super(message)
    this.story = story
    Object.defineProperty(this, 'backstory', { value: backstory, enumerable: false, configurable: true, writable: false })
  }
}

export class AuthorizationError extends CoreError {
  family = "Impossible"
  flavor = "AuthorizationError"
  static override subhead = "This request does not have the appropriate permissions level"
}

export class BadValueError extends CoreError {
  family = "Inconsistent"
  flavor = "BadValueError"
  static override subhead = "An essential piece of information did not have the correct form"
}

export class BlankError extends CoreError {
  family = "Inconsistent"
  flavor = "BlankError"
  static override subhead = "An essential piece of information was unexpectedly absent"
}

export class InconsistentError extends CoreError {
  family = "Unexpected"
  flavor = "InconsistentError"
  static override subhead = "The safety checks required before data changes occur showed an issue"
}

export class FailedOpError extends CoreError {
  family = "Unexpected"
  flavor = "FailedOpError"
  static override subhead = "An essential step did not complete"
}

export class UnknownTagError extends CoreError {
  family = "Unexpected"
  flavor = "UnknownTagError"
  static override subhead = "Received a term that is not on the menu of values we can act on"
}

export class MissingError extends CoreError {
  family = "Unexpected"
  flavor = "MissingError"
  static override subhead = "Could not access information essential to completing this process"
}

export class MismatchError extends CoreError {
  family = "Unexpected"
  flavor = "MismatchError"
  static override subhead = "Part of this request did not have correctly-shaped values"
}

export class NotYetError extends CoreError {
  family = "Bug"
  flavor = "NotYetError"
  static override subhead = "Very sorry, we cannot yet complete this process"
}

export class EmptyStubError extends NotYetError {
  override family = "Bug"
  override flavor = "EmptyStubError"
  static override subhead = "Reached an unimplemented process"
}

export class TypeError extends CoreError {
  family = "Bug"
  flavor = "TypeError"
  static override subhead = "The data had an expected type"
}

export class UnableToError extends CoreError {
  family = "Impossible"
  flavor = "UnableToError"
  static override subhead = `The request was phrased correctly, and our robots did their best, but the process cannot proceed` // eslint-disable-line max-len
}

export class RemoteIssueError extends UnableToError {
  static override subhead = `Our robots did their best, but an external service we depend on is not operating correctly` // eslint-disable-line max-len
  override flavor = "RemoteIssueError"
}

export class RemoteUnreachableError extends UnableToError {
  static override subhead = `Our robots did their best, but an external service we depend on is not responding to requests` // eslint-disable-line max-len
  override flavor = "RemoteUnreachableError"
}

export function Unauthorized(message:      string, info: TY.Story, backstory: TY.Story = {}) { const err = new AuthorizationError(message,     info, backstory); Error.captureStackTrace?.(err, Unauthorized); return err }
export function BadValue(message:          string, info: TY.Story, backstory: TY.Story = {}) { const err = new BadValueError(message,          info, backstory); Error.captureStackTrace?.(err, BadValue);     return err }
export function BlankValue(message:        string, info: TY.Story, backstory: TY.Story = {}) { const err = new BlankError(message,             info, backstory); Error.captureStackTrace?.(err, BlankValue);   return err }
export function Inconsistent(message:      string, info: TY.Story, backstory: TY.Story = {}) { const err = new InconsistentError(message,      info, backstory); Error.captureStackTrace?.(err, Inconsistent); return err }
export function FailedOp(message:          string, info: TY.Story, backstory: TY.Story = {}) { const err = new FailedOpError(message,          info, backstory); Error.captureStackTrace?.(err, FailedOp);     return err }
export function UnknownTag(message:        string, info: TY.Story, backstory: TY.Story = {}) { const err = new UnknownTagError(message,        info, backstory); Error.captureStackTrace?.(err, UnknownTag);   return err }
export function Missing(message:           string, info: TY.Story, backstory: TY.Story = {}) { const err = new MissingError(message,           info, backstory); Error.captureStackTrace?.(err, Missing);      return err }
export function Mismatch(message:          string, info: TY.Story, backstory: TY.Story = {}) { const err = new MismatchError(message,          info, backstory); Error.captureStackTrace?.(err, Mismatch);     return err }
export function NotYet(message:            string, info: TY.Story, backstory: TY.Story = {}) { const err = new NotYetError(message,            info, backstory); Error.captureStackTrace?.(err, NotYet);       return err }
export function EmptyStub(message:         string, info: TY.Story, backstory: TY.Story = {}) { const err = new EmptyStubError(message,         info, backstory); Error.captureStackTrace?.(err, EmptyStub);    return err }
export function UnableTo(message:          string, info: TY.Story, backstory: TY.Story = {}) { const err = new UnableToError(message,          info, backstory); Error.captureStackTrace?.(err, UnableTo);     return err }
export function Mistyped(message:          string, info: TY.Story, backstory: TY.Story = {}) { const err = new TypeError(message,              info, backstory); Error.captureStackTrace?.(err, Mistyped);     return err }
export function RemoteIssue(message:       string, info: TY.Story, backstory: TY.Story = {}) { const err = new RemoteIssueError(message,       info, backstory); Error.captureStackTrace?.(err, RemoteIssue);  return err }
export function RemoteUnreachable(message: string, info: TY.Story, backstory: TY.Story = {}) { const err = new RemoteUnreachableError(message, info, backstory); Error.captureStackTrace?.(err, RemoteUnreachable);  return err }
