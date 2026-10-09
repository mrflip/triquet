import * as Labelmaker from './labelmaker'
import * as Estimates from './estimates'
import * as Formularies from './formulary/formularies'
import { RefusalNotices } from './notices'
import { columnsShowing } from './columns'
import * as UU from './useful'
import * as Reporting from './vv/reporting'
import { Column, namesFor } from '../models/column'
import { AddedColumnWidthPx } from '../models/layout'
import { DefaultTier, ReservedWidgetingLabels, Widgeting, WidgetingValidators, type WidgetingPatch, type WidgetingT, type WidgetingTier } from '../models/widgeting'
import type { Formularykind, WidgetT } from '../models/widget'
import { Quiz, type QuizT } from '../models/quiz'
import type { HuntActionDNA } from '../models/actions'

/** How wide the column a new widgeting brings with it is: a number's, a model's answer's, a note's, or a template's text */
export const NewColumnWidthPx: Readonly<Record<Formularykind, number>> = {
  jsonata:   78,
  aibot:     170,
  entry:     170,
  liquidize: 220,
}

/** How wide the column a new category-estimate widgeting brings is: room for two pills side by side */
export const EstimatesColumnWidthPx = 360

/** Everything the widgeting editor holds while it is open: a widgeting's own fields, and which widget it works */
export type WidgetingEdit = {
  /** The widgeting being edited, or null for a new one */
  widgeting:   WidgetingT | null
  label:       string
  description: string
  /** The label of the library's widget it works; blank while none is picked */
  widgetLabel: string
  /** Which level a new one runs at, for each question unless said; an existing one keeps its own */
  tier?:       WidgetingTier
  /** What it hands its widget: an entry's constraints, say. Absent, an existing one keeps its own and a new one says none */
  params?:     WidgetingT['params']
}

/** What applying a widgeting edit comes to: the actions to dispatch, or what to tell the author is wrong, and whether it is the label */
export type WidgetingPlan =
  | { ok: true, actions: HuntActionDNA[] }
  | { ok: false, issue: string, labelIssue: string | null }

/**
 * The actions that applying `edit` of a widgeting comes to, or the reason it cannot be.
 *
 * An existing widgeting is revised only where it changed; relabelled, a column still headed after
 * its old label is headed after the new. Its params are held to the widget it
 * works (`Formularies.paramsOf`), as the server holds them. A new one works a widget the library
 * holds and can run at its tier (`Widgeting.runsAt`), and is labelled as its widget is unless the
 * author says otherwise, growing `_2`, `_3` while that is taken or reserved (for one run once for
 * the whole quiz, by the quiz's own fields too). One for each question brings a column to show it,
 * just before Alt Text; one for the whole quiz has no cell for any question, and brings none.
 * Whether the quiz may be changed at all is the editor's to offer (`Approve`), not the plan's. The
 * widget itself is the library's, and is never changed from here.
 *
 * @param edit - The editor's state.
 * @param library - The library's widgets, with any written a moment ago that it does not hold yet.
 * @param quiz - The quiz the widgeting belongs to.
 * @returns The plan.
 *
 * @example planWidgetingEdit({ widgeting: null, label: '', description: '', widgetLabel: 'answer_reversed' }, library, quiz)
 *   // => { ok: true, actions: [{ kind: 'add_widgeting', ... }, { kind: 'add_column', ... }] }
 */
export function planWidgetingEdit(edit: Readonly<WidgetingEdit>, library: readonly WidgetT[], quiz: QuizT): WidgetingPlan {
  const widget = library.find((each) => each.label === edit.widgetLabel)
  if (! widget && edit.widgeting === null) { return refused('Pick a widget for it to work.') }
  const tier = edit.widgeting?.tier ?? edit.tier ?? DefaultTier
  if (widget && edit.widgeting === null && ! Widgeting.runsAt(widget, tier)) { return refused(RefusalNotices.tierUnoffered) }
  const siblings = new Set(quiz.widgetings.filter((other) => other.label !== edit.widgeting?.label).map((other) => other.label))
  const label = labelOf(edit, siblings, tier)
  if (siblings.has(label)) { return refused('Another widgeting in this quiz already has that label.', true) }
  if (tier === 'quiz' && ! Quiz.mayLabelQuizTier(label)) { return refused('The quiz itself already answers to that name in a formula.', true) }
  const checked = WidgetingValidators.widgeting.safeParse({ widget_label: edit.widgetLabel, label, description: edit.description, params: edit.params ?? edit.widgeting?.params ?? {}, tier })
  if (! checked.success) {
    const [first] = checked.error.issues
    return refused(first?.message ?? 'That widgeting will not do.', first?.path[0] === 'label')
  }
  const paramsIssue = widget ? paramsIssueOf(widget, edit.widgeting, checked.data.params) : null
  if (paramsIssue !== null) { return refused(paramsIssue) }
  if (edit.widgeting !== null) { return { ok: true, actions: editWidgetingActions(edit.widgeting, checked.data, quiz) } }
  if (tier === 'quiz') { return { ok: true, actions: [{ kind: 'add_widgeting', widgeting: checked.data }] } }
  const width_px = widget && Estimates.isEstimating(widget) ? EstimatesColumnWidthPx : NewColumnWidthPx[widget?.formulary ?? 'jsonata']
  return { ok: true, actions: [{ kind: 'add_widgeting', widgeting: checked.data }, newColumnFor(quiz, checked.data.label, width_px)] }
}

/**
 * The label a widgeting edit asks for: what was typed, tidied into a label; or, typed blank, its
 * widget's, growing `_2`, `_3` while a sibling, the questions or (for one run once for the whole
 * quiz) the quiz's own fields have it.
 */
function labelOf(edit: Readonly<WidgetingEdit>, siblings: ReadonlySet<string>, tier: WidgetingTier): string {
  const typed = Labelmaker.normalize(edit.label)
  if (typed !== '') { return typed }
  const reserved = tier === 'quiz' ? Quiz.bagKeys : []
  return Labelmaker.firstFree(edit.widgetLabel, new Set([...siblings, ...ReservedWidgetingLabels, ...reserved]))
}

/**
 * What is wrong with `params` for a widgeting of `widget`, or null when nothing is. Params are
 * held to the widget only where they are written, as the server holds them: an existing
 * widgeting's own stand until they change.
 */
function paramsIssueOf(widget: WidgetT, held: WidgetingT | null, params: WidgetingT['params']): string | null {
  if (held !== null && UU.jsonify(params) === UU.jsonify(held.params)) { return null }
  const checked = Formularies.paramsOf(widget).safeParse(params, { error: Reporting.customError })
  return checked.success ? null : `Its params will not do: ${Reporting.explain(checked.error)}`
}

/** A refusal; `labelIssue` when it is the widgeting's label that will not do */
function refused(issue: string, labelIssue = false): Extract<WidgetingPlan, { ok: false }> {
  return { ok: false, issue, labelIssue: labelIssue ? issue : null }
}

/** A column showing the widgeting labelled `label`, titled after it, for a new widgeting to bring with it */
function newColumnFor(quiz: QuizT, label: string, width_px: number): HuntActionDNA {
  const columnLabel = Labelmaker.firstFree(label, new Set(quiz.columns.map((column) => column.label)))
  const column = Column.fill({ label: columnLabel, title: Labelmaker.titleize(label), source: label, width_px })
  const before = quiz.columns.findIndex((each) => each.source === 'alt_text')
  return before === -1 ? { kind: 'add_column', column } : { kind: 'add_column', column, onto_idx: before }
}

/**
 * The action adding a column that shows `source` (a ref), at the end of the
 * grid: titled and labelled after what it shows, its label growing `_2`, `_3` while another
 * column has it, at the width a new column takes. The author changes the rest in its row, as it is
 * made.
 *
 * @param quiz - The quiz the column is added to.
 * @param source - What it shows.
 * @returns The `add_column` action.
 *
 * @example newColumnShowing(quiz, 'notes')  // => { kind: 'add_column', column: { label: 'notes', title: 'Notes', source: 'notes', width_px: 180 } }; `notes_2` beside another
 */
export function newColumnShowing(quiz: Pick<QuizT, 'columns'>, source: string): Extract<HuntActionDNA, { kind: 'add_column' }> {
  const named = namesFor(source)
  const label = Labelmaker.firstFree(named.label, new Set(quiz.columns.map((column) => column.label)))
  return { kind: 'add_column', column: Column.fill({ label, title: named.title, source, width_px: AddedColumnWidthPx }) }
}

/**
 * Revising only what changed in an existing widgeting. A relabel carries the columns showing it
 * along (the reducer's doing); a column still headed after its old label, as a new one is, is
 * headed after the new.
 */
function editWidgetingActions(held: WidgetingT, next: WidgetingT, quiz: QuizT): HuntActionDNA[] {
  const patch: WidgetingPatch = {
    ...(held.label !== next.label && { label: next.label }),
    ...(held.description !== next.description && { description: next.description }),
    ...(UU.jsonify(held.params) !== UU.jsonify(next.params) && { params: next.params }),
  }
  if (Object.keys(patch).length === 0) { return [] }
  const headedAfter = held.label === next.label ? [] : columnsShowing(quiz, held.label).filter((column) => column.title === Labelmaker.titleize(held.label))
  return [
    { kind: 'edit_widgeting', label: held.label, patch },
    ...headedAfter.map((column): HuntActionDNA => ({ kind: 'edit_column', label: column.label, patch: { title: Labelmaker.titleize(next.label) } })),
  ]
}

/** A quiz's run order as its lists show it: the entries at the head, never dragged, then the rest */
export type RunOrderListsT = {
  /** The entry widgetings, which read nothing and so run first wherever they are placed */
  entries: WidgetingT[]
  /** Every other widgeting, in position order, both tiers mixed: the ones dragged into order */
  rest:    WidgetingT[]
  /** Whether a widgeting is one of the entries */
  isEntry: (widgeting: WidgetingT) => boolean
}

/**
 * A quiz's widgetings split as the run-order lists show them: the entries at the head, the rest
 * below in position order. A widgeting whose widget the library no longer holds is among the rest.
 *
 * @param widgetings - The quiz's widgetings, in position order.
 * @param library - The widgets they work.
 * @returns The two lists, and how one was told from the other (for `runOrderIdxOf`).
 *
 * @example runOrderListsOf([shout, remark, guess], library)  // => { entries: [remark], rest: [shout, guess], isEntry }
 */
export function runOrderListsOf(widgetings: readonly WidgetingT[], library: readonly WidgetT[]): RunOrderListsT {
  const entryLabels = new Set(library.filter((widget) => widget.formulary === 'entry').map((widget) => widget.label))
  const isEntry = (widgeting: WidgetingT) => entryLabels.has(widgeting.widget_label)
  return {
    entries: widgetings.filter((widgeting) => isEntry(widgeting)),
    rest:    widgetings.filter((widgeting) => ! isEntry(widgeting)),
    isEntry,
  }
}

/**
 * Where a widgeting dropped in the run-order list lands in the quiz's whole run order, for
 * `move_widgeting`. The list shows the entries at its head, where nothing is dragged, and the rest
 * below them as placed: a drop at `onto_idx` of the rest, counted as they stand once the dragged
 * one is lifted, lands just before the one now there, or just after the last of them. The entries'
 * own places among the rest are left as they were, since they run first wherever they are.
 *
 * @param widgetings - The quiz's widgetings, in position order.
 * @param isEntry - Whether a widgeting is an entry's, one of those not dragged.
 * @param label - The widgeting dropped.
 * @param onto_idx - Where among the rest it was dropped.
 * @returns Its index in the whole run order, counted once it is lifted.
 *
 * @example runOrderIdxOf([remark, guess, shout], isEntry, 'shout', 0)  // => 1
 */
export function runOrderIdxOf(widgetings: readonly WidgetingT[], isEntry: (widgeting: WidgetingT) => boolean, label: string, onto_idx: number): number {
  const lifted = widgetings.filter((widgeting) => widgeting.label !== label)
  const rest = lifted.filter((widgeting) => ! isEntry(widgeting))
  const before = rest[onto_idx]
  if (before) { return lifted.indexOf(before) }
  const last = rest.at(-1)
  return last ? lifted.indexOf(last) + 1 : lifted.length
}
