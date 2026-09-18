/**
 * Every string the tool shows an author in place of a result, gathered in one place.
 *
 * Features-v1 appendices B and C. A failure reaches the author as a sentence, never as a code,
 * and never as a blank cell -- so these are content, and they live together where they can be
 * read as a set and revised as a set.
 */

/** Why an ask failed, in the author's language */
export const AskFailureNotices = {
  notPermitted:   "You haven't allowed this page to ask Claude.",
  rateLimited:    'Too many requests right now — try again shortly.',
  declined:       'Claude declined to answer this one.',
  emptyAnswer:    'Got an empty answer — try again.',
  unreadable:     "Couldn't read that as structured data — try again.",
  accountOff:     'Asking Claude is off for this account.',
  sessionExpired: 'Sign in again to keep asking Claude.',
  connection:     'A connection hiccup — try again.',
  unknown:        'Something went wrong asking the model.',
  unavailable:    "Asking Claude isn't available in this view.",
  missingFromRun: "The combined response didn't include this one — try refreshing it on its own.",
} as const

export type AskFailurekind = keyof typeof AskFailureNotices

/** Notices about the tool itself rather than about one cell */
export const AppNotices = {
  nothingToRecalculate: 'No questions or hints have any text yet — nothing to recalculate.',
  saveFailed:           "Couldn't save to this browser — storage may be full, disabled, or private-browsing",
  untitledQuiz:         'Untitled quiz',
  copied:               'Copied',
  copyRefused:          'Selected — press Ctrl/Cmd+C',
} as const

/** What a cell reads when it holds no result, or a result the author should read differently */
export const CellNotices = {
  askable:           'Double-click to ask',
  thinking:          'Thinking…',
  retry:             'Double-click to try again',
  ishesNoneFound:    'None found',
  butnotNoChain:     'Pick a chain target',
  butnotNoTarget:    'Target question not found',
  butnotNoHint:      'No hint entered yet',
  butnotIshesUnasked: "Not computed yet — double-click that question's Hint Ishes",
  sumUncomputable:   '–',
  chainUnset:        '— pick —',
  chainTargetUnnamed: '(no title yet)',
  stale:             '· stale',
  truncated:         '· cut short',
} as const

/**
 * Notice for a whole batch run that failed, ending in the promise that nothing moved.
 *
 * @param message - Why it failed, already in the author's language.
 * @returns One sentence naming the cause and one reassuring the author.
 *
 * @example bulkRunFailedNotice('A connection hiccup — try again.')
 *   // => "Couldn't recalculate: A connection hiccup — try again. Nothing was changed."
 */
export function bulkRunFailedNotice(message: string): string {
  return `Couldn't recalculate: ${message} Nothing was changed.`
}
