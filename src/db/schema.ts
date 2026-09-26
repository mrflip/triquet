import { schema as JZS } from 'jazz-tools'

/**
 * The app's tables, in Jazz's own DSL.
 *
 * `spike_notes` is a placeholder: Jazz's dev server will not publish a schema with no tables,
 * and nothing in the app reads or writes it.
 */
export const schema = JZS.defineSchema({
  spike_notes: JZS.table({
    text: JZS.string(),
  }, {}),
})

/** The typed handle every query and write starts from */
export const app = JZS.defineApp(schema)
