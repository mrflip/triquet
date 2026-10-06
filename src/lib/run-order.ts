import type { WidgetingTier } from '../models/widgeting'

/**
 * A quiz's run order across its two tiers. A quiz's widgetings are one list (`position`), and the
 * questions pivot is where its question widgetings sit in it: the quiz's own widgetings above the
 * pivot run first, once each, then the question widgetings, each for every question, then the
 * quiz's own widgetings below the pivot. Each one reads what every one before it came to.
 *
 * The pivot is not stored: it sits just before the first question widgeting, so a quiz widgeting
 * placed among the question widgetings (by nothing this tool sends) runs after them all, and a
 * quiz with no question widgetings has every quiz widgeting above its pivot, where order across it
 * makes no difference. Every change to the order is written whole (`runOrderOf`), so positions
 * never interleave the tiers.
 */

/** What the questions pivot is called in the quiz tier's list: a word no widgeting can be labelled */
export const PivotKey = 'questions'

/** The questions pivot, as the quiz tier's list holds it among the quiz's own widgetings */
export type PivotT = { pivot: true, label: typeof PivotKey }

/** The questions pivot */
export const Pivot: PivotT = { pivot: true, label: PivotKey }

/** One item of the quiz tier's list: a widgeting for the whole quiz, or the questions pivot */
export type QuizListItemT<WT> = WT | PivotT

/** A quiz's widgetings by where they run: the quiz's own above the pivot, the question widgetings, the quiz's own below it */
export type TieredT<WT> = {
  before:    WT[]
  questions: WT[]
  after:     WT[]
}

/** How an item says its tier: a widgeting's own `tier`, a run step's widgeting's, a row's with its fallback */
export type TierOf<WT> = (item: WT) => WidgetingTier

/**
 * A widgeting's own tier: the `tierOf` for a list of widgetings.
 *
 * @example tieredOf(quiz.widgetings, ownTier)
 */
export function ownTier(widgeting: { tier: WidgetingTier }): WidgetingTier {
  return widgeting.tier
}

/**
 * `widgetings`, in position order, by where each runs: the quiz's own widgetings before the first
 * question widgeting run above the pivot; every other quiz widgeting runs below it.
 *
 * @param widgetings - A quiz's widgetings in position order, or anything that carries them.
 * @param tierOf - How an item says its tier (`ownTier`, for widgetings).
 *
 * @example tieredOf([entry, sum, total], ownTier).before  // => [entry], when sum runs for each question and total for the quiz
 */
export function tieredOf<WT>(widgetings: readonly WT[], tierOf: NoInfer<TierOf<WT>>): TieredT<WT> {
  const firstQuestion = widgetings.findIndex((item) => tierOf(item) === 'question')
  const pivotAt = firstQuestion === -1 ? widgetings.length : firstQuestion
  return {
    before:    widgetings.slice(0, pivotAt).filter((item) => tierOf(item) === 'quiz'),
    questions: widgetings.filter((item) => tierOf(item) === 'question'),
    after:     widgetings.slice(pivotAt).filter((item) => tierOf(item) === 'quiz'),
  }
}

/**
 * `widgetings` in the order they run: the quiz's own above the pivot, the question widgetings,
 * the quiz's own below it. What their positions are written as after any change.
 *
 * @example runOrderOf([sum, entry, total], ownTier).map((item) => item.label)  // => ['sum', 'entry', 'total'], where entry is the quiz's own: it runs below the pivot
 */
export function runOrderOf<WT>(widgetings: readonly WT[], tierOf: NoInfer<TierOf<WT>>): WT[] {
  const { before, questions, after } = tieredOf(widgetings, tierOf)
  return [...before, ...questions, ...after]
}

/**
 * The quiz tier's list as the gear shows it: the quiz's own widgetings, with the questions pivot
 * among them where the question widgetings run.
 *
 * @example quizListOf([entry, sum, total], ownTier).map((item) => item.label)  // => ['entry', 'questions', 'total']
 */
export function quizListOf<WT>(widgetings: readonly WT[], tierOf: NoInfer<TierOf<WT>>): QuizListItemT<WT>[] {
  const { before, after } = tieredOf(widgetings, tierOf)
  return [...before, Pivot, ...after]
}

/** Whether an item of the quiz tier's list is the questions pivot */
export function isPivot<WT>(item: QuizListItemT<WT>): item is PivotT {
  return item === Pivot
}

/**
 * `widgetings` in run order once the one labelled `label` is moved to `onto_idx` of its own tier's
 * list: among the question widgetings for one that runs for each question; in the quiz tier's list,
 * the questions pivot counted among them (`quizListOf`), for one that runs once for the quiz. An
 * index past the end is the end. A quiz with no question widgetings runs every quiz widgeting
 * first whatever its place against the pivot, and keeps it above. A label naming none is no move.
 *
 * @param widgetings - A quiz's widgetings in position order.
 * @param label - The one moved.
 * @param onto_idx - Where it was dropped, counted in its tier's list as it stands after the lift.
 * @param tierOf - How an item says its tier.
 * @returns Every widgeting, in its new run order.
 *
 * @example movedWithin([entry, sum, total], 'entry', 2, ownTier).map((item) => item.label)  // => ['sum', 'total', 'entry']: below the pivot, after total
 */
export function movedWithin<WT extends { label: string }>(widgetings: readonly WT[], label: string, onto_idx: number, tierOf: NoInfer<TierOf<WT>>): WT[] {
  const moved = widgetings.find((item) => item.label === label)
  const { before, questions, after } = tieredOf(widgetings, tierOf)
  if (! moved) { return [...before, ...questions, ...after] }
  if (tierOf(moved) === 'question') { return [...before, ...liftedTo(questions, moved, onto_idx), ...after] }
  const list = liftedTo<WT | PivotT>([...before, Pivot, ...after], moved, onto_idx)
  const pivotAt = list.findIndex((item) => isPivot(item))
  const quizOwn = (items: readonly (WT | PivotT)[]) => items.filter((item): item is WT => ! isPivot(item))
  return [...quizOwn(list.slice(0, pivotAt)), ...questions, ...quizOwn(list.slice(pivotAt + 1))]
}

/**
 * Where a new widgeting goes in the run order: one for each question at the end of the question
 * widgetings; an entry for the whole quiz, which reads nothing, at the foot of those above the
 * pivot, so every formula can read it; any other for the whole quiz at the very end, so it can read
 * everything.
 *
 * @param widgetings - A quiz's widgetings in position order.
 * @param fresh - The widgeting added.
 * @param reads - Whether it reads anything: false for an entry.
 * @param tierOf - How an item says its tier.
 * @returns Every widgeting, the new one among them, in run order.
 *
 * @example withAdded([entry, sum], playtesters, false, ownTier).map((item) => item.label)  // => ['entry', 'playtesters', 'sum']
 */
export function withAdded<WT>(widgetings: readonly WT[], fresh: WT, reads: boolean, tierOf: NoInfer<TierOf<WT>>): WT[] {
  const { before, questions, after } = tieredOf(widgetings, tierOf)
  if (tierOf(fresh) === 'question') { return [...before, ...questions, fresh, ...after] }
  return reads ? [...before, ...questions, ...after, fresh] : [...before, fresh, ...questions, ...after]
}

/** `items` with `moved` lifted out and dropped at `onto_idx`, clamped to the list */
function liftedTo<IT>(items: readonly IT[], moved: IT, onto_idx: number): IT[] {
  const lifted = items.filter((item) => item !== moved)
  lifted.splice(Math.max(0, Math.min(onto_idx, lifted.length)), 0, moved)
  return lifted
}
