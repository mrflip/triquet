import * as Bbjank from './bbjank'
import type * as Runner from './formulary/runner'
import * as Templating from './templating'
import type { QuizT } from '../models/quiz'

/**
 * The recap note: what a smith posts to the league's message boards once the quiz has been
 * played. One markdown document, made by filling in Liquid templates, then written in bbjank
 * once, whole: the recap head and tail are filled in over the quiz's template bag (its questions'
 * templated texts filled in first, as the grid shows them), then the recap template (the quiz's
 * own, or `DefaultTemplate`) over the **recap bag**, which holds them; then `Bbjank.toBbjank`,
 * which writes only what it knows, is the last step.
 *
 * The default template reads only what every template reads -- `questions`, each question's own
 * fields and its columns by label -- and the app's filters (`Templating.Helpers`, `in_order`), so an
 * author can see where each line comes from and change any of it. What an author wrote, set into
 * a place where markdown's structure is fragile, can change that structure: a clueing's second
 * line can leave the quote its first line opened, a blank line in an answer breaks its spoiler.
 * The filters (`quote`, `oneline`, `apart`) reshape a field for its place.
 */

/**
 * The recap template every quiz follows until it is given one of its own, written with nothing
 * but what every template reads, Liquid, and the app's filters: the recap head, then, when a
 * question follows, a rule; then each question played (`questions | in_order`: those with a Q# in Q#
 * order, then any other holding a clueing; never an alternate or the archived), numbered by its
 * place there, its clueing quoted under its number, with its own hint after `...OR ELSE...` when it
 * has one; its answer behind a spoiler; the `correct_pct` column; its recap -- then the recap
 * tail. The rule under the head is `***`: a `---` straight under it would make the head's last
 * line a heading. `quote` keeps every line of the clueing and hint in its quote, `oneline` keeps
 * the answer in its spoiler, `apart` keeps a recap opening `---` from making the lines above it a
 * heading. Blank lines the tags leave are the markdown's to swallow.
 */
export const DefaultTemplate = `
{%- assign played = questions | in_order -%}
{%- if recap_head %}
{{ recap_head }}
{%- if played.size > 0 %}
{%- comment %} A rule under the head. Not ---, which would make the line above a heading. {% endcomment %}
***
{%- endif %}
{% endif %}
{%- for question in played %}

> {AS: Q{{ question.number }}}{{ question.number }}. {{ question.clueing | quote }}
{%- if question.hint %}
>
> ...OR ELSE...
>
> {{ question.hint | quote }}
{%- endif %}

Answer: {% if question.full_answer %}~~**{{ question.full_answer | oneline }}**~~{% endif %}
Correct Answer %: {{ question.correct_pct }}
{{ question.recap | apart }}
{%- endfor %}

{{ recap_tail }}
`.trim()

/** What the recap template reads: the quiz's template bag, and its recap head and tail filled in */
export type RecapBagT = Templating.TemplateBag & {
  recap_head: string
  recap_tail: string
}

/** The recap note in bbjank, and what keeps the recap template from filling in, if anything does */
export type RecapNoteT = {
  bbjank: string
  issue:  string | null
}

/**
 * The recap template `quiz` follows: its own, or the default.
 *
 * @example templateOf({ ...quiz, recap_template: undefined }) === DefaultTemplate  // => true
 */
export function templateOf(quiz: Pick<QuizT, 'recap_template'>): string {
  return quiz.recap_template ?? DefaultTemplate
}

/**
 * The recap note in bbjank, ready to paste into a post on the league's boards: the recap
 * template filled in over the recap bag (`bagOf`), then written in bbjank, whole. A template that
 * cannot be filled in is written as typed, with what is wrong with it.
 *
 * @param quiz - The quiz: its recap head, tail and template, and its questions.
 * @param run - Its run, for the templates' bag and the correct-answer column.
 * @returns The note, empty for a quiz with nothing to recap; and the template's issue, if any.
 *
 * @example noteOf({ ...quiz, recap_head: 'Thanks!', questions: [hamilton] }, run).bbjank
 *   // => 'Thanks!\n----------------------------------------\n\n[quote="Q1"]1. Who?[/quote]\n\nAnswer: [spoiler][b]HAMILTON[/b][/spoiler]\nCorrect Answer %:'
 */
export function noteOf(quiz: QuizT, run: Runner.QuizRun): RecapNoteT {
  const filled = Templating.fill(templateOf(quiz), bagOf(quiz, run))
  return { bbjank: Bbjank.toBbjank(filled.markdown), issue: filled.issue }
}

/**
 * What the recap template reads: the quiz's template bag, its questions' templated texts filled
 * in (`Templating.filledBagOf`), so `{{ question.clueing }}` in a loop over `questions` is a templated clueing
 * filled in; and its recap head and tail, each filled in over that bag (as typed, when it cannot be).
 *
 * @example bagOf(quiz, run).recap_head  // => 'Thanks to Ada!'   (typed as 'Thanks to {{ quiz.playtesters }}!')
 */
export function bagOf(quiz: QuizT, run: Runner.QuizRun): RecapBagT {
  const quizBag = Templating.filledBagOf(quiz, run)
  return {
    ...quizBag,
    recap_head: Templating.fill(quiz.recap_head, quizBag).markdown,
    recap_tail: Templating.fill(quiz.recap_tail, quizBag).markdown,
  }
}
