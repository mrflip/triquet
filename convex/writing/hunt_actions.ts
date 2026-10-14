import type { Id } from '../_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import * as PA from '../../src/lib/vv/patterns'
import type { Refusalkind } from '../../src/lib/notices'
import { refuse } from '../../src/lib/refusals'
import type { OuterHuntActionT } from '../../src/models/actions'
import type { WheelT } from '../../src/models/category'
import { HuntshipValidators } from '../../src/models/huntship'
import type { UserFaceT } from '../../src/models/user'
import { censusOf, huntshipsOf, huntInOrg, huntsCountedInOrg, huntsOf, realmsOf, type CensusT } from '../reading'
import { deleteQuiz, insertHunt, updateHunt, type Writer } from './quiz_writing'

/**
 * Make a fresh hunt under `label`: one realm, `home`, holding one blank quiz of the same label,
 * with the user `actor` is as its smith, and its org (`orglabel`) their userlabel. An actor
 * without a userlabel is refused, since a hunt nobody is on is a hunt nobody can open. A sealed
 * one (`Actor.isSealed`: anonymous) makes only its sandbox, whose label policy has already held to
 * its userlabel (`Approve.mayMakeHunt`), and so only once: its org holding any hunt refuses a
 * second. (A user taking its handle is made its sandbox then, `makeSandboxFor`; this makes one by
 * hand for a user that took its handle before that.) Anyone is refused one hunt more than their org may hold (`PA.HuntsPerOrg`), so no one
 * userlabel takes up the app's room; and whatever `makeHuntFor` refuses.
 *
 * @returns The hunt's row id.
 * @throws A refusal (`notIdentified`, `sealedHunts`, `orgFull`, `labelTaken`, `huntsFull`); nothing is written.
 */
export async function newHunt(db: Writer, actor: Actor.ActorT, label: string): Promise<Id<'hunts'>> {
  if (Actor.isUnlabelled(actor)) { refuse('notIdentified') }
  const counted = await huntsCountedInOrg(db, actor.userlabel)
  if (Actor.isSealed(actor) && counted > 0) { refuse('sealedHunts') }
  if (counted >= PA.HuntsPerOrg.max) { refuse('orgFull') }
  return await makeHuntFor(db, { _id: actor.user_id, userlabel: actor.userlabel, title: actor.usertitle }, label)
}

/**
 * Make a fresh hunt under `label` for `maker`, as `newHunt` does, however many hunts its org
 * already holds and whatever sealing says: for a new user's sandbox (`makeSandboxFor`), and for the
 * deployment's admin (`testing:makeHunt`, by which the e2e suite makes a whole run's hunts, under
 * one user per worker). A label some hunt
 * of the org already answers to (`huntInOrg`) is refused, as a quiz's is: the caller has already
 * put it in an address. So is one hunt more than the app may hold.
 *
 * @param maker - Who makes it, its first smith, whose userlabel is its org.
 * @param whenFull - The refusal for one hunt more than the app may hold: `huntsFull`, or, for a
 *   sandbox, the one that tells a new user its handle was not saved (`noRoomForSandbox`).
 * @returns The hunt's row id.
 * @throws A refusal (`labelTaken`, or `whenFull`); nothing is written.
 */
export async function makeHuntFor(db: Writer, maker: Pick<UserFaceT, '_id' | 'userlabel' | 'title'>, label: string, whenFull: Refusalkind = 'huntsFull'): Promise<Id<'hunts'>> {
  const [hunts, taken] = await Promise.all([huntsOf(db), huntInOrg(db, maker.userlabel, label)])
  if (taken) { refuse('labelTaken') }
  if (hunts.length >= PA.HuntsInApp.max) { refuse(whenFull) }
  const hunt_id = await insertHunt(db, label, maker.userlabel)
  await db.insert('huntships', HuntshipValidators.row({ hunt_id, user_id: maker._id, userlabel: maker.userlabel, usertitle: maker.title, role: 'smith' }))
  return hunt_id
}

/**
 * Make the user `maker` its sandbox: the hunt labelled with its own userlabel, so at
 * `~label/label` (`Hunt.isSandbox`), with it as its smith, holding its first quiz, the blank one
 * every hunt is made with. What taking a handle makes (`assumeUserlabel`), in the same write. No
 * hunt of its org can answer to the label already, as a userlabel is free only while no hunt
 * carries it as its org; and a userlabel always passes as a hunt's label (`CK.userlabel`).
 *
 * @param maker - The user, its userlabel and title as it has just taken them.
 * @returns The sandbox's row id.
 * @throws A refusal (`noRoomForSandbox`) when the app holds all the hunts it may; nothing is written.
 *
 * @example await makeSandboxFor(db, { _id: user_id, userlabel: 'flip_kromer', title: 'Flip' })  // => the id of ~flip_kromer/flip_kromer
 */
export async function makeSandboxFor(db: Writer, maker: Pick<UserFaceT, '_id' | 'userlabel' | 'title'>): Promise<Id<'hunts'>> {
  return await makeHuntFor(db, maker, maker.userlabel, 'noRoomForSandbox')
}

/**
 * Give `hunt_id` the title `title`, what it is called on screen. Its label, and so every address
 * of its quizzes, stays as it is. A blank title shows as the label titleized. Refused for a hunt
 * that is gone.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param title - Its new title, already validated.
 *
 * @example await retitleHunt(db, open.hunt_id, 'Autumn Hunt')
 */
export async function retitleHunt(db: Writer, hunt_id: Id<'hunts'>, title: string): Promise<void> {
  const held = await db.get('hunts', hunt_id)
  if (! held) { refuse('huntGone') }
  await updateHunt(db, held, { title })
}

/**
 * Give `hunt_id` the label `label`, which every address of its quizzes names it by within its org;
 * the label it had answers to nothing afterwards. Its org stays as it is. Refused when some other
 * hunt of its org already answers to the label (`huntInOrg`), and for a hunt that is gone.
 *
 * @param db - The mutation's database.
 * @param census - Whose each hunt label is, in each org.
 * @param hunt_id - Which hunt.
 * @param label - Its new label, already validated.
 *
 * @example await relabelHunt(db, census, open.hunt_id, 'autumn_hunt')
 */
export async function relabelHunt(db: Writer, census: CensusT, hunt_id: Id<'hunts'>, label: string): Promise<void> {
  const held = await db.get('hunts', hunt_id)
  if (! held) { refuse('huntGone') }
  const holder_id = await census.huntIdInOrg(held.orglabel, label)
  if (holder_id !== null && holder_id !== hunt_id) { refuse('labelTaken') }
  await updateHunt(db, held, { label })
}

/**
 * Arrange the subject categories of `hunt_id` round its wheel as `wheel`: what every screen of the
 * hunt reads its total order from. Refused for a hunt that is gone.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param wheel - Its new wheel, already validated.
 *
 * @example await arrangeCategories(db, hunt_id, Wheel.placed(wheel, 'tv', 'pool'))
 */
export async function arrangeCategories(db: Writer, hunt_id: Id<'hunts'>, wheel: WheelT): Promise<void> {
  const held = await db.get('hunts', hunt_id)
  if (! held) { refuse('huntGone') }
  await updateHunt(db, held, { wheel })
}

/**
 * Put `hunt_id` on the branch `branch`: the line of work every quiz of the hunt is on, and the git
 * branch its history is committed to. Naming one its history has not seen starts that branch
 * there, in the browser, not here. Refused for a hunt that is gone.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @param branch - Its new branch, already validated.
 *
 * @example await rebranchHunt(db, hunt_id, 'playtest')
 */
export async function rebranchHunt(db: Writer, hunt_id: Id<'hunts'>, branch: string): Promise<void> {
  const held = await db.get('hunts', hunt_id)
  if (! held) { refuse('huntGone') }
  await updateHunt(db, held, { branch })
}

/**
 * Delete `hunt_id` along with its last quiz, and everything they hold: the quiz's questions, its
 * widgetings and what they stored, the reviews and their verdicts; its realms; and everyone's
 * place on it. The library's widgets stay, being every hunt's. The users themselves stay. A hunt is deleted only once it is down to one quiz, so that
 * no single act loses a hunt's worth of quizzes. A hunt already gone is nothing to do.
 *
 * @param db - The mutation's database.
 * @param hunt_id - Which hunt.
 * @throws A refusal (`huntNotEmptied`) while the hunt holds more than one quiz; nothing is written.
 */
export async function deleteHunt(db: Writer, hunt_id: Id<'hunts'>): Promise<void> {
  const held = await db.get('hunts', hunt_id)
  if (! held) { return }
  const [realms, huntships] = await Promise.all([realmsOf(db, hunt_id), huntshipsOf(db, hunt_id)])
  if (realms.flatMap(({ quizzes }) => quizzes).length > 1) { refuse('huntNotEmptied') }
  for (const { realm, quizzes } of realms) {
    for (const quiz of quizzes) { await deleteQuiz(db, quiz._id) }
    await db.delete('realms', realm._id)
  }
  for (const huntship of huntships) { await db.delete('huntships', huntship._id) }
  await db.delete('hunts', hunt_id)
}

/**
 * Carry out what a smith did to a hunt from outside any quiz (the hunts list, the hunt's own
 * pages), writing the rows it comes to: make a hunt, or retitle, relabel, arrange the categories
 * of, or put on another branch one they smith. Whether they may is asked before this
 * (`authorize`).
 *
 * @param db - The mutation's database.
 * @param actor - Who the visitor is now; unlabelled until their user holds a userlabel.
 * @param action - What the visitor did.
 * @returns The id of the hunt made or changed.
 * @throws A refusal when the action cannot be carried out; nothing is written.
 */
export async function performOuterHunt(db: Writer, actor: Actor.ActorT, action: OuterHuntActionT): Promise<Id<'hunts'>> {
  switch (action.kind) {
  case 'new_hunt':      { return await newHunt(db, actor, action.label) }
  case 'retitle_hunt':  { await retitleHunt(db, action.hunt_id, action.title); return action.hunt_id }
  case 'relabel_hunt':  { await relabelHunt(db, censusOf(db), action.hunt_id, action.label); return action.hunt_id }
  case 'arrange_categories': { await arrangeCategories(db, action.hunt_id, action.wheel); return action.hunt_id }
  case 'rebranch_hunt': { await rebranchHunt(db, action.hunt_id, action.branch); return action.hunt_id }
  }
}
