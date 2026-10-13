import type * as Z from 'zod'
import type { Id } from '../../convex/_generated/dataModel'
import type * as Actor from '../lib/actor'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'

export const UserValidators = Validator(({ obj, str, num, bool, zid, userlabel, heldUserlabel, titleish, stamps }) => {
  const label = userlabel
    .describe('A userlabel being claimed: what a person types to become a user (a handle on screen). Kept from every reserved word, top-level ones included (`Labelmaker.isReserved`), and free only while no user holds it, no ghosting holds it, and no hunt carries it as its orglabel.')
  const held = heldUserlabel
    .describe('A userlabel already held: what others add the user to a hunt by, and the org of the hunts it makes. Unique across the app and set once. Held to the words every label is kept from, not the top-level ones, so a word reserved later leaves a user holding it writable (`CK.heldUserlabel`).')
  const title = titleish.min(1)
    .describe('What the user is called on screen: the name typed beside the userlabel, or the userlabel titleized. Set with the userlabel, and changed at will after.')
  const googleProfile = obj({
    email: str.optional()
      .describe('The email Google sends. Shown to its owner alone, and never how a user is found at sign-in.'),
    name:  str.optional()
      .describe('The name Google sends.'),
    image: str.optional()
      .describe('The address of the picture Google sends.'),
    emailVerificationTime: num.optional()
      .describe("When Google last said the email is verified (`email_verified`): the moment it issued the sign-in's token, in epoch milliseconds; absent when Google says it is not."),
    locale: str.optional()
      .describe('The language and region Google sends for the account (`locale`), when it sends one.'),
    hosted_domain: str.optional()
      .describe("The Google Workspace domain the account belongs to (`hd`); absent for a personal account."),
  })
    .describe("What a Google sign-in keeps of what Google sends: the email (and whether Google has verified it), name, picture, locale and Workspace domain the privacy policy names, and nothing more (Google's account id is the account's, not the user's). Anything else is dropped here.")
  const merged = obj({
    into_user_id: zid('users')
      .describe('The user it merged into, which carries on: signed in with Google, and made smith of its sandbox, if it had one.'),
    account_id:   zid('authAccounts')
      .describe('The Google account whose sign-in merged it: one the user it merged into already had.'),
  })
    .describe('How an anonymous user holding a userlabel was merged away, when its browser signed in with a Google account that already had a user: marked, never deleted, its sessions gone. While it still holds its userlabel, the user it merged into has a name choice to make (`nameChoiceFor`).')
  const signIn = obj({
    existingUserId: zid('users').nullable()
      .describe('The user of the account signed in to, for a returning account; null for a new one.'),
    authUserId:     zid('users').nullable().default(null)
      .describe("The user the browser was signed in as when it started the sign-in (our patch of Convex Auth, after upstream's PR #306), handed on only at the code's exchange; null at Google's callback, with no session, or when the session is gone."),
    provider:       obj({ id: str })
      .describe('The provider signed in with, by its id: `anonymous` or `google`.'),
    type:           str.optional()
      .describe("Where in the sign-in Convex Auth asks: for Google, `oauth` at Google's callback, where nothing proves which browser finished, and `verification` at the code's exchange, where the browser has proved it is the one that started (our patch)."),
    profile:        googleProfile.default({})
      .describe('What the provider sent, as far as a user keeps any of it.'),
  })
    .describe('What Convex Auth tells `createOrUpdateUser` of a sign-in, as far as it is read: whose the account is, whose the browser is, the provider, and the profile.')

  const row = obj({
    // Convex Auth's fields, as `authTables` ships them, kept with its indexes
    name:                  str.optional()
      .describe("Convex Auth's: the name a provider that proves who someone is sends (Google). None for an anonymous user."),
    image:                 str.optional()
      .describe("Convex Auth's: the address of the picture a provider sends."),
    email:                 str.optional()
      .describe("Convex Auth's: the email a provider sends. Shown to its owner alone, never to anyone else."),
    emailVerificationTime: num.optional()
      .describe("Convex Auth's: when the email was verified, in epoch milliseconds."),
    phone:                 str.optional()
      .describe("Convex Auth's: a phone number, which nothing here asks for."),
    phoneVerificationTime: num.optional()
      .describe("Convex Auth's: when the phone was verified, which nothing here does."),
    isAnonymous:           bool.optional()
      .describe("Convex Auth's: whether the user was signed in with no proof (the Anonymous provider). An anonymous user is sealed: a userlabel and one sandbox, nothing more (`Approve`)."),
    // Ours
    locale:                str.optional()
      .describe('The language and region Google last sent for the account; absent when it sent none.'),
    hosted_domain:         str.optional()
      .describe("The Google Workspace domain Google last said the account belongs to; absent for a personal account."),
    userlabel:             held.optional()
      .describe('The user\'s userlabel, absent until chosen.'),
    title:                 title.optional()
      .describe('What the user is called on screen; set with its userlabel, which titleized stands in for a title it lacks (`User.titleOf`).'),
    admin:                 bool.optional()
      .describe('Whether the user looks after what belongs to no hunt (the library): set only from the command line, absent for no. Read in one place, as the actor is built (`Actor.ofUser`), and counted only for a user signed in with Google.'),
    merged:                merged.optional(),
    provisional:           bool.optional()
      .describe("Set on a user a new Google account's sign-in made at Google's callback, until the browser finishing it proves it started it, at the code's exchange: then it is kept, or, for an anonymous browser, folded into that browser's user and deleted. Nobody is ever signed in as a provisional user."),
    ...stamps,
  })
    .describe('One user: what a session is signed in as, holding its userlabel, title and admin flag beside the fields Convex Auth keeps. Never a person: one person may hold several.')

  return { userlabel: label, heldUserlabel: held, title, googleProfile, merged, signIn, row }
})

export type UserDNA  = Z.input<typeof UserValidators.row>
export type UserRowT = Z.output<typeof UserValidators.row>
/** What a Google sign-in keeps of what Google sends */
export type GoogleProfileT = Z.output<typeof UserValidators.googleProfile>
/** What Convex Auth tells `createOrUpdateUser` of a sign-in, as it hands it over */
export type SignInDNA = Z.input<typeof UserValidators.signIn>
/** ...and as far as it is read, once validated */
export type SignInT = Z.output<typeof UserValidators.signIn>
/** A user as its holder is shown it: its userlabel and title, and never its email */
export type UserT    = { _id: string, userlabel: string, title: string }
/** Who a session is, as it is told: its user, and the actor the server sees in its requests */
export type CurrentUserT = { user: UserT, actor: Actor.UserActorT }

/**
 * A user as anyone else is told of it: its userlabel and title, and whether it is anonymous (which
 * sealing turns on), and nothing else of its row. What a function that reads another user hands
 * on, so that an email never leaves its owner's own query.
 */
export type UserFaceT = { _id: Id<'users'>, userlabel: string, title: string, anonymous: boolean }

/** A handle a user may keep, as a name choice shows it: the userlabel and the title beside it */
export type HandleT = Pick<UserT, 'userlabel' | 'title'>

/**
 * A name choice pending after a merge (`nameChoiceFor`): the handle the merged browser went by,
 * which the user merged away still holds, and the user's own. One is kept; the other is retired.
 */
export type NameChoiceT = { merged: HandleT, own: HandleT }

/**
 * What a user is told of itself and nobody else is: whether it is signed in with Google, the email
 * Google sent, the handle the front door offers a user signed in with Google that holds none yet,
 * and a name choice pending after a merge.
 */
export type OwnUserT = {
  /** Whether the user is signed in with Google (`Actor.isSignedInWithGoogle`) */
  google:     boolean
  /** The email Google sent, shown to its owner alone; null for a user not signed in with Google, or one Google sent none for */
  email:      string | null
  /** For a user signed in with Google holding no userlabel: the title Google's name makes, and the first free userlabel of `User.suggestionsFor`, null when none is; null otherwise */
  suggested:  { userlabel: string | null, title: string } | null
  /** A name choice pending after a merge; null when none is */
  nameChoice: NameChoiceT | null
}

/**
 * What holds a userlabel, as the front door is told while a handle is typed (`users.holder`): a verified
 * account (signed in with Google), which its owner can sign in to; a standalone account (anonymous,
 * held by one browser); something else that keeps it from being taken (a ghosting a merge retired,
 * or a hunt's address); or nothing, null, when it is free.
 */
export type UserlabelHolderT = 'verified' | 'standalone' | 'kept' | null

/** What `User.suggestionsFor` puts after a userlabel to make another */
const SuggestionNumbers = [2, 3, 4, 5, 6, 7, 8, 9] as const

/** Why what a person typed is not a userlabel: no typing on would make it one, it is one still being typed (too short, or ending in an underscore), or it is a word kept for the app's own use */
export type LabelFlawT = 'shape' | 'unfinished' | 'reserved'

/** What a session is signed in as: the persona in the app, named by the userlabel it chose */
export class User implements Pick<UserRowT, 'userlabel' | 'title' | 'isAnonymous' | 'admin'> {
  declare _id:          string
  declare userlabel?:   string
  declare title?:       string
  declare isAnonymous?: boolean
  declare admin?:       boolean

  /**
   * The userlabel a name makes: normalized as every label is, and no longer than a `Userlabel`
   * may be, the `z` a leading digit gets counted in. Shorter than the minimum is left short, for
   * the validator to refuse. What the userlabel field beside a name shows until the userlabel is
   * typed in itself, and what a name a provider sends is suggested as.
   *
   * @param name - Whatever was typed as a name.
   * @returns A label-shaped string, or `''` when nothing was typed.
   *
   * @example User.labelFor('Flip Kromer')  // => 'flip_kromer'
   * @example User.labelFor('2nd Avenue Puzzle Solvers Club')  // => 'z2nd_avenue_puzzle_solve'
   */
  static labelFor(name: string): string {
    return Labelmaker.normalize(name, PA.Userlabel)
  }

  /**
   * The userlabels to offer a user signed in with Google, best first: its name and the part of its
   * email before the @, each made a userlabel by `labelFor`, then each with `_2` to `_9` after it
   * (cut short to leave room), which also mends one too short to be a userlabel. Only userlabels a
   * person could claim are listed (`flawIn`: no reserved word among them), each once. Whether one
   * is free is the database's to say.
   *
   * @param profile - What Google sent: the name and email, either of which may be missing.
   * @returns The userlabels, best first; empty when neither makes one.
   *
   * @example User.suggestionsFor({ name: 'Flip Kromer', email: 'flip@example.com' }).slice(0, 3)  // => ['flip_kromer', 'flip_kromer_2', 'flip_kromer_3']
   * @example User.suggestionsFor({ email: 'flip@example.com' }).slice(0, 2)                        // => ['flip_2', 'flip_3']
   * @example User.suggestionsFor({})                                                               // => []
   */
  static suggestionsFor(profile: { name?: string, email?: string }): string[] {
    const bases = [this.labelFor(profile.name ?? ''), this.labelFor(profile.email?.split('@', 1)[0] ?? '')]
      .filter((base) => base !== '')
    const numbered = bases.flatMap((base) => SuggestionNumbers.map((num) => `${base.slice(0, PA.Userlabel.max - 2).replace(/_$/, '')}_${String(num)}`))
    return [...new Set([...bases, ...numbered])].filter((label) => this.flawIn(label) === null)
  }

  /**
   * What keeps a label, typed as it is, from being a userlabel, if anything. Nothing is repaired:
   * a capital or a space is a flaw, not something to fold away. `shape` is a label no typing on
   * would make one -- a character no label keeps, a first character that is not a letter, two
   * underscores in a row, or too many characters. `unfinished` is one typing on could still
   * finish: too short, nothing typed included, or ending in an underscore. `reserved` is a word no
   * userlabel may be (`Labelmaker.isReserved`), which typing on may yet make another word.
   *
   * @param label - Whatever was typed into a userlabel field.
   * @returns The flaw, or null when it is a userlabel.
   *
   * @example User.flawIn('flip_kromer')  // => null
   * @example User.flawIn('Flip Kromer')  // => 'shape'
   * @example User.flawIn('flip')         // => 'unfinished'
   * @example User.flawIn('support')      // => 'reserved'
   */
  static flawIn(label: string): LabelFlawT | null {
    if (label.length > PA.Userbegun.max || ! PA.Userbegun.re.test(label)) { return 'shape' }
    if (Labelmaker.isReserved(label, { toplevel: true })) { return 'reserved' }
    return UserValidators.userlabel.safeParse(label).success ? null : 'unfinished'
  }

  /**
   * The flaw a userlabel field should say of itself now, if any. A `shape` is said at once; an
   * `unfinished` or `reserved` label only once the field has been left, as it may still be being
   * typed (`support` on its way to `supporter`); and an empty field says nothing, as nobody has
   * typed anything to be told of.
   *
   * @param label - Whatever is in the userlabel field.
   * @param left - Whether the field has been left (where the label follows another field, either of them has).
   * @returns The flaw to say, or null.
   *
   * @example User.flawToSay('flip', false)  // => null
   * @example User.flawToSay('flip', true)   // => 'unfinished'
   * @example User.flawToSay('Flip', false)  // => 'shape'
   */
  static flawToSay(label: string, left: boolean): LabelFlawT | null {
    const flaw = this.flawIn(label)
    if (flaw === 'unfinished' || flaw === 'reserved') { return left && label !== '' ? flaw : null }
    return flaw
  }

  /**
   * A user as it is named on screen in full: its title, then its userlabel written `@label`, which
   * marks it as the handle someone types rather than a word of prose.
   *
   * @param user - The user to name.
   * @returns Its title and its userlabel.
   *
   * @example User.byline({ userlabel: 'mrflip', title: 'Mrflip' })  // => 'Mrflip (@mrflip)'
   */
  static byline(user: Pick<UserT, 'userlabel' | 'title'>): string {
    return `${user.title} (${this.atLabel(user)})`
  }

  /**
   * A user's userlabel written `@label`, as its byline writes it, for a screen that shows the
   * title some other way (the hunts page, where it is retitled in place).
   *
   * @param user - The user whose userlabel to write.
   * @returns Its userlabel, after an `@`.
   *
   * @example User.atLabel({ userlabel: 'mrflip' })  // => '@mrflip'
   */
  static atLabel(user: Pick<UserT, 'userlabel'>): string {
    return `@${user.userlabel}`
  }

  /**
   * The row of a user signed in anonymously, as `createOrUpdateUser` inserts it: no proof of who
   * holds it, and no userlabel yet.
   *
   * @example User.anonymous()  // => { isAnonymous: true }
   */
  static anonymous(): UserRowT {
    return UserValidators.row({ isAnonymous: true })
  }

  /**
   * The fields of a user signed in with Google, as a Google sign-in writes them: no longer
   * anonymous, and holding what Google sent of its email, name and picture, which every sign-in
   * with the account brings up to date; a field of these Google did not send is left as it was.
   * What Google says only while it holds (that the email is verified, the locale, the Workspace
   * domain) is written every time, and taken away when Google no longer sends it: a patch's
   * undefined removes the field.
   *
   * @param profile - What Google sent, already kept to `UserValidators.googleProfile`.
   * @returns The fields to insert, or to patch onto the row.
   *
   * @example User.fromGoogle({ email: 'flip@example.com', name: 'Flip' })  // => { isAnonymous: false, email: 'flip@example.com', name: 'Flip', emailVerificationTime: undefined, locale: undefined, hosted_domain: undefined }
   */
  static fromGoogle(profile: GoogleProfileT): UserRowT {
    const sent = UserValidators.googleProfile(profile)
    const { emailVerificationTime, locale, hosted_domain } = sent
    return { ...UserValidators.row({ ...sent, isAnonymous: false }), emailVerificationTime, locale, hosted_domain }
  }

  /**
   * The row of the user a new Google account's sign-in makes at Google's callback: signed in with
   * Google, holding what Google sent, and provisional until the browser finishing the sign-in
   * proves it started it (`userForSignIn`).
   *
   * @example User.provisional({ email: 'flip@example.com' })  // => { isAnonymous: false, email: 'flip@example.com', provisional: true, … }
   */
  static provisional(profile: GoogleProfileT): UserRowT {
    return { ...this.fromGoogle(profile), provisional: true }
  }

  /**
   * The mark a user merged away carries: the user it merged into, and the Google account whose
   * sign-in merged it.
   *
   * @example User.mergedInto(into_user_id, account_id)  // => { merged: { into_user_id, account_id } }
   */
  static mergedInto(into_user_id: Id<'users'>, account_id: Id<'authAccounts'>): Pick<UserRowT, 'merged'> {
    return { merged: UserValidators.merged({ into_user_id, account_id }) }
  }

  /**
   * What a user's row becomes once it takes `userlabel`: the userlabel, and the title, a blank one
   * defaulting to the userlabel titleized. The fields to patch, validated.
   *
   * @param userlabel - The userlabel, already normalized.
   * @param title - What to call the user, where blank means "use the userlabel".
   * @returns The fields to patch onto the row.
   * @throws When the userlabel is not one, or the title is not a title.
   *
   * @example User.labelled('flip_kromer', '')  // => { userlabel: 'flip_kromer', title: 'Flip Kromer' }
   */
  static labelled(userlabel: string, title: string): { userlabel: string, title: string } {
    return { userlabel: UserValidators.userlabel(userlabel), title: this.titleFor(userlabel, title) }
  }

  /**
   * What a user's row becomes once it takes over `userlabel`, a userlabel already held, from a user
   * merged into it: the userlabel, and the title. Held to what a held userlabel is
   * (`heldUserlabel`), not to the rules for claiming one, as it was claimed once already.
   *
   * @param userlabel - The userlabel taken over.
   * @param title - What to call the user, where blank means "use the userlabel".
   * @returns The fields to patch onto the row.
   *
   * @example User.relabelled('flip_kromer', 'Flip')  // => { userlabel: 'flip_kromer', title: 'Flip' }
   */
  static relabelled(userlabel: string, title: string): { userlabel: string, title: string } {
    return { userlabel: UserValidators.heldUserlabel(userlabel), title: this.titleFor(userlabel, title) }
  }

  /**
   * The title a user holding `userlabel` takes when given `title`: it as typed, or the userlabel
   * titleized when blank.
   *
   * @throws When the title is not a title.
   *
   * @example User.titleFor('flip_kromer', '')      // => 'Flip Kromer'
   * @example User.titleFor('flip_kromer', 'Flip')  // => 'Flip'
   */
  static titleFor(userlabel: string, title: string): string {
    return UserValidators.title(title.trim() === '' ? Labelmaker.titleize(userlabel) : title)
  }

  /**
   * What `user`, holding the userlabel `userlabel`, is called on screen: its title, or its
   * userlabel titleized when it has none. The one fallback, read wherever a user is named (the
   * actor, a face), so that every copy of the title agrees.
   *
   * @example User.titleOf({ userlabel: 'flip_kromer', title: 'Flip' })  // => 'Flip'
   * @example User.titleOf({ userlabel: 'flip_kromer' })                 // => 'Flip Kromer'
   */
  static titleOf(user: Pick<UserRowT, 'title'> & { userlabel: string }): string {
    return user.title ?? Labelmaker.titleize(user.userlabel)
  }

  /**
   * Whether `user` is anonymous: signed in with no proof of who holds it, and so sealed in its
   * sandbox (`Approve`). Convex Auth's `isAnonymous`, read to fail closed: only `false`, which a
   * Google sign-in writes, says otherwise, so a row without the field is sealed, not trusted.
   *
   * @example User.isAnonymous({ isAnonymous: true })   // => true
   * @example User.isAnonymous({ isAnonymous: false })  // => false
   * @example User.isAnonymous({})                      // => true
   */
  static isAnonymous(user: Pick<UserRowT, 'isAnonymous'>): boolean {
    return user.isAnonymous !== false
  }

  /**
   * `user` as anyone else may be told of it (`UserFaceT`): its userlabel, title and whether it is
   * anonymous. Null for a user that has no userlabel yet, which nobody can name.
   *
   * @example User.faceOf({ _id, userlabel: 'flip_kromer', title: 'Flip', isAnonymous: false, email: 'f@example.com' })  // => { _id, userlabel: 'flip_kromer', title: 'Flip', anonymous: false }
   */
  static faceOf(user: Pick<UserRowT, 'userlabel' | 'title' | 'isAnonymous'> & { _id: Id<'users'> }): UserFaceT | null {
    if (user.userlabel === undefined) { return null }
    return { _id: user._id, userlabel: user.userlabel, title: this.titleOf({ ...user, userlabel: user.userlabel }), anonymous: this.isAnonymous(user) }
  }
}
