'use client'

import { useState } from 'react'
import { Button, Dialog, DialogContent, Link, Stack } from '@mui/material'
import { ClosableTitle } from './ClosableTitle'
import HowToSeeFullHistory from '../content/full-history.md'
import * as HuntMirror from '../state/hunt-mirror'
import { AppNotices } from '../lib/notices'
import type { ShallowHuntT } from '../lib/rows'
import styles from './workbench.module.css'

/**
 * A way to take the hunt's whole history with you, on the Full History tab: a download of it as a
 * git repository, and beside it a quiet pointer to what one does with such a thing, which opens
 * as a dialog rather than sending the author away from their work.
 *
 * @param hunt - The hunt whose history is downloaded.
 */
export function FullHistoryDownload({ hunt }: Readonly<{ hunt: ShallowHuntT }>) {
  const [helping, setHelping] = useState(false)
  const [noted, setNoted] = useState<string | null>(null)

  const onDownload = async () => {
    const offered = await HuntMirror.downloadHuntRepo(hunt)
    setNoted(offered ? null : AppNotices.noHistoryHere)
  }

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
        <Button size="small" variant="outlined" onClick={() => { void onDownload() }}>Download Full History</Button>
        <Link component="button" variant="caption" color="text.secondary" underline="hover" onClick={() => { setHelping(true) }}>
          (<em>How to see Full History</em>)
        </Link>
      </Stack>
      {noted !== null && <p className={styles.microcopy} role="status">{noted}</p>}
      <Dialog open={helping} onClose={() => { setHelping(false) }} fullWidth maxWidth="md" aria-labelledby="full-history-title">
        <ClosableTitle id="full-history-title" onClose={() => { setHelping(false) }}>How to see Full History</ClosableTitle>
        <DialogContent><HowToSeeFullHistory /></DialogContent>
      </Dialog>
    </>
  )
}
