'use client'

import type { ReactNode } from 'react'
import { version as reactVersion } from 'react'
import { version as convexVersion } from 'convex'
import { Box, Chip, Link, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { BuildStampT } from '../lib/build-stamp'
import type { BackfillStatusT } from '../lib/rows'
import { convexUrl } from '../state/convex-url'
import { useStats } from '../state/use-stats'
import styles from './workbench.module.css'

type StatsProps = {
  /** What the build said of itself as it was built */
  stamp:        BuildStampT
  next_version: string
}

/** Which build this is, the pull request it came from, what this browser runs, and how far the deployment's backfills have run */
export function Stats({ stamp, next_version }: Readonly<StatsProps>) {
  const { backfills, connected, connections } = useStats()
  const { pull, links } = stamp
  const told = pull ? pull.body : (stamp.message ?? '')
  return (
    <Box component="main" className={styles.page} sx={{ maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>Stats</Typography>

      <Section title="This build">
        <Facts rows={[
          ['Built',          stamp.built_at],
          ['Environment',    stamp.deploy_env],
          ['Commit',         stamp.sha ? <Linked href={links.commit}><code>{stamp.sha.slice(0, 12)}</code></Linked> : null],
          ['Ref',            stamp.ref],
          ['Author',         stamp.author],
          ['Previous deploy', stamp.previous_sha ? <Linked href={links.compare}>changes since <code>{stamp.previous_sha.slice(0, 7)}</code></Linked> : null],
          ['Deployment',     stamp.deploy_url],
          ['Deployment id',  stamp.deployment_id],
          ['Facts from',     stamp.source],
          ['Built on Node',  stamp.node_version],
        ]} />
      </Section>

      <Section title={pull ? `Pull request #${String(pull.number)}` : 'Commit message'}>
        {pull && (
          <Facts rows={[
            ['Title',  <Linked key="title" href={links.pull}>{pull.title}</Linked>],
            ['Branch', pull.branch],
          ]} />
        )}
        <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', mt: 1 }}>
          {told === '' ? '(none)' : told}
        </Typography>
      </Section>

      <Section title="What it merged">
        {stamp.merged.length === 0
          ? <Typography variant="body2" color="text.secondary">{"Nothing listed: not a merge, or the build's clone was too shallow to tell."}</Typography>
          : (
            <Table size="small" aria-label="Merged commits">
              <TableBody>
                {stamp.merged.map((commit) => (
                  <TableRow key={commit.sha}>
                    <TableCell sx={{ width: '1%' }}><Linked href={stamp.repo ? `https://github.com/${stamp.repo}/commit/${commit.sha}` : null}><code>{commit.sha}</code></Linked></TableCell>
                    <TableCell>{commit.subject}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </Section>

      <Section title="This browser">
        <Facts rows={[
          ['Next',       next_version],
          ['React',      reactVersion],
          ['Convex',     convexVersion],
          ['Backend',    convexUrl() ?? null],
          ['Connected',  `${connected ? 'yes' : 'no'}, ${String(connections)} time${connections === 1 ? '' : 's'} so far`],
        ]} />
      </Section>

      <Section title="Backfills">
        <Backfills backfills={backfills} />
      </Section>
    </Box>
  )
}

/** One part of the page, under its heading */
function Section({ title, children }: Readonly<{ title: string, children: ReactNode }>) {
  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Typography variant="h5" component="h2" sx={{ mb: 1 }}>{title}</Typography>
      {children}
    </Box>
  )
}

/** Facts as a two-column table, one to a row; one nobody could tell reads as a dash */
function Facts({ rows }: Readonly<{ rows: readonly (readonly [string, ReactNode])[] }>) {
  return (
    <Table size="small">
      <TableBody>
        {rows.map(([label, fact]) => (
          <TableRow key={label}>
            <TableCell component="th" scope="row" sx={{ width: '12em', fontWeight: 'bold', verticalAlign: 'top' }}>{label}</TableCell>
            <TableCell sx={{ overflowWrap: 'anywhere' }}>{fact ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** `children`, linked to `href` when there is one */
function Linked({ href, children }: Readonly<{ href: string | null, children: ReactNode }>) {
  return href ? <Link href={href} target="_blank" rel="noopener">{children}</Link> : <>{children}</>
}

const StateColors: Record<BackfillStatusT['state'], 'success' | 'info' | 'error' | 'warning' | 'default'> = {
  success:    'success',
  inProgress: 'info',
  failed:     'error',
  canceled:   'warning',
  unknown:    'default',
}

/** The deployment's backfills, those still defined first; a state of `unknown` is one never run here */
function Backfills({ backfills }: Readonly<{ backfills: readonly BackfillStatusT[] | undefined }>) {
  if (backfills === undefined) { return <Typography variant="body2" color="text.secondary">Asking the deployment…</Typography> }
  if (backfills.length === 0) { return <Typography variant="body2" color="text.secondary">None defined, and none run.</Typography> }
  return (
    <Table size="small" aria-label="Backfills">
      <TableHead>
        <TableRow>
          <TableCell>Backfill</TableCell>
          <TableCell>State</TableCell>
          <TableCell align="right">Rows</TableCell>
          <TableCell>Started</TableCell>
          <TableCell>Ended</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {backfills.map((backfill) => (
          <TableRow key={backfill.fnname} sx={backfill.defined ? undefined : { opacity: 0.6 }}>
            <TableCell><code>{backfill.fnname}</code>{backfill.defined ? '' : ' (retired)'}</TableCell>
            <TableCell><Chip size="small" label={backfill.state} color={StateColors[backfill.state]} /></TableCell>
            <TableCell align="right">{backfill.processed}</TableCell>
            <TableCell>{momentOf(backfill.started_at)}</TableCell>
            <TableCell>{momentOf(backfill.ended_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** A moment as an ISO timestamp, to the second; a dash for never */
function momentOf(epochMs: number | null): string {
  return epochMs === null ? '—' : new Date(epochMs).toISOString().replace(/\.\d+Z$/, 'Z')
}
