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
