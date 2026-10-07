import Mustache, { type PartialsOrLookupFn, type RenderOptions, type TemplateSpans } from 'mustache'
import * as UU from './useful'
import * as Labelmaker from './labelmaker'
import * as Shaping from './shaping'
import type { QuizBag, QuizRun } from './formulary/runner'
import { QuestionWidgetLabel } from '../models/column'
import { Widgeted, type WidgetedT } from '../models/widgeted'
import { TemplatableFieldVals, type QuizT, type TemplatableField } from '../models/quiz'
import type { QuestionT } from '../models/question'
import type { WidgetT } from '../models/widget'

/**
 * Field templates: a field's markdown filled in, by mustache, over the quiz's bag, before
 * anything reads it as markdown.
 *
 * Filling cleans nothing. What a template comes to is markdown, and goes on, whole, to the
 * markdown parser and then to the sanitizer, which is always the last step: on screen
 * `react-markdown` and `rehype-sanitize` (`Markdown.TemplatedRenderOptions`), on the board
 * `Bbjank.toBbjank`. So a value holding `<script>` is shown as the characters typed, and a value
 * holding `**bold**` is bold, since it was filled in before the parser read it.
 *
 * Every template may also call the app's few **helpers** (`Helpers`), each only as a section:
 * `{{#quote}}{{clueing}}{{/quote}}` fills the section in, then shapes what it came to.
 */

/**
 * What a template reads: the bag a formula reads, less what only a running widgeting has (its
 * `params` and `widgeting_label`). Each question carries the widgeted of every widgeting of the
 * quiz, under its label. For a text of the quiz's own (a recap's head or tail), `qn` is empty
 * and `qn_label` blank.
 */
export type TemplateBag = Pick<QuizBag, 'hunt' | 'realm' | 'quiz' | 'qns' | 'qn' | 'qn_label' | 'quiz_label'>

/**
 * A template filled in: `markdown` is what it came to, or, when it could not be filled, the
 * template as typed, with `issue` saying why. Either way `markdown` is ready for the parser.
 */
export type FilledT = {
  markdown: string
  issue:    string | null
}

/**
 * The most lookups and passes through a section one fill may make: past this, a template nesting
 * a list in a list in a list is stopped rather than left to hang the page.
 */
export const FillBudget = 10_000

/**
 * The longest a filled template may come to; anything longer is refused rather than drawn. What
 * its tags fill in is counted as it goes, so a tag filling in a whole list's JSON, again and
 * again, is stopped before it is built.
 */
export const FilledMax = 100_000

/** Said when a fill is stopped for spending more than `FillBudget` */
const OverBudget = 'This template reads too much: a list inside a list inside a list, perhaps.'

/** Said when a fill comes to more than `FilledMax` characters */
const OverLong = 'This template comes to far too much text to show.'

/** What one fill has left: lookups and section passes, shared by every context it pushes, and characters its tags may fill in */
type Budget = { left: number, charsLeft: number }

/** A helper: what a section it is called as came to, filled in, and that shaped */
export type HelperT = (filled: string) => string

/**
 * The template helpers, by name: the only code a template can reach, and only as a section,
 * `{{#name}}..{{/name}}`, whose filling the helper shapes (`Shaping`).
 *
 * - `quote` -- to follow a `> ` the template opened: every line after the first opens `> `, so a
 *   many-lined text stays in its quote (`Shaping.quotedOf`).
 * - `oneline` -- on one line, the lines joined by a space (`Shaping.oneLineOf`).
 * - `apart` -- safe on the line straight after another: a first line of `---` or `===` is set a
 *   blank line apart, so it never makes the line above a heading (`Shaping.belowOf`).
 *
 * A section named for a helper always calls the helper, whatever the bag holds under that name; a
 * section whose closing tag stands on a line of its own keeps its last line break. The bare names
 * are the helpers' alone: `{{quote}}` fills in nothing, and `{{^quote}}` always shows, whatever
 * the bag holds. A key that only starts with one (`{{oneline.full_answer}}`) reads the bag as ever.
 * Frozen, and only ever looked up by its own keys: nothing in the bag is ever called.
 *
 * @example fill('> {{#quote}}{{qn.clueing}}{{/quote}}', bag).markdown  // => '> Who?\n> When?'
 * @example fill('{{#oneline}}{{qn.full_answer}}{{/oneline}}', bag).markdown  // => 'HAMILTON (accept ROWAN)'
 */
export const Helpers: Readonly<Record<string, HelperT>> = Object.freeze({
  quote:   Shaping.quotedOf,
  oneline: Shaping.oneLineOf,
  apart:   Shaping.belowOf,
})

/** The helper `name` names, if any: only the registry's own keys */
function helperFor(name: string): HelperT | undefined {
  return Object.hasOwn(Helpers, name) ? Helpers[name] : undefined
}

/** A section as mustache parses it: its kind, its name, where its opening tag begins and ends, its tokens, and where its closing tag begins */
type SectionTokenT = [string, string, number, number, string[][], number]

/**
 * Mustache's writer, with a section named for a helper (`Helpers`) filled in, then handed to the
 * helper, in place of reading the bag.
 */
class FillWriter extends Mustache.Writer {
  override renderSection(token: string[], context: Mustache.Context, partials?: PartialsOrLookupFn, typed?: string, config?: RenderOptions): string {
    const helper = helperFor(token[1] ?? '')
    if (helper === undefined) { return super.renderSection(token, context, partials, typed, config) }
    const section = token as unknown as SectionTokenT
    const filled = this.renderTokens(section[4], context, partials, typed, config)
    const linebreak = typed?.slice(section[3], section[5]).endsWith('\n') ? '\n' : ''
    return (context as BagContext).shape(helper, filled) + linebreak
  }
}

/**
 * The writer every template is parsed and filled with: templating's own, its cache emptied after
 * each use. A face fills its text in on every keystroke, and mustache's shared cache would keep
 * every draft for as long as the page is open.
 */
const Filler = new FillWriter()

/** Spends one of `budget`, or stops the fill when none is left */
function spend(budget: Budget): void {
  budget.left -= 1
  if (budget.left < 0) { throw new Error(OverBudget) }
}

/** `filling`, once counted against the characters `budget` has left to fill in; stops the fill when it comes to too much */
function spendChars(budget: Budget, filling: string): string {
  budget.charsLeft -= filling.length
  if (budget.charsLeft < 0) { throw new Error(OverLong) }
  return filling
}

/**
 * The context a template is rendered in: a key reads only what the bag itself holds at that key,
 * never anything a JavaScript object inherits (`constructor`, `toString`, an array's `map`), and a
 * value that is a function is never called. A helper's bare name reads as nothing. Every lookup,
 * every pass through a section, and every helper called counts against one shared budget, and what
 * a helper adds counts against the characters left.
 */
class BagContext extends Mustache.Context {
  private readonly budget: Budget

  constructor(view: unknown, parent: BagContext | undefined, budget: Budget) {
    super(view, parent)
    this.budget = budget
  }

  /** The context at the top of a fill over `bag`, spending `budget` */
  static over(bag: TemplateBag, budget: Budget): BagContext {
    return new BagContext(bag, undefined, budget)
  }

  override push(view: unknown): BagContext {
    spend(this.budget)
    return new BagContext(view, this, this.budget)
  }

  override lookup(dotkey: string): unknown {
    spend(this.budget)
    if (dotkey === '.') { return this.view }
    if (helperFor(dotkey) !== undefined) { return undefined }
    const found = ownAt(this.view, dotkey.split('.'))
    if (found.held) { return typeof found.val === 'function' ? undefined : found.val }
    return this.parent?.lookup(dotkey)
  }

  /** What `helper` makes of `filled`, spending one of the budget, and whatever it adds from the characters left */
  shape(helper: HelperT, filled: string): string {
    spend(this.budget)
    const shaped = helper(filled)
    this.budget.charsLeft -= Math.max(0, shaped.length - filled.length)
    if (this.budget.charsLeft < 0) { throw new Error(OverLong) }
    return shaped
  }
}

/** What `keypath` reaches in `view`, walking only the bag's own keys of its objects and lists */
function ownAt(view: unknown, keypath: readonly string[]): { held: boolean, val: unknown } {
  let val = view
  for (const key of keypath) {
    if (typeof val !== 'object' || val === null || ! Object.hasOwn(val, key)) { return { held: false, val: undefined } }
    val = (val as Record<string, unknown>)[key]
  }
  return { held: true, val }
}

/**
 * `template` filled in over `bag`, or the template as typed with what is wrong with it.
 *
 * Nothing is escaped or cleaned: a string fills in as it is, a number or a yes-or-no as its text,
 * a widgeted (`{{qn.my_column}}`) as its value's text (nothing, when it has none), and anything
 * else as its JSON. A key the bag lacks fills in as nothing. Sections (`{{#qns}}..{{/qns}}`) and
 * inverted sections work as mustache has them. Never throws.
 *
 * @param template - A field's text, as typed.
 * @param bag - What it reads (`bagOf`).
 * @returns Markdown, for the parser and then the sanitizer.
 *
 * @example fill('By {{qn.author}}', bag)            // => { markdown: 'By Ada', issue: null }
 * @example fill('{{qn.size}} words', bag)           // => { markdown: '30 words', issue: null }   (a widgeted's value)
 * @example fill('{{#qns}}{{title}} {{/qns}}', bag)  // => { markdown: 'One Two ', issue: null }
 * @example fill('{{#qns}}', bag)                    // => { markdown: '{{#qns}}', issue: 'Unclosed section "qns" at 8' }
 */
export function fill(template: string, bag: TemplateBag): FilledT {
  const issue = issueOf(template)
  if (issue !== null) { return { markdown: template, issue } }
  const budget: Budget = { left: FillBudget, charsLeft: FilledMax }
  try {
    const markdown = Filler.render(template, BagContext.over(bag, budget), undefined, { escape: (val: unknown) => spendChars(budget, fillingOf(val)) })
    return markdown.length > FilledMax ? { markdown: template, issue: OverLong } : { markdown, issue: null }
  } catch (err) {
    return { markdown: template, issue: err instanceof Error ? err.message : OverBudget }
  } finally {
    Filler.clearCache()
  }
}

/**
 * What is wrong with `template` as a field template, or null when nothing is: one that does not
 * parse; one that fills a key in raw (`{{{name}}}`, `{{&name}}`), which would fill a widgeted in as
 * `[object Object]` and is never needed, since nothing is escaped; one that includes another
 * template (`{{> name}}`), which there is none of.
 *
 * @example issueOf('{{#qns}}{{title}}')       // => 'Unclosed section "qns" at 17'
 * @example issueOf('{{{qn.author}}}')         // => '{{{qn.author}}} is not needed: write {{qn.author}}, which fills in text as it is'
 * @example issueOf('{{> footer}}')            // => '{{> footer}} includes another template, and there are none to include'
 * @example issueOf('By {{qn.author}}')        // => null
 */
export function issueOf(template: string): string | null {
  try {
    const unparsed = parseIssue(template)
    if (unparsed !== null) { return unparsed }
    const refused = spansOf(parsed(template)).find(([spankind]) => spankind === '&' || spankind === '>')
    if (refused === undefined) { return null }
    const [spankind, key, beg, end] = refused
    const typed = template.slice(beg, end)
    return spankind === '&'
      ? `${typed} is not needed: write {{${key}}}, which fills in text as it is`
      : `${typed} includes another template, and there are none to include`
  } finally {
    Filler.clearCache()
  }
}

/**
 * What a template reads for one question of a run, or for none (`question_id` null): the run's
 * place and quiz, and every question as it stands once every widgeting has run, so a template sees
 * every column. The one place a template's bag is made; widen it here.
 *
 * @param run - The quiz, run.
 * @param question_id - The question the text is a field of; null for a text of the quiz's own.
 * @returns The bag. A question the run does not hold reads as no question.
 *
 * @example bagOf(run, question._id).qn.clueing   // => 'Who?'
 * @example bagOf(run, null).qn                   // => {}
 */
export function bagOf(run: QuizRun, question_id: string | null): TemplateBag {
  const { frame } = run
  const idx = question_id === null ? -1 : frame.question_ids.indexOf(question_id)
  return {
    hunt:       frame.hunt,
    realm:      frame.realm,
    quiz:       frame.quiz,
    qns:        run.qnsAfter as Record<string, unknown>[],
    qn:         run.qnsAfter[idx] ?? {},
    qn_label:   frame.qn_labels[idx] ?? '',
    quiz_label: frame.quiz_label,
  }
}

/**
 * The source string by which a quiz nominates a question's own field for templating, as a
 * column names it.
 *
 * @example sourceOfField('clueing')  // => 'question.clueing'
 */
export function sourceOfField(field: TemplatableField): string {
  return `${QuestionWidgetLabel}.${field}`
}

/**
 * Whether `quiz` templates `source`: a question's field (`question.clueing`) or a widgeting's label.
 *
 * @example templates({ templated: ['question.clueing'] }, 'question.clueing')  // => true
 * @example templates({ templated: ['question.clueing'] }, 'question.hint')     // => false
 */
export function templates(quiz: Pick<QuizT, 'templated'>, source: string): boolean {
  return quiz.templated.includes(source)
}

/** One source a quiz may template, and what an author calls it */
export type TemplatableSourceT = {
  source: string
  title:  string
}

/**
 * The sources a quiz may nominate for templating, in the order an author is offered them: each
 * of its questions' fields an author writes markdown into, then each widgeting for each question
 * typed into as text, in run order, and any other such widgeting the quiz already templates, so it
 * can be let go.
 *
 * @param quiz - The quiz: its widgetings, and what it templates now.
 * @param library - The library's widgets, which say what each widgeting is.
 * @returns The sources, each with its title.
 *
 * @example templatableSources(quiz, library).map(({ source }) => source)
 *   // => ['question.clueing', 'question.hint', 'question.full_answer', 'question.notes', 'question.recap', 'author']
 */
export function templatableSources(quiz: Pick<QuizT, 'widgetings' | 'templated'>, library: readonly WidgetT[]): TemplatableSourceT[] {
  const widgetFor = new Map(library.map((widget) => [widget.label, widget]))
  const isText = (widget: WidgetT | undefined) => widget?.formulary === 'entry' && widget.config.entry_kind === 'text'
  const fields = TemplatableFieldVals.map((field) => ({ source: sourceOfField(field), title: Labelmaker.titleize(field) }))
  const widgetings = quiz.widgetings
    .filter((widgeting) => widgeting.tier === 'question')
    .filter((widgeting) => isText(widgetFor.get(widgeting.widget_label)) || templates(quiz, widgeting.label))
    .map((widgeting) => ({ source: widgeting.label, title: Labelmaker.titleize(widgeting.label) }))
  return [...fields, ...widgetings]
}

/**
 * `quiz` with each of its questions' templated fields filled in over its run, for an export to
 * read as it reads any quiz. A field that cannot be filled keeps its text as typed. Widgetings'
 * cells are left as they are.
 *
 * @param quiz - The quiz, as run.
 * @param run - Its run.
 * @returns The quiz; the very same object when it templates none of its questions' fields.
 *
 * @example filledQuiz(quiz, run).questions[0].clueing  // => 'By Ada'   (typed as 'By {{qn.author}}')
 */
export function filledQuiz(quiz: QuizT, run: QuizRun): QuizT {
  const fields = TemplatableFieldVals.filter((field) => templates(quiz, sourceOfField(field)))
  if (fields.length === 0) { return quiz }
  const questions = quiz.questions.map((question): QuestionT => {
    const bag = bagOf(run, question._id)
    const filled = Object.fromEntries(fields.map((field) => [field, fill(question[field], bag).markdown]))
    return { ...question, ...filled }
  })
  return { ...quiz, questions }
}

/** What one value fills in as: a string as it is, a widgeted as its value's text, anything else as its text or JSON */
function fillingOf(val: unknown): string {
  if (typeof val === 'string') { return val }
  if (typeof val === 'number' || typeof val === 'boolean') { return String(val) }
  if (isWidgeted(val)) { return Widgeted.textOf(val) }
  return UU.jsonify(val)
}

/** Whether `val` is a widgeted, as the bag holds one under a widgeting's label */
function isWidgeted(val: unknown): val is WidgetedT {
  return typeof val === 'object' && val !== null && Object.hasOwn(val, 'status') && Object.hasOwn(val, 'value')
}

/** `template`, parsed by templating's own writer */
function parsed(template: string): TemplateSpans {
  return Filler.parse(template) as TemplateSpans
}

/** Why `template` does not parse as mustache, or null when it does */
function parseIssue(template: string): string | null {
  try {
    parsed(template)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'This does not read as a template'
  }
}

/** Every span of a parsed template, its sections' spans included */
function spansOf(spans: TemplateSpans): TemplateSpans {
  return spans.flatMap((span) => {
    const inner = span[4]
    return Array.isArray(inner) ? [span, ...spansOf(inner)] : [span]
  })
}
