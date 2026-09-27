'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Db } from 'jazz-tools'
import { useDb } from 'jazz-tools/react'
import { AppNotices } from '../lib/notices'
import type { QuizLabels } from '../lib/routes'
import { Hunt, type HuntT } from '../models/hunt'
import { Realm, type RealmT } from '../models/realm'
import type { QuizT } from '../models/quiz'
import { askServer } from './lookup'
import { mirrorHunt, openHistories, trackWrite } from './quiz-mirror'
import { perform, type OpenQuiz } from './perform'
import { DirectoryQueries, huntFrom, huntRowFor, loadHeldRows, loadHunt, type HeldRows } from './quiz-rows'
import { useHeldRows } from './use-held-rows'
import type { HuntAction } from './actions'

/** Where finding the quiz an address names stands: still looking, looked and it is not there, or found */
export type Finding = 'waiting' | 'missing' | 'found'

export type HuntHandle = {
  /** Whether the quiz the labels name has been found, or is not there to find */
  finding:    Finding
  /** The hunt the labels name, once it has all arrived; null otherwise */
  hunt:       HuntT | null
  /** The realm the labels name; null when the hunt has no such realm, or has not arrived */
  realm:      RealmT | null
  /** The quiz the labels name; null when the realm has no such quiz, or has not arrived */
  quiz:       QuizT | null
  /** Whether a change dispatched here is still being written */
  unsaved:    boolean
  /** Why the last change could not be kept; null while all is well */
  saveNotice: string | null
  dispatch:   (action: HuntAction) => void
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

/** What the server said about a hunt label this browser holds nothing for: whether it has one */
type Heard = { label: string, found: boolean }

/** The hunt, realm and quiz `labels` name among `rows`, and where finding them stands */
function findIn(rows: HeldRows | null, labels: QuizLabels, heard: Heard | null): Pick<HuntHandle, 'finding' | 'hunt' | 'realm' | 'quiz'> {
  const none = { hunt: null, realm: null, quiz: null }
  if (! rows) { return { finding: 'waiting', ...none } }
  const huntRow = huntRowFor(rows, labels.hunt)
  if (! huntRow) {
    const settled = heard?.label === labels.hunt && ! heard.found
    return { finding: settled ? 'missing' : 'waiting', ...none }
  }
  const hunt = huntFrom(rows, huntRow.id)
  if (! hunt) { return { finding: 'waiting', ...none } }
  const realm = Hunt.realmFor(hunt, labels.realm) ?? null
  const quiz = realm && (Realm.quizFor(realm, labels.quiz) ?? null)
  return { finding: quiz ? 'found' : 'missing', hunt, realm, quiz }
}

/**
 * The quiz `labels` names, live: every row it holds, kept current as they change here, in another
 * tab, on another device, or at someone else's hands, and every change written the moment it is
 * dispatched.
 *
 * A browser that has never synced holds nothing, so a hunt label it cannot find is only missing
 * once the server has been asked; until then it is still being looked for. A quiz of a hunt it
 * holds is found or missing at once.
 *
 * There is no save button and no save queue: a change is in this browser's database as soon as
 * it has been written, a moment after it is dispatched, and syncs from there. Leaving the page in
 * that moment asks first. A change is mirrored into its quiz's history by the tab that made it.
 *
 * @param labels - The hunt, realm and quiz the address names.
 * @returns The hunt, realm and quiz, a dispatcher, and why anything went wrong.
 */
export function useHunt(labels: QuizLabels): HuntHandle {
  const db: Db = useDb()
  const rows = useHeldRows(labels.hunt)
  const [heard, setHeard] = useState<Heard | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [writing, setWriting] = useState(0)

  // Keyed by the labels themselves, so a caller handing in a fresh object each render does not
  // make a fresh hunt each render.
  const { hunt: huntLabel, realm: realmLabel, quiz: quizLabel } = labels
  const held = useMemo(() => findIn(rows, { hunt: huntLabel, realm: realmLabel, quiz: quizLabel }, heard), [rows, huntLabel, realmLabel, quizLabel, heard])
  const { hunt, realm, quiz } = held

  // A hunt label this browser holds nothing for is asked of the server, once per label.
  const unheard = rows !== null && ! huntRowFor(rows, huntLabel) && heard?.label !== huntLabel
  useEffect(() => {
    if (! unheard) { return }
    let current = true
    const ask = async () => {
      const remote = await askServer(db, DirectoryQueries.hunts)
      if (current) { setHeard({ label: huntLabel, found: huntRowFor({ hunts: remote ?? [] }, huntLabel) !== undefined }) }
    }
    void ask()
    return () => { current = false }
  }, [db, unheard, huntLabel])

  useEffect(() => {
    if (hunt) { openHistories(hunt) }
  }, [hunt])

  useEffect(() => {
    document.title = quiz?.title ? `${quiz.title} — Triquet` : 'Triquet'
  }, [quiz?.title])

  // Read by the dispatcher when it runs rather than when it was made, so it never goes stale.
  const open: OpenQuiz | null = hunt && realm && quiz ? { hunt_id: hunt.id, realm_id: realm.id, quiz_id: quiz.id } : null
  const latest = useRef({ rows, hunt, open })
  useEffect(() => { latest.current = { rows, hunt, open } })

  // The change still being written, for the next one to wait its turn behind.
  const ahead = useRef<Promise<void> | null>(null)

  const dispatch = useCallback((action: HuntAction) => {
    const { rows: shown, hunt: before, open: there } = latest.current
    if (shown === null || before === null || there === null) { return }
    const waitFor = ahead.current
    const carryOut = async () => {
      setWriting((was) => was + 1)
      holdThePage(true)
      try {
        // A change dispatched while another is being written (an editor applying several at
        // once, say) waits for it, then works from the rows as they now stand. A change on its
        // own works from the rows on screen, and so writes before the author can act again.
        if (waitFor) { await waitFor }
        const current = waitFor ? await loadHeldRows(db, there.hunt_id) : shown
        await perform(db, current, there, action)
        setSaveNotice(null)
        const after = await loadHunt(db, there.hunt_id)
        if (after) { mirrorHunt(before, after) }
      } catch (err) {
        console.error('Hunt: a change could not be kept', action, err)
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
  }, [db])

  return { ...held, unsaved: writing > 0, saveNotice, dispatch }
}
