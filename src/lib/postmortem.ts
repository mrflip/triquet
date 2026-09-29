import { ConvexError } from 'convex/values'
import * as Z from 'zod'
import { CoreError, type Story } from './errors'
import type * as TY from './types'
import * as UU from './useful'

/**
 * Everything a failure can tell whoever reads the console about itself, gathered from whatever
 * was thrown: which server function failed and the request id its logs file it under, whether
 * the server refused on purpose and why, and what the error itself says.
 */
export type PostmortemT = {
  /** One line: what went wrong, as far as the failure says */
  summary:     string
  /** The server turned the call down on purpose (a refusal), rather than failing at it */
  refused:     boolean
  /** Which refusal, when it is one: `reviewNotOpened`, `invalid`, ... */
  failurekind: string | null
  /** The server function that failed, as Convex names it: `hunts:perform` */
  fnpath:      string | null
  /** Whether that function reads, writes or acts */
  fnkind:      Fnkind | null
  /** Convex's id for the call, to find it in the deployment's logs */
  request_id:  string | null
  /** The server kept the reason to itself, as a production deployment does for an unplanned error */
  hidden:      boolean
  /** What a refused argument or row got wrong, one sentence each */
  issues:      readonly string[]
  /** The error's own name: `ConvexError`, `TypeError`, `BadValueError`, ... */
  flavor:      string
  /** The context a `CoreError` carries */
  story:       Story | null
  /** The error's causes, outermost first, each as its message */
  causes:      readonly string[]
}

export const FnkindVals = ['query', 'mutation', 'action'] as const
export type  Fnkind     = typeof FnkindVals[number]

/** Where the logs of a report should be looked for: this build of the app, and its backend */
export type WhereaboutsT = { build: string, backend: string }

/** The letter Convex's client prefixes a function's path with, for each kind of function */
const FnkindForLetter: TY.Bag<Fnkind> = { Q: 'query', M: 'mutation', A: 'action' }

/** `[CONVEX M(hunts:perform)] ` at the head of an error the Convex client raised */
const ConvexPrefixRe = /^\[CONVEX ([QMA])\(([^)]+)\)\] /
/** `[Request ID: 5c0f...] ` anywhere in it */
const RequestIdRe    = /\[Request ID: ([^\]]+)\] ?/
/** The line the Convex client closes its errors with */
const CalledBy       = 'Called by client'

/** A refusal's data, as `refuse` throws it */
const RefusalShape    = Z.object({ failurekind: Z.string(), message: Z.string() })
/** One issue Zod found, as a refusal carries it */
const IssuePathShape  = Z.array(Z.union([Z.string(), Z.number()]))
const IssueShape      = Z.object({ message: Z.string(), path: IssuePathShape.optional() })
/** The data convex-helpers gives an argument its Zod schema refused, or a refusal for something invalid */
const IssuesShape     = Z.object({ ZodError: Z.array(IssueShape) })

/** The deepest a chain of causes is followed; a cycle would otherwise never end */
const CausesMax = 8

/**
 * What `err` tells about itself, whatever was thrown: see `PostmortemT`.
 *
 * @param err - What a call rejected with, or a render threw.
 * @returns The postmortem.
 *
 * @example of(refusal).summary  // => 'refused (reviewNotOpened): Open your review of this quiz first.'
 * @example of(hiddenServerError).summary  // => 'failed on the server, which keeps the reason to itself: find request 5c0f in the Convex logs'
 * @example of(new TypeError('x is undefined')).summary  // => 'TypeError: x is undefined'
 */
export function of(err: unknown): PostmortemT {
  const message = err instanceof Error ? err.message : String(err)
  const prefix = ConvexPrefixRe.exec(message)
  const request_id = RequestIdRe.exec(message)?.[1] ?? null
  const said = withoutCalledBy(message.replace(ConvexPrefixRe, '').replace(RequestIdRe, ''))
  const data = err instanceof ConvexError ? (err.data as unknown) : undefined
  const refusal = RefusalShape.safeParse(data)
  const issues = issuesOf(data)
  const hidden = prefix !== null && said === 'Server Error'
  const facts = {
    refused:     err instanceof ConvexError,
    failurekind: refusal.success ? refusal.data.failurekind : null,
    fnpath:      prefix?.[2] ?? null,
    fnkind:      FnkindForLetter[prefix?.[1] ?? ''] ?? null,
    request_id,
    hidden,
    issues,
    flavor:      err instanceof Error ? err.name : typeof err,
    story:       err instanceof CoreError ? err.story : null,
    causes:      causesOf(err),
  }
  return { summary: summaryOf(facts, refusal.success ? refusal.data.message : null, said, err), ...facts }
}

/** The one line a postmortem leads with */
function summaryOf(facts: Omit<PostmortemT, 'summary'>, refusalMessage: string | null, said: string, err: unknown): string {
  if (facts.refused) {
    const why = refusalMessage ?? (facts.issues.length > 0 ? facts.issues.join('; ') : said)
    return `refused (${facts.failurekind ?? 'invalid'}): ${why}`
  }
  if (facts.hidden) {
    return `failed on the server, which keeps the reason to itself: find request ${facts.request_id ?? '(no id)'} in the Convex logs`
  }
  const firstLine = said.split('\n', 1)[0] ?? ''
  return err instanceof Error ? `${err.name}: ${firstLine}` : firstLine
}

/** `message` without the line the Convex client closes its errors with, trimmed */
function withoutCalledBy(message: string): string {
  const lines = message.trimEnd().split('\n')
  return (lines.at(-1)?.trim() === CalledBy ? lines.slice(0, -1) : lines).join('\n').trim()
}

/** What a refused argument or row got wrong, each with the path to the field it was about */
function issuesOf(data: unknown): string[] {
  const shaped = IssuesShape.safeParse(data)
  if (! shaped.success) { return [] }
  return shaped.data.ZodError.map(({ message, path }) => (path && path.length > 0 ? `${path.join('.')}: ${message}` : message))
}

/** `err`'s causes, outermost first, each as its message */
function causesOf(err: unknown): string[] {
  const causes: string[] = []
  let cause = err instanceof Error ? err.cause : undefined
  while (cause !== undefined && causes.length < CausesMax) {
    causes.push(cause instanceof Error ? `${cause.name}: ${cause.message}` : UU.jsonify(cause))
    cause = cause instanceof Error ? cause.cause : undefined
  }
  return causes
}

/**
 * This build of the app and the backend it talks to, as a report names them. Vercel says which
 * commit it built; anywhere else the build is `local`.
 *
 * @example whereabouts()  // => { build: '67284e7', backend: 'https://prestigious-coyote-542.convex.cloud' }
 */
export function whereabouts(): WhereaboutsT {
  return {
    build:   process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    backend: process.env.NEXT_PUBLIC_CONVEX_URL ?? '(none)',
  }
}

/**
 * Say in the console that `attempt` failed, with everything `err` tells: one line to read at a
 * glance, then the postmortem and `context` to unfold, then the error itself with its stack. A
 * refusal is a warning, since the server meant it; anything else is an error.
 *
 * Nothing sensitive goes in `context`: a browser key never does.
 *
 * @param attempt - What was being tried, as a reader of the console would say it.
 * @param err - What it failed with.
 * @param context - What was being worked on: the action, the labels, the connection.
 * @returns The postmortem, for a caller that goes on to show part of it.
 *
 * @example report('keep a change to the quiz', err, { action })
 *   // console: Triquet: could not keep a change to the quiz — refused (reviewNotOpened): Open your review of this quiz first. { ... } ConvexError ...
 */
export function report(attempt: string, err: unknown, context: TY.AnyBag = {}): PostmortemT {
  const postmortem = of(err)
  const say = postmortem.refused ? console.warn : console.error
  say(`Triquet: could not ${attempt} — ${postmortem.summary}`, { ...postmortem, ...context, ...whereabouts(), at: new Date().toISOString() }, err)
  return postmortem
}
