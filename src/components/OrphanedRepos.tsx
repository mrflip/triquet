'use client'

import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import * as Huntgit from '../lib/huntgit'
import type { ListedHuntT } from '../lib/rows'
import { useHuntRepos } from '../state/use-hunt-repos'
import { HuntRepoList } from './HuntRepoList'
import styles from './workbench.module.css'

/**
 * The hunts' history repositories this browser holds for hunts the visitor is not on -- a deleted
 * hunt's, one they were taken off, or one another visitor of this browser works on -- folded away
 * until asked for, each downloaded as a zip with a click. Shown only when there is at least one.
 *
 * @param hunts - The hunts this visitor is on; a repository of any of them is not an orphan.
 */
export function OrphanedRepos({ hunts }: Readonly<{ hunts: readonly ListedHuntT[] }>) {
  const repos = useHuntRepos()
  if (repos === null) { return null }

  const orphans = Huntgit.orphansAmong(repos, new Set(hunts.map((hunt) => hunt._id)))
  if (orphans.length === 0) { return null }

  return (
    <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }} sx={{ mt: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} id="orphaned-repos-summary" aria-controls="orphaned-repos-details">
        Orphaned histories ({orphans.length})
      </AccordionSummary>
      <AccordionDetails id="orphaned-repos-details">
        <p className={styles.microcopy}>
          Git repositories this browser kept for hunts you are not on: deleted, or someone else&apos;s. Download one to keep it.
        </p>
        <HuntRepoList repos={orphans} hunts={[]} naming="Orphaned histories" />
      </AccordionDetails>
    </Accordion>
  )
}
