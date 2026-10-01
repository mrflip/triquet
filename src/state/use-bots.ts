'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchBotStatuses } from '../lib/bots/port'
import { botUnavailableNotice } from '../lib/notices'
import type { BotStatusT } from '../models/bot-status'
import type { AibotWidgetT } from '../models/widget'

export type BotsHandle = {
  /** Why an `aibot` widget cannot be asked, in the author's words; null when it can, or when nothing is known */
  unavailableNotice: (widget: Pick<AibotWidgetT, 'title' | 'config'>) => string | null
}

/**
 * Which bots can play, fetched once from the server.
 *
 * Until the answer arrives, and if it never does, every bot is presumed able: an ask the
 * server cannot serve says so itself, so not knowing must never hold a cell back.
 *
 * @returns The reason each widget cannot be asked, where there is one: no credentials for its service.
 */
export function useBots(): BotsHandle {
  const [statuses, setStatuses] = useState<BotStatusT[]>([])

  useEffect(() => {
    let current = true
    const load = async () => {
      const found = await fetchBotStatuses()
      if (current) { setStatuses(found) }
    }
    void load()
    return () => { current = false }
  }, [])

  const unavailableNotice = useCallback((widget: Pick<AibotWidgetT, 'title' | 'config'>): string | null => {
    const { servicelabel } = widget.config
    const uncredentialed = statuses.some((held) => held.servicelabel === servicelabel && ! held.credentialed)
    return uncredentialed ? botUnavailableNotice(widget.title, servicelabel) : null
  }, [statuses])

  return { unavailableNotice }
}
