/**
 * Where each thing a hunt holds is found, three ways at once: its address in the app, its file in
 * the hunt's repository, and the key path its piece of the hunt sits at in a jsonball.
 *
 * All three come from one key path (`keypathOf`), the nouns and labels below the hunt
 * (`['quizzes', 'home', 'legends']`), so they cannot drift apart: the address puts the hunt in
 * front (`/~pat/spring_hunt/quizzes/home/legends`), and the file adds its pre-extension behind
 * (`quizzes/home/legends.tqq.json`). The library's widgets hang from `/lib` in place of a hunt.
 * `notes/decisions/urls.md` is the scheme.
 */
import type { HuntRole } from '../models/hunting'
import { WidgetScopeVals, type WidgetScope } from '../models/widget'
import * as PA from './vv/patterns'

/** How a resource can be opened: worked on by a smith, or playtested */
export const ModeVals = ['edit', 'playtest'] as const
export type Mode = typeof ModeVals[number]

/** A resource of one hunt: the hunt, named within its org */
export type InHuntT = { org: string, hunt: string }

/** A resource of one quiz: its hunt, and the realm and label that name it there */
export type InQuizT = InHuntT & { realm: string, quiz: string }

/**
 * A resource the app can name, by label throughout. `kind` says which:
 *
 * * `org`: an org's hunts.
 * * `hunt`: the hunt itself, its own fields.
 * * `quizzes`: every quiz of the hunt, as a list.
 * * `categories`, `members`: the hunt's wheel of categories, and who is on it.
 * * `quiz`: one quiz, whole.
 * * `questions`: one quiz's questions alone, to paste across quizzes.
 * * `review`: one reviewer's review of one quiz, by their ident label.
 * * `widget`: one widget of the library.
 */
export type AddressT =
  | { kind: 'org', org: string }
  | ({ kind: 'hunt' }       & InHuntT)
  | ({ kind: 'quizzes' }    & InHuntT)
  | ({ kind: 'categories' } & InHuntT)
  | ({ kind: 'members' }    & InHuntT)
  | ({ kind: 'quiz' }       & InQuizT)
  | ({ kind: 'questions' }  & InQuizT)
  | ({ kind: 'review', reviewer: string } & InQuizT)
  | { kind: 'widget', scope: WidgetScope, widget: string }

export type AddressKind = AddressT['kind']

/** A resource with a key path: every one but an org, which holds hunts rather than being part of one */
export type KeyedAddressT = Exclude<AddressT, { kind: 'org' }>

/** A resource written as a file of a hunt's repository: every keyed one but the list of quizzes, whose quizzes are each a file */
export type FiledAddressT = Exclude<KeyedAddressT, { kind: 'quizzes' }>

/** The formats a file of a hunt's repository is written in: a jsonball, and a table beside it with the same stem */
export const FormatVals = ['json', 'tsv'] as const
export type Format = typeof FormatVals[number]

/**
 * Each file's pre-extension, ahead of its format: `legends.tqq.json`. The jsonballs' are all `tq`
 * and one letter more, so `*.tq?.json` finds every file a merge reads. The questions alone are
 * `qq`, outside that pattern, because they repeat what the quiz's ball holds.
 */
export const PreextForKind = {
  hunt:       'tqh',
  categories: 'tqc',
  members:    'tqm',
  quiz:       'tqq',
  review:     'tqr',
  widget:     'tqw',
  questions:  'qq',
} as const satisfies Record<FiledAddressT['kind'], string>

/** The stem of the hunt's own file, whose key path is the root and so names no file of its own */
const HuntStem = 'hunt'

/** A resource read from an address: what it names, and the mode it is opened in, or null when it names none */
export type LocationT = {
  address: AddressT
  mode:    Mode | null
}

/** One who is on a hunt, as far as naming its org needs: who, and in what role */
type MemberLikeT = { label: string, role: HuntRole }

/**
 * The org a hunt is addressed under: the ident label of its earliest smith, its maker. Null for a
 * hunt with no smith, which nothing should leave.
 *
 * @param members - Who is on the hunt, in the order they joined it.
 *
 * @example orgOf([{ label: 'pat_smith', role: 'smith' }, { label: 'lee_jones', role: 'smith' }])  // => 'pat_smith'
 * @example orgOf([{ label: 'lee_jones', role: 'reviewer' }, { label: 'pat_smith', role: 'smith' }])  // => 'pat_smith'
 * @example orgOf([])  // => null
 */
export function orgOf(members: readonly MemberLikeT[]): string | null {
  return members.find((member) => member.role === 'smith')?.label ?? null
}

/**
 * The key path of a resource: the nouns and labels below its hunt, or below the library for a
 * widget. It is where the resource's piece of the hunt sits in a jsonball (the hunt's own fields
 * at the root), and the address and the file are made from it.
 *
 * @example keypathOf({ kind: 'quiz', org: 'pat_smith', hunt: 'spring_hunt', realm: 'home', quiz: 'legends' })  // => ['quizzes', 'home', 'legends']
 * @example keypathOf({ kind: 'hunt', org: 'pat_smith', hunt: 'spring_hunt' })  // => []
 * @example keypathOf({ kind: 'widget', scope: 'pub', widget: 'dumdum' })  // => ['widgets', 'pub', 'dumdum']
 */
export function keypathOf(address: KeyedAddressT): string[] {
  switch (address.kind) {
  case 'hunt':       { return [] }
  case 'quizzes':    { return ['quizzes'] }
  case 'categories': { return ['categories'] }
  case 'members':    { return ['members'] }
  case 'quiz':       { return ['quizzes', address.realm, address.quiz] }
  case 'questions':  { return ['quizzes', address.realm, address.quiz, 'questions'] }
  case 'review':     { return ['quizzes', address.realm, address.quiz, 'reviews', address.reviewer] }
  case 'widget':     { return ['widgets', address.scope, address.widget] }
  }
}

/**
 * The address of a resource in the app, opened in `mode` when one is given.
 *
 * @example urlOf({ kind: 'quiz', org: 'pat_smith', hunt: 'spring_hunt', realm: 'home', quiz: 'legends' }, 'playtest')  // => '/~pat_smith/spring_hunt/quizzes/home/legends/!playtest'
 * @example urlOf({ kind: 'hunt', org: 'pat_smith', hunt: 'spring_hunt' })  // => '/~pat_smith/spring_hunt'
 * @example urlOf({ kind: 'org', org: 'pat_smith' })  // => '/~pat_smith'
 * @example urlOf({ kind: 'widget', scope: 'pub', widget: 'dumdum' })  // => '/lib/widgets/pub/dumdum'
 */
export function urlOf(address: AddressT, mode?: Mode): string {
  const keypath = address.kind === 'org' ? [] : keypathOf(address)
  const tail    = mode === undefined ? [] : ['!' + mode]
  return '/' + [...rootOf(address), ...keypath, ...tail].join('/')
}

/** The segments an address starts with: its org and hunt, or the library */
function rootOf(address: AddressT): string[] {
  switch (address.kind) {
  case 'org':    { return [`~${address.org}`] }
  case 'widget': { return ['lib'] }
  default:       { return [`~${address.org}`, address.hunt] }
  }
}

/**
 * The path of a resource's file in its hunt's repository: its key path as directories and a stem,
 * then its pre-extension and its format.
 *
 * @param format - Which of the two files: the jsonball, or the table beside it.
 *
 * @example filepathOf({ kind: 'quiz', org: 'pat_smith', hunt: 'spring_hunt', realm: 'home', quiz: 'legends' })  // => 'quizzes/home/legends.tqq.json'
 * @example filepathOf({ kind: 'questions', org: 'pat_smith', hunt: 'spring_hunt', realm: 'home', quiz: 'legends' }, 'tsv')  // => 'quizzes/home/legends/questions.qq.tsv'
 * @example filepathOf({ kind: 'hunt', org: 'pat_smith', hunt: 'spring_hunt' })  // => 'hunt.tqh.json'
 */
export function filepathOf(address: FiledAddressT, format: Format = 'json'): string {
  const stem = address.kind === 'hunt' ? HuntStem : keypathOf(address).join('/')
  return `${stem}.${PreextForKind[address.kind]}.${format}`
}

/**
 * Whether a resource's jsonball is one of those that deep-merge into the hunt. The questions
 * alone are not: they repeat what the quiz's ball holds.
 *
 * @example isMerged({ kind: 'categories', org: 'pat_smith', hunt: 'spring_hunt' })  // => true
 * @example isMerged({ kind: 'questions', org: 'pat_smith', hunt: 'spring_hunt', realm: 'home', quiz: 'legends' })  // => false
 */
export function isMerged(address: FiledAddressT): boolean {
  return address.kind !== 'questions'
}

/**
 * The resource an address names, and the mode it opens it in; null when it names none. Reads only
 * the address's canonical form, with labels lowercase: an address that does not parse leads
 * nowhere. A query string or a fragment is ignored, as is a trailing slash, and an escaped
 * character reads as itself (`%7E` as `~`).
 *
 * @example locationFrom('/~pat_smith/spring_hunt/quizzes/home/legends/!edit')  // => { address: { kind: 'quiz', org: 'pat_smith', hunt: 'spring_hunt', realm: 'home', quiz: 'legends' }, mode: 'edit' }
 * @example locationFrom('/~pat_smith/spring_hunt')  // => { address: { kind: 'hunt', org: 'pat_smith', hunt: 'spring_hunt' }, mode: null }
 * @example locationFrom('/h/spring_hunt')  // => null
 */
export function locationFrom(raw: string): LocationT | null {
  const segs = segmentsFrom(raw)
  if (segs === null) { return null }
  const hasMode = segs.at(-1)?.startsWith('!') ?? false
  const mode    = hasMode ? modeFrom(segs.at(-1)) : null
  if (hasMode && mode === null) { return null }
  const address = addressFrom(hasMode ? segs.slice(0, -1) : segs)
  return address && { address, mode }
}

/** An address's path as its segments, unescaped, or null when it is not a path or holds an empty segment */
function segmentsFrom(raw: string): string[] | null {
  const path = raw.split(/[?#]/, 1)[0] ?? ''
  if (! path.startsWith('/')) { return null }
  const segs = path.slice(1).replace(/\/$/, '').split('/')
  if (segs.includes('')) { return null } // the bare root among them, which names nothing
  try {
    return segs.map((seg) => decodeURIComponent(seg))
  } catch {
    return null
  }
}

/** The resource a path's segments name, its mode taken off; null when they name none */
function addressFrom(segs: readonly string[]): AddressT | null {
  const [head = '', ...rest] = segs
  if (head === 'lib') { return widgetFrom(rest) }
  const org = orgFrom(head)
  if (org === null) { return null }
  const [hunt, ...keypath] = rest
  if (hunt === undefined) { return { kind: 'org', org } }
  return isLabel(hunt) ? huntResourceFrom({ org, hunt }, keypath) : null
}

/** The library's resource a key path names, or null */
function widgetFrom(keypath: readonly string[]): AddressT | null {
  const [noun, scope, widget, ...extra] = keypath
  const known = WidgetScopeVals.find((each) => each === scope)
  if (noun !== 'widgets' || known === undefined || widget === undefined || ! isLabel(widget) || extra.length > 0) { return null }
  return { kind: 'widget', scope: known, widget }
}

/** The resource of a hunt a key path names, or null */
function huntResourceFrom(inHunt: InHuntT, keypath: readonly string[]): AddressT | null {
  const [noun, realm, quiz, ...below] = keypath
  if (noun === undefined) { return { kind: 'hunt', ...inHunt } }
  if (realm === undefined) {
    switch (noun) {
    case 'quizzes':    { return { kind: 'quizzes',    ...inHunt } }
    case 'categories': { return { kind: 'categories', ...inHunt } }
    case 'members':    { return { kind: 'members',    ...inHunt } }
    default:           { return null }
    }
  }
  if (noun !== 'quizzes' || quiz === undefined || ! isLabel(realm) || ! isLabel(quiz)) { return null }
  return quizResourceFrom({ ...inHunt, realm, quiz }, below)
}

/** The resource of a quiz the rest of a key path names, or null */
function quizResourceFrom(inQuiz: InQuizT, keypath: readonly string[]): AddressT | null {
  const [noun, reviewer, ...extra] = keypath
  if (extra.length > 0) { return null }
  if (noun === undefined) { return { kind: 'quiz', ...inQuiz } }
  if (noun === 'questions' && reviewer === undefined) { return { kind: 'questions', ...inQuiz } }
  if (noun === 'reviews' && reviewer !== undefined && isLabel(reviewer)) { return { kind: 'review', ...inQuiz, reviewer } }
  return null
}

/**
 * The org an address's first segment names: the ident label after its `~`; null when it names
 * none, as a label too short or too long to be an ident's does not.
 *
 * @example orgFrom('~pat_smith')  // => 'pat_smith'
 * @example orgFrom('pat_smith')  // => null
 * @example orgFrom('~pat')  // => null
 */
export function orgFrom(raw: string | null | undefined): string | null {
  if (! raw?.startsWith('~')) { return null }
  const org = raw.slice(1)
  return isIdentlabel(org) ? org : null
}

/**
 * The mode an address's last segment names: one it knows after a `!`; null otherwise.
 *
 * @example modeFrom('!playtest')  // => 'playtest'
 * @example modeFrom('!admin')  // => null
 */
export function modeFrom(raw: string | null | undefined): Mode | null {
  if (! raw?.startsWith('!')) { return null }
  return ModeVals.find((mode) => mode === raw.slice(1)) ?? null
}

/** Whether `str` is a label: what every slot of an address holds besides its sigils and nouns */
function isLabel(str: string): boolean {
  return PA.Label.re.test(str)
}

/** Whether `str` is an ident's label, as an org is: a label, and of an ident's length */
function isIdentlabel(str: string): boolean {
  return PA.Identlabel.re.test(str) && str.length >= PA.Identlabel.min && str.length <= PA.Identlabel.max
}
