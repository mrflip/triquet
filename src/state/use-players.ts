'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchPlayerStatuses } from '../lib/players/port'
import { playerUnavailableNotice } from '../lib/notices'
import type { PlayerLabel } from '../models/player'
import type { PlayerStatusT } from '../models/player-status'
import type { Askkind } from './use-asking'

/** Which player each askable cell belongs to */
export const PlayerForAskkind: Record<Askkind, PlayerLabel> = {
  guess:   'dumdum',
  clueing: 'numnum',
  hint:    'numnum',
}

export type PlayersHandle = {
  /** Why this cell cannot be asked about, in the author's words; null when it can, or when nothing is known */
  unavailableNotice: (askkind: Askkind) => string | null
}

/**
 * Which players can play, fetched once from the server.
 *
 * Until the answer arrives, and if it never does, every player is presumed able: an ask the
 * server cannot serve says so itself, so not knowing must never hold a cell back.
 *
 * @returns The reason each cell cannot be asked about, where there is one.
 */
export function usePlayers(): PlayersHandle {
  const [statuses, setStatuses] = useState<PlayerStatusT[]>([])

  useEffect(() => {
    let current = true
    const load = async () => {
      const found = await fetchPlayerStatuses()
      if (current) { setStatuses(found) }
    }
    void load()
    return () => { current = false }
  }, [])

  const unavailableNotice = useCallback((askkind: Askkind): string | null => {
    const status = statuses.find((held) => held.label === PlayerForAskkind[askkind])
    return status && ! status.credentialed ? playerUnavailableNotice(status.title, status.servicelabel) : null
  }, [statuses])

  return { unavailableNotice }
}
