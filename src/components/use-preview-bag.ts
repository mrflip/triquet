'use client'

import { useMemo, useState } from 'react'
import * as Runner from '../lib/formulary/runner'
import * as Rank from '../lib/rank'
import type { ShallowHuntT } from '../lib/rows'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import { useOtherQuiz } from '../state/use-other-quiz'

/** The quiz and question a widget editor's preview is pointed at, and the bag it reads there */
export type PreviewBagHandle = {
  /** Every quiz of the hunt, for the preview to be pointed at */
  quizzes:     readonly ShallowHuntT['realms'][number]['quizzes'][number][]
  quiz_id:     string
  /** Point the preview at another quiz, starting on its lowest-numbered question */
  pickQuiz:    (quiz_id: string) => void
  /** The quiz's questions, in Q# order */
  ranked:      readonly QuestionT[]
  /** The question picked; the lowest-numbered one until another is */
  question:    QuestionT | undefined
  pickQuestion: (question_id: string) => void
  /** The bag the widget reads for that question, once its quiz is to hand */
  bag:         Runner.QuizBag | undefined
}

/**
 * Where a widget editor's live preview is pointed, and the bag it reads there.
 *
 * Any quiz of the hunt and any of its questions can be picked; it starts on the lowest-numbered
 * question of the quiz on screen. Another quiz is read for as long as the preview is pointed at
 * it. The bag is the one the widgeting labelled `widgeting_label` sees: with the widgeteds of
 * those before it, or of every widgeting, for a widget not yet put to work.
 *
 * @param hunt - The hunt, whose every quiz the preview can be pointed at.
 * @param library - The library, whose widgets the quizzes' widgetings work.
 * @param openQuiz - The quiz on screen.
 * @param widgeting_label - The widgeting the widget is being written for; blank for none.
 * @returns The picks, and the bag.
 */
export function usePreviewBag(hunt: ShallowHuntT, library: readonly WidgetT[], openQuiz: QuizT, widgeting_label: string): PreviewBagHandle {
  const [quiz_id, setQuizId] = useState<string>(openQuiz._id)
  const [question_id, setQuestionId] = useState<string | null>(null)

  const quizzes = useMemo(() => hunt.realms.flatMap((realm) => realm.quizzes), [hunt])
  const picked = quiz_id === openQuiz._id ? null : quizzes.find((row) => row._id === quiz_id) ?? null
  const other = useOtherQuiz(hunt, picked?._id ?? null)
  const quiz: QuizT | null = picked ? other : openQuiz
  const ranked = useMemo(() => Rank.inRankOrder(quiz?.questions ?? []), [quiz])
  const question = ranked.find((held) => held._id === question_id) ?? ranked[0]
  const realm = quiz && hunt.realms.find((held) => held.quizzes.some((row) => row._id === quiz._id))
  const bags = useMemo((): ReadonlyMap<string, Runner.QuizBag> => {
    if (! quiz || ! realm) { return new Map() }
    const run = Runner.runQuiz(Runner.sourceOf(quiz, library, Runner.placeOf(hunt, realm)))
    return Runner.bagsAt(run, { label: widgeting_label, params: {} })
  }, [quiz, hunt, library, realm, widgeting_label])

  return {
    quizzes,
    quiz_id,
    pickQuiz:     (picking) => { setQuizId(picking); setQuestionId(null) },
    ranked,
    question,
    pickQuestion: setQuestionId,
    bag:          question ? bags.get(question._id) : undefined,
  }
}
