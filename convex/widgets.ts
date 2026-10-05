import * as Approve from '../src/lib/approve'
import { ValidatorKit } from '../src/lib/validator'
import { widgetFrom, type WidgetUsageT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import type { WidgetT } from '../src/models/widget'
import { zLibraryMutation, zQuery } from './functions'
import { affirmLibraryAction } from './authorize'
import { libraryOf, usageOf } from './reading'
import { performLibrary } from './writing/library_actions'

const { label, zod } = ValidatorKit

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
 * may change the library, and so the widget (`Approve.mayCountUsage`); null for anyone else. A
 * label the library lacks counts nothing.
 */
export const usage = zQuery({
  args:    { widget_label: label },
  handler: async (ctx, { widget_label }): Promise<WidgetUsageT | null> => {
    if (! Approve.may('count_usage', ctx.actor)) { return null }
    return await usageOf(ctx.db, widget_label)
  },
})

/**
 * Carry out what an admin did to the library of widgets every hunt shares: add, revise, move,
 * remove or import widgets (see `writing/library_actions`). No hunt or quiz need be open: the
 * library belongs to none, and the actor alone is asked of (`Approve.mayChangeLibrary`). What it
 * writes, it writes only to the library (`LibraryRules`); whether a widget is worked anywhere it
 * asks the census.
 *
 * @throws A `ConvexError` whose data is a refusal (`lib/refusals`) when the action cannot be
 *   carried out (`notIdentified` for an actor who has asserted no username, `notPermitted` for one
 *   who is no admin, `labelTaken`, `libraryFull`, `widgetGone`, `widgetInUse`, `entryKindFixed`
 *   for what the library will not hold), or `{ ZodError }` when an argument is not valid; nothing
 *   is written.
 */
export const perform = zLibraryMutation({
  args:    { action: ActionValidators.libraryAction },
  returns: zod.null(),
  affirm:  (ctx, { action }) => { affirmLibraryAction(ctx.actor, action) },
  handler: async (ctx, { action }) => {
    await performLibrary(ctx.db, ctx.census, action)
    return null
  },
})
