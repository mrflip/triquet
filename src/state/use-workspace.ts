'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Db } from 'jazz-tools'
import { useAll, useDb, useSession } from 'jazz-tools/react'
import { app } from '../db/schema'
import { AppNotices } from '../lib/notices'
import * as Labelmaker from '../lib/labelmaker'
import { Workspace, openQuizOf, type WorkspaceT } from '../models/workspace'
import { mirrorWorkspace, openHistories, trackWrite } from './quiz-mirror'
import { perform } from './perform'
import { ensureWorkspace } from './quiz-actions'
import { LocalFirst, loadAccountRows, loadWorkspace, workspaceFrom, type AccountRows } from './quiz-rows'
import type { QuizT } from '../models/quiz'
import type { WorkspaceAction } from './actions'

export type WorkspaceHandle = {
  workspace:  WorkspaceT
  /** Whether this account's quizzes have arrived yet */
  loaded:     boolean
  /** Whether a change dispatched here is still being written */
  unsaved:    boolean
  /** Why the workspace could not be opened, or the last change could not be kept; null while all is well */
  saveNotice: string | null
  /** The quiz on screen: the one the label names, or the one last open; null when there is none */
  quiz:       QuizT | null
  dispatch:   (action: WorkspaceAction) => void
}

/** The quiz `label` names in `workspace`, or the one it last had open when there is no label */
function quizOn(workspace: WorkspaceT, label: string | undefined): QuizT | null {
  if (label === undefined) { return openQuizOf(workspace) }
  return Labelmaker.entityForLabel(workspace.quizzes, label) ?? null
}

/** How many changes this page is writing */
const Writing = { count: 0 }

/** Asks before the page is left, which would lose a change still being written */
function askBeforeLeaving(event: BeforeUnloadEvent): void {
  event.preventDefault()
}

/**
 * Hold the page while a change is written, and let it go once none is. Done at once rather than
 * after the next render, because a change is only a moment in the writing and the author may
 * leave in that moment.
 */
function holdThePage(holding: boolean): void {
  Writing.count += holding ? 1 : -1
  if (holding && Writing.count === 1) { addEventListener('beforeunload', askBeforeLeaving) }
  if (! holding && Writing.count === 0) { removeEventListener('beforeunload', askBeforeLeaving) }
}

/** What stands in for the workspace until this account's rows arrive */
const Unloaded = Workspace.blank()

/**
 * This account's workspace, live: every row it holds, kept current as they change here, in
 * another tab, or on another device, and every change written the moment it is dispatched.
 *
 * There is no save button and no save queue: a change is in this browser's database as soon as
 * it has been written, a moment after it is dispatched, and syncs from there. Leaving the page
 * in that moment asks first. A change is mirrored
 * into its quiz's history by the tab that made it.
 *
 * @param label - The quiz the address names; without one, the quiz last open.
 * @returns The workspace, the quiz on screen, a dispatcher, and why anything went wrong.
 */
export function useWorkspace(label?: string): WorkspaceHandle {
  const db: Db = useDb()
  const [workspace_id, setWorkspaceId] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [writing, setWriting] = useState(0)

  const account = useSession()?.user.account ?? null

  useEffect(() => {
    if (account === null) { return }
    let current = true
    const find = async () => {
      try {
        console.warn('Workspace: finding the workspace for account', account)
        const found = await ensureWorkspace(db, account)
        console.warn('Workspace: found', found)
        if (current) { setWorkspaceId(found) }
      } catch (err) {
        console.error('Workspace: could not be found or made', err)
        if (current) { setSaveNotice(AppNotices.loadFailed) }
      }
    }
    void find()
    return () => { current = false }
  }, [db, account])

  // One subscription per table, since a query that includes several relations can hang. Every
  // row an account can see is its own, so each table is read whole.
  const workspaces  = useAll(app.workspaces, LocalFirst)
  const quizzes     = useAll(app.quizzes.orderBy('$createdAt'), LocalFirst)
  const expressions = useAll(app.expressions, LocalFirst)
  const questions   = useAll(app.questions, LocalFirst)
  const widgets     = useAll(app.widgets, LocalFirst)
  const columns     = useAll(app.columns, LocalFirst)
  const bottings    = useAll(app.bottings.select('*', '$createdAt'), LocalFirst)

  // How many rows each table has delivered, or that it is still waiting, logged as it changes.
  const tables = { workspaces, quizzes, expressions, questions, widgets, columns, bottings }
  const arrivals = Object.entries(tables).map(([table, { data, error: err }]) => `${table}:${err ? 'failed' : String(data?.length ?? 'waiting')}`).join(' ')
  useEffect(() => {
    console.warn('Workspace: rows', arrivals, { ms: Math.round(performance.now()) })
  }, [arrivals])
  useEffect(() => {
    const failures = {
      workspaces: workspaces.error, quizzes: quizzes.error, expressions: expressions.error, questions: questions.error,
      widgets: widgets.error, columns: columns.error, bottings: bottings.error,
    }
    for (const [table, err] of Object.entries(failures)) {
      if (err) { console.error(`Workspace: the ${table} subscription failed`, err) }
    }
  }, [workspaces.error, quizzes.error, expressions.error, questions.error, widgets.error, columns.error, bottings.error])

  const rows = useMemo((): AccountRows | null => {
    if (! workspaces.data || ! quizzes.data || ! expressions.data || ! questions.data || ! widgets.data || ! columns.data || ! bottings.data) { return null }
    return {
      workspaces: workspaces.data, quizzes: quizzes.data, expressions: expressions.data, questions: questions.data,
      widgets: widgets.data, columns: columns.data, bottings: bottings.data,
    }
  }, [workspaces.data, quizzes.data, expressions.data, questions.data, widgets.data, columns.data, bottings.data])

  // Null until the workspace and its quizzes have arrived: each table arrives on its own.
  const held = useMemo(() => (rows && workspace_id !== null ? workspaceFrom(rows, workspace_id) : null), [rows, workspace_id])

  const workspace = held ?? Unloaded
  const quiz = held && quizOn(held, label)

  useEffect(() => {
    if (held) { openHistories(held) }
  }, [held])

  useEffect(() => {
    document.title = quiz?.title ? `${quiz.title} — Triquet` : 'Triquet'
  }, [quiz?.title])


  // Read by the dispatcher when it runs rather than when it was made, so it never goes stale.
  const latest = useRef({ rows, workspace, quiz_id: quiz?.id ?? null })
  useEffect(() => { latest.current = { rows, workspace, quiz_id: quiz?.id ?? null } })

  // The change still being written, for the next one to wait its turn behind.
  const ahead = useRef<Promise<void> | null>(null)

  const dispatch = useCallback((action: WorkspaceAction) => {
    const { rows: shown, workspace: before, quiz_id } = latest.current
    if (workspace_id === null || shown === null) { return }
    const open = { workspace_id, quiz_id: quiz_id ?? before.active_quiz_id }
    const waitFor = ahead.current
    const carryOut = async () => {
      setWriting((was) => was + 1)
      holdThePage(true)
      try {
        // A change dispatched while another is being written (an editor applying several at
        // once, say) waits for it, then works from the rows as they now stand. A change on its
        // own works from the rows on screen, and so writes before the author can act again.
        if (waitFor) { await waitFor }
        const held = waitFor ? await loadAccountRows(db) : shown
        await perform(db, held, open, action)
        setSaveNotice(null)
        const after = await loadWorkspace(db, workspace_id)
        if (after) { mirrorWorkspace(before, after) }
      } catch (err) {
        console.error('Workspace: a change could not be kept', action, err)
        setSaveNotice(AppNotices.changeFailed)
      } finally {
        setWriting((was) => was - 1)
        holdThePage(false)
      }
    }
    const work = carryOut()
    ahead.current = work
    const release = async () => {
      await work
      if (ahead.current === work) { ahead.current = null }
    }
    void release()
    trackWrite(work)
  }, [db, workspace_id])

  return { workspace, loaded: held !== null, unsaved: writing > 0, saveNotice, quiz, dispatch }
}
