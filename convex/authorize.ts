import type { Id } from './_generated/dataModel'

/**
 * Whether the browser `browser_key` may change the hunt `hunt_id`: the only place authorization
 * is written, and every function that writes a hunt asks it first, refusing (`notPermitted`)
 * when it may not.
 *
 * For the playtesting trial every hunt is open to every browser: anyone who can reach the app can
 * read and change any hunt. A hunt is found by its address, and an address is not a secret.
 * Who is on a hunt, and in what role, is kept (its huntings) and followed by the pages; this
 * check does not consult it.
 *
 * Two kinds of row are not open, by what the functions offer rather than by a check. A browser's
 * identings are read only through its own key, so no browser sees which idents another has taken
 * on. An ident may be made by anyone, but no function changes or removes one, so an ident
 * someone has taken on cannot be pulled from under them.
 *
 * @param _browser_key - The browser asking.
 * @param _hunt_id - The hunt it would change.
 * @returns Whether it may; for the trial, always.
 *
 * @example if (! mayChangeHunt(browser_key, open.hunt_id)) { refuse('notPermitted') }
 */
export function mayChangeHunt(_browser_key: string, _hunt_id: Id<'hunts'>): boolean {
  return true
}
