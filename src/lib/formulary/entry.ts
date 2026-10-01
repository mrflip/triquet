import type * as Z from 'zod'
import { EntryValueFor, WidgetValidators, type EntryValueT, type EntryWidgetT } from '../../models/widget'
import type { InputOutcome } from './formularies'

/**
 * The formulary of a value a person types: no formula, no input, never worked out and never
 * asked. Its cell is a field editor that commits on blur, and what it commits is upserted as the
 * cell's one row (`enter_widgeted`); an emptied cell holds no row, and reads as `missing`.
 *
 * What a cell may hold hangs on the widget's `entry_kind`, which is fixed once the widget is made.
 */
// A class of statics with no instances, as every formulary is.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class EntryFormulary {
  static readonly kind = 'entry'
  /** It reads nothing */
  static readonly defaultInput = null
  /** Typed, so neither worked out nor asked */
  static readonly refresh = null
  static readonly store = 'upsert'
  static readonly config = WidgetValidators.entryConfig

  /**
   * Whether the widget is well-formed: always, since it has no formula to get wrong.
   *
   * @example EntryFormulary.check(notesEntry)  // => null
   */
  static check(): string | null {
    return null
  }

  /**
   * What the widget reads: nothing, ever, so there is never anything to run.
   *
   * @example EntryFormulary.input()  // => { status: 'missing' }
   */
  static input(): InputOutcome {
    return { status: 'missing' }
  }

  /**
   * The validator of what one of the widget's cells may hold, by its entry kind.
   *
   * @param widget - The entry widget, whose config names its kind.
   * @returns The validator: prose, a number, a label or a title.
   *
   * @example EntryFormulary.valueOf({ config: { entry_kind: 'labelish' } }).parse('quiet_otter')  // => 'quiet_otter'
   */
  static valueOf(widget: Pick<EntryWidgetT, 'config'>): Z.ZodType<EntryValueT> {
    return EntryValueFor[widget.config.entry_kind]
  }
}
