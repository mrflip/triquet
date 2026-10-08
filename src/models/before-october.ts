import { QuizRefPrefix } from './column'
import { CategoryDataLabel } from './seeds'

// What the tool called things before October 2026 that it calls otherwise now, as the backfills
// (`convex/migrations.ts`) and the importer read them: the importer for good, since an export is
// a promise. The column grammar's own reading is `column.ts`'s (`beforeOctoberOf`, `plainOf`), and
// a quiz's nomination's `quiz.ts`'s (`templateableFrom`).

/**
 * What the seeded category-estimate entry was labelled before October 2026, and so the widgetings
 * that worked it: a word at the bag's top level since, the hunt's categories, which no widgeting
 * may shadow.
 */
export const CategoriesWidgetLabel = 'categories'

/** The description the seeded category-estimate entry had before October 2026, which the backfill rewrites as the seed's now */
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
