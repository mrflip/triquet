import type { JsonT } from './widgeted'

/**
 * One widget put to work in one quiz, under a label of its own: what the runner walks, in run
 * order. Each widgeting's bag holds the widgeteds of those before it.
 *
 * Until the widgetings table exists, a quiz's widgets stand in for its widgetings
 * (`src/lib/formulary/standins.ts`), and this is the shape the runner reads them in.
 */
export type WidgetingT = {
  /** What columns, the bag and exports name it by; unique within its quiz */
  label:        string
  /** Which widget of the library it works */
  widget_label: string
  description:  string
  /** What it hands the widget beyond the bag; reaches the bag as `params` */
  params:       Record<string, JsonT>
}
