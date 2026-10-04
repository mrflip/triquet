import * as PA from './vv/patterns'
import type { SmithT } from './rows'

/**
 * Every string the tool shows an author in place of a result, gathered in one place.
 *
 * A failure reaches the author as a sentence, never as a code, and never as a blank cell -- so
 * these are content, and they live together where they can be read as a set and revised as a set.
 */

/** Why the server declined to carry out an act it keeps switched off unless told otherwise: one per `ApprovalAct` */
export const ApprovalNotices = {
  anthropic_bot: "Asking Claude is switched off on this server for now — everything else still works.",
} as const

/** Why an ask failed, in the author's language */
export const AskFailureNotices = {
  notPermitted:   ApprovalNotices.anthropic_bot,
  rateLimited:    'Too many requests right now — try again shortly.',
  declined:       'Claude declined to answer this one.',
  emptyAnswer:    'Got an empty answer — try again.',
  unreadable:     "Couldn't read that as structured data — try again.",
  cutShort:       'The answer ran out of room before it finished — give the widget more tokens.',
  accountOff:     'Asking Claude is off for this account.',
  sessionExpired: 'Sign in again to keep asking Claude.',
  connection:     'A connection hiccup — try again.',
  unknown:        'Something went wrong asking the model.',
  unavailable:    "Asking Claude isn't available in this view.",
} as const

export type AskFailurekind = keyof typeof AskFailureNotices

/** Notices about the tool itself rather than about one cell */
export const AppNotices = {
  changeFailed:         "Couldn't keep that change — nothing was altered. Try it again, or reload the page.",
  changeNotKept:        "Your change wasn't kept",
  changeNotSent:        "Couldn't send that change — the quiz isn't open here yet. Reload the page and try it again.",
  pageFailed:           "This page couldn't be shown. Trying again often works; if it doesn't, send us what it says below.",
  opening:              'Opening…',
  openingHunts:         'Opening your hunts…',
  openingHunt:          'Opening the hunt…',
  noHunts:              'No hunts yet.',
  identLabelShape:      'An ident label is 6 to 24 lowercase letters, digits and single underscores, starting with a letter. Spaces become underscores.',
  identLabelNeeded:     'Type the label you go by.',
  identGateTitle:       'Enter your username (6+ letters, a-z) to join',
  untitledQuiz:         'Untitled quiz',
  smithsNoteBlank:      'The theme, the meta, what is left to do…',
  untitledQuestion:     'Untitled question',
  reviewShared:         'Shared with the smiths.',
  reviewNotShared:      'Not shared with the smiths yet.',
  noReviewsShared:      'No reviews have been shared yet.',
  othersReviewsBlurb:   "What the other reviewers have shared about this quiz. They can read yours while it's shared, too.",
  othersReviewsHidden:  "Share your review to see what the other reviewers have shared.",
  answerSeen:           'Seen before',
  answerLocked:         '(...click to reveal answer...)',
  copied:               'Copied',
  copyRefused:          'Selected — press Ctrl/Cmd+C',
  copyFailed:           "Couldn't reach the clipboard — nothing was copied.",
  exportUnread:         "Couldn't read the hunt for the export — try again.",
  nothingToMilestone:   'No history here yet — make an edit first.',
  noHistoryHere:        "This browser holds no history for this quiz yet — it starts at your next edit.",
  noRepositories:       'No history has been kept in this browser yet.',
  deletingHunt:         'To delete a hunt, please delete its quizzes.',
  huntTitleTooLong:     'That name is too long.',
  huntLabelShape:       'Enter a label: letters, digits and single underscores, starting with a letter.',
  huntRelabelMoves:     "Changing this label updates the URL. Old links won't find this page anymore.",
} as const

/** Why the server refused a change, in the author's language: one per `failurekind` */
export const RefusalNotices = {
  notPermitted:     "You can't change this hunt.",
  quizLocked:       'This quiz is locked — unlock it to change it.',
  quizGone:         'That quiz is no longer here; someone may have deleted it.',
  realmGone:        'That realm is no longer part of this hunt.',
  huntGone:         'That hunt is no longer here.',
  questionGone:     'That question is no longer in this quiz.',
  widgetGone:       'That widget is no longer in the library.',
  widgetingGone:    'That widgeting is no longer in this quiz.',
  columnGone:       'That column is no longer in this quiz.',
  labelTaken:       'That label is already taken here — choose another.',
  sourceUnshowable: "That column would show a widgeting this quiz doesn't have.",
  widgetInUse:      'A widgeting still works this widget — remove the widgeting first.',
  formularyFixed:   "A widget's formulary is fixed once it is made — make a new widget instead.",
  notStored:        "That widgeting isn't asked from its cell; there is nothing to record.",
  notEntered:       "That widgeting's cells aren't typed into.",
  entryKindFixed:   "An entry's kind is fixed once it is made — make a new widget instead.",
  lastQuiz:         "A realm's last quiz can't be deleted on its own — it goes with its hunt.",
  huntNotEmptied:   AppNotices.deletingHunt,
  notInRealm:       'That quiz belongs to another realm.',
  notIdentified:    'Say who you are first.',
  reviewNotOpened:  'Open your review of this quiz first.',
  identUnknown:     identUnknownNotice('…'),
  ownHunting:       "You can't take yourself off this hunt or change your own role — another smith can.",
  questionsFull:    `A quiz holds at most ${String(PA.QuestionsPerQuiz.max)} questions.`,
  widgetingsFull:   `A quiz holds at most ${String(PA.WidgetingsPerQuiz.max)} widgetings.`,
  columnsFull:      `A quiz holds at most ${String(PA.ColumnsPerQuiz.max)} columns.`,
  reviewsFull:      `A quiz holds at most ${String(PA.ReviewsPerQuiz.max)} reviews.`,
  topsFull:         `You already have a top ${String(PA.PicksPerReview.max)} — lower one of them first.`,
  mehsFull:         `You already have a meh ${String(PA.PicksPerReview.max)} — lower one of them first.`,
  quizzesFull:      `A realm holds at most ${String(PA.QuizzesPerRealm.max)} quizzes.`,
  libraryFull:      `The library holds at most ${String(PA.WidgetsInLibrary.max)} widgets.`,
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

/** Any of several names, as a sentence says them: "Flip, Ada, or Grace" */
const EitherOf = new Intl.ListFormat('en', { type: 'disjunction' })

/**
 * `smiths` as a sentence names them, any one of them to be asked, each by title and label (by
 * label alone when that is all there is); "a smith of this hunt" when none are known.
 *
 * @example smithsNamed([{ label: 'flip_kromer', title: 'Flip' }, { label: 'ada_lovelace', title: '' }])  // => 'Flip (flip_kromer) or ada_lovelace'
 */
function smithsNamed(smiths: readonly SmithT[]): string {
  if (smiths.length === 0) { return 'a smith of this hunt' }
  return EitherOf.format(smiths.map(({ label, title }) => (title && title !== label ? `${title} (${label})` : label)))
}

/**
 * What someone not on a hunt is told when an address takes them into it: who could add them, and
 * how.
 *
 * @param smiths - The hunt's smiths.
 * @param label - The label of the ident they are now, which a smith would add.
 *
 * @example notOnHuntNotice([{ label: 'flip_kromer', title: 'Flip' }], 'ada_lovelace')  // => 'You are not yet a member of this hunt. Ask Flip (flip_kromer) to please add you: …'
 */
export function notOnHuntNotice(smiths: readonly SmithT[], label: string): string {
  return `You are not yet a member of this hunt. Ask ${smithsNamed(smiths)} to please add you: they can put your ident, “${label}”, on the hunt from the Members panel beneath any of its quizzes, and this page opens for you as soon as they do.`
}

/**
 * What a reviewer is told when an address asks for the smiths' presentation of a quiz: who could
 * make them a smith, and how.
 *
 * @param smiths - The hunt's smiths.
 * @param label - The label of the reviewer's ident.
 *
 * @example notASmithNotice([{ label: 'flip_kromer', title: 'Flip' }], 'ada_lovelace')  // => 'You are a reviewer on this hunt, not a smith. Ask Flip (flip_kromer) to make you one: …'
 */
export function notASmithNotice(smiths: readonly SmithT[], label: string): string {
  return `You are a reviewer on this hunt, not a smith. Ask ${smithsNamed(smiths)} to make you one: they can change the role of your ident, “${label}”, in the Members panel beneath any of its quizzes.`
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
  butnotNoChain:     'Pick a chain target',
  butnotNoChainRead: 'Oops: no hint is attached',
  butnotNoTarget:    'Target question not found',
  butnotNoHint:      'No hint entered yet',
  nothingExpressed:  '–',
  expressedError:    '⚠',
  chainUnset:        '— pick —',
  chainTargetUnnamed: '(no title yet)',
  truncated:         '· cut short',
} as const
