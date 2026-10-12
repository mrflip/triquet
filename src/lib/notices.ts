import * as PA from './vv/patterns'
import type { SmithT } from './rows'

/**
 * Every string the tool shows an author in place of a result, gathered in one place.
 *
 * A failure reaches the author as a sentence, never as a code, and never as a blank cell -- so
 * these are content, and they live together where they can be read as a set and revised as a set.
 */

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
  memberLabelShape:      'A handle is lowercase letters, numbers and single underscores, starting with a letter.',
  memberLabelUnfinished: 'A handle is at least 6 characters long, ending in a letter or number.',
  memberLabelReserved:   "No one goes by that handle: it's kept for the app's own use.",
  memberLabelNeeded:     'Type the handle they go by.',
  userlabelShape:       'A handle is lowercase letters, numbers and single underscores, starting with a letter.',
  userlabelUnfinished:  'A handle is at least 6 characters long, ending in a letter or number.',
  userlabelReserved:    'That handle is kept for the app\'s own use. Add to it, as my_name or name_2.',
  userlabelGateTitle:       'Enter your name and handle to join',
  untitledQuiz:         'Untitled quiz',
  smithsNoteBlank:      'The theme, the meta, what is left to do…',
  recapHeadBlank:       'First, a huge thank you to the playtesters: {{quiz.playtesters}}…',
  recapTailBlank:       'Thanks for playing! See you next season…',
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
  nothingToMilestone:   'This browser holds no history of this hunt yet — try again in a moment, once it has been read.',
  noHistoryHere:        'This browser holds no history of this hunt yet — it starts when a smith opens one of its quizzes here.',
  noRepositories:       'No history has been kept in this browser yet.',
  repoNotDownloaded:    "That history wasn't downloaded",
  deletingHunt:         'To delete a hunt, please delete its quizzes.',
  huntTitleTooLong:     'That name is too long.',
  huntLabelShape:       'Enter a label: letters, digits and single underscores, starting with a letter.',
  branchShape:          'Enter a branch: letters, digits and single underscores, starting with a letter.',
  labelReserved:        'That word is kept for the tool\'s own use. Add to it, as my_label or label_2.',
  branchHelp:           'A new name starts a branch; an old one goes back to it.',
  huntRelabelMoves:     "Changing this label updates the URL. Old links won't find this page anymore.",
  archivingQuestions:   "An archived question leaves the grid, the playtest and the exports, but stays with the quiz. To un-archive it, open the gear (Manage this quiz) and find it under Archived questions.",
  showingQuestions:     "A secondary question is an alternate: its title is shown in italics with (alt) after it, and it sorts after its peers. An archived one leaves the grid, the playtest and the exports; un-archive it from the gear's Archived questions.",
  noArchivedQuestions:  'No questions are archived.',
  importSentToLocked:   'This quiz is locked, so the paste sent here from another quiz was not read. Unlock it and paste again.',
  libraryReadOnly:      'Only an admin of this deployment can change the library, so here it is only to copy out.',
  orSignInWithGoogle:   'Or sign in with Google, and take your handle to every device.',
  nameChoiceTitle:      'Keep which handle?',
  nameChoiceAbout:      "The handle you don't keep is retired: nobody else can take it. Every hunt keeps its address either way.",
  nameChoiceLater:      'Decide later',
  signOut:              'Sign out',
  staySignedIn:         'Stay signed in',
  reviewingSealedTitle: 'Reviewing comes with Google',
  reviewingSealed:      'This hunt is yours to work on, but reviewing a quiz, your own included, comes with signing in with Google.',
} as const

/** Why the server refused a change, or a request, in the author's language: one per `failurekind` */
export const RefusalNotices = {
  notPermitted:     "You can't change this hunt.",
  quizLocked:       'This quiz is locked — unlock it to change it.',
  quizGone:         'That quiz is no longer here; someone may have deleted it.',
  realmGone:        'That realm is no longer part of this hunt.',
  huntGone:         'That hunt is no longer here.',
  questionGone:     'That question is no longer in this quiz.',
  sortStale:        'The questions changed while they were being sorted — sort again.',
  widgetGone:       'That widget is no longer in the library.',
  widgetingGone:    'That widgeting is no longer in this quiz.',
  columnGone:       'That column is no longer in this quiz.',
  labelTaken:       'That label is already taken here — choose another.',
  sourceUnshowable: "That column would show a widgeting this quiz doesn't have.",
  untemplatable:    "That would template a widgeting this quiz doesn't have.",
  widgetInUse:      'A widgeting still works this widget — remove the widgeting first.',
  widgetingShown:   'A column still shows that widgeting — remove the column first.',
  formularyFixed:   "A widget's formulary is fixed once it is made — make a new widget instead.",
  notStored:        "That widgeting isn't asked from its cell; there is nothing to record.",
  notEntered:       "That widgeting's cells aren't typed into.",
  tierUnoffered:    'Only a formula or an entry of one value can run once for the whole quiz.',
  wrongTier:        'That widgeting runs at the other level: once for the whole quiz, or for each question.',
  entryKindFixed:   "An entry's kind is fixed once it is made — make a new widget instead.",
  regexRisky:       'That regular expression could take too long to match some text — make it simpler.',
  lastQuiz:         "A realm's last quiz can't be deleted on its own — it goes with its hunt.",
  huntNotEmptied:   AppNotices.deletingHunt,
  notInRealm:       'That quiz belongs to another realm.',
  notIdentified:    'Say who you are first.',
  notSignedIn:      "This browser isn't signed in yet — try again in a moment.",
  userlabelClaimed: "Someone else holds that handle. Choose a different one — or, if it's yours, go back to the browser where you first chose it.",
  userlabelSet:     'This browser already has a handle, and a handle is chosen once.',
  reviewNotOpened:  'Open your review of this quiz first.',
  userUnknown:      userUnknownNotice('…'),
  ownHuntship:       "You can't take yourself off this hunt or change your own role — another smith can.",
  questionsFull:    `A quiz holds at most ${String(PA.QuestionsPerQuiz.max)} questions.`,
  widgetingsFull:   `A quiz holds at most ${String(PA.WidgetingsPerQuiz.max)} widgetings.`,
  columnsFull:      `A quiz holds at most ${String(PA.ColumnsPerQuiz.max)} columns.`,
  reviewsFull:      `A quiz holds at most ${String(PA.ReviewsPerQuiz.max)} reviews.`,
  topsFull:         `You already have a top ${String(PA.PicksPerReview.max)} — lower one of them first.`,
  mehsFull:         `You already have a meh ${String(PA.PicksPerReview.max)} — lower one of them first.`,
  quizzesFull:      `A realm holds at most ${String(PA.QuizzesPerRealm.max)} quizzes.`,
  libraryFull:      `The library holds at most ${String(PA.WidgetsInLibrary.max)} widgets.`,
  huntsFull:        `The app holds at most ${String(PA.HuntsInApp.max)} hunts.`,
  orgFull:          `One handle may make at most ${String(PA.HuntsPerOrg.max)} hunts.`,
  huntshipsFull:    `A hunt holds at most ${String(PA.HuntshipsPerHunt.max)} members.`,
  sealedHunts:      'Sign in with Google to make more hunts than the one named for your handle.',
  sealedRelabel:    'Sign in with Google to relabel your hunt: its label is your handle until then.',
  sealedDelete:     'Sign in with Google to delete your hunt.',
  sealedMembers:    'Sign in with Google to bring others onto your hunt.',
  sealedJoin:       "That handle isn't signed in with Google, so it can't be put on a hunt until it is.",
  sealedReview:     'Sign in with Google to review quizzes, your own included.',
  nameChoiceGone:   'That choice of handle has already been made — reload the page to see the handle you have.',
  botsOff:          'Asking Claude is switched off on this server for now — everything else still works.',
} as const

export type Refusalkind = keyof typeof RefusalNotices

/** Why an ask failed, in the author's language */
export const AskFailureNotices = {
  notPermitted:   RefusalNotices.botsOff,
  rateLimited:    'Too many requests right now — try again shortly.',
  declined:       'Claude declined to answer this one.',
  emptyAnswer:    'Got an empty answer — try again.',
  unreadable:     "Couldn't read that as structured data — try again.",
  cutShort:       'The answer ran out of room before it finished — give the widget more tokens.',
  keyRefused:     "This server's key isn't allowed to ask Claude that.",
  sessionExpired: 'Sign in again to keep asking Claude.',
  connection:     'A connection hiccup — try again.',
  unknown:        'Something went wrong asking the model.',
  unavailable:    "Asking Claude isn't available in this view.",
} as const

export type AskFailurekind = keyof typeof AskFailureNotices

/** What a Google sign-in that did not finish is headed, when the browser comes back to the app as it was */
export const GoogleSignInUnfinished = "Google sign-in didn't finish"

/**
 * What a browser is told when a Google sign-in it started did not finish (cancelled at Google,
 * started too long ago, or refused), and it is still the user it was: by its handle, when it
 * holds one. Nothing about it has changed.
 *
 * @example googleSignInUnfinishedNotice('flip_kromer')  // => "You're still flip_kromer, as before. Try again."
 * @example googleSignInUnfinishedNotice(null)           // => "You're still signed in as before. Try again."
 */
export function googleSignInUnfinishedNotice(userlabel: string | null): string {
  return userlabel === null ? "You're still signed in as before. Try again." : `You're still ${userlabel}, as before. Try again.`
}

/**
 * What an anonymous user is offered beside the Google sign-in button: its handle, kept on every
 * device.
 *
 * @example keepHandleNotice('mrflip')  // => 'Sign in with Google to keep mrflip on every device.'
 */
export function keepHandleNotice(userlabel: string): string {
  return `Sign in with Google to keep ${userlabel} on every device.`
}

/**
 * What the front door says above the name and handle of a user signed in with Google that holds no
 * handle yet, by the email Google sent, when it sent one.
 *
 * @example googleGateNotice('flip@example.com')  // => 'Signed in with Google as flip@example.com. Your name is what others see, …'
 */
export function googleGateNotice(email: string | null): string {
  const signedIn = email === null ? 'Signed in with Google.' : `Signed in with Google as ${email}.`
  return `${signedIn} Your name is what others see, and you can change it later. Your handle is how others add you to a hunt: if nobody goes by it yet, it becomes yours for good. Here is one made from your Google name; change it if you like.`
}

/**
 * Who the user menu says its owner is signed in as: the email Google sent, to its owner alone.
 *
 * @example signedInAsNotice('flip@example.com')  // => 'Signed in with Google as flip@example.com'
 * @example signedInAsNotice(null)                // => 'Signed in with Google'
 */
export function signedInAsNotice(email: string | null): string {
  return email === null ? 'Signed in with Google' : `Signed in with Google as ${email}`
}

/**
 * What signing out asks first: the browser goes back to having no handle, and how to be the user
 * again.
 *
 * @example signOutQuestion('mrflip')  // => 'Sign out? This browser goes back to having no handle. To be mrflip here again, sign in with Google.'
 * @example signOutQuestion(null)      // => 'Sign out? This browser goes back to having no handle.'
 */
export function signOutQuestion(userlabel: string | null): string {
  const again = userlabel === null ? '' : ` To be ${userlabel} here again, sign in with Google.`
  return `Sign out? This browser goes back to having no handle.${again}`
}

/**
 * What the name choice a merge left asks: which handle to keep, the merged browser's or the
 * Google account's.
 *
 * @example nameChoiceQuestion('mrflip', 'flippy')  // => 'This browser was mrflip; your Google account is flippy. Keep which?'
 */
export function nameChoiceQuestion(merged: string, own: string): string {
  return `This browser was ${merged}; your Google account is ${own}. Keep which?`
}

/**
 * Why a smith could not add `label` to a hunt: nobody has chosen that handle yet. The refusal
 * `userUnknown` says it of the userlabel refused.
 *
 * @example userUnknownNotice('flip_kromer')  // => 'Nobody goes by the handle "flip_kromer". They need to visit the app and choose it first.'
 */
export function userUnknownNotice(label: string): string {
  return `Nobody goes by the handle "${label}". They need to visit the app and choose it first.`
}

/**
 * What an address says when no hunt answers to it: the org it named, and the hunt's label (an old
 * address names no org).
 *
 * @example noSuchHuntNotice('pat_smith', 'spring_hunt')  // => 'There is no hunt labelled “spring_hunt” in ~pat_smith.'
 * @example noSuchHuntNotice(null, 'spring_hunt')  // => 'There is no hunt labelled “spring_hunt”.'
 */
export function noSuchHuntNotice(org: string | null, huntLabel: string): string {
  return org === null ? `There is no hunt labelled “${huntLabel}”.` : `There is no hunt labelled “${huntLabel}” in ~${org}.`
}

/** Any of several names, as a sentence says them: "Flip, Ada, or Grace" */
const EitherOf = new Intl.ListFormat('en', { type: 'disjunction' })

/** All of several names, as a sentence says them: "Masie, Artie, and Poppy" */
const AllOf = new Intl.ListFormat('en', { type: 'conjunction' })

/**
 * Why a widgeting cannot be removed: the columns that show it, by what each is called on screen.
 * The refusal `widgetingShown` says it of no column in particular.
 *
 * @param columnNames - What each column showing it is called: its title, or its label when untitled.
 *
 * @example widgetingShownNotice(['Sum'])  // => 'The column “Sum” still shows that widgeting — remove the column first.'
 * @example widgetingShownNotice(['Masie', 'Artie'])  // => 'The columns “Masie” and “Artie” still show that widgeting — remove them first.'
 */
export function widgetingShownNotice(columnNames: readonly string[]): string {
  const quoted = columnNames.map((columnName) => `“${columnName}”`)
  if (quoted.length === 0) { return RefusalNotices.widgetingShown }
  if (quoted.length === 1) { return `The column ${AllOf.format(quoted)} still shows that widgeting — remove the column first.` }
  return `The columns ${AllOf.format(quoted)} still show that widgeting — remove them first.`
}

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
 * What someone not on a hunt is told when an address takes them into it: to contact its smith for
 * an invitation, naming the handle to invite.
 *
 * @param smiths - The hunt's smiths.
 * @param label - Their userlabel, which a smith would add.
 *
 * @example notOnHuntNotice([{ label: 'flip_kromer', title: 'Flip' }], 'ada_lovelace')  // => 'You are not yet a member of this hunt. To be invited, contact its smith, Flip (flip_kromer), …'
 */
export function notOnHuntNotice(smiths: readonly SmithT[], label: string): string {
  return `You are not yet a member of this hunt. To be invited, contact ${smithsWhom(smiths)}, and give them your handle, “${label}”. This page opens for you as soon as they add you.`
}

/**
 * What an anonymous visitor not on a hunt is told when an address takes them into it: to sign in
 * with Google first, since a smith can put a handle on a hunt only once it is signed in (`sealedJoin`),
 * and then whom to ask.
 *
 * @param smiths - The hunt's smiths.
 * @param label - Their userlabel, which a smith would add.
 *
 * @example sealedNotOnHuntNotice([{ label: 'flip_kromer', title: 'Flip' }], 'ada_lovelace')  // => 'You are not yet a member of this hunt. Sign in with Google first, then contact its smith, Flip (flip_kromer), …'
 */
export function sealedNotOnHuntNotice(smiths: readonly SmithT[], label: string): string {
  return `You are not yet a member of this hunt. Sign in with Google first, then contact ${smithsWhom(smiths)}, and give them your handle, “${label}”: a handle is put on a hunt only once it is signed in. This page opens for you as soon as they add you.`
}

/** The smiths to contact, as a sentence names them after "contact": its smith, one of its smiths, or a smith of this hunt when none are known */
function smithsWhom(smiths: readonly SmithT[]): string {
  const which = smiths.length > 1 ? 'one of its smiths' : 'its smith'
  return smiths.length === 0 ? smithsNamed(smiths) : `${which}, ${smithsNamed(smiths)}`
}

/**
 * What a reviewer is told when an address asks for the smiths' presentation of a quiz: who could
 * make them a smith, and how.
 *
 * @param smiths - The hunt's smiths.
 * @param label - The reviewer's userlabel.
 *
 * @example notASmithNotice([{ label: 'flip_kromer', title: 'Flip' }], 'ada_lovelace')  // => 'You are a reviewer on this hunt, not a smith. Ask Flip (flip_kromer) to make you one: …'
 */
export function notASmithNotice(smiths: readonly SmithT[], label: string): string {
  return `You are a reviewer on this hunt, not a smith. Ask ${smithsNamed(smiths)} to make you one: they can change the role of your handle, “${label}”, in the Members panel beneath any of its quizzes.`
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
  chainTargetArchived: '(archived)',
  truncated:         '· cut short',
  imported:          'imported',
} as const
