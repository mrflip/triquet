import { widgetFrom } from '../src/lib/rows'
import { IdentingValidators } from '../src/models/identing'
import type { WidgetT } from '../src/models/widget'
import { zQuery } from './functions'
import { mayReadLibrary } from './authorize'
import { identFor, libraryOf } from './reading'

/**
 * The library: every widget every hunt can put to work, in the order it lists them, for a browser
 * that has said who it is (`browser_key`). Empty for one that has not.
 */
export const library = zQuery({
  args:    { browser_key: IdentingValidators.browserKey },
  handler: async (ctx, { browser_key }): Promise<WidgetT[]> => {
    const ident = await identFor(ctx.db, browser_key)
    if (! mayReadLibrary(ident?._id ?? null)) { return [] }
    const rows = await libraryOf(ctx.db)
    return rows.map((row) => widgetFrom(row))
  },
})
