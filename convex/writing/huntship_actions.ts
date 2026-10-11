import type { Doc, Id } from '../_generated/dataModel'
import * as Approve from '../../src/lib/approve'
import * as PA from '../../src/lib/vv/patterns'
import { userUnknownNotice } from '../../src/lib/notices'
import { refuse } from '../../src/lib/refusals'
import { Hunt } from '../../src/models/hunt'
import { HuntshipValidators, type HuntRole } from '../../src/models/huntship'
import { User, type UserFaceT } from '../../src/models/user'
import { huntshipFor, huntshipsOf, type CensusT } from '../reading'
import type { Writer } from './quiz_writing'

/**
 * Put `user` on `hunt_id` as `role`: a new huntship, carrying the user's userlabel and title, or
 * the role of the one it already has replaced, never a second. Past every policy: whoever calls
 * this has decided the user may be put on (`addHuntship`, `smithOfSandbox`, the admin's
 * `testing:putOnHunt`).
 *
 * @throws A refusal (`huntshipsFull`) when the hunt holds as many members as a hunt may; nothing is written.
 */
async function placeOn(db: Writer, hunt_id: Id<'hunts'>, user: UserFaceT, role: HuntRole): Promise<void> {
  const held = await huntshipFor(db, hunt_id, user._id)
  if (held?.role === role) { return }
  const row = HuntshipValidators.row({ hunt_id, user_id: user._id, userlabel: user.userlabel, usertitle: user.title, role })
  if (held) {
    await db.patch('huntships', held._id, { role: row.role })
    return
  }
  const huntships = await huntshipsOf(db, hunt_id)
  if (huntships.length >= PA.HuntshipsPerHunt.max) { refuse('huntshipsFull') }
  await db.insert('huntships', row)
}

/**
 * Put the user holding the userlabel `userlabel` on `hunt_id` as `role`: a new huntship, carrying
 * the user's userlabel and title, or the role of the one it already has replaced, never a second.
 *
 * Refused when no user holds the userlabel (they have to choose it first), when the user may not
 * be put on any hunt (`Approve.mayJoinHunt`: an anonymous user is sealed in its sandbox), or when
 * the hunt holds as many members as a hunt may. Whether the one acting may change this member's
 * place is asked before this (`Approve.mayChangeMembership`).
 *
 * @param db - The mutation's database.
 * @param census - Who a user is, beyond the hunt's own rows.
 * @param hunt_id - Which hunt.
 * @param userlabel - Who to add, by the userlabel they chose.
 * @param role - What they are to do on it.
 * @throws A refusal (`userUnknown`, `sealedJoin`, `huntshipsFull`); nothing is written.
 *
 * @example await addHuntship(db, census, open.hunt_id, 'alice_reviews', 'reviewer')
 */
export async function addHuntship(db: Writer, census: CensusT, hunt_id: Id<'hunts'>, userlabel: string, role: HuntRole): Promise<void> {
  const user = await census.userByLabel(userlabel)
  if (! user) { refuse('userUnknown', userUnknownNotice(userlabel)) }
  Approve.must('join_hunt', user)
  await placeOn(db, hunt_id, user, role)
}

/**
 * Take `user_id` off `hunt_id`. One not on the hunt is left as they are. Whether the one acting
 * may take them off is asked before this (`Approve.mayChangeMembership`).
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param user_id - Who to remove.
 */
export async function removeHuntship(db: Writer, hunt_id: Id<'hunts'>, user_id: Id<'users'>): Promise<void> {
  const held = await huntshipFor(db, hunt_id, user_id)
  if (held) { await db.delete('huntships', held._id) }
}

/**
 * Make `user` a smith of the sandbox `sandbox`: what a merge does when an anonymous user's browser
 * signs in with a Google account that already has a user, so the work in the sandbox goes on with
 * the user that carries on. The one way past sealing's "nobody is added to a sandbox", and only for
 * a user signed in with Google: an anonymous user is refused, as `mayJoinHunt` refuses one. The
 * sandbox keeps its address (`~label/label`), whatever userlabel `user` holds.
 *
 * @param db - The mutation's database, holding every hunt.
 * @param user - The user to make its smith, signed in with Google and holding a userlabel.
 * @param sandbox - The sandbox: a hunt labelled with its own org (`Hunt.isSandbox`).
 * @throws A refusal (`sealedJoin`) for an anonymous user; an error for a user holding no userlabel, or a hunt that is no sandbox; nothing is written.
 *
 * @example await smithOfSandbox(ctx.db, googleUser, sandbox)
 */
export async function smithOfSandbox(db: Writer, user: Doc<'users'>, sandbox: Doc<'hunts'>): Promise<void> {
  const face = User.faceOf(user)
  if (! face) { throw new Error('Only a user holding a userlabel is made smith of a sandbox') }
  if (! Hunt.isSandbox(sandbox)) { throw new Error(`~${sandbox.orglabel}/${sandbox.label} is no sandbox`) }
  Approve.must('join_hunt', face)
  await placeOn(db, sandbox._id, face, 'smith')
}
