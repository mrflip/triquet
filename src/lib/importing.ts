import type * as Z from 'zod'
import { mintId } from './ids'
import * as Labelmaker from './labelmaker'
import * as UU from './useful'
import { ClearedValueFor, ImportValidators, ImportableFieldnames, type ImportPatchT, type ImportQuizT, type ImportedQuestionT } from '../models/import'
import type { HuntActionDNA } from '../models/actions'
import type { QuizT } from '../models/quiz'
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
  /** What to send for the widgetings, before the questions: one add or revision per widgeting that changes */
  widgetingActions: HuntActionDNA[]
}

/**
 * `pasted` read against `quiz`, as the questions to send.
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
 * unless it works another widget, when it is skipped. None is removed. What a widgeting came to
 * is not carried -- a worked-out value is worked out again, and an asked one is recorded by
 * asking -- except an entry's, which a person typed: under an entry widgeting's label, a value
 * (bare, or as the export writes it, `{ status: 'ok', value }`) is typed into the question's cell,
 * and nothing (null, or `{ status: 'missing' }`) empties it, as a question's own fields merge. A
 * value not of the entry's kind fails its question, as a field would.
 *
 * @param quiz - The quiz on screen.
 * @param pasted - Whatever is in the Import box.
 * @param library - The library's widgets, which a pasted widgeting must name.
 * @returns The questions and widgeting actions to send, a one-line summary, and a line per pasted question and widgeting.
 *
 * @example importInto(quiz, '[{"label":"quiet_otter","clueing":"Which region?"}]', library)
 */
export function importInto(quiz: QuizT, pasted: string, library: readonly WidgetT[]): ImportOutcome {
  const nothing = { log: [], questions: null, widgetingLog: [], widgetingActions: [] }
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

  const tallied = (outcome: ImportLogEntry['outcome']) => merge.log.filter((entry) => entry.outcome === outcome).length
  const skipped = tallied('skipped')
  const widgetingsSkipped = widgetings.log.filter((entry) => entry.outcome === 'skipped').length

  return {
    ok:               skipped === 0 && widgetingsSkipped === 0,
    summary:          `${payload.reading} ${String(tallied('merged'))} merged, ${String(tallied('added'))} added, ${String(skipped)} skipped${widgetingSummary(widgetings.log)} — see log below. Renumbered Q# by rank.`,
    log:              merge.log,
    questions:        chainsResolved(merge, held),
    widgetingLog:     widgetings.log,
    widgetingActions: widgetings.actions,
  }
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
  | { ok: true, quiz: ImportQuizT, reading: string }
  | { ok: false, summary: string }

/**
 * The pasted text read as whichever of the three accepted shapes it is.
 *
 * Given a whole hunt, it takes the quiz matching the open one by label, failing that by name,
 * failing that the first one -- and says which reading it took, so the author is never guessing.
 */
function readPayload(pasted: string, openQuiz: QuizT): PayloadReading {
  let raw: unknown
  try {
    raw = JSON.parse(pasted)
  } catch {
    return { ok: false, summary: "That isn't readable as JSON, so nothing was changed. Your text is still here." }
  }

  const hunt = ImportValidators.importHunt.safeParse(raw)
  if (hunt.success) {
    const quizzes = hunt.data.realms.flatMap((realm) => realm.quizzes)
    const chosen = quizFromExport(quizzes, openQuiz)
    if (! chosen) { return { ok: false, summary: 'That hunt holds no quizzes, so nothing was changed.' } }
    return {
      ok:      true,
      quiz:    chosen,
      reading: `Read as a whole hunt of ${String(quizzes.length)} quiz(zes); ${howChosen(chosen, openQuiz)}, with ${String(chosen.questions.length)} question(s).`,
    }
  }

  const quiz = ImportValidators.importQuiz.safeParse(raw)
  if (quiz.success) {
    return { ok: true, quiz: quiz.data, reading: `Read as one quiz of ${String(quiz.data.questions.length)} question(s).` }
  }

  const bare = ImportValidators.importPayload.safeParse(raw)
  if (bare.success && Array.isArray(bare.data)) {
    return { ok: true, quiz: { questions: bare.data, widgetings: [] }, reading: `Read as a bare list of ${String(bare.data.length)} question(s).` }
  }

  return { ok: false, summary: "That isn't a shape this tool recognises, so nothing was changed. Your text is still here." }
}

/** How the quiz was picked out of a pasted export, for the log */
function howChosen(chosen: ImportQuizT, openQuiz: QuizT): string {
  if (labelOfPasted(chosen) === openQuiz.label) { return 'matched this quiz by label' }
  return (chosen.title ?? '') === openQuiz.title ? 'matched this quiz by name' : 'took the first quiz'
}

/** The label a pasted quiz answered to (its `forced_label`, in an export made while one could be set), or null when it carries none */
function labelOfPasted(quiz: ImportQuizT): string | null {
  return quiz.forced_label ?? quiz.label ?? null
}

/**
 * An export's quiz chosen against the one on screen: by label, then by name, failing both the
 * first.
 */
export function quizFromExport(quizzes: readonly ImportQuizT[], openQuiz: QuizT): ImportQuizT | undefined {
  const { label } = openQuiz
  return quizzes.find((quiz) => labelOfPasted(quiz) === label)
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
 * @param pasted - Whatever is in the library's Import box: `{ widgets: [...] }`, or a bare list of widgets.
 * @returns The widgets to send, a one-line summary, and a line per pasted widget.
 *
 * @example libraryImported(library, '{"widgets":[{"label":"shout","formulary":"jsonata","formula":"$uppercase(qn.title)"}]}').log[0]?.outcome  // => 'added'
 */
export function libraryImported(library: readonly WidgetT[], pasted: string): LibraryImportOutcome {
  let raw: unknown
  try {
    raw = JSON.parse(pasted)
  } catch {
    return { ok: false, summary: "That isn't readable as JSON, so nothing was changed. Your text is still here.", log: [], widgets: null }
  }
  const listed = Array.isArray(raw) ? raw : (raw as { widgets?: unknown } | null)?.widgets
  if (! Array.isArray(listed)) { return { ok: false, summary: "That isn't a library export, so nothing was changed. Your text is still here.", log: [], widgets: null } }

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
