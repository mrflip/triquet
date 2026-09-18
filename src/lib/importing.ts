import * as Z from 'zod'
import { clearDanglingChains } from './chain'
import { renumberByRank } from './rank'
import { mintId } from './ids'
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
  title: string
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
  /** The revised round, or null when nothing could be read and the box should keep its text */
  quiz:    QuizT | null
}

/**
 * `pasted` merged into `quiz`.
 *
 * Questions are matched to existing ones **by title**, compared case-insensitively and
 * ignoring surrounding whitespace. Title is the right key because it is the one field
 * that stays stable while an author rewrites a question around it, and because ids minted in
 * another browser are meaningless here.
 *
 * Nothing is ever deleted by an import. A title with no match becomes a new question
 * appended to the round; a question that fails validation is skipped entirely rather than
 * half-merged, and named in the log.
 *
 * @param quiz - The round on screen.
 * @param pasted - Whatever is in the Import box.
 * @returns The revised round, a one-line summary, and a line per question.
 *
 * @example importInto(quiz, '[{"title":"Leon","clueing":"Which region?"}]')
 */
export function importInto(quiz: QuizT, pasted: string): ImportOutcome {
  const payload = readPayload(pasted, quiz)
  if (! payload.ok) { return { ok: false, summary: payload.summary, log: [], quiz: null } }

  const incoming = payload.quiz.questions
  if (incoming.length === 0) {
    return { ok: false, summary: `${payload.reading} It holds no questions, so nothing was changed.`, log: [], quiz: null }
  }

  const merge: MergeState = {
    questions:          [...quiz.questions],
    log:                [],
    answerForForeignId: new Map(),
    // Two passes: fields first, so every question a chain might point at exists before chains
    // are resolved, whether it was merged into an existing question or freshly appended.
    chainOrders:        [],
  }

  for (const [ii, raw] of incoming.entries()) { mergeOneQuestion(merge, raw, ii + 1) }

  // Two cleanups over the whole round, not just the questions the import touched.
  const questions = renumberByRank(clearDanglingChains(
    remapChains(merge.questions, merge.chainOrders, merge.answerForForeignId, merge.log),
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
  answerForForeignId: Map<string, string>
  chainOrders:        { question_id: string, foreignTarget: string | null }[]
}

/**
 * One incoming question folded in: merged onto the question holding its title, or
 * appended when nothing here holds it.
 *
 * A question that fails validation is skipped *entirely* rather than half-merged, and named in
 * the log by position and title. One bad question never blocks the rest of the import.
 */
function mergeOneQuestion(merge: MergeState, raw: unknown, position: number) {
  const bag = (raw ?? {}) as Record<string, unknown>
  const parsed = ImportValidators.importQuestion.safeParse(raw)

  if (! parsed.success) {
    const shownAnswer = typeof bag.title === 'string' ? bag.title : ''
    merge.log.push({ position, title: shownAnswer, outcome: 'skipped', issues: issuesOf(parsed.error) })
    return
  }

  if (typeof bag.id === 'string' && typeof parsed.data.title === 'string') {
    merge.answerForForeignId.set(bag.id, parsed.data.title)
  }

  const seatIdx = seatFor(merge.questions, bag, parsed.data.title ?? '')
  const seated = seatIdx === -1 ? undefined : merge.questions[seatIdx]
  const revised = { ...(seated ?? Question.fill({ id: mintId() })), ...patchFrom(bag, parsed.data) }

  merge.questions = seated === undefined
    ? [...merge.questions, revised]
    : merge.questions.map((question, jj) => (jj === seatIdx ? revised : question))

  if (Object.hasOwn(bag, 'chains_to')) {
    merge.chainOrders.push({
      question_id:   revised.id,
      foreignTarget: typeof bag.chains_to === 'string' ? bag.chains_to : null,
    })
  }
  merge.log.push({ position, title: revised.title, outcome: seated === undefined ? 'added' : 'merged', issues: [] })
}

type PayloadReading =
  | { ok: true, quiz: ImportQuizT, reading: string }
  | { ok: false, summary: string }

/**
 * The pasted text read as whichever of the three accepted shapes it is.
 *
 * Given a whole workspace it takes the round matching the open one by id, failing that by name,
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
    if (! chosen) { return { ok: false, summary: 'That workspace holds no rounds, so nothing was changed.' } }
    return {
      ok:      true,
      quiz:    chosen,
      reading: `Read as a whole workspace of ${String(workspace.data.quizzes.length)} round(s); ${howChosen(chosen, openQuiz)}, with ${String(chosen.questions.length)} question(s).`,
    }
  }

  const quiz = ImportValidators.importQuiz.safeParse(raw)
  if (quiz.success) {
    return { ok: true, quiz: quiz.data, reading: `Read as one round of ${String(quiz.data.questions.length)} question(s).` }
  }

  const bare = ImportValidators.importPayload.safeParse(raw)
  if (bare.success && Array.isArray(bare.data)) {
    return { ok: true, quiz: { questions: bare.data }, reading: `Read as a bare list of ${String(bare.data.length)} question(s).` }
  }

  return { ok: false, summary: "That isn't a shape this tool recognises, so nothing was changed. Your text is still here." }
}

/** How the round was picked out of a pasted workspace, for the log */
function howChosen(chosen: ImportQuizT, openQuiz: QuizT): string {
  if (chosen.id === openQuiz.id) { return 'matched this round by id' }
  return (chosen.title ?? '') === openQuiz.title ? 'matched this round by name' : 'took the first round'
}

/**
 * A workspace's round chosen against the one on screen: by id, failing that by name, failing
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
 * Chains resolved through the pasted data's own id-to-title map and re-pointed at the
 * question holding that title here. Anything unresolvable is left unset and logged.
 */
function remapChains(
  questions: readonly QuestionT[],
  orders: readonly { question_id: string, foreignTarget: string | null }[],
  answerForForeignId: ReadonlyMap<string, string>,
  log: ImportLogEntry[],
): QuestionT[] {
  if (orders.length === 0) { return [...questions] }
  const idForAnswer = new Map(questions.map((question) => [matchkeyOf(question.title), question.id]))

  return questions.map((question) => {
    const order = orders.find((each) => each.question_id === question.id)
    if (! order) { return question }
    if (order.foreignTarget === null) { return { ...question, chains_to: null } }

    const foreignAnswer = answerForForeignId.get(order.foreignTarget)
    const localId = foreignAnswer === undefined ? undefined : idForAnswer.get(matchkeyOf(foreignAnswer))
    if (localId === undefined || localId === question.id) {
      noteChainLoss(log, question.title)
      return { ...question, chains_to: null }
    }
    return { ...question, chains_to: localId }
  })
}

/** Records an unresolvable chain against the question that carried it */
function noteChainLoss(log: ImportLogEntry[], title: string) {
  const entry = log.find((each) => each.title === title)
  entry?.issues.push({
    fieldpath: 'chains_to',
    message:   'Chain target could not be resolved to a question in this round; left unset',
    code:      'chain_unresolved',
  })
}

/**
 * Which existing question an incoming one belongs to, or -1 to append it.
 *
 * Title is the stated key, and the right one across browsers: it is the field that stays
 * stable while an author rewrites a question around it, where an id minted elsewhere means
 * nothing. But an id that names a question *in this round* is an exact match and is tried
 * first, which is what makes pasting your own export straight back idempotent -- without it,
 * every question you had not named yet would be appended as a duplicate.
 *
 * A question with neither a known id nor a title has no key at all, so it is appended
 * rather than merged onto whichever blank it happens to sit next to.
 */
function seatFor(questions: readonly QuestionT[], bag: Record<string, unknown>, title: string): number {
  if (typeof bag.id === 'string') {
    const byId = questions.findIndex((question) => question.id === bag.id)
    if (byId !== -1) { return byId }
  }
  const matchkey = matchkeyOf(title)
  if (matchkey === '') { return -1 }
  return questions.findIndex((question) => matchkeyOf(question.title) === matchkey)
}

/** How two titles are compared: case-insensitively, ignoring surrounding whitespace */
export function matchkeyOf(title: string): string {
  return title.trim().toLowerCase()
}

/** Every validation issue, with the field path, what was wrong, and the code */
function issuesOf(err: Z.ZodError): ImportIssue[] {
  return err.issues.map((issue) => ({
    fieldpath: issue.path.join('.') || '(whole question)',
    message:   issue.message,
    code:      issue.code,
  }))
}
