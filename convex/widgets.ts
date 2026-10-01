import { ValidatorKit } from '../src/lib/validator'
import { widgetFrom, type WidgetUsageT } from '../src/lib/rows'
import { IdentingValidators } from '../src/models/identing'
import type { WidgetT } from '../src/models/widget'
import { zQuery } from './functions'
import { mayCountUsage, mayReadLibrary } from './authorize'
import { identFor, libraryOf, usageOf } from './reading'

const { label } = ValidatorKit

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

/**
 * How far the library's widget labelled `widget_label` is put to work, in every hunt: how many
 * widgetings work it, across how many quizzes, in how many hunts. Counts only, for a browser whose
 * ident is a smith of some hunt, and so may change the widget; null for anyone else. A label the
 * library lacks counts nothing.
 */
export const usage = zQuery({
  args:    { browser_key: IdentingValidators.browserKey, widget_label: label },
  handler: async (ctx, { browser_key, widget_label }): Promise<WidgetUsageT | null> => {
    const ident = await identFor(ctx.db, browser_key)
    if (! await mayCountUsage(ctx.db, ident?._id ?? null)) { return null }
    return await usageOf(ctx.db, widget_label)
  },
})
