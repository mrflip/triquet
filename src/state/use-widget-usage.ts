'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { WidgetUsageT } from '../lib/rows'
import { useSession } from './use-session'

/**
 * How far the library's widget labelled `widget_label` is put to work, in every hunt, live: a
 * facet of its own, watched only while the widget's editor is open, since nothing else shows it.
 *
 * @param widget_label - A widget the library holds.
 * @returns The counts; null when this browser may not count them (it may not change the library:
 *   `Approve.mayCountUsage`); undefined until they have arrived.
 */
export function useWidgetUsage(widget_label: string): WidgetUsageT | null | undefined {
  const { ready } = useSession()
  return useQuery(api.widgets.usage, ready ? { widget_label } : 'skip')
}
