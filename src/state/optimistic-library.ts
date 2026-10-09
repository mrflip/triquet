import type { OptimisticLocalStore } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import * as Postmortem from '../lib/postmortem'
import { ActionValidators, type LibraryActionDNA } from '../models/actions'
import { Widget, WidgetValidators, type WidgetT } from '../models/widget'

/**
 * Show a change to the library on the page the moment it is sent (Convex's optimistic update, on
 * `widgets.perform`), so that whatever reads the library next (an ask, a cell worked out, a
 * preview) reads the widget as written, not as last loaded. Convex takes it back when the server
 * refuses the change, and replaces it with what the server wrote when it lands.
 *
 * Only a widget written or revised is shown early, as `libraryChanged` says. An update that
 * throws is reported and never stops the write: Convex runs it inside the mutation's call, and
 * does not catch.
 */
export function showLibraryChanged(store: OptimisticLocalStore, { action }: { action: LibraryActionDNA }): void {
  try {
    const library = store.getQuery(api.widgets.library, {})
    if (library === undefined) { return }
    const changed = libraryChanged(library, action)
    if (changed !== library) { store.setQuery(api.widgets.library, {}, [...changed]) }
  } catch (err) {
    Postmortem.report(`show a change to the library early (${action.kind})`, err, { action })
  }
}

/**
 * The library as `action` leaves it, as the server writes it: a new widget at the end of the
 * list, a revised one with its patch merged in and held to the widget's validator. Anything else,
 * or an action the server would refuse as it reads it (a label already taken, a widget it lacks, a
 * patch that does not fit, an entry's kind changed), leaves the library as it is: the screen waits
 * for the server.
 *
 * @param library - The library as the page holds it.
 * @param action - The change, as sent.
 * @returns The library changed, or `library` itself when nothing is shown early.
 *
 * @example libraryChanged(library, { kind: 'edit_widget', label: 'riddle', patch: { formula: 'Riddle me {{clueing}}' } })  // => the library, riddle's formula revised
 * @example libraryChanged(library, { kind: 'delete_widget', label: 'riddle' })  // => library, unchanged
 */
export function libraryChanged(library: readonly WidgetT[], action: LibraryActionDNA): readonly WidgetT[] {
  const read = ActionValidators.libraryAction.safeParse(action)
  if (! read.success) { return library }
  const performed = read.data
  switch (performed.kind) {
  case 'add_widget': {
    return library.some((widget) => widget.label === performed.widget.label) ? library : [...library, performed.widget]
  }
  case 'edit_widget': {
    const held = library.find((widget) => widget.label === performed.label)
    if (! held) { return library }
    const revised = WidgetValidators.widget.safeParse({ ...held, ...performed.patch })
    if (! revised.success || Widget.flavorOf(revised.data) !== Widget.flavorOf(held)) { return library }
    return library.map((widget) => (widget === held ? revised.data : widget))
  }
  default: { return library }
  }
}
