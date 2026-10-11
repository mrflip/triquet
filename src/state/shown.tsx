'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { HuntListingT } from '../lib/rows'
import type * as Routes from '../lib/routes'
import type { IdentT } from '../models/ident'
import type { QuizT } from '../models/quiz'

/** The hunt a page is about, as the header names it: its title, and its org and label to link to */
export type ShownHuntT = Pick<HuntListingT, 'org' | 'label' | 'title'>

/** A quiz as the header's switcher lists it: its label to link to, its title, and whether it is locked */
export type ShownQuizBriefT = Pick<QuizT, '_id' | 'label' | 'title' | 'locked'>

/**
 * The quiz a page is about, as the header names it: the label of its realm, which the header
 * links to; the quiz itself, the switcher's face; its siblings in the realm, which the switcher
 * opens; and the mode they open in.
 */
export type ShownQuizT = {
  realm:   string
  quiz:    ShownQuizBriefT
  quizzes: readonly ShownQuizBriefT[]
  mode:    Routes.Mode
}

/** What the quiz's screen lets the header do with the quiz on it: make another beside it, and lock or unlock it */
export type QuizActsT = {
  onNew:     () => void
  onSetLock: (locked: boolean) => void
}

/** Who is looking, as the header's account menu shows them: their ident, null until they have said one; and how to retitle it */
export type ShownAccountT = {
  ident:     IdentT | null
  onRetitle: (title: string) => void
}

/** Everything the header shows that only the page beneath it knows; null for each part the page says nothing of */
export type ShownT = {
  hunt:     ShownHuntT | null
  quiz:     ShownQuizT | null
  quizActs: QuizActsT | null
  account:  ShownAccountT | null
}

/** Say one part of what the header shows; null for nothing */
type Show = <PT extends keyof ShownT>(part: PT, val: ShownT[PT]) => void

const NothingShown: ShownT = { hunt: null, quiz: null, quizActs: null, account: null }

// Two contexts, so a page that only says what the header shows is not drawn again when it does.
const ShowContext = createContext<Show | null>(null)
const ShownContext = createContext<ShownT>(NothingShown)

/**
 * What the page shows the header, said by the page and read by the header above it, which sits
 * outside the page and its connection to the database: the hunt and the quiz it is about, what the
 * quiz's screen lets the header do, and who is looking. Wraps the whole app, header included.
 */
export function ShownProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [shown, setShown] = useState<ShownT>(NothingShown)
  const show = useCallback<Show>((part, val) => { setShown((was) => (was[part] === val ? was : { ...was, [part]: val })) }, [])
  return (
    <ShowContext value={show}>
      <ShownContext value={shown}>
        {children}
      </ShownContext>
    </ShowContext>
  )
}

/**
 * Say one part of what the header shows, for as long as the caller is on screen; null says
 * nothing. Said again whenever `val` is another object, so a caller hands over one it holds still
 * (`useMemo`) until something the header shows has changed.
 */
function useShowPart<PT extends keyof ShownT>(part: PT, val: ShownT[PT]): void {
  const show = useContext(ShowContext)
  if (show === null) { throw new Error('Saying what the header shows wants a ShownProvider above it') }
  useEffect(() => {
    if (val === null) { return }
    show(part, val)
    return () => { show(part, null) }
  }, [show, part, val])
}

/**
 * Say that the page is about `hunt`, for as long as it is on screen, so that the header names it.
 * A page about no hunt, or one whose hunt has not arrived, says nothing, and the header names none.
 *
 * @param hunt - The hunt the page is about; null while there is none to name.
 *
 * @example useShowHunt(hunt)
 */
export function useShowHunt(hunt: ShownHuntT | null): void {
  const org = hunt?.org ?? null
  const label = hunt?.label ?? null
  const title = hunt?.title ?? null
  const shown = useMemo(() => (org === null || label === null || title === null ? null : { org, label, title }), [org, label, title])
  useShowPart('hunt', shown)
}

/**
 * Say that the page is about a quiz, for as long as it is on screen, so that the header names its
 * realm and offers its siblings. Hand over an object held still until what it says changes.
 *
 * @param quiz - The quiz, its realm and siblings, and the mode they open in; null while there is none.
 *
 * @example useShowQuiz(useMemo(() => ({ realm: 'home', quiz, quizzes, mode: 'edit' }), [quiz, quizzes]))
 */
export function useShowQuiz(quiz: ShownQuizT | null): void {
  useShowPart('quiz', quiz)
}

/**
 * Say what the header may do with the quiz on screen, for as long as the screen offering it is up.
 * Hand over an object held still until one of its functions would do otherwise.
 *
 * @param acts - Making another quiz, and locking or unlocking this one; null to offer neither.
 *
 * @example useShowQuizActs(useMemo(() => ({ onNew, onSetLock }), [onNew, onSetLock]))
 */
export function useShowQuizActs(acts: QuizActsT | null): void {
  useShowPart('quizActs', acts)
}

/**
 * Say who is looking, for the header's account menu, for as long as the caller is on screen. Hand
 * over an object held still until who it is changes.
 *
 * @param account - The visitor's ident and how to retitle it; null to say nothing.
 *
 * @example useShowAccount(useMemo(() => ({ ident, onRetitle }), [ident, onRetitle]))
 */
export function useShowAccount(account: ShownAccountT | null): void {
  useShowPart('account', account)
}

/**
 * What the page shows the header: each part null that the page has said nothing of.
 *
 * @returns The hunt, the quiz, what may be done with it, and who is looking.
 */
export function useShown(): ShownT {
  return useContext(ShownContext)
}
