import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import * as Regexes from '../lib/regexes'
import { ServicelabelVals } from '../lib/credentials'
import { ModelTierVals } from './ask'
import { ColumnValidators } from './column'
import type { EstimatesT } from './estimate'

/** The formularies a widget of the library can be worked by: a JSONata formula worked out on render, a prompt put to a model, a value a person types, or a Liquid template filled in on render */
export const FormularykindVals = ['jsonata', 'aibot', 'entry', 'liquidize'] as const
export type Formularykind = typeof FormularykindVals[number]

/**
 * What an `entry` widget's cells take (its **kind**): prose, a number, a percent, a yes or no, one
 * of a list of options, a label, a one-line title, or a question's category estimates. Fixed once
 * the widget is made, since the values typed hang on it.
 */
export const EntryKindVals = ['text', 'number', 'percent', 'boolean', 'enum', 'labelish', 'titleish', 'estimates'] as const
export type EntryKind = typeof EntryKindVals[number]

/**
 * The **families** of entry: each a cell editor and the type of value it keeps, constrained by
 * its widgeting's params. A kind is its own family, but for `labelish` and `titleish`, which are
 * presets of `text`, and `percent`, a preset of `number` (`EntryPresets`).
 */
export const EntryFamilyVals = ['text', 'number', 'boolean', 'enum', 'estimates'] as const
export type EntryFamily = typeof EntryFamilyVals[number]

/** The kinds a new entry widget may be made of: one per family, and a percent beside the number; the presets of `text` left to the widgets that already hold them */
export const OfferedEntryKindVals: readonly EntryKind[] = ['text', 'number', 'percent', 'boolean', 'enum', 'estimates']

/** The family each kind of entry belongs to */
export const EntryFamilyOf: Readonly<Record<EntryKind, EntryFamily>> = {
  text:      'text',
  number:    'number',
  percent:   'number',
  boolean:   'boolean',
  enum:      'enum',
  labelish:  'text',
  titleish:  'text',
  estimates: 'estimates',
}

/** The named patterns a `text` entry may hold its cells to: a label, one line of anything, or a web address */
export const TextPatternVals = ['label', 'oneline', 'url'] as const
export type TextPattern = typeof TextPatternVals[number]

/** How many lines a `text` entry's cell takes: one, or as many as are typed */
export const TextLinesVals = ['one', 'many'] as const
export type TextLines = typeof TextLinesVals[number]

/** The most options an `enum` entry may offer */
export const EnumOptionsMax = 40

/** The longest an `enum` entry's option may be: a title's length */
export const EnumOptionMaxLen = 82

/** Who a widget belongs to: `pub`, the library every hunt sees, is the only scope there is so far */
export const WidgetScopeVals = ['pub'] as const
export type WidgetScope = typeof WidgetScopeVals[number]

/** Most room an `aibot` widget may give a model to answer in: twice what the number spotter takes */
export const AibotTokensMax = 8000

/** The input formula a new `jsonata` widget starts with: the whole bag */
export const JsonataDefaultInput = '$'

/** The input formula a new `aibot` widget starts with: the clueing, for a `{{clueing}}` in its prompt */
export const AibotDefaultInput = "{ 'clueing': question.clueing }"

/** The input formula a new `liquidize` widget starts with: the whole bag, so its template reads `question.title` as a formula would */
export const LiquidizeDefaultInput = '$'

export const WidgetValidators = Validator(({ obj, arr, oneof, lit, str, label, titleish, noteish, textish, formulaish, discrim, union, uint, num, bool, stamps }) => {
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
  // What an entry's widgeting may say of its cells, by family: each field optional, so a widget's
  // defaults and a widgeting's own overlay one another key by key (`EntryFormulary.inForce`).
  const numberParams = obj({
    min:     num.optional()
      .describe('The least a cell may hold. Absent, there is no least, and a cell may go below nought.'),
    max:     num.optional()
      .describe('The most a cell may hold. Absent, there is no most.'),
    integer: bool.optional()
      .describe('Whether a cell holds whole numbers only. Absent, a fraction is welcome.'),
  }).strict()
    .describe('What a `number` entry\'s cells may hold: between `min` and `max`, and whole when `integer`.')
  const regex = obj({
    source: str.min(1).max(Regexes.SourceMax).regex(PA.Stringish.re, PA.Stringish.msg)
      .describe(`The pattern, as written between a regular expression's slashes: at most ${String(Regexes.SourceMax)} characters, on one line.`),
    flags:  str.regex(Regexes.FlagsRe, 'should be some of «i», «m», «s» and «u», each once, in that order').default('')
      .describe('Its flags: `i` to ignore case, `m` for `^` and `$` at each line, `s` for `.` across a newline, `u` for Unicode. Absent, none.'),
  }).strict()
    .check((context) => {
      const issue = Regexes.compileIssueOf(context.value)
      if (issue !== null) { context.issues.push({ code: 'custom', path: ['source'], input: context.value.source, message: issue }) }
    })
    .describe('A regular expression of the author\'s own. Where it is written, it is also held to taking no longer to match than a text is long (`Redos`).')
  const textParams = obj({
    max_length: uint.min(1).max(PA.Textish.max).optional()
      .describe(`The most characters a cell may hold. Absent, ${String(PA.Textish.max)}.`),
    pattern:    oneof(TextPatternVals).optional()
      .describe('A named pattern every cell must match: `label` (lowercase letters, digits and single underscores), `oneline` (one line of anything) or `url` (a web address). Any of them is one line. Absent, any prose.'),
    regex:      regex.optional()
      .describe('A regular expression of your own every cell must match, beside any named pattern: its source and flags. One that could take too long to match some text is refused where it is written. Absent, none.'),
    lines:      oneof(TextLinesVals).optional()
      .describe('How many lines a cell takes: `one`, a box that never wraps, or `many`, prose and markdown. Absent, `many`, unless a pattern makes it one.'),
  }).strict()
    .describe('What a `text` entry\'s cells may hold: how long, of what pattern or regular expression, and on how many lines.')
  const enumOption = titleish.min(1).max(EnumOptionMaxLen)
    .describe('One option, a line of text, as the select offers it and the cell keeps it.')
  const enumParams = obj({
    options: arr(enumOption).max(EnumOptionsMax).optional()
      .refine((options) => options === undefined || new Set(options).size === options.length, 'should name each option once')
      .describe(`The options a cell may hold, in the order the select offers them, each once; at most ${String(EnumOptionsMax)}. Absent or empty, a cell may hold nothing.`),
  }).strict()
    .describe('What an `enum` entry\'s cells may hold: one of its options.')
  const noParams = obj({}).strict()
    .describe('Nothing: this kind of entry takes no params.')

  const liquidizeConfig = obj({}).strict()
    .describe('A `liquidize` widget\'s settings: none.')
  const liquidTemplate = textish.min(1)
    .describe('A Liquid template, filled in over what the widget\'s input came to: `{{ question.title }}`, `{% if question.hint %}...{% endif %}`. Kept exactly as typed.')
  const templateFrom = obj({
    ref:     ColumnValidators.ref
      .describe('Where the template\'s text is read from, as a column\'s ref names it: a question\'s field (`notes`), a widgeting run before this one (`dumdum`), a word of the bag, or `quiz.<label>`.'),
    formula: formulaish.optional()
      .describe('JSONata working the template\'s text out of what the ref picks, as a column\'s formula does: `$.value.template` of a bot\'s reply. Absent, the field itself, or the widgeting\'s value. Must come to text.'),
  }).strict()
    .describe('A template read from the bag as the widgeting runs: what a bot or a formula before it wrote, say.')
  // A widgeting's template, said outright or read from the bag; either overrides the widget's own.
  const liquidizeParams = obj({
    template:      liquidTemplate.optional()
      .describe('The template this widgeting fills in, in place of its widget\'s.'),
    template_from: templateFrom.optional(),
  }).strict()
    .refine((params) => params.template === undefined || params.template_from === undefined, { path: ['template_from'], message: 'should be left out beside a template of its own: say one or the other' })
    .describe('Where a `liquidize` widgeting\'s template comes from: its own `template`, or `template_from` the bag. Absent, its widget\'s.')

  // An entry widget's config: its kind, and the defaults its widgetings' params overlay.
  const entryConfigOf = <KT extends EntryKind, ST extends Z.core.$ZodLooseShape>(entry_kind: KT, params: Z.ZodObject<ST>) => (
    obj({ entry_kind: lit(entry_kind), ...params.shape }).strict()
      .check((context) => { for (const issue of entryParamsIssues(entry_kind, context.value)) { context.issues.push({ code: 'custom', ...issue }) } })
  )
  const entryConfig = discrim('entry_kind', [
    entryConfigOf('text', textParams),
    entryConfigOf('number', numberParams),
    entryConfigOf('percent', numberParams),
    entryConfigOf('boolean', noParams),
    entryConfigOf('enum', enumParams),
    entryConfigOf('labelish', noParams),
    entryConfigOf('titleish', noParams),
    entryConfigOf('estimates', noParams),
  ])
    .describe('An `entry` widget\'s settings: what kind of value is typed into its cells (`entry_kind`: `text`, `number`, `percent` (a number from 0 to 100 unless its params say otherwise, shown with `%`), `boolean`, `enum`, `estimates`, or the older `labelish` and `titleish`), fixed once made since the values typed hang on it; and the params its widgetings start from, which each may overlay.')

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

  const liquidizeFormula = liquidTemplate
    .describe('A Liquid template, filled in over what the widget\'s input came to for every question: the default its widgetings may each replace. Kept exactly as typed.')

  const jsonataFields = { formulary: lit('jsonata'), formula: jsonataFormula, config: jsonataConfig }
  const aibotFields = { formulary: lit('aibot'), formula: aibotFormula, config: aibotConfig }
  const liquidizeFields = { formulary: lit('liquidize'), formula: liquidizeFormula, config: liquidizeConfig }
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
  const liquidizeWidget = obj({
    scope:         scope.default('pub'),
    label:         widgetLabel,
    title:         title.default(''),
    description:   description.default(''),
    ...liquidizeFields,
    input_formula: input_formula.default(LiquidizeDefaultInput),
    config:        liquidizeConfig.default({}),
  })
    .describe('A widget that fills in a Liquid template on every render, coming to text, and is stored nowhere.')

  const widget = discrim('formulary', [jsonataWidget, aibotWidget, entryWidget, liquidizeWidget])
    .describe('A reusable definition in the library: a formulary, a formula, an input formula and a config, under a label. It knows nothing of any quiz; a widgeting puts it to work in one.')

  const widgetPatch = obj({
    title:         title.optional(),
    description:   description.optional(),
    formula:       textish.min(1).optional()
      .describe('The formula or the prompt; held to the bound of the widget\'s own formulary once applied.'),
    input_formula: input_formula.optional(),
    config:        union([jsonataConfig, aibotConfig, entryConfig, liquidizeConfig]).optional()
      .describe('The settings; held to the shape of the widget\'s own formulary once applied.'),
  })
    .describe('The fields of one widget being revised. A key absent means "leave whatever is already there". The scope, the label and the formulary are not among them: other things refer to a widget by the first two, and its config\'s shape hangs on the third.')

  const rowFields = {
    scope,
    label:         widgetLabel,
    title,
    description,
    input_formula,
    position:      uint.max(PA.WidgetsInLibrary.max)
      .describe('The widget\'s place in the order the library lists them, counting from zero.'),
    ...stamps,
  }
  const row = discrim('formulary', [obj({ ...rowFields, ...jsonataFields }), obj({ ...rowFields, ...aibotFields }), obj({ ...rowFields, ...entryFields }), obj({ ...rowFields, ...liquidizeFields })])
    .describe('One widget as the database holds it: its fields, and its place in the library.')

  return { jsonataConfig, aibotConfig, entryConfig, liquidizeConfig, regex, numberParams, textParams, enumOption, enumParams, noParams, liquidizeParams, widgetLabel, widget, widgetPatch, row }
})

export type JsonataConfigT = Z.output<typeof WidgetValidators.jsonataConfig>
export type AibotConfigT   = Z.output<typeof WidgetValidators.aibotConfig>
export type EntryConfigT   = Z.output<typeof WidgetValidators.entryConfig>
export type LiquidizeConfigT = Z.output<typeof WidgetValidators.liquidizeConfig>
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
/** A widget of the library that fills in a Liquid template */
export type LiquidizeWidgetT = Extract<WidgetT, { formulary: 'liquidize' }>
/** What an `entry` widget's cell holds: text, a number, a yes or no, or a question's category estimates */
export type EntryValueT    = string | number | boolean | EstimatesT
export type NumberParamsT  = Z.output<typeof WidgetValidators.numberParams>
export type TextParamsT    = Z.output<typeof WidgetValidators.textParams>
export type EnumParamsT    = Z.output<typeof WidgetValidators.enumParams>
/** What a family that takes no params takes */
export type NoParamsT      = Z.output<typeof WidgetValidators.noParams>
/** Where a `liquidize` widgeting's template comes from, when not from its widget */
export type LiquidizeParamsT = Z.output<typeof WidgetValidators.liquidizeParams>

/** Each entry family's params, as its widgeting and its widget's config say them */
export type EntryParamsFor = {
  text:      TextParamsT
  number:    NumberParamsT
  boolean:   NoParamsT
  enum:      EnumParamsT
  estimates: NoParamsT
}

/**
 * The validator of each kind of entry's params: its family's, but for the presets of `text`,
 * which take none of their own. The one source a params editor is drawn from: each key of its
 * shape is one field, and each field's sentence is its own.
 */
export const EntryParamsOf: Readonly<Record<EntryKind, Z.ZodObject>> = {
  text:      WidgetValidators.textParams,
  number:    WidgetValidators.numberParams,
  percent:   WidgetValidators.numberParams,
  boolean:   WidgetValidators.noParams,
  enum:      WidgetValidators.enumParams,
  labelish:  WidgetValidators.noParams,
  titleish:  WidgetValidators.noParams,
  estimates: WidgetValidators.noParams,
}

/** What each preset of `text` holds its cells to, beneath whatever its widget and widgeting say */
export const TextPresets: Readonly<Partial<Record<EntryKind, TextParamsT>>> = {
  labelish: { pattern: 'label', lines: 'one' },
  titleish: { pattern: 'oneline', lines: 'one', max_length: PA.Titleish.max },
}

/** What each preset of `number` holds its cells to, beneath whatever its widget and widgeting say */
export const NumberPresets: Readonly<Partial<Record<EntryKind, NumberParamsT>>> = {
  percent: { min: 0, max: 100 },
}

/** What each preset kind of entry holds its cells to, beneath whatever its widget and widgeting say: a preset of `text` or of `number` */
export const EntryPresets: Readonly<Partial<Record<EntryKind, TextParamsT | NumberParamsT>>> = { ...TextPresets, ...NumberPresets }

/** What a kind of entry shows after the number in its box: a percent's `%` */
export const EntrySuffixes: Readonly<Partial<Record<EntryKind, string>>> = {
  percent: '%',
}

/** Whether an entry of each kind holds one value the quiz as a whole can have: every kind but a question's category estimates */
export const EntryKindOncePerQuiz: Readonly<Record<EntryKind, boolean>> = {
  text:      true,
  number:    true,
  percent:   true,
  boolean:   true,
  enum:      true,
  labelish:  true,
  titleish:  true,
  estimates: false,
}

/** One thing wrong with an entry's params taken together: which of them to say it of, what it holds, and what is wrong */
type ParamsIssue = { path: string[], input: unknown, message: string }

/**
 * What is wrong with an entry's params taken together, rather than one by one: a `number`'s
 * least above its most, or a `text` held to a pattern yet given many lines. Said of the params in
 * force, a widget's defaults overlaid by a widgeting's own, so a widgeting is told when its own
 * fit its widget's no longer.
 *
 * @param entry_kind - The entry's kind, which says which params it takes.
 * @param params - The params in force, or a widget's defaults.
 * @returns Each issue, said of the param the author would change; empty when they agree.
 *
 * @example entryParamsIssues('number', { min: 10, max: 1 })  // => [{ path: ['max'], input: 1, message: 'should be no less than the least, «10»' }]
 */
export function entryParamsIssues(entry_kind: EntryKind, params: Record<string, unknown>): ParamsIssue[] {
  switch (EntryFamilyOf[entry_kind]) {
  case 'number': {
    const { min, max } = params
    return typeof min === 'number' && typeof max === 'number' && min > max ? [{ path: ['max'], input: max, message: `should be no less than the least, «${String(min)}»` }] : []
  }
  case 'text': {
    return params.pattern !== undefined && params.lines === 'many' ? [{ path: ['lines'], input: params.lines, message: 'should be one: a pattern holds a cell to one line' }] : []
  }
  default: { return [] }
  }
}
export type WidgetPatch    = Z.output<typeof WidgetValidators.widgetPatch>
export type WidgetRowT     = Z.output<typeof WidgetValidators.row>

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
   * @example Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)' }).input_formula  // => '$'
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
    case 'liquidize': { return { ...shared, formulary: 'liquidize', formula: widget.formula, config: widget.config } }
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
const EntryKindNames: Readonly<Record<EntryKind, string>> = { text: 'text', number: 'number', percent: 'percent', boolean: 'yes-or-no', enum: 'choice', labelish: 'label', titleish: 'title', estimates: 'category estimate' }
