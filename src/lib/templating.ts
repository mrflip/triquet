import * as EST from 'es-toolkit'
import * as UU from './useful'
import * as Labelmaker from './labelmaker'
import * as Liquidry from './liquidry'
import * as Shaping from './shaping'
import type { QuizBag, QuizRun } from './formulary/runner'
import { Widgeted, type WidgetedT } from '../models/widgeted'
import { TemplatableFieldVals, isTemplatableField, type QuizT } from '../models/quiz'
import { ArchivedField, PlaceField, RankField, SecondaryField, type QuestionT } from '../models/question'
import type { Formularykind, WidgetT } from '../models/widget'

/**
 * Field templates: a field's markdown filled in, by Liquid (LiquidJS), over the quiz's bag, before
 * anything reads it as markdown.
 *
 * Filling cleans nothing. What a template comes to is markdown, and goes on, whole, to the
 * markdown parser and then to the sanitizer, which is always the last step: on screen
 * `react-markdown` and `rehype-sanitize` (`Markdown.RenderOptions`), on the board
 * `Bbjank.toBbjank`. So a value holding `<script>` is shown as the characters typed, and a value
 * holding `**bold**` is bold, since it was filled in before the parser read it. One thing is
 * changed on the way in: an image in a formula's or a bot's column is made a link to it, so only
 * text a person typed draws an image.
 *
 * Liquid as `Liquidry` holds it: interpreted, reading only what the bag itself holds at a key,
 * never anything a JavaScript object inherits, its budgets counted. A template may use
 * Liquid's own tags and filters (`{% for %}`, `{% if %}`, `| sort`, `| where`) and the app's
 * (`Helpers`, `in_order`): `{{ qn.clueing | quote }}`, `{% assign played = qns | in_order %}`. A
 * filter goes in an `assign`, never in a `for` tag, which would pass it over. It may not include
 * another template. An empty value is false, as in JavaScript (`jsTruthy`): `{% if hint %}` shows
 * only for a hint that holds something.
 */

/**
 * What a template reads: the bag a formula reads, less what only a running widgeting has (its
 * `params` and `widgeting_label`), and with its questions told apart: `qns` holds only the
 * questions a screen shows (the alternates among them, not the archived), and `quiz.questions`
 * every one. Each question carries the widgeted of every widgeting of the quiz, under its label,
 * and says whether it is `archived` and whether it is `secondary` (an alternate). For a text of
 * the quiz's own (a recap's head or tail), `qn` is empty and `qn_label` blank.
 */
export type TemplateBag = Pick<QuizBag, 'hunt' | 'realm' | 'categories' | 'quiz' | 'qns' | 'qn' | 'qn_label' | 'quiz_label'>

/** What a column's template reads: the question's template bag, and the value the column's formula came to, as `value` */
export type ValuedBag = TemplateBag & { value: unknown }

/**
 * A template filled in: `markdown` is what it came to, or, when it could not be filled, the
 * template as typed, with `issue` saying why. Either way `markdown` is ready for the parser.
 */
export type FilledT = {
  markdown: string
  issue:    string | null
}

export { FillBudget, FilledMax, ShapedMax } from './liquidry'

/** A filter of the app's: a value, as it would fill in, shaped */
export type HelperT = Liquidry.ShaperT

/**
 * The app's text filters, by name, each shaping a value as it would fill in (`Shaping`):
 *
 * - `quote` -- to follow a `> ` the template opened: every line after the first opens `> `, so a
 *   many-lined text stays in its quote (`Shaping.quotedOf`).
 * - `oneline` -- on one line, the lines joined by a space (`Shaping.oneLineOf`).
 * - `apart` -- safe on the line straight after another: a first line of `---` or `===` is set a
 *   blank line apart, so it never makes the line above a heading (`Shaping.belowOf`).
 *
 * A text built of several, `{% capture %}`d first, is shaped as one. Frozen.
 *
 * @example fill('> {{ qn.clueing | quote }}', bag).markdown  // => '> Who?\n> When?'
 * @example fill('{{ qn.full_answer | oneline }}', bag).markdown  // => 'HAMILTON (accept ROWAN)'
 */
export const Helpers: Readonly<Record<string, HelperT>> = Object.freeze({
  quote:   Shaping.quotedOf,
  oneline: Shaping.oneLineOf,
  apart:   Shaping.belowOf,
})

/**
 * `qns` in the order a recap reads them, each numbered (`number`, from 1) by its place there: the
 * questions with a rank (a Q#) in rank order, then those without one that hold a clueing, in their
 * own order. Alternates (`secondary`) and the archived are left out. Anything in the list that is
 * not a question is passed over. The `in_order` filter: `{% assign played = qns | in_order %}`.
 *
 * @example inOrder(bag.qns).map((qn) => [qn.number, qn.rank])  // => [[1, 1], [2, 2], [3, null]]
 */
export function inOrder(qns: unknown): Record<string, unknown>[] {
  if (! Array.isArray(qns)) { return [] }
  const played = qns.filter((qn): qn is Record<string, unknown> => EST.isPlainObject(qn) && qn[SecondaryField] !== true && qn[ArchivedField] !== true)
  const ranked = EST.sortBy(played.filter((qn) => typeof qn[RankField] === 'number'), [(qn) => qn[RankField] as number])
  const unranked = played.filter((qn) => typeof qn[RankField] !== 'number' && typeof qn.clueing === 'string' && qn.clueing.trim() !== '')
  return [...ranked, ...unranked].map((qn, idx) => ({ ...qn, [PlaceField]: idx + 1 }))
}

/** The language every field and recap template is read and filled in with: Liquid, with the app's filters, a value filling in as `fillingOf` says */
const Renderer = Liquidry.rendererFor({ fillingOf, shapers: Helpers, filters: { in_order: inOrder } })

/**
 * `template` filled in over `bag`, or the template as typed with what is wrong with it.
 *
 * Nothing is escaped or cleaned: a string fills in as it is, a number or a yes-or-no as its text,
 * a widgeted (`{{ qn.my_column }}`) as its value's text (nothing, when it has none), and anything
 * else as its JSON. A key the bag lacks fills in as nothing. Never throws.
 *
 * @param template - A field's text, as typed.
 * @param bag - What it reads (`bagOf`).
 * @returns Markdown, for the parser and then the sanitizer.
 *
 * @example fill('By {{ qn.author }}', bag)                         // => { markdown: 'By Ada', issue: null }
 * @example fill('{{ qn.size }} words', bag)                        // => { markdown: '30 words', issue: null }   (a widgeted's value)
 * @example fill('{% for qn in qns %}{{ qn.title }} {% endfor %}', bag)  // => { markdown: 'One Two ', issue: null }
 * @example fill('{% if qn.hint %}', bag)                            // => { markdown: '{% if qn.hint %}', issue: 'tag {% if qn.hint %} not closed, line:1, col:1' }
 */
export function fill(template: string, bag: TemplateBag): FilledT {
  const { text, issue } = Renderer.render(template, bag)
  return { markdown: text, issue }
}

/**
 * What is wrong with `template` as a field template, or null when nothing is: one that does not
 * read as Liquid, names a filter there is none of, or includes another template. What only
 * filling in can find (a template that reads too much) is `fill`'s to say.
 *
 * @example issueOf('{% if qn.hint %}')          // => 'tag {% if qn.hint %} not closed, line:1, col:1'
 * @example issueOf('{{ qn.hint | shout }}')     // => 'undefined filter: shout, line:1, col:1'
 * @example issueOf('{% include "footer" %}')    // => '{% include %} includes another template, and there are none to include, line:1, col:1'
 * @example issueOf('By {{ qn.author }}')        // => null
 */
export function issueOf(template: string): string | null {
  return Renderer.issueOf(template)
}

/**
 * What a template reads for one question of a run, or for none (`question_id` null): the run's
 * place, the hunt's categories and the quiz, and its questions as they stand once every widgeting
 * has run, so a template sees every column -- in `qns` those a screen shows (all but the
 * archived), in `quiz.questions` every one. `qn` is the question itself, archived or not. An image
 * in a formula's or a bot's column comes as a link to it (`imagesLinkedOf`). The one place a
 * template's bag is made; widen it here.
 *
 * @param run - The quiz, run.
 * @param question_id - The question the text is a field of; null for a text of the quiz's own.
 * @returns The bag. A question the run does not hold reads as no question.
 *
 * @example bagOf(run, question._id).qn.clueing   // => 'Who?'
 * @example bagOf(run, null).qn                   // => {}
 * @example bagOf(run, null).qns.length           // => 3   (and `quiz.questions` 4, with the one archived)
 */
export function bagOf(run: QuizRun, question_id: string | null): TemplateBag {
  return bagOver(run, run.qnsAfter, question_id)
}

/**
 * What a text of the quiz's own reads (the recap's head, tail and template): `bagOf(run, null)`,
 * but with every question's templateable texts (`quiz.templateable`: its own fields, and text
 * entries) filled in, each over its own question's bag (`finishedQnsOf`), as the grid shows them.
 * Filled once: a template a filled text comes to is not filled again, and one that cannot be
 * filled stays as typed.
 *
 * @param quiz - The quiz: which of its texts it nominates as templateable.
 * @param run - Its run.
 * @returns The bag, `qns` and `quiz.questions` holding the questions filled in.
 *
 * @example filledBagOf(quiz, run).qns[0].clueing  // => 'By Ada'   (typed as 'By {{qn.author}}')
 */
export function filledBagOf(quiz: Pick<QuizT, 'templateable'>, run: QuizRun): TemplateBag {
  if (quiz.templateable.length === 0) { return bagOf(run, null) }
  return bagOver(run, finishedQnsOf(run, quiz.templateable), null)
}

/**
 * What a column's template reads for one question: the question's template bag over the finished
 * bag (its questions' templateable sources filled in, `finishedQnsOf`), with the value the
 * column's formula came to beside the bag's own words as `value`.
 *
 * @param run - The quiz, run.
 * @param templateable - What the quiz nominates as templateable.
 * @param question_id - The question the cell is in.
 * @param value - What the column's formula came to, or the thing its ref picked.
 * @returns The bag.
 *
 * @example fill('{{ value }}%', valuedBagOf(run, [], question._id, 53)).markdown  // => '53%'
 * @example valuedBagOf(run, ['clueing'], question._id, null).qn.clueing             // => 'By Ada'   (typed as 'By {{qn.author}}')
 */
export function valuedBagOf(run: QuizRun, templateable: readonly string[], question_id: string, value: unknown): ValuedBag {
  return { ...bagOver(run, finishedQnsOf(run, templateable), question_id), value }
}

/** What `finishedQnsOf` made, by the run, and by the sources filled */
const FinishedOf = new WeakMap<QuizRun, Map<string, readonly Record<string, unknown>[]>>()

/**
 * Every question of the run as the finished bag holds it: as the last widgeting left it, with
 * each source `templateable` names filled in over the question's own template bag (`bagOf`): a
 * field, or a text entry's widgeted's value. The one place a templateable source is filled; made
 * once per run. Anything else named, or not text, is left as it is.
 *
 * @param run - The quiz, run.
 * @param templateable - What the quiz nominates as templateable.
 * @returns The questions, in the run's order; the run's own when nothing is nominated.
 *
 * @example finishedQnsOf(run, ['clueing'])[0].clueing  // => 'By Ada'   (typed as 'By {{qn.author}}')
 */
export function finishedQnsOf(run: QuizRun, templateable: readonly string[]): readonly Record<string, unknown>[] {
  if (templateable.length === 0) { return run.qnsAfter }
  const known = FinishedOf.get(run) ?? new Map<string, readonly Record<string, unknown>[]>()
  FinishedOf.set(run, known)
  const key = templateable.join('\n')
  const held = known.get(key)
  if (held !== undefined) { return held }
  const finished = run.qnsAfter.map((qn, idx) => filledQnOf(templateable, qn, bagOf(run, run.frame.question_ids[idx] ?? null)))
  known.set(key, finished)
  return finished
}

/** The template bag over `questions` (every question of the run, in its order) for `question_id`, or for none */
function bagOver(run: QuizRun, questions: readonly Record<string, unknown>[], question_id: string | null): TemplateBag {
  const { frame } = run
  const idx = question_id === null ? -1 : frame.question_ids.indexOf(question_id)
  const { quiz, every } = imagesLinkedOf(run, questions)
  return {
    hunt:       frame.hunt,
    realm:      frame.realm,
    categories: frame.categories,
    quiz:       { ...quiz, questions: every },
    qns:        every.filter((qn) => qn[ArchivedField] !== true),
    qn:         every[idx] ?? {},
    qn_label:   frame.qn_labels[idx] ?? '',
    quiz_label: frame.quiz_label,
  }
}

/** The formularies whose columns are worked out, not typed: a formula's and a bot's */
const ComputedFormularies: ReadonlySet<Formularykind> = new Set(['jsonata', 'aibot'])

/**
 * Whether what `widget` comes to is worked out rather than typed (a formula's or a bot's), and so
 * reaches markdown with its images made links (`imagesLinkedIn`).
 *
 * @example computes(Widget.fill({ label: 'sizer', formulary: 'jsonata', formula: '1' }))  // => true
 * @example computes(Widget.fill({ label: 'authors', formulary: 'entry', config: { entry_kind: 'text' } }))  // => false
 * @example computes(null)  // => false
 */
export function computes(widget: Pick<WidgetT, 'formulary'> | null): boolean {
  return widget !== null && ComputedFormularies.has(widget.formulary)
}

/** What `imagesLinkedOf` made, by the questions it was made from, so a run's is made once however many cells read it */
const LinkedOf = new WeakMap<readonly Record<string, unknown>[], { quiz: Record<string, unknown>, every: Record<string, unknown>[] }>()

/**
 * The run's quiz and `questions` as a template reads them: in each computed column's widgeted (a
 * formula's or a bot's, never an entry's or a field), every image is a link to it (`![alt](src)`
 * becomes `&#33;[alt](src)`, a `!` and then a link), so a value a template fills in can make no
 * browser fetch from an address it chose. Typed text keeps its images. Formulas read the run
 * itself, untouched.
 */
function imagesLinkedOf(run: QuizRun, questions: readonly Record<string, unknown>[]): { quiz: Record<string, unknown>, every: Record<string, unknown>[] } {
  const known = LinkedOf.get(questions)
  if (known !== undefined) { return known }
  const computed = run.steps.filter(({ widget }) => computes(widget))
  const labelsAt = (tier: string) => computed.filter(({ widgeting }) => widgeting.tier === tier).map(({ widgeting }) => widgeting.label)
  const linked = { quiz: labelsLinkedIn(run.frame.quiz, labelsAt('quiz')), every: questions.map((qn) => labelsLinkedIn(qn, labelsAt('question'))) }
  LinkedOf.set(questions, linked)
  return linked
}

/** `held` with what each of `labels` holds imagesLinkedIn; `held` itself when it holds none of them */
function labelsLinkedIn(held: Record<string, unknown>, labels: readonly string[]): Record<string, unknown> {
  const present = labels.filter((label) => Object.hasOwn(held, label))
  if (present.length === 0) { return held }
  return { ...held, ...Object.fromEntries(present.map((label) => [label, imagesLinkedIn(held[label])])) }
}

/**
 * `val` with every `![` in every string it holds written `&#33;[`: the `!` as a character
 * reference, which markdown reads as the character and never as the start of an image. What a
 * formula or a bot came to is drawn as markdown only so.
 *
 * @example imagesLinkedIn({ value: ['![map](https://host/m.png)'] })  // => { value: ['&#33;[map](https://host/m.png)'] }
 */
export function imagesLinkedIn(val: unknown): unknown {
  if (typeof val === 'string') { return val.replaceAll('![', '&#33;[') }
  if (Array.isArray(val)) { return val.map((each) => imagesLinkedIn(each)) }
  if (typeof val === 'object' && val !== null) { return Object.fromEntries(Object.entries(val).map(([key, each]) => [key, imagesLinkedIn(each)])) }
  return val
}

/**
 * One question of a bag with each of its texts `templateable` names filled in over `bag`, its
 * own: a field (`clueing`) or a text entry, whose widgeted's value is filled in. Anything else
 * named, or not text, is left as it is.
 */
function filledQnOf(templateable: readonly string[], qn: Record<string, unknown>, bag: TemplateBag): Record<string, unknown> {
  const filled = templateable.flatMap((source): [string, unknown][] => {
    const held = qn[source]
    if (isTemplatableField(source)) { return typeof held === 'string' ? [[source, fill(held, bag).markdown]] : [] }
    return isWidgeted(held) && typeof held.value === 'string' ? [[source, { ...held, value: fill(held.value, bag).markdown }]] : []
  })
  return filled.length === 0 ? qn : { ...qn, ...Object.fromEntries(filled) }
}

/**
 * Whether `quiz` nominates `source` as templateable: a question's field (`clueing`) or a
 * widgeting's label.
 *
 * @example templates({ templateable: ['clueing'] }, 'clueing')  // => true
 * @example templates({ templateable: ['clueing'] }, 'hint')     // => false
 */
export function templates(quiz: Pick<QuizT, 'templateable'>, source: string): boolean {
  return quiz.templateable.includes(source)
}

/** One source a quiz may nominate as templateable, and what an author calls it */
export type TemplatableSourceT = {
  source: string
  title:  string
}

/**
 * The sources a quiz may nominate as templateable, in the order an author is offered them: each
 * of its questions' fields an author writes markdown into, then each widgeting for each question
 * typed into as text, in run order, and any other such widgeting the quiz already nominates, so
 * it can be let go.
 *
 * @param quiz - The quiz: its widgetings, and what it nominates now.
 * @param library - The library's widgets, which say what each widgeting is.
 * @returns The sources, each with its title.
 *
 * @example templatableSources(quiz, library).map(({ source }) => source)
 *   // => ['clueing', 'hint', 'full_answer', 'notes', 'recap', 'author']
 */
export function templatableSources(quiz: Pick<QuizT, 'widgetings' | 'templateable'>, library: readonly WidgetT[]): TemplatableSourceT[] {
  const widgetFor = new Map(library.map((widget) => [widget.label, widget]))
  const isText = (widget: WidgetT | undefined) => widget?.formulary === 'entry' && widget.config.entry_kind === 'text'
  const fields = TemplatableFieldVals.map((field) => ({ source: field, title: Labelmaker.titleize(field) }))
  const widgetings = quiz.widgetings
    .filter((widgeting) => widgeting.tier === 'question')
    .filter((widgeting) => isText(widgetFor.get(widgeting.widget_label)) || templates(quiz, widgeting.label))
    .map((widgeting) => ({ source: widgeting.label, title: Labelmaker.titleize(widgeting.label) }))
  return [...fields, ...widgetings]
}

/**
 * `quiz` with each of its questions' templateable fields filled in over its run, for an export to
 * read as it reads any quiz. A field that cannot be filled keeps its text as typed. Widgetings'
 * cells are left as they are.
 *
 * @param quiz - The quiz, as run.
 * @param run - Its run.
 * @returns The quiz; the very same object when it nominates none of its questions' fields.
 *
 * @example filledQuiz(quiz, run).questions[0].clueing  // => 'By Ada'   (typed as 'By {{qn.author}}')
 */
export function filledQuiz(quiz: QuizT, run: QuizRun): QuizT {
  const fields = TemplatableFieldVals.filter((field) => templates(quiz, field))
  if (fields.length === 0) { return quiz }
  const questions = quiz.questions.map((question): QuestionT => {
    const bag = bagOf(run, question._id)
    const filled = Object.fromEntries(fields.map((field) => [field, fill(question[field], bag).markdown]))
    return { ...question, ...filled }
  })
  return { ...quiz, questions }
}

/** What one value fills in as: nothing for none, a string as it is, a widgeted as its value's text, anything else as its text or JSON */
function fillingOf(val: unknown): string {
  if (val === null || val === undefined) { return '' }
  if (typeof val === 'string') { return val }
  if (typeof val === 'number' || typeof val === 'boolean') { return String(val) }
  if (isWidgeted(val)) { return Widgeted.textOf(val) }
  return UU.jsonify(val)
}

/** Whether `val` is a widgeted, as the bag holds one under a widgeting's label */
function isWidgeted(val: unknown): val is WidgetedT {
  return typeof val === 'object' && val !== null && Object.hasOwn(val, 'status') && Object.hasOwn(val, 'value')
}
