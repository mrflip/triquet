import * as Exporting from '../../src/lib/exporting'
import type { ReviewedT, ShallowHuntT } from '../../src/lib/rows'
import type { QuizT } from '../../src/models/quiz'
import { HuntPartkey, WidgetsPartkey, huntPartOf, quizPartOf, widgetsPartOf, type FedPartT, type HuntReadingT, type UnreadQuizT } from '../../src/state/hunt-feed'
import { present } from './present'

/*
 * The feed's view of a snapshot (`tests/support/snapshots.ts`): the hunt as `hunts.open` shows it,
 * a quiz's reviews as `reviews.forQuiz` reads them, and a whole reading, made by the feed's own
 * part functions. What the history's commits are tested on.
 */

/** `held` as `hunts.open` shows it to its smith: what the feed's hunt-level watch reads */
export function shallowOf(held: Exporting.HuntSnapshotT, hunt_id = 'hunt'): ShallowHuntT {
  const realms = held.realms.map((realm, ii) => ({ _id: `realm${String(ii)}`, label: realm.label, title: realm.title, quizzes: [] }))
  const members = held.members.map((member) => ({ ...member, ident_id: `ident_${member.label}` }))
  return { ...held.hunt, _id: hunt_id, org: Exporting.placeOf(held).org, wheel: held.wheel, members, realms, role: 'smith' } as unknown as ShallowHuntT
}

/** `held`'s reviews of `quiz` as `reviews.forQuiz` reads them, rows and all */
export function reviewedOf(held: Exporting.HuntSnapshotT, quiz: QuizT): ReviewedT[] {
  return (held.reviews[quiz._id] ?? []).map((review, ii) => ({
    ...review, _id: `review${String(ii)}`, _creationTime: ii, hunt_id: 'hunt', quiz_id: quiz._id, ident_id: `ident${String(ii)}`,
    reviewings: review.reviewings.map((reviewing) => ({ ...reviewing, _id: 'reviewing', _creationTime: 1, hunt_id: 'hunt', quiz_id: quiz._id, ident_id: `ident${String(ii)}`, review_id: `review${String(ii)}`, peeked: true })),
  })) as unknown as ReviewedT[]
}

/** What a reading made by `readingOf` is, besides its files */
export type ReadingOptsT = {
  /** Whether it is a tab's first reading of the hunt */
  first?:   boolean
  /** The labels of the quizzes that could not be read: they have no part */
  unread?:  readonly string[]
  /** The hunt's id, which keys its repository */
  hunt_id?: string
}

/**
 * A reading of the hunt `held` is, as the feed would hand it on: each part made by the feed's own
 * part functions, every quiz of every realm read but those `opts.unread` names.
 *
 * @example readingOf(snapshot(), { first: true }).files  // => every file of the hunt but its README
 */
export function readingOf(held: Exporting.HuntSnapshotT, opts: ReadingOptsT = {}): HuntReadingT {
  const hunt = shallowOf(held, opts.hunt_id)
  const unreadLabels = new Set(opts.unread)
  const placed = held.realms.flatMap((realm, ii) => realm.quizzes.map((quiz) => ({ realm, shallow: present(hunt.realms[ii]), quiz })))
  const [skipped, read] = [placed.filter(({ quiz }) => unreadLabels.has(quiz.label)), placed.filter(({ quiz }) => ! unreadLabels.has(quiz.label))]
  const unread = new Map(skipped.map(({ realm, quiz }): [string, UnreadQuizT] => [quiz._id, { realm: realm.label, label: quiz.label }]))
  const parts = new Map<string, FedPartT>([
    [HuntPartkey, huntPartOf(hunt)],
    ...read.map(({ shallow, quiz }): [string, FedPartT] => [quiz._id, quizPartOf(hunt, held.library, shallow, quiz, reviewedOf(held, quiz))]),
    [WidgetsPartkey, widgetsPartOf(held.library, read.map(({ quiz }) => quiz))],
  ])
  const files = new Map(parts.values().flatMap((part) => part.files))
  return { hunt, parts, files, first: opts.first ?? false, unread }
}
