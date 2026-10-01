import * as Labelmaker from '../lib/labelmaker'
import { Column } from '../models/column'
import * as UU from '../lib/useful'
import { AibotDefaultInput, WidgetValidators, type AibotWidgetT, type Formularykind, type JsonataWidgetT, type WidgetPatch, type WidgetT } from '../models/widget'
import { ReservedWidgetingLabels, WidgetingValidators, type WidgetingPatch, type WidgetingT } from '../models/widgeting'
import type { QuizT } from '../models/quiz'
import type { HuntActionDNA } from '../models/actions'

/** What the widget select says for "write a new one", which no widget is labelled */
export const NewWidget = ''

/** How wide the column a new widgeting brings with it is: a number's, or a model's answer's */
export const NewColumnWidthPx: Readonly<Record<Formularykind, number>> = {
  jsonata: 78,
  aibot:   170,
}

/** The parts of a `jsonata` widget being written or revised: a draft that names no formulary is one */
export type JsonataDraft = Pick<JsonataWidgetT, 'label' | 'description' | 'formula'> & { formulary?: 'jsonata' }

/** The parts of an `aibot` widget being written or revised: its prompt, its input formula and its config */
export type AibotDraft = Pick<AibotWidgetT, 'label' | 'description' | 'formula' | 'input_formula' | 'config'> & { formulary: 'aibot' }

/** The parts of a widget being written or revised, in the library or beside the widgeting that works it */
export type WidgetDraft = JsonataDraft | AibotDraft

/** What a new `aibot` widget starts as: the clueing put to the quick tier, with room for a short object */
export const BlankAibotDraft: AibotDraft = {
  formulary:     'aibot',
  label:         '',
  description:   '',
  formula:       '',
  input_formula: AibotDefaultInput,
  config:        { servicelabel: 'claude', model_tier: 'quick', max_tokens: 1024 },
}

/** Everything the widgeting editor holds while it is open */
export type WidgetingEdit = {
  /** The widgeting being edited, or null for a new one */
  widgeting:   WidgetingT | null
  label:       string
  description: string
  /** The widget it works, or `NewWidget` to write one now */
  widgetLabel: string
  /** The widget being written or revised beside it; null when the widget is left as it is */
  widget:      WidgetDraft | null
}

/** What applying an edit comes to: the actions to dispatch, or what to tell the author is wrong */
export type WidgetPlan =
  | { ok: true, actions: HuntActionDNA[] }
  | { ok: false, issue: string, labelIssue: string | null }

/**
 * The actions that applying `edit` of a widgeting comes to, or the reason it cannot be.
 *
 * A new widget is added to the library before the widgeting that works it; an existing one is
 * revised only if something of it changed. A new widgeting brings a column to
 * show it, just before Alt Text, and is labelled as its widget is unless the author says
 * otherwise, growing `_2`, `_3` while that is taken. On a locked quiz the widgeting is left alone
 * and only the widget -- which belongs to the library -- can be revised.
 *
 * @param edit - The editor's state.
 * @param library - The library's widgets.
 * @param quiz - The quiz the widgeting belongs to.
 * @returns The plan.
 *
 * @example planWidgetingEdit(edit, library, quiz)  // => { ok: true, actions: [{ kind: 'add_widget', ... }, { kind: 'add_widgeting', ... }, { kind: 'add_column', ... }] }
 */
export function planWidgetingEdit(edit: Readonly<WidgetingEdit>, library: readonly WidgetT[], quiz: QuizT): WidgetPlan {
  const widget = widgetPlanFor(edit, library)
  if (! widget.ok || quiz.locked) { return widget }
  const widgeting = widgetingPlanFor(edit, widget.widget_label, library, quiz)
  return widgeting.ok ? { ok: true, actions: [...widget.actions, ...widgeting.actions] } : widgeting
}

/**
 * The actions that revising a widget of the library to `draft` comes to: one edit when anything
 * of it changed, none when nothing did; or the reason it cannot be.
 *
 * @param draft - The widget as revised; its label names the widget.
 * @param library - The library's widgets.
 * @returns The plan.
 *
 * @example planWidgetEdit({ ...draftOf(heldWidget), formula: '1' }, library)  // => { ok: true, actions: [{ kind: 'edit_widget', ... }] }
 */
export function planWidgetEdit(draft: WidgetDraft, library: readonly WidgetT[]): WidgetPlan {
  const step = widgetPlanFor({ widgeting: null, label: '', description: '', widgetLabel: draft.label, widget: draft }, library)
  return step.ok ? { ok: true, actions: step.actions } : step
}

/**
 * A widget of the library as a draft to revise: the parts its formulary lets an author change.
 *
 * @example draftOf(SeedWidgets[0]).formulary  // => 'aibot'
 */
export function draftOf(widget: WidgetT): WidgetDraft {
  const { label, description, formula } = widget
  if (widget.formulary === 'jsonata') { return { formulary: 'jsonata', label, description, formula } }
  return { formulary: 'aibot', label, description, formula, input_formula: widget.input_formula, config: widget.config }
}

/** A plan, and on its way to success the label of the widget it works */
type WidgetStep = (Extract<WidgetPlan, { ok: true }> & { widget_label: string }) | Extract<WidgetPlan, { ok: false }>

/** A refusal */
function refused(issue: string, labelIssue = false): Extract<WidgetPlan, { ok: false }> {
  return { ok: false, issue, labelIssue: labelIssue ? issue : null }
}

/**
 * The widget's share of an edit: the widget added when it is new, revised when it changed, and
 * nothing otherwise; or why it will not do.
 */
function widgetPlanFor(edit: Readonly<WidgetingEdit>, library: readonly WidgetT[]): WidgetStep {
  const { widget } = edit
  const isNew = widget !== null && edit.widgetLabel === NewWidget
  const widget_label = isNew ? Labelmaker.normalize(widget.label) : edit.widgetLabel
  if (widget_label === '') { return refused(isNew ? 'Give the new widget a label.' : 'Pick a widget for it to work.', isNew) }
  if (isNew && library.some((other) => other.label === widget_label)) { return refused('Another widget in the library already has that label.', true) }
  if (widget === null) { return { ok: true, actions: [], widget_label } }
  const checked = WidgetValidators.widget.safeParse({ formulary: 'jsonata', ...widget, label: widget_label })
  if (! checked.success) { return refused(checked.error.issues[0]?.message ?? 'That widget will not do.') }
  if (isNew) { return { ok: true, actions: [{ kind: 'add_widget', widget: checked.data }], widget_label } }
  const patch = patchFor(checked.data)
  const held = library.find((other) => other.label === widget_label)
  if (held && Object.entries(patch).every(([key, val]) => UU.jsonify(held[key as keyof WidgetT]) === UU.jsonify(val))) { return { ok: true, actions: [], widget_label } }
  return { ok: true, actions: [{ kind: 'edit_widget', label: widget_label, patch }], widget_label }
}

/** What revising a widget to `widget` sets: its description and formula, and an `aibot` widget's input formula and config */
function patchFor(widget: WidgetT): WidgetPatch {
  const shared = { formula: widget.formula, description: widget.description }
  return widget.formulary === 'aibot' ? { ...shared, input_formula: widget.input_formula, config: widget.config } : shared
}

/**
 * The widgeting's share of an edit: added with a column to show it when it is new, revised where
 * it changed otherwise; or why it will not do.
 */
function widgetingPlanFor(edit: Readonly<WidgetingEdit>, widget_label: string, library: readonly WidgetT[], quiz: QuizT): WidgetPlan {
  const siblings = new Set(quiz.widgetings.filter((other) => other.label !== edit.widgeting?.label).map((other) => other.label))
  const typed = Labelmaker.normalize(edit.label)
  const label = typed === '' ? Labelmaker.firstFree(widget_label, new Set([...siblings, ...ReservedWidgetingLabels])) : typed
  if (siblings.has(label)) { return refused('Another widgeting in this quiz already has that label.') }
  const checked = WidgetingValidators.widgeting.safeParse({ widget_label, label, description: edit.description, params: edit.widgeting?.params ?? {} })
  if (! checked.success) { return refused(checked.error.issues[0]?.message ?? 'That widgeting will not do.') }
  if (edit.widgeting !== null) { return { ok: true, actions: editWidgetingActions(edit.widgeting, checked.data) } }
  const formulary = library.find((widget) => widget.label === widget_label)?.formulary ?? edit.widget?.formulary ?? 'jsonata'
  return { ok: true, actions: [{ kind: 'add_widgeting', widgeting: checked.data }, newColumnFor(quiz, checked.data.label, NewColumnWidthPx[formulary])] }
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
