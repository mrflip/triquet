'use client'

import { Accordion, AccordionDetails, AccordionSummary, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import * as Alarms from '../lib/alarms'
import { AppNotices } from '../lib/notices'
import * as Quizgit from '../lib/quizgit'
import type { ListedHuntT } from '../lib/rows'
import { useRaiseAlarm } from '../state/alarms'
import * as QuizMirror from '../state/quiz-mirror'
import { useQuizRepos } from '../state/use-quiz-repos'
import styles from './workbench.module.css'

/**
 * The history repositories this browser holds that no quiz of `hunts` answers to -- a deleted
 * quiz's, or one of a hunt this visitor is not on -- folded away until asked for, each downloaded
 * as a zip with a click. Shown only when there is at least one.
 *
 * @param hunts - The hunts this visitor is on; a repository of any of their quizzes is not an orphan.
 */
export function OrphanedRepos({ hunts }: Readonly<{ hunts: readonly ListedHuntT[] }>) {
  const repos = useQuizRepos()
  const raise = useRaiseAlarm()
  if (repos === null) { return null }

  const quizIds = new Set(hunts.flatMap((hunt) => hunt.realms.flatMap((realm) => realm.quizzes.map((quiz) => quiz._id))))
  const orphans = Quizgit.orphansAmong(repos, quizIds)
  if (orphans.length === 0) { return null }

  const onDownload = async (repo: Quizgit.RepoSummary) => {
    try {
      await QuizMirror.downloadRepo(repo)
    } catch (err) {
      raise(Alarms.of(AppNotices.repoNotDownloaded, err))
    }
  }

  return (
    <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }} sx={{ mt: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} id="orphaned-repos-summary" aria-controls="orphaned-repos-details">
        Orphaned histories ({orphans.length})
      </AccordionSummary>
      <AccordionDetails id="orphaned-repos-details">
        <p className={styles.microcopy}>
          Git repositories this browser kept for quizzes that are not in any of your hunts: deleted, or of a hunt you are not on. Click one to download it.
        </p>
        <List dense disablePadding aria-label="Orphaned histories">
          {orphans.map((repo) => (
            <ListItemButton key={repo.id} onClick={() => { void onDownload(repo) }}>
              <ListItemIcon sx={{ minWidth: 32 }}><DownloadOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary={repo.label ?? 'no commits yet'} secondary={describeRepo(repo)} />
            </ListItemButton>
          ))}
        </List>
      </AccordionDetails>
    </Accordion>
  )
}

/**
 * A repository's branch and latest commit, on one line.
 *
 * @example describeRepo(repo)  // => 'main · +quiz · 10/5/2026, 3:04:05 PM'
 */
export function describeRepo(repo: Quizgit.RepoSummary): string {
  const branch = repo.branch ?? 'no branch'
  if (repo.committed_at === null) { return branch }
  return `${branch} · ${repo.message ?? ''} · ${new Date(repo.committed_at).toLocaleString()}`
}
