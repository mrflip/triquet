import * as Labelmaker from '../lib/labelmaker'
import * as UU from '../lib/useful'
import { AibotDefaultInput, LiquidizeDefaultInput, Widget, WidgetValidators, type AibotWidgetT, type EntryWidgetT, type Formularykind, type JsonataWidgetT, type LiquidizeWidgetT, type WidgetPatch, type WidgetT } from '../models/widget'
import type { LibraryActionDNA } from '../models/actions'

/** The parts of a `jsonata` widget being written or revised: its formula */
export type JsonataDraft = Pick<JsonataWidgetT, 'label' | 'description' | 'formula'> & { formulary: 'jsonata' }

/** The parts of an `aibot` widget being written or revised: its prompt, its input formula and its config */
export type AibotDraft = Pick<AibotWidgetT, 'label' | 'description' | 'formula' | 'input_formula' | 'config'> & { formulary: 'aibot' }

/** The parts of an `entry` widget being written or revised: what kind of value its cells take, fixed once it is made, and the params its widgetings start from */
export type EntryDraft = Pick<EntryWidgetT, 'label' | 'description' | 'config'> & { formulary: 'entry' }

/** The parts of a `liquidize` widget being written or revised: its template, the default its widgetings may replace, and its input formula */
export type LiquidizeDraft = Pick<LiquidizeWidgetT, 'label' | 'description' | 'formula' | 'input_formula'> & { formulary: 'liquidize' }

/** The parts of a widget of the library being written or revised */
export type WidgetDraft = JsonataDraft | AibotDraft | EntryDraft | LiquidizeDraft

/** What a new `jsonata` widget starts as: nothing yet */
export const BlankJsonataDraft: JsonataDraft = { formulary: 'jsonata', label: '', description: '', formula: '' }

/** What a new `aibot` widget starts as: the clueing put to the quick tier, with room for a short object */
export const BlankAibotDraft: AibotDraft = {
  formulary:     'aibot',
  label:         '',
  description:   '',
  formula:       '',
  input_formula: AibotDefaultInput,
  config:        { servicelabel: 'claude', model_tier: 'quick', max_tokens: 1024 },
}

/** What a new `entry` widget starts as: text, as a note is */
export const BlankEntryDraft: EntryDraft = { formulary: 'entry', label: '', description: '', config: { entry_kind: 'text' } }

/** What a new `liquidize` widget starts as: no template yet, filled in over the whole bag */
export const BlankLiquidizeDraft: LiquidizeDraft = { formulary: 'liquidize', label: '', description: '', formula: '', input_formula: LiquidizeDefaultInput }

/** What a new widget of each formulary starts as */
const BlankDrafts: Readonly<Record<Formularykind, WidgetDraft>> = {
  jsonata:   BlankJsonataDraft,
  aibot:     BlankAibotDraft,
  entry:     BlankEntryDraft,
  liquidize: BlankLiquidizeDraft,
}

/** What applying an edit comes to: the actions to dispatch, or what to tell the author is wrong, and whether it is the label */
export type WidgetPlan =
  | { ok: true, actions: LibraryActionDNA[] }
  | { ok: false, issue: string, labelIssue: string | null }

/** What writing a new widget comes to: the action adding it, and the widget as added; or what is wrong */
export type NewWidgetPlan =
  | Extract<WidgetPlan, { ok: false }>
  | { ok: true, actions: LibraryActionDNA[], widget: WidgetT }

/**
 * A new widget of `formulary`, as it starts, keeping the label and description already typed: what
 * the editor holds once the author picks a formulary.
 *
 * @example blankDraftOf('aibot', { label: 'riddler', description: '' }).input_formula  // => "{ 'clueing': question.clueing }"
 */
export function blankDraftOf(formulary: Formularykind, kept: Pick<WidgetDraft, 'label' | 'description'>): WidgetDraft {
  return { ...BlankDrafts[formulary], label: kept.label, description: kept.description }
}

/**
 * A widget of the library as a draft to revise: the parts its formulary lets an author change.
 *
 * @example draftOf(SeedWidgets[0]).formulary  // => 'aibot'
 */
export function draftOf(widget: WidgetT): WidgetDraft {
  const { label, description, formula } = widget
  switch (widget.formulary) {
  case 'jsonata': { return { formulary: 'jsonata', label, description, formula } }
  case 'aibot':   { return { formulary: 'aibot', label, description, formula, input_formula: widget.input_formula, config: widget.config } }
  case 'entry':   { return { formulary: 'entry', label, description, config: widget.config } }
  case 'liquidize': { return { formulary: 'liquidize', label, description, formula, input_formula: widget.input_formula } }
  }
}

/**
 * The action that adding `draft` to the library comes to, and the widget it adds; or the reason it
 * cannot be. Its label is normalized, and must be one the library does not hold.
 *
 * @param draft - The widget as written.
 * @param library - The library's widgets.
 * @returns The plan.
 *
 * @example planNewWidget({ ...BlankJsonataDraft, label: 'Title Length', formula: '$length(question.title)' }, library).actions  // => [{ kind: 'add_widget', widget: { label: 'title_length', ... } }]
 */
export function planNewWidget(draft: WidgetDraft, library: readonly WidgetT[]): NewWidgetPlan {
  const label = Labelmaker.normalize(draft.label)
  if (label === '') { return refused('Give the new widget a label.', true) }
  if (library.some((other) => other.label === label)) { return refused('Another widget in the library already has that label.', true) }
  const checked = WidgetValidators.widget.safeParse({ ...draft, label })
  if (! checked.success) { return refused(checked.error.issues[0]?.message ?? 'That widget will not do.') }
  return { ok: true, actions: [{ kind: 'add_widget', widget: checked.data }], widget: checked.data }
}

/**
 * The actions that revising a widget of the library to `draft` comes to: one edit when anything
 * of it changed, none when nothing did; or the reason it cannot be. An entry's kind is fixed once
 * it is made, so a draft changing it is refused.
 *
 * @param draft - The widget as revised; its label names the widget.
 * @param library - The library's widgets.
 * @returns The plan.
 *
 * @example planWidgetEdit({ ...draftOf(heldWidget), formula: '1' }, library)  // => { ok: true, actions: [{ kind: 'edit_widget', ... }] }
 */
export function planWidgetEdit(draft: WidgetDraft, library: readonly WidgetT[]): WidgetPlan {
  const checked = WidgetValidators.widget.safeParse(draft)
  if (! checked.success) { return refused(checked.error.issues[0]?.message ?? 'That widget will not do.') }
  const patch = patchFor(checked.data)
  const held = library.find((other) => other.label === draft.label)
  if (held && Widget.flavorOf(held) !== Widget.flavorOf(checked.data)) { return refused(`It is ${Widget.flavorOf(held)}, which is fixed once it is made.`) }
  if (held && Object.entries(patch).every(([key, val]) => UU.jsonify(held[key as keyof WidgetT]) === UU.jsonify(val))) { return { ok: true, actions: [] } }
  return { ok: true, actions: [{ kind: 'edit_widget', label: draft.label, patch }] }
}

/** A refusal; `labelIssue` when it is the label that will not do */
function refused(issue: string, labelIssue = false): Extract<WidgetPlan, { ok: false }> {
  return { ok: false, issue, labelIssue: labelIssue ? issue : null }
}

/** What revising a widget to `widget` sets: its description and formula, and an `aibot` or `liquidize` widget's input formula, and an `aibot`'s config; an entry's description and config, the defaults its widgetings start from */
function patchFor(widget: WidgetT): WidgetPatch {
  const shared = { formula: widget.formula, description: widget.description }
  switch (widget.formulary) {
  case 'jsonata': { return shared }
  case 'aibot':   { return { ...shared, input_formula: widget.input_formula, config: widget.config } }
  case 'entry':   { return { description: widget.description, config: widget.config } }
  case 'liquidize': { return { ...shared, input_formula: widget.input_formula } }
  }
}
