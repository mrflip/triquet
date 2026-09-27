'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAll } from 'jazz-tools/react'
import { bottingsQuery, DirectoryQueries, huntQueries, huntRowFor, idsIn, idsKey, LocalFirst, quizzesOf, type Directory, type HeldRows } from './quiz-rows'

/** How each subscription stands, by table: what it delivered, or that it is still waiting, or failed */
type Arrivals = Record<string, { data?: readonly unknown[], error?: unknown }>

/**
 * Log how many rows each table has delivered, or that it is still waiting, as that changes, and
 * any subscription that fails.
 */
function useArrivalLog(tables: Arrivals): void {
  const arrivals = Object.entries(tables).map(([table, { data, error: err }]) => `${table}:${err ? 'failed' : String(data?.length ?? 'waiting')}`).join(' ')
  useEffect(() => {
    console.warn('Rows:', arrivals, { ms: Math.round(performance.now()) })
  }, [arrivals])
  const failures = Object.entries(tables).filter(([, { error: err }]) => err).map(([table]) => table).join(' ')
  useEffect(() => {
    if (failures !== '') { console.error('Rows: these subscriptions failed:', failures) }
  }, [failures])
}

/**
 * Every hunt, realm and quiz row this browser can read, live: enough to list every hunt's
 * quizzes, and to resolve any address.
 *
 * @returns The rows, once every table has delivered; null until then.
 */
export function useDirectory(): Directory | null {
  const hunts   = useAll(DirectoryQueries.hunts, LocalFirst)
  const realms  = useAll(DirectoryQueries.realms, LocalFirst)
  const quizzes = useAll(DirectoryQueries.quizzes, LocalFirst)
  useArrivalLog({ hunts, realms, quizzes })

  return useMemo((): Directory | null => {
    if (! hunts.data || ! realms.data || ! quizzes.data) { return null }
    return { hunts: hunts.data, realms: realms.data, quizzes: quizzes.data }
  }, [hunts.data, realms.data, quizzes.data])
}

/**
 * `data` as it arrives; while it is away, the last `data` delivered for the same `scope`.
 *
 * A subscription whose query changes delivers nothing until the new query has run once. The
 * hunt's queries change whenever it gains or loses a quiz or a question, and the rows they
 * delivered a moment ago are still right for everything that was already there, so the page
 * keeps them rather than blanking. A different scope (another hunt) starts from nothing.
 */
function useKept<RT>(scope: string | null, data: RT | undefined): RT | undefined {
  const [kept, setKept] = useState<{ scope: string | null, data: RT } | null>(null)
  if (data !== undefined && (kept?.scope !== scope || kept.data !== data)) { setKept({ scope, data }) }
  if (data !== undefined) { return data }
  return kept?.scope === scope ? kept.data : undefined
}

/**
 * The directory, and the rows of the hunt answering to `huntLabel`, live: kept current as they
 * change here, in another tab, on another device, or at the hands of someone else.
 *
 * One subscription per table, since a query that includes several relations can hang. Only the
 * named hunt's own rows are subscribed to, so a browser hears nothing of the other hunts' edits:
 * its expressions by the hunt, its questions, widgets and columns by its quizzes, and its
 * bottings by its questions. When no hunt this browser holds answers to the label, its rows are
 * none.
 *
 * @param huntLabel - The hunt the address names.
 * @returns The rows, once every table has delivered; null until then.
 */
export function useHeldRows(huntLabel: string): HeldRows | null {
  const directory = useDirectory()
  const hunt_id = directory ? huntRowFor(directory, huntLabel)?.id ?? null : null
  // Keyed by the ids as text, so a directory delivery that changes nothing of this hunt's makes
  // no new query.
  const quizKey = directory && hunt_id !== null ? idsKey(quizzesOf(directory, hunt_id)) : null
  const queries = useMemo(() => (hunt_id === null || quizKey === null ? null : huntQueries(hunt_id, idsIn(quizKey))), [hunt_id, quizKey])

  const expressions = useAll(queries?.expressions, LocalFirst)
  const questions   = useAll(queries?.questions, LocalFirst)
  const widgets     = useAll(queries?.widgets, LocalFirst)
  const columns     = useAll(queries?.columns, LocalFirst)
  const reviews     = useAll(queries?.reviews, LocalFirst)
  const keptQuestions = useKept(hunt_id, questions.data)
  const questionKey = keptQuestions ? idsKey(keptQuestions) : null
  const bottingsQueried = useMemo(() => (questionKey === null ? undefined : bottingsQuery(idsIn(questionKey))), [questionKey])
  const bottings    = useAll(bottingsQueried, LocalFirst)
  useArrivalLog({ expressions, questions, widgets, columns, bottings, reviews })

  const keptExpressions = useKept(hunt_id, expressions.data)
  const keptWidgets = useKept(hunt_id, widgets.data)
  const keptColumns = useKept(hunt_id, columns.data)
  const keptBottings = useKept(hunt_id, bottings.data)
  const keptReviews = useKept(hunt_id, reviews.data)

  return useMemo((): HeldRows | null => {
    if (! directory) { return null }
    if (queries === null) { return { ...directory, expressions: [], questions: [], widgets: [], columns: [], bottings: [], reviews: [] } }
    if (! keptExpressions || ! keptQuestions || ! keptWidgets || ! keptColumns || ! keptBottings || ! keptReviews) { return null }
    return { ...directory, expressions: keptExpressions, questions: keptQuestions, widgets: keptWidgets, columns: keptColumns, bottings: keptBottings, reviews: keptReviews }
  }, [directory, queries, keptExpressions, keptQuestions, keptWidgets, keptColumns, keptBottings, keptReviews])
}
