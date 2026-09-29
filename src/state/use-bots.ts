'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchBotStatuses } from '../lib/bots/port'
import { botUnavailableNotice } from '../lib/notices'
import type { BotLabel } from '../models/bot'
import type { BotStatusT } from '../models/bot-status'
import type { Askkind } from './use-asking'

/** Which bot each askable cell belongs to */
export const BotForAskkind: Record<Askkind, BotLabel> = {
  guess:   'dumdum',
  clueing: 'numnum',
  hint:    'numnum',
}

export type BotsHandle = {
  /** Why this cell cannot be asked about, in the author's words; null when it can, or when nothing is known */
  unavailableNotice: (askkind: Askkind) => string | null
}

/**
 * Which bots can play, fetched once from the server.
 *
 * Until the answer arrives, and if it never does, every bot is presumed able: an ask the
 * server cannot serve says so itself, so not knowing must never hold a cell back.
 *
 * @returns The reason each cell cannot be asked about, where there is one.
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

  const unavailableNotice = useCallback((askkind: Askkind): string | null => {
    const status = statuses.find((held) => held.label === BotForAskkind[askkind])
    return status && ! status.credentialed ? botUnavailableNotice(status.title, status.servicelabel) : null
  }, [statuses])

  return { unavailableNotice }
}
