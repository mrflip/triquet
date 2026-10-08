import * as Labelmaker from './labelmaker'
import * as Estimates from './estimates'
import { RefusalNotices } from './notices'
import { Column } from '../models/column'
import { DefaultTier, ReservedWidgetingLabels, Widgeting, WidgetingValidators, type WidgetingPatch, type WidgetingT, type WidgetingTier } from '../models/widgeting'
import type { Formularykind, WidgetT } from '../models/widget'
import { Quiz, type QuizT } from '../models/quiz'
import type { HuntActionDNA } from '../models/actions'

/** How wide the column a new widgeting brings with it is: a number's, a model's answer's, or a note's */
export const NewColumnWidthPx: Readonly<Record<Formularykind, number>> = {
  jsonata: 78,
  aibot:   170,
  entry:   170,
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
}

/** What applying a widgeting edit comes to: the actions to dispatch, or what to tell the author is wrong, and whether it is the label */
export type WidgetingPlan =
  | { ok: true, actions: HuntActionDNA[] }
  | { ok: false, issue: string, labelIssue: string | null }

/**
 * The actions that applying `edit` of a widgeting comes to, or the reason it cannot be.
 *
 * An existing widgeting is revised only where it changed. A new one works a widget the library
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
  const reserved = tier === 'quiz' ? Quiz.bagKeys : []
  const typed = Labelmaker.normalize(edit.label)
  const label = typed === '' ? Labelmaker.firstFree(edit.widgetLabel, new Set([...siblings, ...ReservedWidgetingLabels, ...reserved])) : typed
  if (siblings.has(label)) { return refused('Another widgeting in this quiz already has that label.', true) }
  if (tier === 'quiz' && ! Quiz.mayLabelQuizTier(label)) { return refused('The quiz itself already answers to that name in a formula.', true) }
  const checked = WidgetingValidators.widgeting.safeParse({ widget_label: edit.widgetLabel, label, description: edit.description, params: edit.widgeting?.params ?? {}, tier })
  if (! checked.success) {
    const [first] = checked.error.issues
    return refused(first?.message ?? 'That widgeting will not do.', first?.path[0] === 'label')
  }
  if (edit.widgeting !== null) { return { ok: true, actions: editWidgetingActions(edit.widgeting, checked.data) } }
  if (tier === 'quiz') { return { ok: true, actions: [{ kind: 'add_widgeting', widgeting: checked.data }] } }
  const width_px = widget && Estimates.isEstimating(widget) ? EstimatesColumnWidthPx : NewColumnWidthPx[widget?.formulary ?? 'jsonata']
  return { ok: true, actions: [{ kind: 'add_widgeting', widgeting: checked.data }, newColumnFor(quiz, checked.data.label, width_px)] }
}

/** A refusal; `labelIssue` when it is the widgeting's label that will not do */
function refused(issue: string, labelIssue = false): Extract<WidgetingPlan, { ok: false }> {
  return { ok: false, issue, labelIssue: labelIssue ? issue : null }
}

/** A column showing the widgeting labelled `label`, titled after it, for a new widgeting to bring with it */
function newColumnFor(quiz: QuizT, label: string, width_px: number): HuntActionDNA {
  const columnLabel = Labelmaker.firstFree(label, new Set(quiz.columns.map((column) => column.label)))
  const column = Column.fill({ label: columnLabel, title: Labelmaker.titleize(label), source: label, width_px })
  const before = quiz.columns.findIndex((each) => each.source === 'question.alt_text')
  return before === -1 ? { kind: 'add_column', column } : { kind: 'add_column', column, onto_idx: before }
}

/** Revising only what changed in an existing widgeting */
function editWidgetingActions(held: WidgetingT, next: WidgetingT): HuntActionDNA[] {
  const patch: WidgetingPatch = {
    ...(held.label !== next.label && { label: next.label }),
    ...(held.description !== next.description && { description: next.description }),
  }
  return Object.keys(patch).length === 0 ? [] : [{ kind: 'edit_widgeting', label: held.label, patch }]
}
