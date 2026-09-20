/**
 * The addresses this app answers to.
 *
 * One place writes the shape of a URL, so a route that moves moves once.
 */

/** Where the workbench for the quiz labelled `label` lives */
export function quizPath(label: string): string {
  return `/my/quiz/${label}`
}
