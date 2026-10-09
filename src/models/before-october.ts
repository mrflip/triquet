import * as Estimates from '../lib/estimates'
import * as Labelmaker from '../lib/labelmaker'
import { QuestionFieldVals, QuestionViewVals, QuizRefPrefix } from './column'
import { CategoryDataLabel } from './seeds'

// What the tool called things before October 2026 that it calls otherwise now, as the importer
// reads them, for good: an export is a promise. A column's source said `question.<field>` for a
// question's own field or view, and `<widgeting>.<part>` for one part of what a category-estimate
// entry came to; a quiz nominated what it templated (`templated`) the same way; and the seeded
// category-estimate entry, and the widgetings working it, were labelled `categories`. The
// columnwise sprint's backfills rewrote the database's rows so (`notes/deploy.md`, the ledger's
// `20261008-cw_widen`); nothing else reads this grammar.

/** What the grammar before October 2026 called the questions' own fields in a source: `question.title` */
export const QuestionWidgetLabel = 'question'

/** Whether `word` is one of `vals` */
function isOneOf(vals: readonly string[], word: string): boolean {
  return vals.includes(word)
}

/**
 * A source in the grammar before October 2026, read as the plain ref and formula it is now: a
 * question's field or view by its name, a part of a widgeting as the widgeting with a formula
 * naming the part. Null for a source that is not in that grammar.
 *
 * @example beforeOctoberOf('question.clueing')   // => { source: 'clueing', formula: null }
 * @example beforeOctoberOf('categories.masie')   // => { source: 'categories', formula: '$.masie' }
 * @example beforeOctoberOf('dumdum')             // => null
 */
export function beforeOctoberOf(source: string): { source: string, formula: string | null } | null {
  const [head = '', tail, ...more] = source.split('.')
  if (tail === undefined || more.length > 0) { return null }
  if (head === QuestionWidgetLabel) {
    return isOneOf(QuestionFieldVals, tail) || isOneOf(QuestionViewVals, tail) ? { source: tail, formula: null } : null
  }
  const part = `${head}.` === QuizRefPrefix ? null : Estimates.partOf(`$.${tail}`)
  return part === null ? null : { source: head, formula: Estimates.partFormulaOf(part) }
}

/**
 * A column's source and formula in the plain grammar: as they are, or, for a source in the
 * grammar before October 2026, translated (`beforeOctoberOf`). What the importer reads an older
 * export's columns as.
 *
 * @example plainOf({ source: 'categories.average' })                // => { source: 'categories', formula: '$.average' }
 * @example plainOf({ source: 'dumdum', formula: '$.value.guess' })  // => { source: 'dumdum', formula: '$.value.guess' }
 */
export function plainOf(column: { source: string, formula?: string }): { source: string, formula?: string } {
  const translated = beforeOctoberOf(column.source)
  const formula = translated?.formula ?? column.formula
  return { source: translated?.source ?? column.source, ...(formula !== undefined && { formula }) }
}

/**
 * What a quiz nominated as templateable, read from its `templated` in the grammar before October
 * 2026: a question's field named `question.<field>` by its name, a widgeting's label as it is.
 *
 * @example templateableFrom(['question.clueing', 'author'])  // => ['clueing', 'author']
 */
export function templateableFrom(templated: readonly string[]): string[] {
  return templated.map((source) => beforeOctoberOf(source)?.source ?? source)
}

/**
 * What the seeded category-estimate entry was labelled before October 2026, and so the widgetings
 * that worked it: a word at the bag's top level since, the hunt's categories, which no widgeting
 * may shadow.
 */
export const CategoriesWidgetLabel = 'categories'

/** The description the seeded category-estimate entry had before October 2026, which an import writes as the seed's now */
export const CategoriesDescription = "Which subject categories a question draws on, each at a difficulty: a pill for each. Columns can show the list, or Masie's, Artie's and Poppy's chances at the question and their average, read against the hunt's wheel (`categories.masie` and the like); a formula reads them as `qn.categories.masie`."

/**
 * The label a widgeting, or a widget, labelled `label` before October 2026 goes by now:
 * `categories` is `category_data`, and `categories_<n>` (as a second one was named) is
 * `category_data_<n>`. Null for any other label, which is unchanged.
 *
 * @example categoryDataOf('categories')    // => 'category_data'
 * @example categoryDataOf('categories_2')  // => 'category_data_2'
 * @example categoryDataOf('dumdum')        // => null
 */
export function categoryDataOf(label: string): string | null {
  if (label === CategoriesWidgetLabel) { return CategoryDataLabel }
  const nth = label.startsWith(`${CategoriesWidgetLabel}_`) ? label.slice(CategoriesWidgetLabel.length + 1) : ''
  return /^[1-9]\d*$/.test(nth) ? `${CategoryDataLabel}_${nth}` : null
}

/**
 * What each of one quiz's widgeting `labels` from before October 2026 that `categoryDataOf`
 * relabels goes by now: its label there, or, where the quiz holds that already or another of them
 * is to take it, the first free label after it (`Labelmaker.firstFree`), so no two come to share
 * one, as the backfill that rewrote the database's rows did.
 *
 * @example categoryDataLabelsFor(['categories', 'categories_2'])   // => Map { categories => category_data, categories_2 => category_data_2 }
 * @example categoryDataLabelsFor(['categories', 'category_data'])  // => Map { categories => category_data_2 }
 */
export function categoryDataLabelsFor(labels: readonly string[]): Map<string, string> {
  const kept = labels.filter((label) => categoryDataOf(label) === null)
  const labelFor = new Map<string, string>()
  for (const label of labels) {
    const relabelled = categoryDataOf(label)
    if (relabelled === null) { continue }
    const others = labels.filter((other) => other !== label).flatMap((other) => categoryDataOf(other) ?? [])
    const taken = new Set([...kept, ...others, ...labelFor.values()])
    labelFor.set(label, Labelmaker.firstFree(relabelled, taken))
  }
  return labelFor
}

/**
 * A column's `source` with the widgeting it names relabelled as `labelFor` says, in either
 * grammar: its first part, or its part after `quiz.`. Any other source is as it was.
 *
 * @example relabelledSource('categories.masie', new Map([['categories', 'category_data']]))  // => 'category_data.masie'
 * @example relabelledSource('quiz.categories_2', new Map([['categories_2', 'category_data_2']]))  // => 'quiz.category_data_2'
 */
export function relabelledSource(source: string, labelFor: ReadonlyMap<string, string>): string {
  const quizWide = source.startsWith(QuizRefPrefix)
  const [head = '', ...rest] = (quizWide ? source.slice(QuizRefPrefix.length) : source).split('.')
  const relabelled = [labelFor.get(head) ?? head, ...rest].join('.')
  return quizWide ? `${QuizRefPrefix}${relabelled}` : relabelled
}

// What a formula and a template read before the bag took the export's shape (the columnwise
// sprint's thread 10, October 2026), as the importer reads them for good and the `bagshape`
// backfill rewrote the database's: the question being worked out was `qn`, its label `qn_label`,
// the quiz's questions `qns` (a list; in a template's bag, the archived left out, and every one in
// `quiz.questions`), and the hunt's categories a list. A question is now `question`, its label
// `question_label`; `questions` holds every question by its label, and `categories` every
// category by its own. The rewrite is a heuristic, made once here, word for word, and idempotent:
// the old words are reserved from every label (`qn`, `qns`), so text that says them can mean only
// them. What it cannot rewrite is in the thread's `human/` note.

/** What a ref named the questions as before October 2026, and names them as now */
const QnsRef = 'qns'
const QuestionsRef = 'questions'

/**
 * A column's or a template source's ref, its word for the questions as it is now: `qns` is
 * `questions`, any other ref as it was.
 *
 * @example beforeOctoberRef('qns')      // => 'questions'
 * @example beforeOctoberRef('clueing')  // => 'clueing'
 */
export function beforeOctoberRef(ref: string): string {
  return ref === QnsRef ? QuestionsRef : ref
}

/** The search for the question a field of this one names, by its label, in parens: `(qns[label = $$.qn.chains_to])` */
const SearchedInParens = /\(\s*qns\s*\[\s*label\s*=\s*\$\$\.qn\.(\w+)\s*\]\s*\)/g

/** The same search, bare: `qns[label = $$.qn.chains_to]` */
const Searched = /(?<![\w$.])qns\s*\[\s*label\s*=\s*\$\$\.qn\.(\w+)\s*\]/g

// Each word of the bag where it begins a path: not inside another word, nor after a `$` or a dot,
// but for a path from the root, `$.` or `$$.`.
const QnLabelWord   = /(?:(?<![\w$.])|(?<=\$\.))qn_label(?!\w)/g
const QnsWord       = /(?:(?<![\w$.])|(?<=\$\.))qns(?!\w)/g
const CategoriesWord = /(?:(?<![\w$.])|(?<=\$\.))categories(?!\w|\.\*)/g
const QnWord        = /(?:(?<![\w$.])|(?<=\$\.))qn(?!\w)/g

/** The lookup of the question whose label `field` of this one holds: nothing for none, since `$lookup` refuses a null key */
const lookedUp = (field: string) => `(question.${field} ? $lookup(questions, question.${field}))`

/**
 * What one stretch of JSONata, outside its strings and comments, reads now: the search for a
 * question by a label a field of this one holds made a lookup; `qns` as the questions' values,
 * `questions.*`; `categories` the same; `qn_label` and `qn` spelled out.
 */
function formulaCodeOf(code: string): string {
  return code
    .replaceAll(SearchedInParens, (_whole, field: string) => lookedUp(field))
    .replaceAll(Searched, (_whole, field: string) => lookedUp(field))
    .replaceAll(QnLabelWord, 'question_label')
    .replaceAll(QnsWord, 'questions.*')
    .replaceAll(CategoriesWord, 'categories.*')
    .replaceAll(QnWord, 'question')
}

/** A JSONata string, in either quote, or a comment: the stretches of a formula the rewrite leaves as they are */
const FormulaVerbatim = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\//g

/**
 * A JSONata formula over the bag, as it reads the bag now: the words it read the bag by before
 * October 2026 rewritten (`qn` as `question`, `qn_label` as `question_label`, `qns` as
 * `questions.*`, the hunt's `categories` as `categories.*`), and the search for the question a
 * field names made a lookup by label. Strings and comments are left as they are, so a key an input
 * makes keeps its name. A formula that reads no bag (a column's, over what its ref picked) is not
 * one of these.
 *
 * @example beforeOctoberFormula('$uppercase(qn.title)')  // => '$uppercase(question.title)'
 * @example beforeOctoberFormula('(qns[label = $$.qn.chains_to]).hint')  // => '(question.chains_to ? $lookup(questions, question.chains_to)).hint'
 * @example beforeOctoberFormula("$count(qns[archived = false])")  // => '$count(questions.*[archived = false])'
 * @example beforeOctoberFormula("{ 'qn': qn.clueing }")  // => "{ 'qn': question.clueing }"
 */
export function beforeOctoberFormula(formula: string): string {
  return spliced(formula, FormulaVerbatim, formulaCodeOf)
}

/** `text` with each stretch outside what `verbatim` finds made over by `rewrite`, and what it finds left as it was */
function spliced(text: string, verbatim: RegExp, rewrite: (code: string) => string): string {
  let out = ''
  let from = 0
  for (const found of text.matchAll(verbatim)) {
    out += rewrite(text.slice(from, found.index)) + found[0]
    from = found.index + found[0].length
  }
  return out + rewrite(text.slice(from))
}

/** What is inside a tag opening a raw block, whose text up to its `endraw` is left as it is */
const RawInside = /^\s*raw\s*$/

/** The tag closing a raw block */
const RawEnd = /\{%-?\s*endraw\s*-?%\}/g

/** One tag or output found in a template: its opening with any trim mark (`{%-`), what is inside, its closing (`-}}`), and where it ends */
type MarkupT = { opening: string, inside: string, closing: string, end: number }

/** The tag or output opening at `beg`, or null when it is never closed */
function markupAt(template: string, beg: number): MarkupT | null {
  const isTag = template[beg + 1] === '%'
  const close = template.indexOf(isTag ? '%}' : '}}', beg + 2)
  if (close === -1) { return null }
  const insideBeg = beg + (template[beg + 2] === '-' ? 3 : 2)
  const insideEnd = template[close - 1] === '-' && close - 1 >= insideBeg ? close - 1 : close
  return { opening: template.slice(beg, insideBeg), inside: template.slice(insideBeg, insideEnd), closing: template.slice(insideEnd, close + 2), end: close + 2 }
}

/** Where the raw block whose opening tag ends at `from` ends: past its `endraw`, or at the end of the template */
function rawEndAt(template: string, from: number): number {
  RawEnd.lastIndex = from
  const raw = RawEnd.exec(template)
  return raw === null ? template.length : raw.index + raw[0].length
}

/**
 * `template` with each Liquid tag and output made over by `rewrite`, handed its opening, what is
 * inside, and its closing; the text between them, and a raw block whole, left as they are. A tag
 * or output never closed is left, with all after it.
 */
function eachMarkup(template: string, rewrite: (opening: string, inside: string, closing: string) => string): string {
  const pieces: string[] = []
  let from = 0
  for (let beg = openingAt(template, from); beg !== -1; beg = openingAt(template, from)) {
    const markup = markupAt(template, beg)
    if (markup === null) { break }
    pieces.push(template.slice(from, beg))
    const { opening, inside, closing, end } = markup
    const isRaw = opening.startsWith('{%') && RawInside.test(inside)
    from = isRaw ? rawEndAt(template, end) : end
    pieces.push(isRaw ? template.slice(beg, from) : rewrite(opening, inside, closing))
  }
  return pieces.join('') + template.slice(from)
}

/** Where the first tag or output at or after `from` opens, or -1 for none */
function openingAt(template: string, from: number): number {
  const output = template.indexOf('{{', from)
  const tag = template.indexOf('{%', from)
  if (output === -1 || tag === -1) { return Math.max(output, tag) }
  return Math.min(output, tag)
}

/** A Liquid string, in either quote: what the rewrite leaves as it is inside a tag or an output */
const LiquidString = /'[^']*'|"[^"]*"/g

/** A `for` tag over a collection whose old shape was a list: its loop variable, the collection, and the rest of the tag */
const ForOverList = /^(\s*for\s+)(\w+)(\s+in\s+)(qns|quiz\.questions|categories)(?![\w.])([\s\S]*)$/

/** What each collection a template looped over as a list is, now, as a list, and the variable a `for` tag over it is handed */
const ListedAs = {
  'qns':            { listed: 'questions | values | reject: "archived"', listname: 'shown_questions' },
  'quiz.questions': { listed: 'questions | values', listname: 'every_question' },
  'categories':     { listed: 'categories | values', listname: 'every_category' },
} as const

// Each word of the bag where it begins a path, in a template: not inside another word, nor after a dot.
const TplQnsInOrder     = /(?<![\w.])qns(?=\s*\|\s*in_order\b)/g
const TplQnsPiped       = /(?<![\w.])qns(?=\s*\|)/g
const TplEveryPiped     = /(?<![\w.])quiz\.questions(?=\s*\|)/g
const TplCategoriesPiped = /(?<![\w.])categories(?=\s*\|)(?!\s*\|\s*values\b)/g
const TplEvery          = /(?<![\w.])quiz\.questions(?!\w)/g
const TplQns            = /(?<![\w.])qns(?!\w)/g
const TplQnLabel        = /(?<![\w.])qn_label(?!\w)/g
const TplQn             = /(?<![\w.])qn(?!\w)/g

/**
 * What one stretch of a tag or an output, outside its strings, reads now: a list the old bag held
 * piped into a filter is the new bag's collection made a list first (`qns` the questions shown, so
 * the archived left out; `in_order` takes the questions as they are); `quiz.questions` and `qns`
 * otherwise `questions`; `qn_label` and `qn` spelled out.
 */
function templateCodeOf(code: string): string {
  return code
    .replaceAll(TplQnsInOrder, 'questions')
    .replaceAll(TplQnsPiped, () => ListedAs.qns.listed)
    .replaceAll(TplEveryPiped, () => ListedAs['quiz.questions'].listed)
    .replaceAll(TplCategoriesPiped, () => ListedAs.categories.listed)
    .replaceAll(TplEvery, 'questions')
    .replaceAll(TplQns, 'questions')
    .replaceAll(TplQnLabel, 'question_label')
    .replaceAll(TplQn, 'question')
}

/**
 * One tag or output as it reads now: a `for` over what was a list loops over it made a list
 * first, in an `assign` just before (a `for` tag takes no filter); anything else as
 * `templateCodeOf` says.
 */
function markupOf(opening: string, inside: string, closing: string): string {
  const looping = opening.startsWith('{%') ? ForOverList.exec(inside) : null
  if (looping === null) { return opening + spliced(inside, LiquidString, templateCodeOf) + closing }
  const [, head = '', loopvar = '', within = '', collection = '', rest = ''] = looping
  const { listed, listname } = ListedAs[collection as keyof typeof ListedAs]
  return `${opening} assign ${listname} = ${listed} %}{%${head}${templateCodeOf(loopvar)}${within}${listname}${spliced(rest, LiquidString, templateCodeOf)}${closing}`
}

/**
 * A Liquid template over the bag, as it reads the bag now: inside each tag and output, the words
 * it read the bag by before October 2026 rewritten (`qn` as `question`, `qn_label` as
 * `question_label`, `qns` and `quiz.questions` as `questions`), and a loop or a filter over what
 * was a list made over the new collection's values (`| values`, the archived left out where `qns`
 * left them out). The text around the tags, and a raw block, are left as they are, so a
 * templateable field's prose is never touched. A template over something else (an `aibot`
 * prompt, a `liquidize` template over an input of its own) is not one of these.
 *
 * @example beforeOctoberTemplate('By {{ qn.author }}, qn')  // => 'By {{ question.author }}, qn'
 * @example beforeOctoberTemplate('{%- for qn in qns %}{{ qn.title }}{% endfor %}')
 *   // => '{%- assign shown_questions = questions | values | reject: "archived" %}{% for question in shown_questions %}{{ question.title }}{% endfor %}'
 * @example beforeOctoberTemplate('{% assign played = qns | in_order %}')  // => '{% assign played = questions | in_order %}'
 */
export function beforeOctoberTemplate(template: string): string {
  return eachMarkup(template, markupOf)
}

/** Whether a widget's input formula hands its formula or template the whole bag: `$`, or none, which a `jsonata` or `liquidize` widget reads as `$` */
function readsBag(input_formula: unknown): boolean {
  return typeof input_formula !== 'string' || ['', '$'].includes(input_formula.trim())
}

/**
 * A widget's texts as they read the bag now (`beforeOctoberFormula`, `beforeOctoberTemplate`): its
 * input formula, which reads the bag; and its formula, a `jsonata` widget's or a `liquidize`
 * widget's template, where its input is the whole bag. An `aibot` widget's prompt reads its input,
 * and an entry has none, so neither is touched. Anything else the widget holds is as it was.
 *
 * @example beforeOctoberWidgetTexts({ formulary: 'jsonata', input_formula: '$', formula: 'qn.title' }).formula  // => 'question.title'
 * @example beforeOctoberWidgetTexts({ formulary: 'liquidize', input_formula: "{ 'qn': qn }", formula: '{{ qn.title }}' }).formula  // => '{{ qn.title }}'
 */
export function beforeOctoberWidgetTexts<WT extends Readonly<Record<string, unknown>>>(widget: WT): WT {
  const { formulary, formula, input_formula } = widget
  if (formulary !== 'jsonata' && formulary !== 'aibot' && formulary !== 'liquidize') { return widget }
  const bagged = readsBag(input_formula)
  return {
    ...widget,
    ...(typeof input_formula === 'string' && { input_formula: beforeOctoberFormula(input_formula) }),
    ...(typeof formula === 'string' && bagged && formulary === 'jsonata' && { formula: beforeOctoberFormula(formula) }),
    ...(typeof formula === 'string' && bagged && formulary === 'liquidize' && { formula: beforeOctoberTemplate(formula) }),
  }
}

/**
 * A `liquidize` widgeting's params as they read the bag now: its own `template`, where its widget's
 * input is the whole bag (`readsBag`, from the widget's input formula; the widget's default when
 * the library holds none), and `template_from`'s ref (`beforeOctoberRef`). `template_from`'s
 * formula reads what its ref picks, not the bag, and is left; so is any other param.
 *
 * @example beforeOctoberParams({ template: '{{ qn.hint }}' }, '$')  // => { template: '{{ question.hint }}' }
 * @example beforeOctoberParams({ template_from: { ref: 'qns', formula: '$count($)' } }, '$')  // => { template_from: { ref: 'questions', formula: '$count($)' } }
 */
export function beforeOctoberParams<PT extends Readonly<Record<string, unknown>>>(params: PT, input_formula: unknown): PT {
  const { template, template_from } = params
  const from = typeof template_from === 'object' && template_from !== null && ! Array.isArray(template_from) ? template_from as Record<string, unknown> : null
  return {
    ...params,
    ...(typeof template === 'string' && readsBag(input_formula) && { template: beforeOctoberTemplate(template) }),
    ...(typeof from?.ref === 'string' && { template_from: { ...from, ref: beforeOctoberRef(from.ref) } }),
  }
}

/**
 * A column as it reads the bag now: its ref (`beforeOctoberRef`) and its template, which is filled
 * in over the bag (`beforeOctoberTemplate`). Its formula reads what its ref picks, not the bag,
 * and is left; so is anything else.
 *
 * @example beforeOctoberColumn({ source: 'qns', template: '{{ value }} of {{ qns.size }}' })  // => { source: 'questions', template: '{{ value }} of {{ questions.size }}' }
 */
export function beforeOctoberColumn<CT extends Readonly<Record<string, unknown>>>(column: CT): CT {
  const { source, template } = column
  return {
    ...column,
    ...(typeof source === 'string' && { source: beforeOctoberRef(source) }),
    ...(typeof template === 'string' && { template: beforeOctoberTemplate(template) }),
  }
}

/** The quiz's own texts that are templates over the bag: its recap's head, tail and template */
export const QuizTemplateFieldnames = ['recap_head', 'recap_tail', 'recap_template'] as const

/**
 * A quiz's own fields as they read the bag now: its recap's head, tail and template, each a
 * template over the bag (`beforeOctoberTemplate`). Anything else is as it was.
 *
 * @example beforeOctoberQuizTexts({ recap_head: 'Thanks, {{ quiz.title }}!', recap_template: '{% for qn in qns %}{% endfor %}' }).recap_template
 *   // => '{% assign shown_questions = questions | values | reject: "archived" %}{% for question in shown_questions %}{% endfor %}'
 */
export function beforeOctoberQuizTexts<QT extends Readonly<Record<string, unknown>>>(quiz: QT): QT {
  const rewritten = QuizTemplateFieldnames.flatMap((fieldname): [string, string][] => {
    const text = quiz[fieldname]
    return typeof text === 'string' ? [[fieldname, beforeOctoberTemplate(text)]] : []
  })
  return { ...quiz, ...Object.fromEntries(rewritten) }
}

/**
 * A templateable text (a question's nominated field, or a nominated text entry's value) as it reads
 * the bag now: a template over the bag (`beforeOctoberTemplate`). A cell's value carried as its
 * widgeted (`{ status, value }`) has its value rewritten; anything not text is as it was.
 *
 * @example beforeOctoberTemplated('By {{qn.author}}')  // => 'By {{question.author}}'
 * @example beforeOctoberTemplated({ status: 'ok', value: '{{ qn.title }}!' })  // => { status: 'ok', value: '{{ question.title }}!' }
 */
export function beforeOctoberTemplated(held: unknown): unknown {
  if (typeof held === 'string') { return beforeOctoberTemplate(held) }
  if (typeof held !== 'object' || held === null || Array.isArray(held)) { return held }
  const { value } = held as Record<string, unknown>
  return typeof value === 'string' ? { ...held, value: beforeOctoberTemplate(value) } : held
}
