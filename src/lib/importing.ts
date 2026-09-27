import type * as Z from 'zod'
import * as Chain from './chain'
import * as Rank from './rank'
import { mintId } from './ids'
import * as Labelmaker from './labelmaker'
import { ClearedValueFor, ImportValidators, ImportableFieldnames, type ImportQuizT } from '../models/import'
import { Question, type QuestionT } from '../models/question'
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
  ok:      boolean
  /** The one-line result shown next to the button */
  summary: string
  /** A line per question, and a nested line per validation issue */
  log:     ImportLogEntry[]
  /** The revised quiz, or null when nothing could be read and the box should keep its text */
  quiz:    QuizT | null
}

/**
 * `pasted` merged into `quiz`.
 *
 * Questions are matched to existing ones **by label**: the label in force, meaning the forced
 * label where a question has one. A label is the one name that survives both the author
 * rewriting a question's title and a round trip through another tool, and ids minted in another
 * browser are meaningless here.
 *
 * Nothing is ever deleted by an import. A label with no match becomes a new question appended to
 * the quiz under that label; so does a question with no label at all, under a fresh one. A
 * question that fails validation is skipped entirely rather than half-merged, and named in the log.
 *
 * @param quiz - The quiz on screen.
 * @param pasted - Whatever is in the Import box.
 * @returns The revised quiz, a one-line summary, and a line per question.
 *
 * @example importInto(quiz, '[{"label":"quiet_otter","clueing":"Which region?"}]')
 */
export function importInto(quiz: QuizT, pasted: string): ImportOutcome {
  const payload = readPayload(pasted, quiz)
  if (! payload.ok) { return { ok: false, summary: payload.summary, log: [], quiz: null } }

  const incoming = payload.quiz.questions
  if (incoming.length === 0) {
    return { ok: false, summary: `${payload.reading} It holds no questions, so nothing was changed.`, log: [], quiz: null }
  }

  const merge: MergeState = {
    questions:       [...quiz.questions],
    log:             [],
    idForForeignId:  new Map(),
    // Two passes: fields first, so every question a chain might point at exists before chains
    // are resolved, whether it was merged into an existing question or freshly appended.
    chainOrders:        [],
  }

  for (const [ii, raw] of incoming.entries()) { mergeOneQuestion(merge, raw, ii + 1) }

  // Two cleanups over the whole quiz, not just the questions the import touched.
  const questions = Rank.renumberByRank(Chain.clearDanglingChains(
    remapChains(merge.questions, merge.chainOrders, merge.idForForeignId, merge.log),
  ))

  const tallied = (outcome: ImportLogEntry['outcome']) => merge.log.filter((entry) => entry.outcome === outcome).length
  const skipped = tallied('skipped')

  return {
    ok:      skipped === 0,
    summary: `${payload.reading} ${String(tallied('merged'))} merged, ${String(tallied('added'))} added, ${String(skipped)} skipped — see log below. Renumbered Q# by rank.`,
    log:     merge.log,
    quiz:    { ...quiz, questions },
  }
}

/** What the merge is building up as it walks the pasted questions */
type MergeState = {
  questions:          QuestionT[]
  log:                ImportLogEntry[]
  /** The question here that each pasted question's own id came to stand for, so its chains can be re-pointed */
  idForForeignId: Map<string, string>
  chainOrders:    { question_id: string, foreignTarget: string | null }[]
}

/**
 * One incoming question folded in: merged onto the question holding its label, or
 * appended when nothing here holds it.
 *
 * A question that fails validation is skipped *entirely* rather than half-merged, and named in
 * the log by position and title. One bad question never blocks the rest of the import.
 */
function mergeOneQuestion(merge: MergeState, raw: unknown, position: number) {
  const bag = (raw ?? {}) as Record<string, unknown>
  const parsed = ImportValidators.importQuestion.safeParse(raw)

  if (! parsed.success) {
    const shownLabel = typeof bag.label === 'string' ? bag.label : ''
    merge.log.push({ position, label: shownLabel, outcome: 'skipped', issues: issuesOf(parsed.error) })
    return
  }

  const incomingLabel = parsed.data.forced_label ?? parsed.data.label ?? null
  const seatIdx = seatFor(merge.questions, incomingLabel)
  const seated = seatIdx === -1 ? undefined : merge.questions[seatIdx]
  const fresh = Question.fill({ id: mintId(), ...(incomingLabel !== null && { label: incomingLabel }) })
  const revised = { ...(seated ?? fresh), ...patchFrom(bag, parsed.data) }

  if (typeof bag.id === 'string') { merge.idForForeignId.set(bag.id, revised.id) }

  merge.questions = seated === undefined
    ? [...merge.questions, revised]
    : merge.questions.map((question, jj) => (jj === seatIdx ? revised : question))

  if (Object.hasOwn(bag, 'chains_to')) {
    merge.chainOrders.push({
      question_id:   revised.id,
      foreignTarget: typeof bag.chains_to === 'string' ? bag.chains_to : null,
    })
  }
  merge.log.push({ position, label: Labelmaker.effectiveLabelOf(revised), outcome: seated === undefined ? 'added' : 'merged', issues: [] })
}

type PayloadReading =
  | { ok: true, quiz: ImportQuizT, reading: string }
  | { ok: false, summary: string }

/**
 * The pasted text read as whichever of the three accepted shapes it is.
 *
 * Given a whole workspace it takes the quiz matching the open one by id, failing that by name,
 * failing that the first one -- and says which reading it took, so the author is never guessing.
 */
function readPayload(pasted: string, openQuiz: QuizT): PayloadReading {
  let raw: unknown
  try {
    raw = JSON.parse(pasted)
  } catch {
    return { ok: false, summary: "That isn't readable as JSON, so nothing was changed. Your text is still here." }
  }

  const workspace = ImportValidators.importWorkspace.safeParse(raw)
  if (workspace.success) {
    const chosen = quizFromWorkspace(workspace.data.quizzes, openQuiz)
    if (! chosen) { return { ok: false, summary: 'That workspace holds no quizzes, so nothing was changed.' } }
    return {
      ok:      true,
      quiz:    chosen,
      reading: `Read as a whole workspace of ${String(workspace.data.quizzes.length)} quiz(zes); ${howChosen(chosen, openQuiz)}, with ${String(chosen.questions.length)} question(s).`,
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

/** How the quiz was picked out of a pasted workspace, for the log */
function howChosen(chosen: ImportQuizT, openQuiz: QuizT): string {
  if (chosen.id === openQuiz.id) { return 'matched this quiz by id' }
  return (chosen.title ?? '') === openQuiz.title ? 'matched this quiz by name' : 'took the first quiz'
}

/**
 * A workspace's quiz chosen against the one on screen: by id, failing that by name, failing
 * that the first.
 */
export function quizFromWorkspace(quizzes: readonly ImportQuizT[], openQuiz: QuizT): ImportQuizT | undefined {
  return quizzes.find((quiz) => quiz.id === openQuiz.id)
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
function patchFrom(bag: Record<string, unknown>, clean: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const fieldname of ImportableFieldnames) {
    if (! Object.hasOwn(bag, fieldname)) { continue }
    patch[fieldname] = bag[fieldname] === null ? ClearedValueFor[fieldname] : clean[fieldname]
  }
  // Chains are remapped in a second pass, never copied: a pasted chain points at an id from
  // wherever it came from, which means nothing here.
  delete patch.chains_to
  return patch
}

/**
 * Chains re-pointed from the pasted data's own ids onto the questions here that those pasted
 * questions were merged into or appended as. Anything unresolvable is left unset and logged.
 */
function remapChains(
  questions: readonly QuestionT[],
  orders: readonly { question_id: string, foreignTarget: string | null }[],
  idForForeignId: ReadonlyMap<string, string>,
  log: ImportLogEntry[],
): QuestionT[] {
  if (orders.length === 0) { return [...questions] }

  return questions.map((question) => {
    const order = orders.find((each) => each.question_id === question.id)
    if (! order) { return question }
    if (order.foreignTarget === null) { return { ...question, chains_to: null } }

    const localId = idForForeignId.get(order.foreignTarget)
    if (localId === undefined || localId === question.id) {
      noteChainLoss(log, Labelmaker.effectiveLabelOf(question))
      return { ...question, chains_to: null }
    }
    return { ...question, chains_to: localId }
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

/**
 * Which existing question an incoming one belongs to, or -1 to append it.
 *
 * A question with no label has no key at all, so it is appended rather than merged onto
 * whichever question it happens to sit next to.
 */
function seatFor(questions: readonly QuestionT[], incomingLabel: string | null): number {
  if (incomingLabel === null) { return -1 }
  return questions.findIndex((question) => Labelmaker.effectiveLabelOf(question) === incomingLabel)
}

/** Every validation issue, with the field path, what was wrong, and the code */
function issuesOf(err: Z.ZodError): ImportIssue[] {
  return err.issues.map((issue) => ({
    fieldpath: issue.path.join('.') || '(whole question)',
    message:   issue.message,
    code:      issue.code,
  }))
}
