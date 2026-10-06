import type * as Z from 'zod'
import { mintId } from './ids'
import * as Jsonball from './jsonball'
import * as Labelmaker from './labelmaker'
import * as UU from './useful'
import { ClearedValueFor, ImportValidators, ImportableFieldnames, type ImportPatchT, type ImportedQuestionT } from '../models/import'
import type { HuntActionDNA } from '../models/actions'
import { ColumnValidators, widgetingLabelOf, type ColumnPatch, type ColumnT } from '../models/column'
import { QuizValidators, type QuizT, type Sortkey } from '../models/quiz'
import { EntryFormulary } from './formulary/entry'
import { Widget, WidgetValidators, type EntryValueT, type EntryWidgetT, type WidgetT } from '../models/widget'
import { WidgetingValidators, type WidgetingT } from '../models/widgeting'

/** One thing wrong with one incoming question */
export type ImportIssue = {
  fieldpath: string
  message:   string
  code:      string
}

/** What became of one incoming question */
export type ImportLogEntry = {
  /** 1-based position in the pasted list, so the author can find it again */
  position:     number
  /** The question's label, or '' where the paste named none and the question was skipped */
  label:        string
  outcome:      'merged' | 'added' | 'skipped'
  issues:       ImportIssue[]
}

/** What became of one incoming widgeting */
export type WidgetingLogEntry = {
  /** Its label, or '' where the paste named none */
  label:   string
  outcome: 'added' | 'revised' | 'kept' | 'skipped'
  /** Why it was skipped; null otherwise */
  reason:  string | null
}

/** What became of one incoming column */
export type ColumnLogEntry = {
  /** Its label, or '' where the paste named none */
  label:   string
  outcome: 'added' | 'revised' | 'kept' | 'removed' | 'skipped'
  /** Why it was skipped; null otherwise */
  reason:  string | null
}

/** One of the quiz's own fields an import may carry */
export type CarriedFieldname = 'title' | Jsonball.PastedFieldname

/** What became of one of the quiz's own fields the paste held */
export type FieldLogEntry = {
  fieldname: CarriedFieldname
  /** Carried onto the quiz; already as the paste has it; or not read */
  outcome:   'carried' | 'kept' | 'skipped'
  /** Why it was skipped, or for the sort memory why it is kept only by a quiz with no questions; null otherwise */
  reason:    string | null
}

export type ImportOutcome = {
  /** True when everything validated; false when anything was skipped or nothing could be read */
  ok:            boolean
  /** The one-line result shown next to the button */
  summary:       string
  /** A line per question, and a nested line per validation issue */
  log:           ImportLogEntry[]
  /** What to send, one entry per label; null when nothing could be read and the box should keep its text */
  questions:     ImportedQuestionT[] | null
  /** A line per incoming widgeting */
  widgetingLog:  WidgetingLogEntry[]
  /** What to send for the widgetings: one add or revision per widgeting that changes */
  widgetingActions: HuntActionDNA[]
  /** A line per incoming column, and one per column of the quiz the paste removes */
  columnLog:     ColumnLogEntry[]
  /** What to send for the columns, once the widgetings they show are there: what makes the quiz's columns the paste's */
  columnActions: HuntActionDNA[]
  /** A line per field of the quiz's own the paste held */
  fieldLog:      FieldLogEntry[]
  /** What to send for the quiz's own fields: one per field that changes */
  fieldActions:  HuntActionDNA[]
  /** Everything to send, in order: the quiz's fields, its widgetings, its columns, then its questions (`import_questions`); empty when nothing could be read */
  actions:       HuntActionDNA[]
}

/**
 * `pasted` read against `quiz`, as the questions to send.
 *
 * The paste may be any jsonball or merge of them (Raw Export, a quiz's ball, its questions alone),
 * any shape an older export had, or a bare list of questions (`Jsonball.quizzesIn`); holding
 * several quizzes, the one matching this quiz is read. Questions and widgetings keyed by label are
 * read in order of their `position`.
 *
 * Questions are matched to existing ones **by label**: the one name that survives both the
 * author rewriting a question's title and a round trip through another tool. An export made while
 * a label could be overridden carries the override as `forced_label`; where it is set, it is the
 * label matched on, as it was the one the question answered to.
 *
 * Nothing is ever deleted by an import. A label no question here holds becomes a new question
 * appended to the quiz under that label; so does a question with no label at all, under a fresh
 * one. A question that fails validation is skipped entirely rather than half-merged, and named
 * in the log. The server folds the result in (`import_questions`) and renumbers Q# by rank.
 *
 * Widgetings merge by label too: one the quiz lacks is added when the library holds its widget,
 * and skipped and logged when it does not; one it holds has its description and params revised,
 * unless it works another widget, when it is skipped. None is removed, since its cells hold what
 * was asked and typed, and the quiz's run order stands, those added coming last in the order
 * pasted. What a widgeting came to is not carried -- a worked-out value is worked out again, and
 * an asked one is recorded by asking -- except an entry's, which a person typed: under an entry
 * widgeting's label, a value (bare, or as the export writes it, `{ status: 'ok', value }`) is
 * typed into the question's cell, and nothing (null, or `{ status: 'missing' }`) empties it, as a
 * question's own fields merge. A value not of the entry's kind fails its question, as a field would.
 *
 * Columns hold nothing but how the grid is laid out, so a paste that holds any makes the quiz's
 * columns its own (`columnsMerged`): each is added, or revised to the paste's title, source, width
 * and alignment, in the paste's order, and a column the paste lacks is removed, unless some pasted
 * column could not be read. One showing a widgeting the quiz will not have is skipped. A paste
 * holding no columns (the questions alone, a bare list, an export from before columns were
 * exported) leaves them as they are.
 *
 * The quiz's own fields merge as a question's do: its title, smith's note and Q1 preamble each
 * replace the quiz's when the paste holds one (a null note clears it), and stay when it does not.
 * Its sort memory is kept only by a quiz that held no questions, whose order is then the paste's.
 * Its lock is not read: an import never locks or unlocks a quiz.
 *
 * @param quiz - The quiz on screen.
 * @param pasted - Whatever is in the Import box.
 * @param library - The library's widgets, which a pasted widgeting must name.
 * @returns The questions and widgeting actions to send, a one-line summary, and a line per pasted question and widgeting.
 *
 * @example importInto(quiz, '[{"label":"quiet_otter","clueing":"Which region?"}]', library)
 */
export function importInto(quiz: QuizT, pasted: string, library: readonly WidgetT[]): ImportOutcome {
  const nothing = { log: [], questions: null, widgetingLog: [], widgetingActions: [], columnLog: [], columnActions: [], fieldLog: [], fieldActions: [], actions: [] }
  const payload = readPayload(pasted, quiz)
  if (! payload.ok) { return { ok: false, summary: payload.summary, ...nothing } }

  const incoming = payload.quiz.questions
  if (incoming.length === 0) {
    return { ok: false, summary: `${payload.reading} It holds no questions, so nothing was changed.`, ...nothing }
  }

  const held = new Set(quiz.questions.map((question) => question.label))
  const widgetings = widgetingsMerged(quiz, payload.quiz.widgetings, library)
  const merge: MergeState = { patches: new Map(), entered: new Map(), log: [] }
  const entries = entryWidgetingsOf(quiz, payload.quiz.widgetings, widgetings.actions, library)
  for (const [ii, raw] of incoming.entries()) { readOneQuestion(merge, held, entries, raw, ii + 1) }

  const columns = columnsMerged(quiz, payload.quiz.columns, showableAfter(quiz, widgetings.actions))
  const fields = fieldsCarried(quiz, payload.quiz)
  const questions = chainsResolved(merge, held)
  const remembered = fields.last_sortkey === undefined ? {} : { last_sortkey: fields.last_sortkey }

  const tallied = (outcome: ImportLogEntry['outcome']) => merge.log.filter((entry) => entry.outcome === outcome).length
  const skipped = tallied('skipped')
  const anySkipped = [...widgetings.log, ...columns.log, ...fields.log].some((entry) => entry.outcome === 'skipped')

  return {
    ok:               skipped === 0 && ! anySkipped,
    summary:          `${payload.reading} ${String(tallied('merged'))} merged, ${String(tallied('added'))} added, ${String(skipped)} skipped${widgetingSummary(widgetings.log)}${columnSummary(columns.log)}${fieldSummary(fields.log)} — see log below. Renumbered Q# by rank.`,
    log:              merge.log,
    questions,
    widgetingLog:     widgetings.log,
    widgetingActions: widgetings.actions,
    columnLog:        columns.log,
    columnActions:    columns.actions,
    fieldLog:         fields.log,
    fieldActions:     fields.actions,
    actions:          [...fields.actions, ...widgetings.actions, ...columns.actions, { kind: 'import_questions', questions, ...remembered }],
  }
}

/** The columns' share of the summary, or nothing when the paste carried none */
function columnSummary(log: readonly ColumnLogEntry[]): string {
  if (log.length === 0) { return '' }
  const tallied = (outcome: ColumnLogEntry['outcome']) => log.filter((entry) => entry.outcome === outcome).length
  return `; columns ${String(tallied('added'))} added, ${String(tallied('revised'))} revised, ${String(tallied('removed'))} removed, ${String(tallied('skipped'))} skipped`
}

/** What the summary says of the quiz's own fields: those carried, and those skipped; nothing when none changes */
function fieldSummary(log: readonly FieldLogEntry[]): string {
  const named = (outcome: FieldLogEntry['outcome']) => log.filter((entry) => entry.outcome === outcome).map((entry) => FieldTitles[entry.fieldname])
  const [carried, skipped] = [named('carried'), named('skipped')]
  return [carried.length > 0 ? `; carried its ${carried.join(', ')}` : '', skipped.length > 0 ? `; skipped its ${skipped.join(', ')}` : ''].join('')
}

/** What the log and summary call each of the quiz's own fields */
const FieldTitles: Readonly<Record<CarriedFieldname, string>> = {
  title:        'title',
  smiths_note:  'smith\'s note',
  q1_preamble:  'Q1 preamble',
  last_sortkey: 'sort memory',
}

/**
 * The quiz's own fields as the paste holds them, against the quiz's: an action for each that
 * changes, and a line for each the paste held. The sort memory is handed back to go with the
 * questions (`import_questions`), which keep it only in a quiz that held none.
 */
function fieldsCarried(quiz: QuizT, pasted: Jsonball.PastedQuizT): { actions: HuntActionDNA[], log: FieldLogEntry[], last_sortkey?: Sortkey | null } {
  const actions: HuntActionDNA[] = []
  const log: FieldLogEntry[] = []
  const carry = (fieldname: CarriedFieldname, read: { success: true, data: string } | { success: false } | null, held: string, action: (val: string) => HuntActionDNA) => {
    if (read === null) { return }
    if (! read.success) { log.push({ fieldname, outcome: 'skipped', reason: `not a ${FieldTitles[fieldname]} this tool can read` }); return }
    if (read.data === held) { log.push({ fieldname, outcome: 'kept', reason: null }); return }
    actions.push(action(read.data))
    log.push({ fieldname, outcome: 'carried', reason: null })
  }
  const noteOf = (fieldname: 'smiths_note' | 'q1_preamble') => {
    if (! Object.hasOwn(pasted.fields, fieldname)) { return null }
    const raw = pasted.fields[fieldname]
    return QuizValidators[fieldname].safeParse(raw === null ? '' : raw)
  }
  carry('title', pasted.title === null ? null : { success: true, data: pasted.title }, quiz.title, (title) => ({ kind: 'retitle_quiz', title }))
  carry('smiths_note', noteOf('smiths_note'), quiz.smiths_note, (smiths_note) => ({ kind: 'set_smiths_note', smiths_note }))
  carry('q1_preamble', noteOf('q1_preamble'), quiz.q1_preamble, (q1_preamble) => ({ kind: 'set_q1_preamble', q1_preamble }))
  if (! Object.hasOwn(pasted.fields, 'last_sortkey')) { return { actions, log } }
  const sortkey = QuizValidators.sortkey.nullable().safeParse(pasted.fields.last_sortkey)
  if (! sortkey.success) {
    log.push({ fieldname: 'last_sortkey', outcome: 'skipped', reason: 'not a sort memory this tool can read' })
    return { actions, log }
  }
  if (quiz.questions.length > 0) {
    log.push({ fieldname: 'last_sortkey', outcome: 'kept', reason: 'a quiz that holds questions keeps its own order, and so its own sort memory' })
    return { actions, log }
  }
  log.push({ fieldname: 'last_sortkey', outcome: sortkey.data === quiz.last_sortkey ? 'kept' : 'carried', reason: null })
  return { actions, log, last_sortkey: sortkey.data }
}

/** The labels of the widgetings the quiz will hold once `actions` are sent: those it holds, and those added */
function showableAfter(quiz: QuizT, actions: readonly HuntActionDNA[]): ReadonlySet<string> {
  const added = actions.flatMap((action) => (action.kind === 'add_widgeting' ? [action.widgeting.label] : []))
  return new Set([...quiz.widgetings.map((widgeting) => widgeting.label), ...added])
}

/**
 * The pasted columns made the quiz's, by label: the actions to send, in order, and a line for each.
 * Each pasted column is put at its place in the paste, added or revised (a column whose alignment
 * the paste leaves unset, where the quiz's sets one, is taken off and put back, since nothing else
 * unsets one); and a column of the quiz the paste lacks is removed, but only when every pasted
 * column could be read. Nothing is sent for a paste holding no columns.
 */
function columnsMerged(quiz: QuizT, pasted: readonly unknown[] | null, showable: ReadonlySet<string>): { actions: HuntActionDNA[], log: ColumnLogEntry[] } {
  if (pasted === null) { return { actions: [], log: [] } }
  const { read, log } = columnsRead(pasted, showable)
  const wanted = new Set(read.map((column) => column.label))
  const removing = log.length === 0 ? quiz.columns.filter((column) => ! wanted.has(column.label)) : []
  const actions: HuntActionDNA[] = removing.map(({ label }) => ({ kind: 'delete_column', label }))
  log.push(...removing.map(({ label }): ColumnLogEntry => ({ label, outcome: 'removed', reason: null })))
  const heldFor = new Map(quiz.columns.map((column) => [column.label, column]))
  // The quiz's columns by label, in order, as each action sent so far leaves them.
  const removed = new Set(removing.map((column) => column.label))
  const layout = quiz.columns.map((column) => column.label).filter((label) => ! removed.has(label))
  for (const [idx, column] of read.entries()) {
    const placed = columnPlaced(heldFor.get(column.label), column, layout, idx)
    actions.push(...placed.actions)
    log.push({ label: column.label, outcome: placed.outcome, reason: null })
  }
  return { actions, log }
}

/**
 * The pasted columns that will do, in order, and a line for each that will not: one that does not
 * read, repeats a label, or shows a widgeting the quiz will not have.
 */
function columnsRead(pasted: readonly unknown[], showable: ReadonlySet<string>): { read: ColumnT[], log: ColumnLogEntry[] } {
  const read: ColumnT[] = []
  const log: ColumnLogEntry[] = []
  for (const raw of pasted) {
    const parsed = ColumnValidators.column.safeParse(raw)
    if (! parsed.success) {
      const shownLabel = typeof (raw as { label?: unknown } | null)?.label === 'string' ? (raw as { label: string }).label : ''
      log.push({ label: shownLabel, outcome: 'skipped', reason: parsed.error.issues[0]?.message ?? 'not a column this tool can read' })
      continue
    }
    const column = parsed.data
    const shown = widgetingLabelOf(column.source)
    if (read.some((other) => other.label === column.label)) {
      log.push({ label: column.label, outcome: 'skipped', reason: 'another pasted column has its label' })
    } else if (shown !== null && ! showable.has(shown)) {
      log.push({ label: column.label, outcome: 'skipped', reason: `it shows "${shown}", a widgeting this quiz will not have` })
    } else {
      read.push(column)
    }
  }
  return { read, log }
}

/** The actions that put `column` at `idx` of `layout`, which they leave as the quiz will stand: added, revised and moved, or kept */
function columnPlaced(held: ColumnT | undefined, column: ColumnT, layout: string[], idx: number): { actions: HuntActionDNA[], outcome: ColumnLogEntry['outcome'] } {
  const { label } = column
  if (! held || (held.align !== undefined && column.align === undefined)) {
    placeIn(layout, label, idx)
    const readd: HuntActionDNA[] = held ? [{ kind: 'delete_column', label }] : []
    return { actions: [...readd, { kind: 'add_column', column, onto_idx: idx }], outcome: held ? 'revised' : 'added' }
  }
  const patch = columnPatchOf(held, column)
  const actions: HuntActionDNA[] = patch === null ? [] : [{ kind: 'edit_column', label, patch }]
  if (layout.indexOf(label) !== idx) {
    placeIn(layout, label, idx)
    actions.push({ kind: 'move_column', label, onto_idx: idx })
  }
  return { actions, outcome: actions.length === 0 ? 'kept' : 'revised' }
}

/** `layout` with `label` taken from wherever it is, if anywhere, and put at `idx` */
function placeIn(layout: string[], label: string, idx: number): void {
  const at = layout.indexOf(label)
  if (at !== -1) { layout.splice(at, 1) }
  layout.splice(idx, 0, label)
}

/** What revises `held` into `pasted`, field by field; null when nothing differs */
function columnPatchOf(held: ColumnT, pasted: ColumnT): ColumnPatch | null {
  const fieldnames = ['title', 'source', 'width_px', 'align'] as const
  const changed = fieldnames.filter((fieldname) => pasted[fieldname] !== undefined && pasted[fieldname] !== held[fieldname])
  if (changed.length === 0) { return null }
  return ColumnValidators.columnPatch(Object.fromEntries(changed.map((fieldname) => [fieldname, pasted[fieldname]])))
}

/** The widgetings' share of the summary, or nothing when the paste carried none */
function widgetingSummary(log: readonly WidgetingLogEntry[]): string {
  if (log.length === 0) { return '' }
  const tallied = (outcome: WidgetingLogEntry['outcome']) => log.filter((entry) => entry.outcome === outcome).length
  return `; widgetings ${String(tallied('added'))} added, ${String(tallied('revised'))} revised, ${String(tallied('skipped'))} skipped`
}

/**
 * The pasted widgetings merged into the quiz's by label: the actions to send, and a line for each.
 * Only what changes is sent.
 */
function widgetingsMerged(quiz: QuizT, pasted: readonly unknown[], library: readonly WidgetT[]): { actions: HuntActionDNA[], log: WidgetingLogEntry[] } {
  const inLibrary = new Set(library.map((widget) => widget.label))
  const heldFor = new Map(quiz.widgetings.map((widgeting) => [widgeting.label, widgeting]))
  const merged = pasted.map((raw): { action: HuntActionDNA | null, entry: WidgetingLogEntry } => {
    const parsed = WidgetingValidators.widgeting.safeParse(raw)
    const shownLabel = typeof (raw as { label?: unknown } | null)?.label === 'string' ? (raw as { label: string }).label : ''
    if (! parsed.success) { return skippedAs(shownLabel, parsed.error.issues[0]?.message ?? 'not a widgeting this tool can read') }
    const widgeting = parsed.data
    const held = heldFor.get(widgeting.label)
    if (held) { return revisedFrom(held, widgeting) }
    if (! inLibrary.has(widgeting.widget_label)) { return skippedAs(widgeting.label, `the library holds no widget called "${widgeting.widget_label}"`) }
    return { action: { kind: 'add_widgeting', widgeting }, entry: { label: widgeting.label, outcome: 'added', reason: null } }
  })
  return { actions: merged.flatMap(({ action }) => (action ? [action] : [])), log: merged.map(({ entry }) => entry) }
}

/** A pasted widgeting the quiz already holds, as the revision of its description and params it comes to */
function revisedFrom(held: WidgetingT, pasted: WidgetingT): { action: HuntActionDNA | null, entry: WidgetingLogEntry } {
  const { label } = held
  if (held.widget_label !== pasted.widget_label) { return skippedAs(label, `it works "${pasted.widget_label}" here, and "${held.widget_label}" in this quiz`) }
  if (held.description === pasted.description && UU.jsonify(held.params) === UU.jsonify(pasted.params)) {
    return { action: null, entry: { label, outcome: 'kept', reason: null } }
  }
  return { action: { kind: 'edit_widgeting', label, patch: { description: pasted.description, params: pasted.params } }, entry: { label, outcome: 'revised', reason: null } }
}

/** A widgeting skipped, and why */
function skippedAs(label: string, reason: string): { action: null, entry: WidgetingLogEntry } {
  return { action: null, entry: { label, outcome: 'skipped', reason } }
}

/** What the read is building up as it walks the pasted questions */
type MergeState = {
  /** What each label's question comes to, in the order the labels were first met */
  patches: Map<string, ImportPatchT>
  /** What each label's question has typed into its entry cells, by the entry widgeting's label */
  entered: Map<string, Record<string, EntryValueT | null>>
  log:     ImportLogEntry[]
}

/**
 * The entry widgetings the quiz will hold once the import's widgeting actions are sent, by label,
 * each with the library's widget it works: those it holds, and those the import adds. One the paste
 * says works another widget is left out: what its cells hold came from that widget, not this entry.
 */
function entryWidgetingsOf(quiz: QuizT, pasted: readonly unknown[], actions: readonly HuntActionDNA[], library: readonly WidgetT[]): ReadonlyMap<string, EntryWidgetT> {
  const added = actions.flatMap((action) => (action.kind === 'add_widgeting' ? [action.widgeting] : []))
  const pastedWorking = new Map(pasted.flatMap((raw) => {
    const parsed = WidgetingValidators.widgeting.safeParse(raw)
    return parsed.success ? [[parsed.data.label, parsed.data.widget_label] as const] : []
  }))
  const widgetFor = new Map(library.map((widget) => [widget.label, widget]))
  return new Map([...quiz.widgetings, ...added].flatMap(({ label, widget_label }) => {
    const widget = widgetFor.get(widget_label)
    const elsewhere = pastedWorking.get(label)
    if (elsewhere !== undefined && elsewhere !== widget_label) { return [] }
    return widget?.formulary === 'entry' ? [[label, widget] as const] : []
  }))
}

/** What a pasted question types into its entry cells, read off the raw object: what each label carries, and what of it will not do */
function enteredFrom(bag: Record<string, unknown>, entries: ReadonlyMap<string, EntryWidgetT>): { entered: Record<string, EntryValueT | null>, issues: ImportIssue[] } {
  const entered: Record<string, EntryValueT | null> = {}
  const issues: ImportIssue[] = []
  for (const [label, widget] of entries) {
    if (! Object.hasOwn(bag, label)) { continue }
    const pasted = pastedEntryOf(bag[label])
    if (! pasted.ok) { issues.push({ fieldpath: label, message: pasted.message, code: 'entry_unreadable' }); continue }
    if (pasted.value === null) { entered[label] = null; continue }
    const checked = EntryFormulary.valueOf(widget).safeParse(pasted.value)
    if (checked.success) {
      entered[label] = checked.data
    } else {
      issues.push(...issuesOf(checked.error).map((issue) => ({ ...issue, fieldpath: label })))
    }
  }
  return { entered, issues }
}

/**
 * One pasted entry cell, unwrapped: a value as the export writes it (`{ status: 'ok', value }`)
 * or bare; nothing for null, an empty text, or `{ status: 'missing' }`; and anything else is not
 * something a person could have typed.
 */
function pastedEntryOf(raw: unknown): { ok: true, value: unknown } | { ok: false, message: string } {
  const value = typeof raw === 'object' && raw !== null && ! Array.isArray(raw) && 'status' in raw ? unwrapped(raw) : { ok: true as const, value: raw }
  if (! value.ok) { return value }
  return { ok: true, value: value.value === '' ? null : value.value }
}

/** An exported widgeted's value, or why it is not one an entry could hold */
function unwrapped(exported: { status?: unknown, value?: unknown }): { ok: true, value: unknown } | { ok: false, message: string } {
  if (exported.status === 'ok') { return { ok: true, value: exported.value ?? null } }
  if (exported.status === 'missing') { return { ok: true, value: null } }
  return { ok: false, message: `An entry is typed, so it cannot be "${String(exported.status)}"` }
}

/**
 * One incoming question read: its patch folded onto the label it names, or a fresh label when
 * it names none.
 *
 * A question that fails validation is skipped *entirely* rather than half-merged, and named in
 * the log by position and label. One bad question never blocks the rest of the import.
 */
function readOneQuestion(merge: MergeState, held: ReadonlySet<string>, entries: ReadonlyMap<string, EntryWidgetT>, raw: unknown, position: number) {
  const bag = (raw ?? {}) as Record<string, unknown>
  const parsed = ImportValidators.importQuestion.safeParse(raw)
  const typed = enteredFrom(bag, entries)

  if (! parsed.success || typed.issues.length > 0) {
    const shownLabel = typeof bag.label === 'string' ? bag.label : ''
    merge.log.push({ position, label: shownLabel, outcome: 'skipped', issues: [...(parsed.success ? [] : issuesOf(parsed.error)), ...typed.issues] })
    return
  }

  const label = parsed.data.forced_label ?? parsed.data.label ?? Labelmaker.localBlankLabel(new Set([...held, ...merge.patches.keys()]), mintId())
  const outcome = held.has(label) || merge.patches.has(label) ? 'merged' : 'added'
  merge.patches.set(label, { ...merge.patches.get(label), ...patchFrom(bag, parsed.data) })
  merge.entered.set(label, { ...merge.entered.get(label), ...typed.entered })
  merge.log.push({ position, label, outcome, issues: [] })
}

type PayloadReading =
  | { ok: true, quiz: Jsonball.PastedQuizT, reading: string }
  | { ok: false, summary: string }

/**
 * The pasted text read as whichever shape it is (`Jsonball.quizzesIn`): a bare list of questions,
 * one quiz, or quizzes by realm, from any ball, any merge of them, or any older export.
 *
 * Given several quizzes, it takes the one matching the open quiz by label, failing that by name,
 * failing that the first one -- and says which reading it took, so the author is never guessing.
 */
function readPayload(pasted: string, openQuiz: QuizT): PayloadReading {
  let raw: unknown
  try {
    raw = JSON.parse(pasted)
  } catch {
    return { ok: false, summary: "That isn't readable as JSON, so nothing was changed. Your text is still here." }
  }

  const read = Jsonball.quizzesIn(raw)
  if (read === null) { return { ok: false, summary: "That isn't a shape this tool recognises, so nothing was changed. Your text is still here." } }
  if (read.shape === 'none') { return { ok: false, summary: 'That holds no quiz and no questions, so nothing was changed. Your text is still here.' } }
  if (read.shape !== 'hunt') {
    const [quiz = EmptyQuiz] = read.quizzes
    return { ok: true, quiz, reading: `Read as ${read.shape === 'list' ? 'a bare list' : 'one quiz'} of ${String(quiz.questions.length)} question(s).` }
  }
  const chosen = quizFromExport(read.quizzes, openQuiz)
  if (! chosen) { return { ok: false, summary: 'That holds no quizzes, so nothing was changed.' } }
  return {
    ok:      true,
    quiz:    chosen,
    reading: `Read as a hunt of ${String(read.quizzes.length)} quiz(zes); ${howChosen(chosen, openQuiz)}, with ${String(chosen.questions.length)} question(s).`,
  }
}

/** A paste's quiz when it holds none */
const EmptyQuiz: Jsonball.PastedQuizT = { label: null, title: null, fields: {}, questions: [], widgetings: [], columns: null }

/** How the quiz was picked out of a pasted export, for the log */
function howChosen(chosen: Jsonball.PastedQuizT, openQuiz: QuizT): string {
  if (chosen.label === openQuiz.label) { return 'matched this quiz by label' }
  return (chosen.title ?? '') === openQuiz.title ? 'matched this quiz by name' : 'took the first quiz'
}

/** An export's quiz chosen against the one on screen: by label, then by name, failing both the first */
function quizFromExport(quizzes: readonly Jsonball.PastedQuizT[], openQuiz: QuizT): Jsonball.PastedQuizT | undefined {
  const { label } = openQuiz
  return quizzes.find((quiz) => quiz.label === label)
    ?? quizzes.find((quiz) => (quiz.title ?? '') === openQuiz.title)
    ?? quizzes[0]
}

/**
 * What one incoming question changes, read off the *raw* object rather than the validated one.
 *
 * `.default()` fires only when a value is `undefined`, and an explicit `null` passes straight
 * through a nullable field untouched -- so the absent-vs-null distinction the import depends on
 * cannot be expressed with schema defaults. The schema's job here is to validate and scrub; the
 * merge rules are the merge's own.
 */
function patchFrom(bag: Record<string, unknown>, clean: Record<string, unknown>): ImportPatchT {
  const patch: Record<string, unknown> = {}
  for (const fieldname of ImportableFieldnames) {
    if (! Object.hasOwn(bag, fieldname)) { continue }
    patch[fieldname] = bag[fieldname] === null ? ClearedValueFor[fieldname] : clean[fieldname]
  }
  return ImportValidators.importPatch(patch)
}

/**
 * The questions to send, each chain checked: a pasted chain names its target by label, which
 * must be the label of a question here or of one the same import adds. A chain to
 * anything else, or to the question itself, is left unset and logged.
 */
function chainsResolved(merge: MergeState, held: ReadonlySet<string>): ImportedQuestionT[] {
  const known = new Set([...held, ...merge.patches.keys()])
  return [...merge.patches].map(([label, patch]) => {
    const entered = merge.entered.get(label) ?? {}
    const target = patch.chains_to
    if (target === undefined || target === null || (target !== label && known.has(target))) { return { label, patch, entered } }
    noteChainLoss(merge.log, label)
    return { label, patch: { ...patch, chains_to: null }, entered }
  })
}

/** Records an unresolvable chain against the question that carried it */
function noteChainLoss(log: ImportLogEntry[], label: string) {
  const entry = log.find((each) => each.label === label)
  entry?.issues.push({
    fieldpath: 'chains_to',
    message:   'Chain target could not be resolved to a question in this quiz; left unset',
    code:      'chain_unresolved',
  })
}

/** Every validation issue, with the field path, what was wrong, and the code */
function issuesOf(err: Z.ZodError): ImportIssue[] {
  return err.issues.map((issue) => ({
    fieldpath: issue.path.join('.') || '(whole question)',
    message:   issue.message,
    code:      issue.code,
  }))
}

/** What became of one incoming widget of a library import */
export type LibraryLogEntry = {
  /** Its label, or '' where the paste named none */
  label:   string
  outcome: 'added' | 'revised' | 'kept' | 'skipped'
  /** Why it was skipped; null otherwise */
  reason:  string | null
}

export type LibraryImportOutcome = {
  /** True when every widget could be read and none was skipped */
  ok:      boolean
  /** The one-line result shown next to the button */
  summary: string
  /** A line per pasted widget */
  log:     LibraryLogEntry[]
  /** The widgets to send (`import_widgets`): those added or revised; null when nothing could be read */
  widgets: WidgetT[] | null
}

/**
 * `pasted` read as a library export, against the library as it stands: merged by label.
 *
 * A widget the library lacks is added; one it holds is revised (title, description, formula,
 * input formula, config); one whose formulary differs from the one held (or an entry whose kind
 * does) is skipped and logged rather than half-merged, as is one that does not validate. Nothing
 * is removed.
 *
 * @param library - The library as it stands.
 * @param pasted - Whatever is in the library's Import box: the library's export, any ball holding widgets, an older library export, or a bare list of widgets (`Jsonball.widgetsIn`).
 * @returns The widgets to send, a one-line summary, and a line per pasted widget.
 *
 * @example libraryImported(library, '{"widgets":{"pub":{"shout":{"formulary":"jsonata","formula":"$uppercase(qn.title)"}}}}').log[0]?.outcome  // => 'added'
 */
export function libraryImported(library: readonly WidgetT[], pasted: string): LibraryImportOutcome {
  let raw: unknown
  try {
    raw = JSON.parse(pasted)
  } catch {
    return { ok: false, summary: "That isn't readable as JSON, so nothing was changed. Your text is still here.", log: [], widgets: null }
  }
  const listed = Jsonball.widgetsIn(raw)
  if (listed === null) { return { ok: false, summary: 'That holds no widgets, so nothing was changed. Your text is still here.', log: [], widgets: null } }

  const heldFor = new Map(library.map((widget) => [widget.label, widget]))
  const read = listed.map((each): { widget: WidgetT | null, entry: LibraryLogEntry } => {
    const parsed = WidgetValidators.widget.safeParse(each)
    const shownLabel = typeof (each as { label?: unknown } | null)?.label === 'string' ? (each as { label: string }).label : ''
    if (! parsed.success) { return { widget: null, entry: { label: shownLabel, outcome: 'skipped', reason: parsed.error.issues[0]?.message ?? 'not a widget this tool can read' } } }
    const widget = parsed.data
    const held = heldFor.get(widget.label)
    if (! held) { return { widget, entry: { label: widget.label, outcome: 'added', reason: null } } }
    if (Widget.flavorOf(held) !== Widget.flavorOf(widget)) { return { widget: null, entry: { label: widget.label, outcome: 'skipped', reason: `it is ${Widget.flavorOf(widget)} here, and ${Widget.flavorOf(held)} in the library` } } }
    if (UU.jsonify(Widget.exported(held)) === UU.jsonify(Widget.exported(widget))) { return { widget: null, entry: { label: widget.label, outcome: 'kept', reason: null } } }
    return { widget, entry: { label: widget.label, outcome: 'revised', reason: null } }
  })
  const log = read.map(({ entry }) => entry)
  const tallied = (outcome: LibraryLogEntry['outcome']) => log.filter((entry) => entry.outcome === outcome).length
  return {
    ok:      tallied('skipped') === 0,
    summary: `Read ${String(listed.length)} widget(s): ${String(tallied('added'))} added, ${String(tallied('revised'))} revised, ${String(tallied('kept'))} unchanged, ${String(tallied('skipped'))} skipped.`,
    log,
    widgets: read.flatMap(({ widget }) => (widget ? [widget] : [])),
  }
}
