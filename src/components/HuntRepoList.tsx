'use client'

import { Button, Link, List, ListItem, ListItemText } from '@mui/material'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import * as Alarms from '../lib/alarms'
import type { HuntRepoT } from '../lib/huntgit'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import type { ListedHuntT } from '../lib/rows'
import { useRaiseAlarm } from '../state/alarms'
import * as HuntMirror from '../state/hunt-mirror'
import NextLink from './NextLink'

export type HuntRepoListProps = {
  /** The repositories to list, as `useHuntRepos` read them */
  repos:  readonly HuntRepoT[]
  /** The hunts the visitor is on: a repository of one links to its page, under its label now */
  hunts:  readonly Pick<ListedHuntT, '_id' | 'org' | 'label'>[]
  /** What the list is called, to a screen reader */
  naming: string
}

/**
 * A list of hunts' history repositories this browser holds, each with its branch and latest
 * commit, and a download of it as a zip named for its hunt. A repository of a hunt the visitor is
 * on links to the hunt; any other is named by the label its own files last gave the hunt, with no
 * link, since there is no hunt here to go to. Wraps rather than scrolls on a narrow screen.
 */
export function HuntRepoList({ repos, hunts, naming }: Readonly<HuntRepoListProps>) {
  const raise = useRaiseAlarm()
  const onDownload = async (repo: HuntRepoT, label: string) => {
    try {
      await HuntMirror.downloadHuntRepo({ _id: repo._id, label })
    } catch (err) {
      raise(Alarms.of(AppNotices.repoNotDownloaded, err))
    }
  }

  return (
    <List dense disablePadding aria-label={naming}>
      {repos.map((repo) => {
        const listed = hunts.find((hunt) => hunt._id === repo._id)
        const label = listed?.label ?? repo.label
        return (
          <ListItem key={repo._id} disableGutters sx={{ gap: 1 }}>
            <ListItemText
              primary={listed
                ? <Link component={NextLink} href={Routes.huntPath({ org: listed.org, hunt: listed.label })}>{label}</Link>
                : label}
              secondary={describeRepo(repo)}
              slotProps={{ primary: { sx: { overflowWrap: 'anywhere' } }, secondary: { sx: { overflowWrap: 'anywhere' } } }}
            />
            <Button size="small" startIcon={<DownloadOutlinedIcon />} aria-label={`Download ${label}`} onClick={() => { void onDownload(repo, label) }} sx={{ flexShrink: 0 }}>
              Download
            </Button>
          </ListItem>
        )
      })}
    </List>
  )
}

/**
 * A repository's branch and latest commit, on one line.
 *
 * @example describeRepo(repo)  // => 'main · legends: quiz ~title · 10/5/2026, 3:04:05 PM'
 */
export function describeRepo(repo: Readonly<Pick<HuntRepoT, 'branch' | 'message' | 'committed_at'>>): string {
  return `${repo.branch ?? 'no branch'} · ${repo.message} · ${new Date(repo.committed_at).toLocaleString()}`
}
