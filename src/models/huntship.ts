import type * as Z from 'zod'
import type * as Actor from '../lib/actor'
import * as Approve from '../lib/approve'
import { Validator } from '../lib/validator'
import type { Mode } from '../lib/addresses'
import { UserValidators } from './user'

/** What a user may do on a hunt: make its quizzes, or playtest them */
export const HuntRoleVals = ['smith', 'reviewer'] as const
export type HuntRole = typeof HuntRoleVals[number]

/** Each role as the screen names it */
export const HuntRoleTitles = { smith: 'Smith', reviewer: 'Reviewer' } as const satisfies Record<HuntRole, string>

export const HuntshipValidators = Validator(({ obj, oneof, stamps, zid }) => {
  const role = oneof(HuntRoleVals)
    .describe('What the user does on the hunt: a smith makes its quizzes and says who else is on it; a reviewer playtests them.')

  const row = obj({
    hunt_id:   zid('hunts')
      .describe('The hunt.'),
    user_id:   zid('users')
      .describe('Who is on it.'),
    userlabel: UserValidators.userlabel
      .describe('The userlabel of who is on it, copied from the user when the huntship is made: a userlabel is set once.'),
    usertitle: UserValidators.title
      .describe('What who is on it is called, copied from the user: retitling a user rewrites it on every huntship the user has.'),
    role,
    ...stamps,
  })
    .describe('One user\'s place on one hunt: at most one per hunt and user, its role replaced rather than a second made.')

  return { role, row }
})

export type HuntshipRowT = Z.output<typeof HuntshipValidators.row>

/** How much each role may do, to compare two: a smith all a reviewer may, and more */
const HuntRoleRanks = { smith: 2, reviewer: 1 } as const satisfies Record<HuntRole, number>

/** The mode the app's own links open a quiz in for each role: a smith works on it, a reviewer playtests it */
const ModeForRole = { smith: 'edit', reviewer: 'playtest' } as const satisfies Record<HuntRole, Mode>

/**
 * The action each mode of a quiz always offers, whatever else it does, and so whose policy says
 * who is shown it: the workbench always offers to lock or unlock the quiz, locked or not; the
 * playtest opens one's review of it the moment it is shown.
 */
const ModeKinds = { edit: 'set_lock', playtest: 'open_review' } as const satisfies Record<Mode, Approve.OfferableKind>

/** One user's place on one hunt, with a role */
export class Huntship implements HuntshipRowT {
  declare hunt_id:   HuntshipRowT['hunt_id']
  declare user_id:   HuntshipRowT['user_id']
  declare userlabel: string
  declare usertitle: string
  declare role:      HuntRole

  /**
   * The mode the app's own links open a quiz in for someone of `role`: a smith works on it, a
   * reviewer playtests it. The link is written for whoever it is shown to; the address it names
   * opens the same screen for anyone (`notes/decisions/urls.md`, rule 4).
   *
   * @example Huntship.modeFor('reviewer')  // => 'playtest'
   */
  static modeFor(role: HuntRole): Mode {
    return ModeForRole[role]
  }

  /**
   * Whether a huntship of role `held` already gives what `role` would: a smith may do all a
   * reviewer may and more, so a smith holds a reviewer's place, never the reverse. What a grant
   * that never lowers a role asks before it writes (`grantHuntship`).
   *
   * @example Huntship.holdsAtLeast('smith', 'reviewer')  // => true
   * @example Huntship.holdsAtLeast('reviewer', 'smith')  // => false
   * @example Huntship.holdsAtLeast('smith', 'smith')     // => true
   */
  static holdsAtLeast(held: HuntRole, role: HuntRole): boolean {
    return HuntRoleRanks[held] >= HuntRoleRanks[role]
  }

  /**
   * Whether `huntship`'s copy of its user (`notes/convex.md`, *Denormalized fields*) is stale: its
   * userlabel or title is not the one `user` is to hold. What a relabel or a retitle rewrites, and
   * what a plan of one counts.
   *
   * @example Huntship.isStale({ userlabel: 'flip', usertitle: 'Flip' }, { userlabel: 'flip', title: 'Flip K.' })  // => true
   * @example Huntship.isStale({ userlabel: 'flip', usertitle: 'Flip' }, { userlabel: 'flip', title: 'Flip' })     // => false
   */
  static isStale(huntship: Pick<HuntshipRowT, 'userlabel' | 'usertitle'>, user: { userlabel: string, title: string }): boolean {
    return huntship.userlabel !== user.userlabel || huntship.usertitle !== user.title
  }

  /**
   * Whether the holder of `claims` may be shown a quiz of their hunt opened in `mode`: whether the
   * server would let them take the one action that mode always offers (`ModeKinds`). A smith may
   * be shown either; a reviewer only the playtest; nobody else either.
   *
   * @example Huntship.mayOpen(claims, 'edit')  // => false, for a reviewer
   */
  static mayOpen(claims: Actor.HuntClaimsT, mode: Mode): boolean {
    return Approve.mayOffer(ModeKinds[mode], claims)
  }
}
