import _ from 'es-toolkit/compat'
import * as Redos from '../../src/lib/redos'
import * as Regexes from '../../src/lib/regexes'
import { refuse } from '../../src/lib/refusals'
import { WidgetValidators } from '../../src/models/widget'

/** The regular expression a widgeting's params or an entry widget's config holds, or null for none */
function regexIn(bag: unknown): Regexes.RegexT | null {
  if (! _.isPlainObject(bag)) { return null }
  const parsed = WidgetValidators.regex.safeParse((bag as Record<string, unknown>).regex)
  return parsed.success ? parsed.data : null
}

/**
 * Refuse a change that writes a regular expression recheck does not find safe (`Redos`): one that
 * could take too long to match some text, or that it cannot settle in the time it has. The check
 * where a pattern is written, and the one that counts: a pattern stored is trusted from then on,
 * compiled and handed to Zod as each cell is checked. A pattern the rows already hold is not
 * checked again, so a change that leaves one as it was costs nothing.
 *
 * @param written - The params or entry configs the change writes, each holding a pattern at `regex` or none.
 * @param held - Those the rows hold now, whose patterns were checked when they were written.
 * @throws A refusal (`regexRisky`) naming the pattern and why; nothing is written.
 *
 * @example refuseRiskyRegexes([{ regex: { source: '^(a+)+$', flags: '' } }])  // throws: The pattern «/^(a+)+$/» could take far too long ...
 */
export function refuseRiskyRegexes(written: readonly unknown[], held: readonly unknown[] = []): void {
  const heldShown = new Set(held.map((bag) => regexIn(bag)).filter((regex) => regex !== null).map((regex) => Regexes.shown(regex)))
  const fresh = written.map((bag) => regexIn(bag)).filter((regex) => regex !== null).filter((regex) => ! heldShown.has(Regexes.shown(regex)))
  if (fresh.length === 0) { return }
  const refusal = Redos.firstRefusalOf(fresh)
  if (refusal !== null) { refuse('regexRisky', refusal) }
}
