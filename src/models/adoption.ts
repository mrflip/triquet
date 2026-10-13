import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as PA from '../lib/vv/patterns'
import { HuntshipValidators } from './huntship'
import { UserValidators } from './user'

/**
 * An adoption: what the command line (`scripts/adopt`, through `adopt:plan` and `adopt:perform`)
 * gives one user, found by its id, its userlabel, or its email -- a userlabel, past the rule that
 * keeps one a hunt's address holds; the admin flag; a role on one hunt or on every hunt -- and what
 * that came to. Nothing here is stored: it is the request and the answer of a trusted command, run
 * with the deployment's admin key.
 */
export const AdoptionValidators = Validator(({ obj, arr, bool, discrim, lit, oneof, str, timestamp, uint, union, zid, zod, label }) => {
  const { role } = HuntshipValidators
  const finding = union([
    zod.strictObject({ user_id: zid('users') })
      .describe('The user with this row id.'),
    zod.strictObject({ userlabel: UserValidators.heldUserlabel })
      .describe('The user holding this userlabel.'),
    zod.strictObject({ email: zod.email() })
      .describe("The one user whose row holds this email, as Google sent it: a lookup for a Coach watching it once, refused unless exactly one user holds it."),
  ])
    .describe('Which user to adopt: by its id, its userlabel, or its email, and by one of them alone.')

  const hunts = union([
    obj({ org: UserValidators.heldUserlabel, hunt: label })
      .describe('The hunt at `/~<org>/<hunt>`.'),
    lit('every')
      .describe('Every hunt there is.'),
  ])
    .describe('Which hunts a grant is for: one, by its address, or every one.')

  const grant = obj({ role, hunts })
    .describe('A role to give the user on some hunts, at least: one it holds that gives more is kept.')

  const request = obj({
    find:      finding,
    userlabel: UserValidators.userlabel.optional()
      .describe("The userlabel to give it, though a hunt's address holds it (the command line is trusted); never one another user or a ghosting holds."),
    title:     UserValidators.title.optional()
      .describe('What to call it, with its userlabel; the title it has, or its userlabel titleized, when absent.'),
    admin:     bool.optional()
      .describe('Whether it is to be an admin; its flag left as it is when absent. Made one only when signed in with Google.'),
    grants:    arr(grant).max(PA.HuntsInApp.max).default([])
      .describe('Roles to give it, on hunts it is put on as a user signed in with Google.'),
  })
    .describe('What to give one user from the command line.')

  const found = obj({
    user_id:    zid('users'),
    userlabel:  str.nullable(),
    title:      str.nullable(),
    anonymous:  bool,
    admin:      bool,
    name:       str.nullable()
      .describe('The name Google sent for it; null for none (an anonymous user has none).'),
    created_at: timestamp
      .describe('When its row was made, in epoch milliseconds.'),
  })
    .describe('The user found, as it stood before: its userlabel and title (null until it holds one), whether it is anonymous, its admin flag, and, so whoever runs the command knows it for theirs before it acts, its Google name and when it was made.')

  const change = discrim('kind', [
    obj({
      kind:      lit('userlabel'),
      from:      str.nullable(),
      to:        str,
      title:     str,
      huntships: uint,
      leaves:    oneof(['free', 'address']).nullable()
        .describe("What becomes of the userlabel it held, when it changes: `free` for anyone to claim (an adoption is no merge, so no ghosting keeps it), or still held by a hunt's `address`, so only the command line gives it out. Null when it held none, or keeps it."),
    })
      .describe('Its userlabel and title, from what it held (null for none), with how many of its huntships\' copies were rewritten, and what becomes of the userlabel it leaves.'),
    obj({ kind: lit('admin'), to: bool })
      .describe('Its admin flag, set or cleared.'),
    obj({ kind: lit('huntship'), org: str, hunt: str, role, from: role.nullable() })
      .describe('A role on the hunt `/~<org>/<hunt>`, from the role it held there (null for none).'),
  ])
    .describe('One change to the user, or to its place on a hunt.')

  const outcome = obj({
    user:    found,
    changes: arr(change),
    kept:    uint
      .describe('How many of the things asked for it held already: its userlabel and title, its admin flag, its role on a hunt (or a higher one).'),
    skipped: uint
      .describe("How many anonymous users' sandboxes a grant on every hunt passed over: sealing keeps each its own user's alone."),
  })
    .describe('What an adoption came to: the user, what was (or would be) changed, and how much was already so.')

  return { finding, grant, request, change, outcome }
})

export type AdoptionDNA  = Z.input<typeof AdoptionValidators.request>
export type AdoptionT    = Z.output<typeof AdoptionValidators.request>
export type AdoptChangeT = Z.output<typeof AdoptionValidators.change>
export type AdoptedT     = Z.output<typeof AdoptionValidators.outcome>
