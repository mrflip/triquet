import type * as Z from 'zod'
import type * as Actor from '../lib/actor'
import * as Approve from '../lib/approve'
import { Validator } from '../lib/validator'
import type { Act } from '../lib/routes'
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

/** The presentation each role is shown when an address names none */
const ActForRole = { smith: 'smith', reviewer: 'review' } as const satisfies Record<HuntRole, Act>

/**
 * The action each presentation of a quiz always offers, whatever else it does, and so whose policy
 * says who is shown it: the workbench always offers to lock or unlock the quiz, locked or not; the
 * review opens one's review of it the moment it is shown.
 */
const ActKinds = { smith: 'set_lock', review: 'open_review' } as const satisfies Record<Act, Approve.OfferableKind>

/** One ident's place on one hunt, with a role */
export class Hunting implements HuntingRowT {
  declare hunt_id:     HuntingRowT['hunt_id']
  declare ident_id:    HuntingRowT['ident_id']
  declare ident_label: string
  declare ident_title: string
  declare role:        HuntRole

  /**
   * The presentation `role` is shown of a quiz when its address names none: a smith works it, a
   * reviewer reviews it.
   *
   * @example Hunting.actFor('reviewer')  // => 'review'
   */
  static actFor(role: HuntRole): Act {
    return ActForRole[role]
  }

  /**
   * Whether the holder of `claims` may be shown a quiz of their hunt presented as `act`: whether
   * the server would let them take the one action that presentation always offers (`ActKinds`).
   * A smith may be shown either; a reviewer only the review; nobody else either.
   *
   * @example Hunting.mayAct(claims, 'smith')  // => false, for a reviewer
   */
  static mayAct(claims: Actor.HuntClaimsT, act: Act): boolean {
    return Approve.mayOffer(ActKinds[act], claims)
  }
}
