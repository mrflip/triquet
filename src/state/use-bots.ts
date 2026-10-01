'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchServiceStatuses } from '../lib/bots/port'
import { botUnavailableNotice } from '../lib/notices'
import type { ServiceStatusT } from '../models/service-status'
import { Widget, type AibotWidgetT } from '../models/widget'

export type BotsHandle = {
  /** Why an `aibot` widget cannot be asked, in the author's words; null when it can, or when nothing is known */
  unavailableNotice: (widget: Pick<AibotWidgetT, 'label' | 'title' | 'config'>) => string | null
}

/**
 * Which services can be asked, fetched once from the server.
 *
 * Until the answer arrives, and if it never does, every service is presumed able: an ask the
 * server cannot serve says so itself, so not knowing must never hold a cell back.
 *
 * @returns The reason each widget cannot be asked, where there is one: no credentials for its service.
 */
export function useBots(): BotsHandle {
  const [statuses, setStatuses] = useState<ServiceStatusT[]>([])

  useEffect(() => {
    let current = true
    const load = async () => {
      const found = await fetchServiceStatuses()
      if (current) { setStatuses(found) }
    }
    void load()
    return () => { current = false }
  }, [])

  const unavailableNotice = useCallback((widget: Pick<AibotWidgetT, 'label' | 'title' | 'config'>): string | null => {
    const { servicelabel } = widget.config
    const uncredentialed = statuses.some((held) => held.servicelabel === servicelabel && ! held.credentialed)
    return uncredentialed ? botUnavailableNotice(Widget.titleOf(widget), servicelabel) : null
  }, [statuses])

  return { unavailableNotice }
}
