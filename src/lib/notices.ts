import * as PA from './vv/patterns'

/**
 * Every string the tool shows an author in place of a result, gathered in one place.
 *
 * A failure reaches the author as a sentence, never as a code, and never as a blank cell -- so
 * these are content, and they live together where they can be read as a set and revised as a set.
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
  changeFailed:         "Couldn't keep that change — nothing was altered. Try it again, or reload the page.",
  opening:              'Opening…',
  openingHunts:         'Opening your hunts…',
  noHunts:              'No hunts yet.',
  identLabelShape:      'An ident label is 6 to 24 lowercase letters, digits and single underscores, starting with a letter. Spaces become underscores.',
  identLabelNeeded:     'Type the label you go by.',
  untitledQuiz:         'Untitled quiz',
  untitledQuestion:     'Untitled question',
  reviewShared:         'Shared with the smiths.',
  reviewNotShared:      'Not shared with the smiths yet.',
  noReviewsShared:      'No reviews have been shared yet.',
  answerSeen:           'Seen before',
  copied:               'Copied',
  copyRefused:          'Selected — press Ctrl/Cmd+C',
  copyFailed:           "Couldn't reach the clipboard — nothing was copied.",
  exportUnread:         "Couldn't read the hunt for the export — try again.",
  nothingToMilestone:   'No history here yet — make an edit first.',
  noHistoryHere:        "This browser holds no history for this quiz yet — it starts at your next edit.",
  noRepositories:       'No history has been kept in this browser yet.',
} as const

/** Why the server refused a change, in the author's language: one per `failurekind` */
export const RefusalNotices = {
  notPermitted:     "You can't change this hunt.",
  quizLocked:       'This quiz is locked — unlock it to change it.',
  quizGone:         'That quiz is no longer here; someone may have deleted it.',
  realmGone:        'That realm is no longer part of this hunt.',
  huntGone:         'That hunt is no longer here.',
  questionGone:     'That question is no longer in this quiz.',
  widgetGone:       'That widget is no longer in this quiz.',
  columnGone:       'That column is no longer in this quiz.',
  expressionGone:   'That expression is no longer in this hunt.',
  labelTaken:       'That label is already taken here — choose another.',
  sourceUnshowable: "That column would show a widget this quiz doesn't have.",
  expressionInUse:  'A widget still works this expression — remove the widget first.',
  lastQuiz:         "A realm's last quiz can't be deleted — make another one first.",
  notInRealm:       'That quiz belongs to another realm.',
  notIdentified:    'Say who you are first.',
  reviewNotOpened:  'Open your review of this quiz first.',
  identUnknown:     identUnknownNotice('…'),
  ownHunting:       "You can't take yourself off this hunt or change your own role — another smith can.",
  questionsFull:    `A quiz holds at most ${String(PA.QuestionsPerQuiz.max)} questions.`,
  widgetsFull:      `A quiz holds at most ${String(PA.WidgetsPerQuiz.max)} widgets.`,
  columnsFull:      `A quiz holds at most ${String(PA.ColumnsPerQuiz.max)} columns.`,
  reviewsFull:      `A quiz holds at most ${String(PA.ReviewsPerQuiz.max)} reviews.`,
  quizzesFull:      `A realm holds at most ${String(PA.QuizzesPerRealm.max)} quizzes.`,
  expressionsFull:  `A hunt holds at most ${String(PA.ExpressionsPerHunt.max)} expressions.`,
  huntsFull:        `The app holds at most ${String(PA.HuntsInApp.max)} hunts.`,
  huntingsFull:     `A hunt holds at most ${String(PA.HuntingsPerHunt.max)} members.`,
} as const

export type Refusalkind = keyof typeof RefusalNotices

/**
 * Why a smith could not add `label` to a hunt: nobody has chosen that ident yet. The refusal
 * `identUnknown` says it of the label refused.
 *
 * @example identUnknownNotice('flip_kromer')  // => 'No ident is labelled "flip_kromer". They need to visit the app and choose it first.'
 */
export function identUnknownNotice(label: string): string {
  return `No ident is labelled "${label}". They need to visit the app and choose it first.`
}

/**
 * What a bot's cell reads when the server holds no credentials for the service behind it.
 *
 * @param title - What the bot is called.
 * @param servicelabel - The service it needs credentials for.
 * @returns A calm sentence: nothing is broken, it just is not set up.
 *
 * @example botUnavailableNotice('Dumdum', 'claude')  // => "Dumdum can't play yet — no Claude credentials are set up for this app."
 */
export function botUnavailableNotice(title: string, servicelabel: string): string {
  const service = servicelabel.charAt(0).toUpperCase() + servicelabel.slice(1)
  return `${title} can't play yet — no ${service} credentials are set up for this app.`
}

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
  nothingExpressed:  '–',
  expressedError:    '⚠',
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
