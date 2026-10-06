import _ from 'es-toolkit/compat'
import type { WithoutSystemFields } from 'convex/server'
import { wrapDatabaseReader, wrapDatabaseWriter, type RLSConfig, type Rules } from 'convex-helpers/server/rowLevelSecurity'
import type { DataModel, Doc, Id, TableNames } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import * as Actor from '../src/lib/actor'
import * as Approve from '../src/lib/approve'
import type { HuntAffirmsT } from '../src/models/actions'
import type { ClaimsOf } from './authorize'

// The rules a hunt's function holds its database to, once its affirms are checked: the structural
// backstop behind every policy, so that a function which forgets a check still cannot reach
// another hunt. The builders in `functions.ts` (`zHuntQuery`, `zHuntMutation`) hand a handler the
// database these rules wrap (convex-helpers' row-level security), never the bare one.
//
// One rule per table, each a non-async function of the claims and a row that reads nothing:
// whether the row may be seen, changed or deleted (`modify`), and inserted. A row the rules hide
// reads as absent (`get` answers null, a query passes over it); a write to one throws, as the bug
// it is. A table with no rule is not reachable at all: an ident's identings, and Convex Auth's
// tables. A patch or replace is judged by the row as it stands, not as it would become: the copies
// a row carries of its hunt never change (`notes/convex.md`, *Denormalized fields*).
//
// Two facts a write must know span every hunt, and so are not asked through this database: whose
// a hunt label is, and whether a widget is worked anywhere (`CensusT` in `reading.ts`).
//
// The library belongs to no hunt, and a hunt's function never writes it. Its own mutation
// (`widgets.perform`, built by `zLibraryMutation`) holds a database held to `LibraryRules`: the
// library's widgets, and nothing of any hunt.

/** What a scoped database is scoped by: the checked claims of an actor on one hunt, and for a read of a quiz's reviews, their own review of it (null when they have none) */
export type ScopeClaimsT = ClaimsOf<HuntAffirmsT> & { own_review?: Doc<'reviews'> | null }

/** One table's rule: whether the claims `CT` may see a row, change or delete it, and insert one */
type TableRuleT<TN extends TableNames, CT> = {
  read:   (claims: CT, row: Doc<TN>) => boolean
  modify: (claims: CT, row: Doc<TN>) => boolean
  insert: (claims: CT, row: WithoutSystemFields<Doc<TN>>) => boolean
}

/** A rule for every table a scoped database reaches, by the claims `CT` it is scoped by; a table left out is not reachable */
type TableRulesT<CT = ScopeClaimsT> = { [TN in TableNames]?: TableRuleT<TN, CT> }

/** A row of the claims' hunt: one that carries the hunt it belongs to, and it is theirs */
function isOfHunt(claims: ScopeClaimsT, row: { hunt_id?: Id<'hunts'> }): boolean {
  return row.hunt_id === claims.hunt_id
}

/** The claims' hunt's own row */
function isTheHunt(claims: ScopeClaimsT, row: { _id: Id<'hunts'> }): boolean {
  return row._id === claims.hunt_id
}

/** Nothing of this table, by these claims */
function never(): boolean {
  return false
}

/** Every row of this table */
function always(): boolean {
  return true
}

/**
 * Whether the claims may write a review or a reviewing of their hunt. In order:
 *
 * * Nothing of another hunt
 * * One's own
 * * A smith's, who deletes the others' with the question, quiz or hunt they are part of
 */
function mayWriteReviewRow(claims: ScopeClaimsT, row: { hunt_id?: Id<'hunts'>, ident_id?: Id<'idents'> }): boolean {
  if (! isOfHunt(claims, row))          { return false } // Nothing of another hunt
  if (row.ident_id === claims.ident_id) { return true }  // One's own
  return Actor.isSmith(claims)                           // A smith's, who deletes the others' with the question, quiz or hunt they are part of
}

/**
 * Whether the claims may be shown `review` (`Approve.mayReadReview`), judged by their own review of
 * its quiz. Their own review rides in the claims for the quiz they read the reviews of; of any
 * other quiz, they are judged as having none, which shows them only their own.
 */
function mayShowReview(claims: ScopeClaimsT, review: Doc<'reviews'>): boolean {
  const ownReview = claims.own_review?.quiz_id === review.quiz_id ? claims.own_review : null
  return Approve.may('read_review', review, claims, ownReview)
}

/** Whether the actor (or the claims, which carry one) may see the library's widgets (`Approve.mayReadLibrary`) */
function mayReadLibrary(actor: Actor.ActorT): boolean {
  return Approve.may('read_library', actor)
}

/** Whether the actor may change the library's widgets (`Approve.mayChangeLibrary`) */
function mayChangeLibrary(actor: Actor.ActorT): boolean {
  return Approve.may('change_library', actor)
}

/** Every row of the claims' hunt, and no other: to see, change, delete or insert */
const HuntOwned = { read: isOfHunt, modify: isOfHunt, insert: isOfHunt } as const

/**
 * What a hunt's mutation may touch. It reads to write: a quiz's reviews to count them against the
 * cap and to delete them with the quiz, so it sees every review of its hunt; it shows none of what
 * it reads.
 *
 * * `hunts` -- its own hunt's row; none is made here (a hunt is made from the hunts list).
 * * The tables a hunt owns -- each row of the hunt, by the hunt it carries.
 * * `reviews`, `reviewings` -- seen across the hunt; written by their writer, or deleted by a smith.
 * * `widgets` -- the library every hunt shares: seen by anyone with a username, never written.
 *   Changing it is an admin's act, on a mutation of its own (`LibraryRules`).
 * * `idents` -- a public persona, its label and title shown to whoever shares a hunt with it, and
 *   named by a smith adding a member: seen, never written (retitling is the ident's own).
 * * `signals` -- each quiz's change signal, of the hunt it carries: seen, never written here. The
 *   database's trigger alone writes it (`signalling.ts`), beneath this database.
 */
export const WritingRules = {
  hunts:      { read: isTheHunt, modify: isTheHunt, insert: never },
  realms:     HuntOwned,
  quizzes:    HuntOwned,
  questions:  HuntOwned,
  widgetings: HuntOwned,
  columns:    HuntOwned,
  widgeteds:  HuntOwned,
  huntings:   HuntOwned,
  reviews:    { read: isOfHunt, modify: mayWriteReviewRow, insert: mayWriteReviewRow },
  reviewings: { read: isOfHunt, modify: mayWriteReviewRow, insert: mayWriteReviewRow },
  widgets:    { read: mayReadLibrary, modify: never, insert: never },
  idents:     { read: always, modify: never, insert: never },
  signals:    { read: isOfHunt, modify: never, insert: never },
} as const satisfies TableRulesT

/**
 * What a hunt's query may see, which is what it shows: as a mutation may touch, but a review only
 * when its reader may read it (`Approve.mayReadReview`). A reviewing is seen through its review,
 * so it is held to its hunt alone; a smith reads the reviewings of others' shared reviews.
 */
export const ReadingRules = {
  ...WritingRules,
  reviews: { ...WritingRules.reviews, read: mayShowReview },
} as const satisfies TableRulesT

/**
 * What the library's mutation may touch, scoped by the actor alone: the library's widgets, seen by
 * anyone with a username and changed by whoever may change the library (`Approve.mayChangeLibrary`).
 * Nothing of any hunt: whether a widget is worked anywhere is the census's to say.
 */
export const LibraryRules = {
  widgets: { read: mayReadLibrary, modify: mayChangeLibrary, insert: mayChangeLibrary },
} as const satisfies TableRulesT<Actor.ActorT>

/** Tables with no rule are not reachable through a scoped database */
const Unlisted: RLSConfig = { defaultPolicy: 'deny' }

/** `rules` as convex-helpers asks for them: each check answered as a promise */
function asHelperRules<CT>(rules: TableRulesT<CT>): Rules<CT, DataModel> {
  // Each rule keeps its table's row type; the map over tables cannot say so.
  return _.mapValues(rules, (rule) => rule && ({
    read:   (claims: CT, row: never) => Promise.resolve(rule.read(claims, row)),
    modify: (claims: CT, row: never) => Promise.resolve(rule.modify(claims, row)),
    insert: (claims: CT, row: never) => Promise.resolve(rule.insert(claims, row)),
  })) as Rules<CT, DataModel>
}

const HelperReadingRules = asHelperRules(ReadingRules)
const HelperWritingRules = asHelperRules(WritingRules)
const HelperLibraryRules = asHelperRules<Actor.ActorT>(LibraryRules)

/**
 * `db` as a hunt's query holds it: seeing only what `ReadingRules` let `claims` see.
 *
 * @param db - The query's own database.
 * @param claims - The checked claims of the actor on the hunt.
 *
 * @example const db = scopedReader(ctx.db, claims); await db.get('quizzes', other_hunts_quiz_id)  // => null
 */
export function scopedReader(db: QueryCtx['db'], claims: ScopeClaimsT): QueryCtx['db'] {
  return wrapDatabaseReader(claims, db, HelperReadingRules, Unlisted)
}

/**
 * `db` as a hunt's mutation holds it: seeing, changing and inserting only what `WritingRules`
 * let `claims` touch. A write to anything else throws.
 *
 * @param db - The mutation's own database.
 * @param claims - The checked claims of the actor on the hunt.
 *
 * @example await scopedWriter(ctx.db, claims).delete('quizzes', other_hunts_quiz_id)  // throws
 */
export function scopedWriter(db: MutationCtx['db'], claims: ScopeClaimsT): MutationCtx['db'] {
  return wrapDatabaseWriter(claims, db, HelperWritingRules, Unlisted)
}

/**
 * `db` as the library's mutation holds it: seeing and writing the library's widgets as
 * `LibraryRules` let `actor`, and nothing else: a row of any hunt reads as absent, and a write it
 * may not make throws.
 *
 * @param db - The mutation's own database.
 * @param actor - Who is acting, once the policy of their action has let them.
 *
 * @example await libraryWriter(ctx.db, ctx.actor).get('quizzes', quiz_id)  // => null: no hunt's rows are reachable
 */
export function libraryWriter(db: MutationCtx['db'], actor: Actor.ActorT): MutationCtx['db'] {
  return wrapDatabaseWriter(actor, db, HelperLibraryRules, Unlisted)
}
