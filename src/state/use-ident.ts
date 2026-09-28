'use client'

import { useMemo } from 'react'
import { useAll, useSession } from 'jazz-tools/react'
import { app, type IdentRow } from '../db/schema'
import type { IdentT } from '../models/ident'
import { LocalFirst } from './quiz-rows'

export type IdentHandle = {
  /** Who this account is now; null when it has never said */
  ident:  IdentT | null
  /** Whether this browser has read far enough to know */
  loaded: boolean
}

/** When an identing was made, in epoch milliseconds; one not stamped yet was made just now */
function madeAt(identing: { $createdAt?: Date }): number {
  return identing.$createdAt?.getTime() ?? Date.now()
}

/**
 * The ident this account is now: the one its newest identing names.
 *
 * An account's identings are its own, so this browser holds all of them and never has to ask the
 * server; a browser that holds none belongs to a visitor who has not said who they are.
 *
 * @returns The ident, and whether that is known yet.
 */
export function useIdent(): IdentHandle {
  const account = useSession()?.user.account ?? null
  const identings = useAll(account === null ? undefined : app.identings.where({ '$createdBy.account': account }).select('*', '$createdAt'), LocalFirst)
  const idents = useAll(app.idents, LocalFirst)

  return useMemo((): IdentHandle => {
    if (! identings.data || ! idents.data) { return { ident: null, loaded: false } }
    const newest = identings.data.toSorted((aa, bb) => madeAt(aa) - madeAt(bb)).at(-1)
    if (! newest) { return { ident: null, loaded: true } }
    const ident = idents.data.find((row) => row.id === newest.ident_id)
    return ident ? { ident: { _id: ident.id, label: ident.label, title: ident.title }, loaded: true } : { ident: null, loaded: false }
  }, [identings.data, idents.data])
}

/**
 * Every ident this browser holds, live: small and global, like the hunt directory, for
 * resolving a review's `ident_id` to a title.
 *
 * @returns The idents, once the table has delivered; null until then.
 */
export function useIdents(): readonly IdentRow[] | null {
  const idents = useAll(app.idents, LocalFirst)
  return idents.data ?? null
}
