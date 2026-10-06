import type * as Z from 'zod'
import type * as Actor from '../lib/actor'
import * as Approve from '../lib/approve'
import { Validator } from '../lib/validator'
import type { Mode } from '../lib/addresses'
import { IdentValidators } from './ident'

/** What an ident may do on a hunt: make its quizzes, or playtest them */
export const HuntRoleVals = ['smith', 'reviewer'] as const
export type HuntRole = typeof HuntRoleVals[number]

/** Each role as the screen names it */
export const HuntRoleTitles = { smith: 'Smith', reviewer: 'Reviewer' } as const satisfies Record<HuntRole, string>

export const HuntingValidators = Validator(({ obj, oneof, zid }) => {
  const role = oneof(HuntRoleVals)
    .describe('What the ident does on the hunt: a smith makes its quizzes and says who else is on it; a reviewer playtests them.')

  const row = obj({
    hunt_id:     zid('hunts')
      .describe('The hunt.'),
    ident_id:    zid('idents')
      .describe('Who is on it.'),
    ident_label: IdentValidators.identLabel
      .describe('The label of who is on it, copied from the ident when the hunting is made: an ident\'s label never changes.'),
    ident_title: IdentValidators.title
      .describe('What who is on it is called, copied from the ident: retitling an ident rewrites it on every hunting the ident has.'),
    role,
  })
    .describe('One ident\'s place on one hunt: at most one per hunt and ident, its role replaced rather than a second made.')

  return { role, row }
})

export type HuntingRowT = Z.output<typeof HuntingValidators.row>

/** The mode the app's own links open a quiz in for each role: a smith works on it, a reviewer playtests it */
const ModeForRole = { smith: 'edit', reviewer: 'playtest' } as const satisfies Record<HuntRole, Mode>

/**
 * The action each mode of a quiz always offers, whatever else it does, and so whose policy says
 * who is shown it: the workbench always offers to lock or unlock the quiz, locked or not; the
 * playtest opens one's review of it the moment it is shown.
 */
const ModeKinds = { edit: 'set_lock', playtest: 'open_review' } as const satisfies Record<Mode, Approve.OfferableKind>

/** One ident's place on one hunt, with a role */
export class Hunting implements HuntingRowT {
  declare hunt_id:     HuntingRowT['hunt_id']
  declare ident_id:    HuntingRowT['ident_id']
  declare ident_label: string
  declare ident_title: string
  declare role:        HuntRole

  /**
   * The mode the app's own links open a quiz in for someone of `role`: a smith works on it, a
   * reviewer playtests it. The link is written for whoever it is shown to; the address it names
   * opens the same screen for anyone (`notes/decisions/urls.md`, rule 4).
   *
   * @example Hunting.modeFor('reviewer')  // => 'playtest'
   */
  static modeFor(role: HuntRole): Mode {
    return ModeForRole[role]
  }

  /**
   * Whether the holder of `claims` may be shown a quiz of their hunt opened in `mode`: whether the
   * server would let them take the one action that mode always offers (`ModeKinds`). A smith may
   * be shown either; a reviewer only the playtest; nobody else either.
   *
   * @example Hunting.mayOpen(claims, 'edit')  // => false, for a reviewer
   */
  static mayOpen(claims: Actor.HuntClaimsT, mode: Mode): boolean {
    return Approve.mayOffer(ModeKinds[mode], claims)
  }
}
