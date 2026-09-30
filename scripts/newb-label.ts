/**
 * A branch label made from loose words: what `newb --from` runs its arguments through, so a
 * branch can be named from a title, a sentence, or another branch's name.
 *
 * The words are joined with a space and a leading datestamp (`20260928-`) comes off; what remains
 * is made a label the way every label in the app is made (`Labelmaker.normalize`), which also
 * drops punctuation and underscores from either end. Prints the label, or an empty line when no
 * label is left.
 *
 *   node_modules/.bin/tsx scripts/newb-label.ts 20260928-++9FOO bar !!baz   # => z9foo_bar_baz
 */
import * as Labelmaker from '../src/lib/labelmaker'

/**
 * `words` made into a branch label.
 *
 * @param words - The arguments following `--from`, as the shell split them.
 * @returns A valid label, or `''` when nothing label-worthy was given.
 *
 * @example branchLabel(['20260928-++9FOO', 'bar', '!!baz'])  // => 'z9foo_bar_baz'
 */
export function branchLabel(words: readonly string[]): string {
  return Labelmaker.normalize(words.join(' ').replace(/^20\d{6}-/, ''))
}

if (import.meta.main) {
  process.stdout.write(`${branchLabel(process.argv.slice(2))}\n`)
}
