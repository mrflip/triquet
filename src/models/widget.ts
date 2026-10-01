import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import { ServicelabelVals } from '../lib/credentials'
import { ModelTierVals } from './ask'

/** The formularies a widget of the library can be worked by: a JSONata formula worked out on render, a prompt put to a model, or a value a person types */
export const FormularykindVals = ['jsonata', 'aibot', 'entry'] as const
export type Formularykind = typeof FormularykindVals[number]

/** What an `entry` widget's cells take: prose, a number, a label, or a one-line title */
export const EntryKindVals = ['text', 'number', 'labelish', 'titleish'] as const
export type EntryKind = typeof EntryKindVals[number]

/** Who a widget belongs to: `pub`, the library every hunt sees, is the only scope there is so far */
export const WidgetScopeVals = ['pub'] as const
export type WidgetScope = typeof WidgetScopeVals[number]

/** Most room an `aibot` widget may give a model to answer in: twice what the number spotter takes */
export const AibotTokensMax = 8000

/** The input formula a new `jsonata` widget starts with: the whole bag */
export const JsonataDefaultInput = '$'

/** The input formula a new `aibot` widget starts with: the clueing, for a `{{clueing}}` in its prompt */
export const AibotDefaultInput = "{ 'clueing': qn.clueing }"

export const WidgetValidators = Validator(({ obj, oneof, lit, label, titleish, noteish, textish, formulaish, discrim, union, uint, num }) => {
  const jsonataConfig = obj({}).strict()
    .describe('A `jsonata` widget\'s settings: none.')
  const aibotConfig = obj({
    servicelabel: oneof(ServicelabelVals)
      .describe('Which outside service the prompt is put to, and so whose credentials it needs.'),
    model_tier:   oneof(ModelTierVals)
      .describe('Which tier of model answers: `quick` for a hasty first instinct, `careful` for a thorough reading.'),
    max_tokens:   uint.min(1).max(AibotTokensMax)
      .describe('How much room the model is given to answer one question.'),
  })
    .describe('An `aibot` widget\'s settings: who answers, and how much room they have.')
  const entryConfig = obj({
    entry_kind: oneof(EntryKindVals)
      .describe('What its cells take: `text` (prose, markdown welcome), `number`, `labelish` (a label, as `quiet_otter`) or `titleish` (one line). Fixed once made: the values typed hang on it.'),
  }).strict()
    .describe('An `entry` widget\'s settings: what kind of value is typed into its cells.')

  // What an `entry` widget's cell holds, by its kind; an emptied cell holds no row at all.
  const entryText = noteish.min(1)
    .describe('Prose typed into an entry cell, trimmed; markdown welcome.')
  const entryNumber = num
    .describe('A number typed into an entry cell.')
  const entryLabelish = label
    .describe('A label typed into an entry cell: plain lowercase letters, numbers and single underscores.')
  const entryTitleish = titleish.min(1)
    .describe('One line typed into an entry cell, as a title is.')

  // Each field is named once, bare, and given a default in the widget and none in its row.
  const scope = oneof(WidgetScopeVals)
    .describe('Who the widget belongs to. `pub` is the library every hunt sees, and the only scope there is so far. Fixed once made.')
  const widgetLabel = label
    .describe('What the widget is called, unique within its scope. Widgetings and files name it by this, so it is fixed once made.')
  const title = titleish
    .describe('What the widget is called on screen; a blank one reads as its label, titleized.')
  const description = noteish
    .describe('What the widget works out, for the author choosing one.')
  const input_formula = formulaish
    .describe('A JSONata expression that culls the bag to what the widget reads. An input that comes to nothing means "do not run".')
  const jsonataFormula = formulaish
    .describe('A JSONata formula, worked out over the widget\'s input for every question. Kept exactly as typed, newlines and all.')
  const aibotFormula = textish.min(1)
    .describe('A prompt template, each `{{name}}` in it filled in from that key of the widget\'s input. Kept exactly as typed.')

  const jsonataFields = { formulary: lit('jsonata'), formula: jsonataFormula, config: jsonataConfig }
  const aibotFields = { formulary: lit('aibot'), formula: aibotFormula, config: aibotConfig }
  const entryFields = {
    formulary:     lit('entry'),
    formula:       lit('')
      .describe('Nothing: an entry\'s value is typed, not worked out.'),
    input_formula: lit('')
      .describe('Nothing: an entry reads nothing.'),
    config:        entryConfig,
  }

  const jsonataWidget = obj({
    scope:         scope.default('pub'),
    label:         widgetLabel,
    title:         title.default(''),
    description:   description.default(''),
    ...jsonataFields,
    input_formula: input_formula.default(JsonataDefaultInput),
    config:        jsonataConfig.default({}),
  })
    .describe('A widget worked out by a JSONata formula on every render, and stored nowhere.')
  const aibotWidget = obj({
    scope:         scope.default('pub'),
    label:         widgetLabel,
    title:         title.default(''),
    description:   description.default(''),
    ...aibotFields,
    input_formula: input_formula.default(AibotDefaultInput),
  })
    .describe('A widget that puts a prompt to a model, asked from the cell, and keeps every answer.')
  const entryWidget = obj({
    scope:         scope.default('pub'),
    label:         widgetLabel,
    title:         title.default(''),
    description:   description.default(''),
    ...entryFields,
    formula:       entryFields.formula.default(''),
    input_formula: entryFields.input_formula.default(''),
  })
    .describe('A widget whose cells a person types into, one value per question, kept as the one value.')

  const widget = discrim('formulary', [jsonataWidget, aibotWidget, entryWidget])
    .describe('A reusable definition in the library: a formulary, a formula, an input formula and a config, under a label. It knows nothing of any quiz; a widgeting puts it to work in one.')

  const widgetPatch = obj({
    title:         title.optional(),
    description:   description.optional(),
    formula:       textish.min(1).optional()
      .describe('The formula or the prompt; held to the bound of the widget\'s own formulary once applied.'),
    input_formula: input_formula.optional(),
    config:        union([jsonataConfig, aibotConfig, entryConfig]).optional()
      .describe('The settings; held to the shape of the widget\'s own formulary once applied.'),
  })
    .describe('The fields of one widget being revised. A key absent means "leave whatever is already there". The scope, the label and the formulary are not among them: other things refer to a widget by the first two, and its config\'s shape hangs on the third.')

  const rowFields = {
    scope,
    label:         widgetLabel,
    title,
    description,
    input_formula,
    position:      uint
      .describe('The widget\'s place in the order the library lists them, counting from zero.'),
  }
  const row = discrim('formulary', [obj({ ...rowFields, ...jsonataFields }), obj({ ...rowFields, ...aibotFields }), obj({ ...rowFields, ...entryFields })])
    .describe('One widget as the database holds it: its fields, and its place in the library.')

  const library = obj({ widgets: widget.array().max(PA.WidgetsInLibrary.max) })
    .describe('The library, as it is exported and imported on its own: every widget, in library order, without its place.')

  return { jsonataConfig, aibotConfig, entryConfig, entryText, entryNumber, entryLabelish, entryTitleish, widgetLabel, widget, widgetPatch, row, library }
})

export type JsonataConfigT = Z.output<typeof WidgetValidators.jsonataConfig>
export type AibotConfigT   = Z.output<typeof WidgetValidators.aibotConfig>
export type EntryConfigT   = Z.output<typeof WidgetValidators.entryConfig>
export type WidgetDNA      = Z.input<typeof WidgetValidators.widget>
/**
 * A reusable definition in the library: a formulary, a formula, an input formula and a config,
 * under a label. It knows nothing of any quiz; a widgeting puts it to work in one.
 */
export type WidgetT        = Z.output<typeof WidgetValidators.widget>
/** A widget of the library worked by a JSONata formula */
export type JsonataWidgetT = Extract<WidgetT, { formulary: 'jsonata' }>
/** A widget of the library that puts a prompt to a model */
export type AibotWidgetT   = Extract<WidgetT, { formulary: 'aibot' }>
/** A widget of the library whose cells a person types into */
export type EntryWidgetT   = Extract<WidgetT, { formulary: 'entry' }>
/** What an `entry` widget's cell holds: text or a number */
export type EntryValueT    = string | number

/** The validator of what each kind of `entry` widget's cell holds */
export const EntryValueFor: Readonly<Record<EntryKind, Z.ZodType<EntryValueT>>> = {
  text:     WidgetValidators.entryText,
  number:   WidgetValidators.entryNumber,
  labelish: WidgetValidators.entryLabelish,
  titleish: WidgetValidators.entryTitleish,
}
export type WidgetPatch    = Z.output<typeof WidgetValidators.widgetPatch>
export type WidgetRowT     = Z.output<typeof WidgetValidators.row>
export type LibraryDNA     = Z.input<typeof WidgetValidators.library>
export type LibraryT       = Z.output<typeof WidgetValidators.library>

/** A reusable definition in the library */
// A class of statics, as a model is, with no instance fields to declare: a widget is a union.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class, unicorn/no-static-only-class
export class Widget {
  /**
   * Validated widget, with its scope, title, description and input formula defaulted, a
   * `jsonata` widget's config too, and an entry's empty formula.
   *
   * @param dna - At least a label and a formulary; a formula, but for an entry; and an `aibot` or `entry` widget's config.
   * @returns A complete widget, of the formulary `dna` names.
   *
   * @example Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' }).input_formula  // => '$'
   */
  static fill<DT extends WidgetDNA>(dna: DT): Extract<WidgetT, { formulary: DT['formulary'] }> {
    // The union is discriminated by `formulary`, so the arm it parses to is the one `dna` names.
    return WidgetValidators.widget(dna) as Extract<WidgetT, { formulary: DT['formulary'] }>
  }

  /**
   * What names a widget outside the database: its scope and its label.
   *
   * @example Widget.keyOf({ scope: 'pub', label: 'dumdum' })  // => 'pub/dumdum'
   */
  static keyOf(widget: Pick<WidgetT, 'scope' | 'label'>): string {
    return `${widget.scope}/${widget.label}`
  }

  /**
   * A widget's title as the screen shows it: a blank one reads as its label, titleized.
   *
   * @example Widget.titleOf({ label: 'clueing_full', title: '' })  // => 'Clueing Full'
   */
  static titleOf(widget: Pick<WidgetT, 'label' | 'title'>): string {
    return widget.title === '' ? Labelmaker.titleize(widget.label) : widget.title
  }

  /**
   * A widget as the library exports it: its fields, without its place.
   *
   * @example Widget.exported(row).label  // => 'dumdum'
   */
  static exported(widget: WidgetT | WidgetRowT): WidgetT {
    const { scope, label, title, description, input_formula } = widget
    const shared = { scope, label, title, description, input_formula }
    switch (widget.formulary) {
    case 'jsonata': { return { ...shared, formulary: 'jsonata', formula: widget.formula, config: widget.config } }
    case 'aibot':   { return { ...shared, formulary: 'aibot', formula: widget.formula, config: widget.config } }
    case 'entry':   { return { ...shared, formulary: 'entry', formula: '', input_formula: '', config: widget.config } }
    }
  }

  /**
   * What is fixed about a widget once it is made, said in words: its formulary, and an entry's
   * kind, which the values typed hang on. A widget may be revised, or merged by an import, only
   * into one that says the same.
   *
   * @example Widget.flavorOf({ formulary: 'entry', config: { entry_kind: 'number' } })  // => 'a number entry'
   * @example Widget.flavorOf({ formulary: 'aibot', config: aibotConfig })               // => 'an aibot widget'
   */
  static flavorOf(widget: Pick<WidgetT, 'formulary' | 'config'>): string {
    if ('entry_kind' in widget.config) { return `a ${EntryKindNames[widget.config.entry_kind]} entry` }
    return widget.formulary === 'aibot' ? 'an aibot widget' : `a ${widget.formulary} widget`
  }
}

/** How each kind of entry is named in a sentence */
const EntryKindNames: Readonly<Record<EntryKind, string>> = { text: 'text', number: 'number', labelish: 'label', titleish: 'title' }
