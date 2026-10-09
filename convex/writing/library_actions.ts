import _ from 'es-toolkit/compat'
import * as PA from '../../src/lib/vv/patterns'
import { refuse } from '../../src/lib/refusals'
import type { LibraryActionT } from '../../src/models/actions'
import { Widget, WidgetValidators, type WidgetPatch, type WidgetT } from '../../src/models/widget'
import { libraryOf, widgetForLabel, type CensusT } from '../reading'
import { insertAbsentWidgets, movedTo, repositioned, updateWidget, type Writer } from './quiz_writing'
import { refuseRiskyRegexes } from './regex_vetting'

/**
 * Put a widget at the end of the library. A label the library already holds is refused, as is one
 * widget more than the library may hold, and an entry whose default params hold a regular
 * expression recheck does not find safe (`refuseRiskyRegexes`).
 */
export async function addWidget(db: Writer, widget: WidgetT): Promise<void> {
  const held = await libraryOf(db)
  if (held.some((other) => other.label === widget.label)) { refuse('labelTaken') }
  if (held.length >= PA.WidgetsInLibrary.max) { refuse('libraryFull') }
  refuseRiskyRegexes([widget.config])
  await db.insert('widgets', WidgetValidators.row({ ...widget, position: held.length }))
}

/**
 * Revise the library's widget labelled `label`, its patch held to the widget's own formulary: a
 * config of another formulary's shape, or a formula past its bound, is not valid, and an entry's
 * kind stays as it is, and a regular expression new to its default params is held to recheck's
 * verdict. Every quiz working it changes with it. Refused when the library holds no such widget.
 *
 * @throws A refusal (`widgetGone`, `entryKindFixed`, `regexRisky`), or a Zod error when the patch does not fit the widget's formulary; nothing is written.
 */
export async function editWidget(db: Writer, label: string, patch: WidgetPatch): Promise<void> {
  const held = await widgetForLabel(db, label)
  if (! held) { refuse('widgetGone') }
  refuseRiskyRegexes([patch.config], [held.config])
  await updateWidget(db, held, patch)
}

/** Move the library's widget labelled `label` to `onto_idx` in the order it lists them */
export async function moveWidget(db: Writer, label: string, onto_idx: number): Promise<void> {
  const held = await libraryOf(db)
  if (held.every((widget) => widget.label !== label)) { refuse('widgetGone') }
  await repositioned(movedTo(held, label, onto_idx), async (row, position) => { await updateWidget(db, row, { position }) })
}

/**
 * Remove the library's widget labelled `label`. Refused while any widgeting, in any quiz of any
 * hunt, works it (as `census` counts them): that widgeting would have nothing to work. One already
 * gone is nothing to do.
 *
 * @throws A refusal (`widgetInUse`); nothing is written.
 */
export async function deleteWidget(db: Writer, census: CensusT, label: string): Promise<void> {
  const held = await libraryOf(db)
  const doomed = held.find((widget) => widget.label === label)
  if (! doomed) { return }
  if (await census.isWorked(label)) { refuse('widgetInUse') }
  await db.delete('widgets', doomed._id)
  await repositioned(held.filter((widget) => widget._id !== doomed._id), async (row, position) => { await updateWidget(db, row, { position }) })
}

/**
 * Merge widgets into the library by label: one it lacks is added at the end; one it holds is
 * revised (title, description, formula, input formula, config); one whose formulary differs from
 * the one held, or an entry whose kind does, is passed over rather than half-merged. None is removed. A label the import names
 * twice is merged once, as its first. A regular expression in an entry's default params that the
 * library does not already hold is held to recheck's verdict, all of them within one budget.
 *
 * @throws A refusal (`libraryFull`) when the widgets added would pass what the library may hold, or (`regexRisky`) for a pattern recheck does not find safe; nothing is written.
 */
export async function importWidgets(db: Writer, widgets: readonly WidgetT[]): Promise<void> {
  // A label named twice is merged once: the first of them is the one taken.
  const merged = _.uniqBy(widgets, 'label')
  const held = await libraryOf(db)
  const heldFor = new Map(held.map((widget) => [widget.label, widget]))
  const added = merged.filter((widget) => ! heldFor.has(widget.label))
  if (held.length + added.length > PA.WidgetsInLibrary.max) { refuse('libraryFull') }
  const revised = merged.flatMap((widget) => {
    const row = heldFor.get(widget.label)
    return row && Widget.flavorOf(row) === Widget.flavorOf(widget) ? [{ row, widget }] : []
  })
  refuseRiskyRegexes([...added, ...revised.map(({ widget }) => widget)].map((widget) => widget.config), held.map((widget) => widget.config))
  for (const { row, widget } of revised) {
    const { title, description, formula, input_formula, config } = widget
    await updateWidget(db, row, { title, description, formula, input_formula, config })
  }
  await insertAbsentWidgets(db, added)
}

/** Carry out an action on the library, writing the rows it comes to, asking `census` what spans every hunt. See `perform`. */
export async function performLibrary(db: Writer, census: CensusT, action: LibraryActionT): Promise<void> {
  switch (action.kind) {
  case 'add_widget':     { await addWidget(db, action.widget); return }
  case 'edit_widget':    { await editWidget(db, action.label, action.patch); return }
  case 'move_widget':    { await moveWidget(db, action.label, action.onto_idx); return }
  case 'delete_widget':  { await deleteWidget(db, census, action.label); return }
  case 'import_widgets': { await importWidgets(db, action.widgets) }
  }
}
