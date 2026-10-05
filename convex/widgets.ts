import * as Approve from '../src/lib/approve'
import { ValidatorKit } from '../src/lib/validator'
import { widgetFrom, type WidgetUsageT } from '../src/lib/rows'
import type { WidgetT } from '../src/models/widget'
import { zQuery } from './functions'
import { affirmCountUsage } from './authorize'
import { libraryOf, usageOf } from './reading'

const { label } = ValidatorKit

/**
 * The library: every widget every hunt can put to work, in the order it lists them, for an actor
 * who has asserted a username. Empty for one who has not.
 */
export const library = zQuery({
  args:    {},
  handler: async (ctx): Promise<WidgetT[]> => {
    if (! Approve.may('read_library', ctx.actor)) { return [] }
    const rows = await libraryOf(ctx.db)
    return rows.map((row) => widgetFrom(row))
  },
})

/**
 * How far the library's widget labelled `widget_label` is put to work, in every hunt: how many
 * widgetings work it, across how many quizzes, in how many hunts. Counts only, for an actor who
 * is a smith of some hunt, and so may change the widget; null for anyone else. A label the
 * library lacks counts nothing.
 */
export const usage = zQuery({
  args:    { widget_label: label },
  handler: async (ctx, { widget_label }): Promise<WidgetUsageT | null> => {
    if (! await affirmCountUsage(ctx.db, ctx.actor)) { return null }
    return await usageOf(ctx.db, widget_label)
  },
})
