'use client'

import { useEffect } from 'react'
import { faceOf, type FaceT } from './markdown'
import type * as Templating from '../../lib/templating'

/**
 * The face of a box holding `text`, as `faceOf` makes it, saying in the console what keeps its
 * template from filling in, if anything does (`useTemplateIssueReport`).
 *
 * @param text - The box's text, as typed.
 * @param bag - What it is filled in over, when the quiz templates it; null when it does not.
 * @param field - What an author calls the box: `Clueing`, `Recap head`.
 * @returns The face.
 *
 * @example const face = useFace(draft, bag, 'Clueing')
 */
export function useFace(text: string, bag: Templating.TemplateBag | null, field: string): FaceT {
  const face = faceOf(text, bag)
  useTemplateIssueReport(face.issue, field, bag)
  return face
}

/** Where a template is, as a report of its issue names it: its field, its quiz's label, and its question's (null for a text of the quiz's own) */
export type TemplatePlaceT = { field: string, quiz: string | null, question: string | null }

/**
 * Says in the console, as an error, what keeps a template from filling in, each time that changes,
 * with where the template is (`issueReportOf`). The screen says it too; the console is for whoever
 * is tracing why. The issue is reported without the place Liquid stopped reading at
 * (`issueGistOf`), which moves with every keystroke into a half-typed tag or section.
 *
 * @param issue - What is wrong with the template (`Templating.fill`); null when nothing is.
 * @param field - What an author calls the template's box.
 * @param bag - What it is filled in over, which names its quiz and question; null when untemplated.
 *
 * @example useTemplateIssueReport(note.issue, 'Recap template', bag)
 */
export function useTemplateIssueReport(issue: string | null, field: string, bag: Pick<Templating.TemplateBag, 'quiz_label' | 'question_label'> | null): void {
  const quiz = bag?.quiz_label ?? null
  const question = bag === null || bag.question_label === '' ? null : bag.question_label
  const gist = issue === null ? null : issueGistOf(issue)
  useEffect(() => {
    if (gist === null) { return }
    console.error(issueReportOf(gist, { field, quiz, question }), { field, quiz, question })
  }, [gist, field, quiz, question])
}

/** The place Liquid says it stopped reading a template at, ending its message */
const IssuePlaceRE = /, line:\d+, col:\d+$/

/**
 * A template's issue without the place Liquid stopped reading at, which moves with every keystroke
 * into a half-typed tag.
 *
 * @example issueGistOf('invalid value expression: "", line:2, col:6')  // => 'invalid value expression: ""'
 * @example issueGistOf('This template comes to far too much text to show.')  // => as it is
 */
export function issueGistOf(issue: string): string {
  return issue.replace(IssuePlaceRE, '')
}

/**
 * The console's line for a template that will not fill in: what was being tried, where, and why.
 *
 * @example issueReportOf('tag {% for each in list %} not closed', { field: 'Recap template', quiz: 'princes', question: null })
 *   // => 'Triquet: could not fill in the template in Recap template of quiz princes — tag {% for each in list %} not closed'
 * @example issueReportOf('undefined filter: shout', { field: 'Clueing', quiz: 'princes', question: 'leon' })
 *   // => 'Triquet: could not fill in the template in Clueing of question leon in quiz princes — undefined filter: shout'
 */
export function issueReportOf(issue: string, { field, quiz, question }: Readonly<TemplatePlaceT>): string {
  const ofQuiz = `quiz ${quiz ?? '(none)'}`
  const where = question === null ? `of ${ofQuiz}` : `of question ${question} in ${ofQuiz}`
  return `Triquet: could not fill in the template in ${field} ${where} — ${issue}`
}
