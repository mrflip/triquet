'use client'

import { useEffect, useState } from 'react'
import type { HuntRepoT } from '../lib/huntgit'
import * as HuntMirror from './hunt-mirror'

/**
 * Every hunt's history repository this browser holds, those of hunts since deleted or that the
 * visitor is no longer on included, read once as the view mounts. Not live: the mirror is a record
 * kept beside the database, not something to watch.
 *
 * @returns The repositories, newest work first; null until they have been read.
 */
export function useHuntRepos(): readonly HuntRepoT[] | null {
  const [repos, setRepos] = useState<HuntRepoT[] | null>(null)

  useEffect(() => {
    let current = true
    const load = async () => {
      const found = await HuntMirror.listHuntRepos()
      if (current) { setRepos(found) }
    }
    void load()
    return () => { current = false }
  }, [])

  return repos
}
