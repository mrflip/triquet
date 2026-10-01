import type * as Z from 'zod'
import _ from 'es-toolkit/compat'
import { mintId } from './ids'
import * as Labelmaker from './labelmaker'
import { BotSlots, type BotSlot } from '../models/botting'
import { ClearedValueFor, ImportValidators, ImportableFieldnames, type ImportPatchT, type ImportQuizT, type ImportedBottingT, type ImportedQuestionT } from '../models/import'
import type { QuizT } from '../models/quiz'

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
  /** The label in force for the question, or '' where the paste named none and the question was skipped */
  label:        string
  outcome:      'merged' | 'added' | 'skipped'
  issues:       ImportIssue[]
}

export type ImportOutcome = {
  /** True when everything validated; false when anything was skipped or nothing could be read */
  ok:        boolean
  /** The one-line result shown next to the button */
  summary:   string
  /** A line per question, and a nested line per validation issue */
  log:       ImportLogEntry[]
  /** What to send, one entry per label; null when nothing could be read and the box should keep its text */
  questions: ImportedQuestionT[] | null
}

/**
 * `pasted` read against `quiz`, as the questions to send.
 *
 * Questions are matched to existing ones **by label**: the label in force, meaning the forced
 * label where a question has one. A label is the one name that survives both the author
 * rewriting a question's title and a round trip through another tool.
 *
 * Nothing is ever deleted by an import. A label no question here holds becomes a new question
 * appended to the quiz under that label; so does a question with no label at all, under a fresh
 * one. A question that fails validation is skipped entirely rather than half-merged, and named
 * in the log. The server folds the result in (`import_questions`) and renumbers Q# by rank.
 *
 * What the bots replied comes along as each question's cached replies: the server keeps one only
 * for a cell that holds no reply of its own, and it reads as stale, since what it was asked is
 * not carried. A reply that will not read is left out and logged; its question still goes.
 *
 * @param quiz - The quiz on screen.
 * @param pasted - Whatever is in the Import box.
 * @returns The questions to send, a one-line summary, and a line per pasted question.
 *
 * @example importInto(quiz, '[{"label":"quiet_otter","clueing":"Which region?"}]')
 */
export function importInto(quiz: QuizT, pasted: string): ImportOutcome {
  const payload = readPayload(pasted, quiz)
  if (! payload.ok) { return { ok: false, summary: payload.summary, log: [], questions: null } }

  const incoming = payload.quiz.questions
  if (incoming.length === 0) {
    return { ok: false, summary: `${payload.reading} It holds no questions, so nothing was changed.`, log: [], questions: null }
  }

  const held = new Set(quiz.questions.map((question) => Labelmaker.effectiveLabelOf(question)))
  const merge: MergeState = { patches: new Map(), replies: new Map(), log: [] }
  for (const [ii, raw] of incoming.entries()) { readOneQuestion(merge, held, raw, ii + 1) }

  const tallied = (outcome: ImportLogEntry['outcome']) => merge.log.filter((entry) => entry.outcome === outcome).length
  const skipped = tallied('skipped')
  const questions = chainsResolved(merge, held)
  const replyCount = _.sumBy(questions, (question) => question.bottings.length)
  const replied = replyCount === 0 ? '' : ` Carried ${String(replyCount)} bot reply(ies) to cells holding none, marked stale.`

  return {
    ok:        skipped === 0,
    summary:   `${payload.reading} ${String(tallied('merged'))} merged, ${String(tallied('added'))} added, ${String(skipped)} skipped — see log below. Renumbered Q# by rank.${replied}`,
    log:       merge.log,
    questions,
  }
}

/** A question's cached replies, by the field each shows in */
type Replies = Partial<Record<BotSlot['field'], ImportedBottingT>>

/** What the read is building up as it walks the pasted questions */
type MergeState = {
  /** What each label's question comes to, in the order the labels were first met */
  patches: Map<string, ImportPatchT>
  /** What the bots replied to each label's question, the later paste winning cell by cell */
  replies: Map<string, Replies>
  log:     ImportLogEntry[]
}

/**
 * One incoming question read: its patch folded onto the label it names, or a fresh label when
 * it names none.
 *
 * A question that fails validation is skipped *entirely* rather than half-merged, and named in
 * the log by position and label. One bad question never blocks the rest of the import.
 */
function readOneQuestion(merge: MergeState, held: ReadonlySet<string>, raw: unknown, position: number) {
  const bag = (raw ?? {}) as Record<string, unknown>
  const parsed = ImportValidators.importQuestion.safeParse(raw)

  if (! parsed.success) {
    const shownLabel = typeof bag.label === 'string' ? bag.label : ''
    merge.log.push({ position, label: shownLabel, outcome: 'skipped', issues: issuesOf(parsed.error) })
    return
  }

  const label = parsed.data.forced_label ?? parsed.data.label ?? Labelmaker.localBlankLabel(new Set([...held, ...merge.patches.keys()]), mintId())
  const outcome = held.has(label) || merge.patches.has(label) ? 'merged' : 'added'
  const { replies, issues } = repliesFrom(bag)
  merge.patches.set(label, { ...merge.patches.get(label), ...patchFrom(bag, parsed.data) })
  merge.replies.set(label, { ...merge.replies.get(label), ...replies })
  merge.log.push({ position, label, outcome, issues })
}

/**
 * What the bots replied to one incoming question, as the bottings to carry in, and a line for
 * each reply that would not read. A cell with nothing in it, or only a failure, carries nothing.
 */
function repliesFrom(bag: Record<string, unknown>): { replies: Replies, issues: ImportIssue[] } {
  const carried = BotSlots.filter((slot) => carriesReply(bag[slot.field]))
  const readings = carried.map((slot) => ({ slot, botting: bottingFrom(slot, bag[slot.field]) }))
  return {
    replies: Object.fromEntries(readings.flatMap(({ slot, botting }) => botting ? [[slot.field, botting]] : [])),
    issues:  readings.filter(({ botting }) => ! botting).map(({ slot }) => ({
      fieldpath: slot.field,
      message:   'Bot reply could not be read; left out',
      code:      'reply_unreadable',
    })),
  }
}

/** Whether a pasted cell holds something meant as a reply: not nothing, and not a failure */
function carriesReply(raw: unknown): boolean {
  if (_.isNil(raw)) { return false }
  return ! (_.isPlainObject(raw) && (raw as Record<string, unknown>).status === 'error')
}

/** One pasted reply as the botting to carry into `slot`; null when it does not read */
function bottingFrom(slot: BotSlot, raw: unknown): ImportedBottingT | null {
  const cell = { bot_label: slot.bot_label, textkind: slot.textkind }
  if (slot.field === 'guess') {
    const guess = ImportValidators.importedGuess.safeParse(raw)
    return guess.success ? ImportValidators.importedBotting({ ...cell, ...replyMetaOf(guess.data), reply_text: guess.data.text, items: [] }) : null
  }
  const ishes = ImportValidators.importedIshes.safeParse(raw)
  return ishes.success ? ImportValidators.importedBotting({ ...cell, ...replyMetaOf(ishes.data), reply_text: null, items: ishes.data.items }) : null
}

/** What a botting says of how a pasted reply was made */
function replyMetaOf(reply: { truncated: boolean, model_tier_applied?: ImportedBottingT['model_tier_applied'], approx_tokens?: number }) {
  return { truncated: reply.truncated, model_tier_applied: reply.model_tier_applied ?? null, approx_tokens: reply.approx_tokens ?? null }
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
    return { ok: true, quiz: { questions: bare.data }, reading: `Read as a bare list of ${String(bare.data.length)} question(s).` }
  }

  return { ok: false, summary: "That isn't a shape this tool recognises, so nothing was changed. Your text is still here." }
}

/** How the quiz was picked out of a pasted export, for the log */
function howChosen(chosen: ImportQuizT, openQuiz: QuizT): string {
  if (labelOfPasted(chosen) === Labelmaker.effectiveLabelOf(openQuiz)) { return 'matched this quiz by label' }
  return (chosen.title ?? '') === openQuiz.title ? 'matched this quiz by name' : 'took the first quiz'
}

/** The label in force of a pasted quiz, or null when it carries none */
function labelOfPasted(quiz: ImportQuizT): string | null {
  return quiz.forced_label ?? quiz.label ?? null
}

/**
 * An export's quiz chosen against the one on screen: by label, then by name, failing both the
 * first.
 */
export function quizFromExport(quizzes: readonly ImportQuizT[], openQuiz: QuizT): ImportQuizT | undefined {
  const label = Labelmaker.effectiveLabelOf(openQuiz)
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
 * must be the label in force of a question here or of one the same import adds. A chain to
 * anything else, or to the question itself, is left unset and logged.
 */
function chainsResolved(merge: MergeState, held: ReadonlySet<string>): ImportedQuestionT[] {
  const known = new Set([...held, ...merge.patches.keys()])
  return [...merge.patches].map(([label, patch]) => {
    const bottings = Object.values(merge.replies.get(label) ?? {})
    const target = patch.chains_to
    if (target === undefined || target === null || (target !== label && known.has(target))) { return { label, patch, bottings } }
    noteChainLoss(merge.log, label)
    return { label, patch: { ...patch, chains_to: null }, bottings }
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
