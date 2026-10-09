import type { HuntActionDNA } from '../models/actions'

/**
 * The keys of the folding panels of the manage dialog and the Widgets panel, one per place a panel
 * is drawn, so a widgeting's panel beneath one column folds apart from its copy beneath another and
 * from its row in the Widgets panel's run order. A `FoldSet` keeps them (`useFoldSet`).
 */
export const LayoutFoldkeys = {
  /** A column's panel, in the columns editor */
  column:    (columnLabel: string) => `column:${columnLabel}`,
  /** The panel of the widgeting a column shows, beneath that column */
  beneath:   (columnLabel: string) => `column:${columnLabel}:widgeting`,
  /** A widgeting's panel, in the Widgets panel's run order */
  widgeting: (widgetingLabel: string) => `widgeting:${widgetingLabel}`,
  /** A column, as a widgeting's panel lists the columns showing it */
  listed:    (widgetingLabel: string, columnLabel: string) => `widgeting:${widgetingLabel}:column:${columnLabel}`,
} as const

/**
 * The panels to open for what `actions` make, so a new column or widgeting arrives open for its
 * fields to be set: a new column's panel and the panel beneath it, a new widgeting's own.
 *
 * @param actions - The actions just sent.
 * @returns The keys of the panels to open.
 *
 * @example madeFoldkeys([{ kind: 'add_column', column: { label: 'memo', ... } }])  // => ['column:memo', 'column:memo:widgeting']
 */
export function madeFoldkeys(actions: readonly HuntActionDNA[]): string[] {
  return actions.flatMap((action) => {
    if (action.kind === 'add_column') { return [LayoutFoldkeys.column(action.column.label), LayoutFoldkeys.beneath(action.column.label)] }
    if (action.kind === 'add_widgeting') { return [LayoutFoldkeys.widgeting(action.widgeting.label)] }
    return []
  })
}
