import * as Runner from './formulary/runner'
import * as Templating from './templating'
import { JsonataFormulary } from './formulary/jsonata'
import { ColumnAlignVals, plainOf, refOf, sortkeyOf, type BagWord, type ColumnAlign, type ColumnReadout, type ColumnT, type QuestionField, type QuestionKey, type QuestionView } from '../models/column'
import { Widgeted, type JsonT, type WidgetedT } from '../models/widgeted'
import type { WidgetingT } from '../models/widgeting'
import type { WidgetT } from '../models/widget'
import { formularyFor } from './formulary/formularies'
import type { Sortkey } from '../models/quiz'
import { widgetingShownNotice } from './notices'

/** How a column's header is drawn: along the row, or rotated into it */
export type Headkind = 'plain' | 'vertical'

/**
 * What a column shows, found: the question's own field, a view of it, a key it has in the bag, a
 * word at the bag's top level, or the widgeting it names, run for each question or for the whole
 * quiz.
 */
export type Resolved =
  | { kind: 'field', field: QuestionField }
  | { kind: 'view', view: QuestionView }
  | { kind: 'key', key: QuestionKey }
  | { kind: 'word', word: BagWord }
  | { kind: 'widgeting', widgeting: WidgetingT }

/** One column as the grid draws it */
export type ColumnSpec = {
  /** The quiz's label for the column, which is also its key in the grid */
  colkey:   string
  title:    string
  /** What the column is called in an export's header row */
  header:   string
  /** What it shows */
  source:   Resolved
  /** What it works out of what it shows, in JSONata; null for identity, the thing itself */
  formula:  string | null
  /** The Liquid making text of what the formula came to; null to draw the value as it is */
  template: string | null
  /** How it draws its text, as the column says; null leaves it to the default (`readoutOf`) */
  readout:  ColumnReadout | null
  /** Folded to its turned header, its cells empty: drawn `CollapsedWidthPx` wide, its own width kept for the return */
  collapsed: boolean
  /** How wide it is drawn: its own width, or `CollapsedWidthPx` while collapsed */
  widthPx:  number
  headkind: Headkind
  /**
   * Where the header and every cell set their text; null leaves each to its own: a header along
   * the row to the left and a turned one to the right, a number to the right and text to the left
   */
  align:    ColumnAlign | null
  /** Present when the header can be clicked to commit the quiz to this column's order */
  sortkey?: Sortkey
}

/** A column as far as what it draws: its ref found, its formula and its template */
type StagedSpec = Pick<ColumnSpec, 'source' | 'formula' | 'template'>

/** The gutter holding a row's grip, or its checkbox and trash can, belongs to the grid rather than to the quiz, and is always first */
export const GutterWidthPx = 40

/** How wide a collapsed column is drawn: its turned header's line of text, and the header's padding either side. A state, not a width, so below `WidthPxMin`. */
export const CollapsedWidthPx = 20

/**
 * What `source` shows, given the widgetings a quiz has: found on the question first, then at the
 * bag's top level. Read in the plain grammar or the one before October 2026 (`refOf`), in which a
 * quiz holds a widgeting called `categories` that the word must not hide.
 *
 * @param source - A column's source.
 * @param widgetings - The quiz's widgetings.
 * @returns The thing shown, or null when it names a widgeting the quiz does not have at the tier named.
 *
 * @example resolve('clueing', [])                       // => { kind: 'field', field: 'clueing' }
 * @example resolve('quiz.playtesters', [playtesters])   // => { kind: 'widgeting', widgeting: playtesters }
 * @example resolve('categories', [])                    // => { kind: 'word', word: 'categories' }
 */
export function resolve(source: string, widgetings: readonly WidgetingT[]): Resolved | null {
  const ref = refOf(source)
  const widgetingAt = (label: string, tier: string) => widgetings.find((each) => each.tier === tier && each.label === label)
  switch (ref.kind) {
  case 'field':
  case 'view':
  case 'key': {
    return ref
  }
  case 'word': {
    const widgeting = widgetingAt(ref.word, 'question')
    return widgeting ? { kind: 'widgeting', widgeting } : ref
  }
  case 'widgeting': {
    const widgeting = widgetingAt(ref.label, ref.tier)
    return widgeting ? { kind: 'widgeting', widgeting } : null
  }
  }
}

/**
 * The columns of a quiz that show the widgeting labelled `label`, whole or a part of it: each
 * found through `resolve`, so a column counts in whichever grammar its source is written.
 *
 * @param quiz - The quiz's columns and widgetings.
 * @param label - The widgeting's label.
 * @returns Those columns, in the quiz's order; none when no column shows it.
 *
 * @example columnsShowing(quiz, 'cats').map((column) => column.label)  // => ['cats', 'cats_masie']
 */
export function columnsShowing<CT extends Pick<ColumnT, 'source'>>(quiz: { columns: readonly CT[], widgetings: readonly WidgetingT[] }, label: string): CT[] {
  return quiz.columns.filter((column) => {
    const shown = resolve(column.source, quiz.widgetings)
    return shown?.kind === 'widgeting' && shown.widgeting.label === label
  })
}

/**
 * Why the widgeting labelled `label` cannot be removed from a quiz, or null when it can: a
 * widgeting goes only once no column shows it (`columnsShowing`). The server refuses with the
 * same sentence the widgeting editor shows in place of its remove button.
 *
 * @param quiz - The quiz's columns and widgetings.
 * @param label - The widgeting's label.
 * @returns The sentence naming the columns that hold it back, or null.
 *
 * @example widgetingRemovalRefusal(quiz, 'hint_full')  // => 'The column “Hint Full Sum” still shows that widgeting — remove the column first.'
 */
export function widgetingRemovalRefusal(quiz: { columns: readonly Pick<ColumnT, 'label' | 'title' | 'source'>[], widgetings: readonly WidgetingT[] }, label: string): string | null {
  const showing = columnsShowing(quiz, label)
  return showing.length === 0 ? null : widgetingShownNotice(showing.map((column) => column.title || column.label))
}

/** Whether ordering the quiz by this can mean something: a value each question has */
function sortable(source: Resolved, formula: string | null): boolean {
  if (source.kind === 'word') { return false }
  if (formula !== null) { return true }
  if (source.kind === 'field') { return ['title', 'chains_to', 'qnum'].includes(source.field) }
  return source.kind !== 'view'
}

/** How a column's header is drawn: a narrow widgeting's, or a collapsed column's, rotated into it, everything else along the row */
function headkindOf(source: Pick<Resolved, 'kind'>, widthPx: number, collapsed = false): Headkind {
  return collapsed || (source.kind === 'widgeting' && widthPx <= 100) ? 'vertical' : 'plain'
}

/** Whether `column` shows the question's Q# as it is */
function isQnum(column: Pick<ColumnT, 'source' | 'formula'>): boolean {
  const plain = plainOf(column)
  const ref = refOf(plain.source)
  return ref.kind === 'field' && ref.field === 'qnum' && plain.formula === undefined
}

/**
 * Where a column sets its header and its cells: where it says, or Q# centered; null for any other
 * column that says nothing, whose header and cells each set themselves.
 *
 * @example alignOf({ ...column, align: 'right' })      // => 'right'
 * @example alignOf({ ...column, source: 'qnum' })      // => 'center'
 * @example alignOf({ ...column, source: 'title' })     // => null
 */
export function alignOf(column: Pick<ColumnT, 'source' | 'formula' | 'align'>): ColumnAlign | null {
  return column.align ?? (isQnum(column) ? 'center' : null)
}

/**
 * Where a column's header sits: where the column says, Q# centered, a turned header to the right
 * over the numbers below it, any other to the left. It is what the column editor shows.
 *
 * @example headAlignOf({ label: 'qnum', title: 'Q#', source: 'qnum', width_px: 60 })              // => 'center'
 * @example headAlignOf({ label: 'clueing_sum', title: 'Sum', source: 'dumdum', width_px: 78 })    // => 'right'
 * @example headAlignOf({ label: 'notes', title: 'Notes', source: 'notes', width_px: 220 })         // => 'left'
 */
export function headAlignOf(column: ColumnT): ColumnAlign {
  return alignOf(column) ?? (headkindOf(refOf(column.source), column.width_px) === 'vertical' ? 'right' : 'left')
}

/**
 * The alignment a click on a column's moves it to: left, then center, then right, then left again.
 *
 * @example alignAfter('left')   // => 'center'
 * @example alignAfter('right')  // => 'left'
 */
export function alignAfter(align: ColumnAlign): ColumnAlign {
  return ColumnAlignVals[(ColumnAlignVals.indexOf(align) + 1) % ColumnAlignVals.length] ?? 'left'
}

/**
 * A column as the grid draws it, its source and formula read in the plain grammar (`plainOf`).
 *
 * @param column - One of the quiz's columns.
 * @param widgetings - The quiz's widgetings, which the column may show.
 * @returns The spec, or null when the column shows a widgeting the quiz does not have.
 */
export function specFor(column: ColumnT, widgetings: readonly WidgetingT[]): ColumnSpec | null {
  const plain = plainOf(column)
  const source = resolve(plain.source, widgetings)
  if (! source) { return null }
  const formula = plain.formula ?? null
  const collapsed = column.collapsed ?? false
  return {
    colkey:    column.label,
    title:     column.title,
    header:    column.label,
    source,
    formula,
    template:  column.template ?? null,
    readout:   column.readout ?? null,
    collapsed,
    widthPx:   collapsed ? CollapsedWidthPx : column.width_px,
    headkind:  headkindOf(source, column.width_px, collapsed),
    align:     alignOf(column),
    ...(sortable(source, formula) && { sortkey: sortkeyOf(column) }),
  }
}

/**
 * Whether a column's cells are typed into, as an entry's or a question's field's are: only while
 * it works nothing out of what it shows and makes no text of it, the formula absent (identity) and
 * no template. A rounded number has no inverse to type into. Whether the thing shown takes typing
 * at all is the cell's own to say.
 *
 * @example isTypedInto({ formula: null, template: null })            // => true
 * @example isTypedInto({ formula: '$round($.value)', template: null })  // => false
 * @example isTypedInto({ formula: null, template: '{{ value }}%' })  // => false
 */
export function isTypedInto(spec: Pick<ColumnSpec, 'formula' | 'template'>): boolean {
  return spec.formula === null && spec.template === null
}

/**
 * Whether a column's cells are drawn by their own editor, whatever readout the column names: a
 * question's field, an entry's cell or a bot's asked from the cell, while the column is typed into
 * (`isTypedInto`). Every other cell is a readout, drawn as `readoutOf` says.
 *
 * @param spec - The column.
 * @param widget - The widget of the widgeting it shows, when it shows one the library has.
 * @returns True for a cell its editor draws.
 *
 * @example isDrawnByEditor({ source: { kind: 'field', field: 'clueing' }, formula: null, template: null }, null)  // => true
 * @example isDrawnByEditor({ source: { kind: 'field', field: 'clueing' }, formula: '$uppercase($)', template: null }, null)  // => false
 * @example isDrawnByEditor({ source: { kind: 'widgeting', widgeting: total }, formula: null, template: null }, clueingFull)  // => false   (a formula's)
 */
export function isDrawnByEditor(spec: StagedSpec, widget: WidgetT | null): boolean {
  if (! isTypedInto(spec)) { return false }
  const { source } = spec
  if (source.kind === 'field') { return true }
  if (widget === null || source.kind !== 'widgeting' || source.widgeting.tier !== 'question') { return false }
  return widget.formulary === 'entry' || formularyFor(widget).refresh === 'click'
}

/**
 * How a column draws its text: as it says, or, saying nothing, `markdown` for a column with a
 * template or showing a `liquidize` widgeting, whose text is markdown by convention; null for any
 * other, which its cells draw as they choose (a field in its box, a value as a worked-out cell
 * shows one).
 *
 * @param spec - The column.
 * @param widget - The widget of the widgeting it shows, when it shows one the library has.
 * @returns The readout.
 *
 * @example readoutOf({ readout: 'code', template: '{{ value }}' })              // => 'code'
 * @example readoutOf({ readout: null, template: '{{ value }}' })                // => 'markdown'
 * @example readoutOf({ readout: null, template: null }, { formulary: 'liquidize' })  // => 'markdown'
 * @example readoutOf({ readout: null, template: null })                         // => null
 */
export function readoutOf(spec: Pick<ColumnSpec, 'readout' | 'template'>, widget: Pick<WidgetT, 'formulary'> | null = null): ColumnReadout | null {
  if (spec.readout !== null) { return spec.readout }
  return spec.template !== null || widget?.formulary === 'liquidize' ? 'markdown' : null
}

/**
 * Every column of a quiz's grid, left to right, as the grid draws them.
 *
 * @param quiz - The quiz's columns and widgetings.
 * @returns One spec per column that shows something.
 *
 * @example specsFor(quiz).map((spec) => spec.title)
 */
export function specsFor(quiz: { columns: readonly ColumnT[], widgetings: readonly WidgetingT[] }): ColumnSpec[] {
  return quiz.columns.flatMap((column) => {
    const spec = specFor(column, quiz.widgetings)
    return spec ? [spec] : []
  })
}

/**
 * How wide the grid insists on being, so the container scrolls rather than the page.
 *
 * @param specs - The grid's columns, not counting the gutter.
 */
export function gridWidthPx(specs: readonly ColumnSpec[]): number {
  return specs.reduce((acc, spec) => acc + spec.widthPx, GutterWidthPx)
}

/**
 * The sort memory of the quiz's Q# column: what the quiz remembers when it is in Q# order.
 *
 * @param quiz - The quiz's columns.
 * @returns The sortkey, or null when the quiz shows no Q# column.
 */
export function qnumSortkeyOf(quiz: { columns: readonly ColumnT[] }): Sortkey | null {
  const column = quiz.columns.find((each) => isQnum(each))
  return column ? sortkeyOf(column) : null
}

/** What `workedOf` made, by the run, then by the column's ref and formula and the quiz's templateable sources */
const WorkedOf = new WeakMap<Runner.QuizRun, Map<string, ReadonlyMap<string, WidgetedT>>>()

/**
 * What a column shows for one question, as a widgeted, before it is drawn. With no formula
 * (identity): a widgeting's widgeted as the run has it, and a question's field, key or view, or a
 * word of the bag, as the bag holds it, `ok`. With one, what the formula worked out of the thing
 * the ref picks (`workedOf`).
 *
 * @param spec - The column.
 * @param run - The quiz, run.
 * @param templateable - What the quiz nominates as templateable, which the finished bag holds filled in.
 * @param question_id - The question.
 * @returns What it came to.
 *
 * @example shownOf({ source: categoryData, formula: '$.masie' }, run, [], question._id)  // => { status: 'ok', value: 0.525, err: null }
 */
export function shownOf(spec: Pick<ColumnSpec, 'source' | 'formula'>, run: Runner.QuizRun, templateable: readonly string[], question_id: string): WidgetedT {
  if (spec.formula !== null) { return workedOf(spec.source, spec.formula, run, templateable).get(question_id) ?? Widgeted.missing }
  const { source } = spec
  if (source.kind === 'widgeting') {
    const { label, tier } = source.widgeting
    return tier === 'quiz' ? Runner.quizWidgetedOf(run, label) : Runner.widgetedOf(run, label, question_id)
  }
  return Widgeted.ok(thingOf(source, run.qnsAfter, run, run.frame.question_ids.indexOf(question_id)) as JsonT)
}

/** What a column draws for one question, before the readout draws it */
export type DrawnT = {
  /** What the column came to (`shownOf`): one not `ok` draws as the dash or the badge, with no text */
  widgeted: WidgetedT
  /** The text drawn: the column's template filled in over what it came to, or that value's own text; empty for one not `ok` */
  text:     string
  /** Why the template could not be filled in, `text` then the template as typed; null when nothing is wrong */
  issue:    string | null
}

/** What `textedOf` made of one column, by the question, and the time its template has left for the rest */
type TextedColumn = { byQuestion: Map<string, DrawnT>, budget: Templating.ColumnBudgetT }

/** What `textedOf` made, by the run, then by the column's stages and the quiz's templateable sources */
const TextedOf = new WeakMap<Runner.QuizRun, Map<string, TextedColumn>>()

/**
 * What a column draws for one question: what it came to (`shownOf`), and the text of it, its
 * template filled in (Liquid, through `Templating.fill`, over the question's template bag with what
 * the formula came to as `value`) or the value's own text. A template, like a formula, works only
 * on an `ok` value: `missing` and `errored` pass by, so the dash and the badge still show. The
 * template has `Templating.ColumnMs` for the whole column, spent cell by cell as each is asked
 * for; once a limit stops it, every later cell says the same, its template as typed. Drawn as
 * markdown (`readoutOf`), what a formula or a bot came to has its images made links
 * (`Templating.imagesLinkedIn`): only text a person typed draws an image.
 *
 * @param spec - The column.
 * @param run - The quiz, run.
 * @param templateable - What the quiz nominates as templateable, which the template's bag holds filled in.
 * @param question_id - The question.
 * @returns What it came to, and its text.
 *
 * @example drawnOf({ source: categoryData, formula: '$round($.masie * 100)', template: '{{ value }}%', readout: null }, run, [], question._id).text  // => '53%'
 */
export function drawnOf(spec: Pick<ColumnSpec, 'source' | 'formula' | 'template' | 'readout'>, run: Runner.QuizRun, templateable: readonly string[], question_id: string): DrawnT {
  const linked = readoutOf(spec, shownWidgetOf(spec.source, run)) === 'markdown' && ! isTyped(spec.source, run)
  return textedOf(spec, run, templateable, question_id, linked)
}

/**
 * What a column carries into a spreadsheet for one question: its template filled in, as the grid
 * draws it, its images left as they are, since nothing draws them; empty for a value not `ok`.
 *
 * @example templatedTextOf({ source: categoryData, formula: '$round($.masie * 100)', template: '{{ value }}%' }, run, [], question._id)  // => '53%'
 */
export function templatedTextOf(spec: StagedSpec, run: Runner.QuizRun, templateable: readonly string[], question_id: string): string {
  return textedOf(spec, run, templateable, question_id, false).text
}

/** What a column draws for one question (`drawnOf`), its value's images made links or not, made once per run, its template's time the column's */
function textedOf(spec: StagedSpec, run: Runner.QuizRun, templateable: readonly string[], question_id: string, linked: boolean): DrawnT {
  const known = TextedOf.get(run) ?? new Map<string, TextedColumn>()
  TextedOf.set(run, known)
  const key = [keyOf(spec.source), spec.formula ?? '', spec.template ?? '', String(linked), ...templateable].join('\n')
  const column = known.get(key) ?? { byQuestion: new Map<string, DrawnT>(), budget: Templating.columnBudget() }
  known.set(key, column)
  const held = column.byQuestion.get(question_id)
  if (held !== undefined) { return held }
  const widgeted = shownOf(spec, run, templateable, question_id)
  const drawn = textOfShown(spec.template, widgeted, run, templateable, question_id, linked, column.budget)
  column.byQuestion.set(question_id, drawn)
  return drawn
}

/** The text of what a column came to, through its template when it has one, filled out of the column's budget */
function textOfShown(template: string | null, widgeted: WidgetedT, run: Runner.QuizRun, templateable: readonly string[], question_id: string, linked: boolean, budget: Templating.ColumnBudgetT): DrawnT {
  if (widgeted.status !== 'ok') { return { widgeted, text: '', issue: null } }
  const value = linked ? Templating.imagesLinkedIn(widgeted.value) as JsonT : widgeted.value
  if (template === null) { return { widgeted, text: Widgeted.textOf({ ...widgeted, value }), issue: null } }
  const filled = Templating.fillWithin(template, Templating.valuedBagOf(run, templateable, question_id, value), budget)
  return { widgeted, text: filled.markdown, issue: filled.issue }
}

/** The widget of the widgeting `source` shows, when it shows one the run has a widget for */
function shownWidgetOf(source: Resolved, run: Runner.QuizRun): WidgetT | null {
  return source.kind === 'widgeting' ? Runner.stepOf(run, source.widgeting.label)?.widget ?? null : null
}

/**
 * Whether the thing `source` picks is text a person typed: a question's own field, view or key,
 * or an entry's widgeted. What a formula or a bot came to is not, nor a word of the bag, which
 * holds what every widgeting came to.
 */
function isTyped(source: Resolved, run: Runner.QuizRun): boolean {
  if (source.kind === 'word') { return false }
  if (source.kind !== 'widgeting') { return true }
  const widget = shownWidgetOf(source, run)
  return widget !== null && ! Templating.computes(widget)
}

/**
 * What `formula` works out of what `source` picks for every question of the run, by the
 * question's id, made once per run. The thing is read from the finished bag: the questions as
 * the last widgeting left them, their templateable sources filled in (`Templating.finishedQnsOf`).
 * A widgeted is worked on only when `ok` (or carrying parts worked out from nothing, `isWorkable`):
 * `missing` and `errored` pass through, so the dash and the badge still show. What the formula comes to reads as a `jsonata` widgeted does
 * (`JsonataFormulary.worked`); a formula that will not stop is stopped once, and every later
 * question reads the same failure rather than waiting on it again.
 */
function workedOf(source: Resolved, formula: string, run: Runner.QuizRun, templateable: readonly string[]): ReadonlyMap<string, WidgetedT> {
  const known = WorkedOf.get(run) ?? new Map<string, ReadonlyMap<string, WidgetedT>>()
  WorkedOf.set(run, known)
  const key = [keyOf(source), formula, ...templateable].join('\n')
  const held = known.get(key)
  if (held !== undefined) { return held }
  const qns = Templating.finishedQnsOf(run, templateable)
  const worked = new Map<string, WidgetedT>()
  let stopped: WidgetedT | null = null
  for (const [idx, question_id] of run.frame.question_ids.entries()) {
    const thing = thingOf(source, qns, run, idx)
    if (source.kind === 'widgeting' && ! isWorkable(thing)) {
      worked.set(question_id, passedThrough(thing))
    } else if (stopped === null) {
      const outcome = JsonataFormulary.worked(formula, thing)
      if (outcome.stops) { stopped = outcome.widgeted }
      worked.set(question_id, outcome.widgeted)
    } else {
      worked.set(question_id, stopped)
    }
  }
  known.set(key, worked)
  return worked
}

/** What the thing `source` names is known by in `WorkedOf` */
function keyOf(source: Resolved): string {
  switch (source.kind) {
  case 'field':     { return `field:${source.field}` }
  case 'view':      { return `view:${source.view}` }
  case 'key':       { return `key:${source.key}` }
  case 'word':      { return `word:${source.word}` }
  case 'widgeting': { return `${source.widgeting.tier}:${source.widgeting.label}` }
  }
}

/**
 * The thing `source` picks for the question at `idx` of `qns`, as the bag holds it: a field or key
 * of the question, the hint of the question it chains to for the view `butnot`, a widgeting's
 * whole widgeted (a category-estimate entry's parts beside its status and value), or a word at the
 * bag's top level, `qns` being every question.
 */
function thingOf(source: Resolved, qns: readonly Record<string, unknown>[], run: Runner.QuizRun, idx: number): unknown {
  const qn = qns[idx] ?? {}
  switch (source.kind) {
  case 'field': { return qn[source.field] ?? null }
  case 'key':   { return qn[source.key] ?? null }
  case 'view': {
    const target = qn.chains_to === null ? undefined : qns.find((each) => each.label === qn.chains_to)
    return target?.hint ?? ''
  }
  case 'widgeting': {
    const { label, tier } = source.widgeting
    return (tier === 'quiz' ? run.frame.quiz[label] : qn[label]) ?? Widgeted.missing
  }
  case 'word': {
    return source.word === 'qns' ? qns : run.frame[source.word]
  }
  }
}

/** What a widgeted holds of its own, beside which the bag may carry its parts */
const WidgetedKeys: ReadonlySet<string> = new Set(['status', 'value', 'err'])

/**
 * Whether a formula works on `thing`, a widgeted as the bag holds one: when it is `ok`; or when it
 * is `missing` but carries parts beside it, worked out from nothing typed (a category-estimate
 * entry's, whose empty cell reads as one estimate of no category in particular). An `errored` one,
 * or a `missing` one with nothing beside it, passes by.
 */
function isWorkable(thing: unknown): boolean {
  const { status } = (thing ?? {}) as Partial<WidgetedT>
  if (status === 'ok') { return true }
  return status === 'missing' && Object.keys(thing as object).some((key) => ! WidgetedKeys.has(key))
}

/** A widgeted that is not `ok`, as it passes a formula by: its status, value and failure, without what rides beside them */
function passedThrough(thing: unknown): WidgetedT {
  const { status = 'missing', value = null, err = null } = (thing ?? {}) as Partial<WidgetedT>
  return { status, value, err } as WidgetedT
}
