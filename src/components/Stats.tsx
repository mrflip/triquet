'use client'

import type { ReactNode } from 'react'
import { version as reactVersion } from 'react'
import { version as convexVersion } from 'convex'
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Link, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { BuildStampT } from '../lib/build-stamp'
import * as EnvViz from '../lib/env-viz'
import type { BackfillStatusT } from '../lib/rows'
import * as StatsReport from '../lib/stats-report'
import * as UU from '../lib/useful'
import { convexUrl } from '../state/convex-url'
import { useStats } from '../state/use-stats'
import { CopyButton } from './CopyButton'
import { ReadonlyBox } from './panels/ReadonlyBox'
import styles from './workbench.module.css'

type StatsProps = {
  /** What the build said of itself as it was built */
  stamp:        BuildStampT
  next_version: string
  /** The environment it was built in, already masked (`EnvViz.visualize`) */
  env:          EnvViz.EnvVizT
}

/** How many lines the JSON box shows */
const BoxRows = 12

/**
 * Which build this is, the pull request it came from, what this browser runs, how far the
 * deployment's backfills have run, and the environment it was built in; all of it again as JSON,
 * to copy from beside the heading or from the box at the foot. Each part folds away under its
 * heading, and all start folded; the environment is in groups (`EnvViz.grouped`), each folded in
 * turn but for `main`. The build's part alone is served at `/stats.json`.
 */
export function Stats({ stamp, next_version, env }: Readonly<StatsProps>) {
  const { backfills, connected, connections } = useStats()
  const { pull, links } = stamp
  const told = pull ? pull.body : (stamp.message ?? '')
  const report = StatsReport.pageReport(
    StatsReport.buildReport(stamp, next_version, env),
    { react: reactVersion, convex: convexVersion, backend: convexUrl() ?? null, connected, connections },
    backfills,
  )
  const reportText = UU.jsonify(report)
  return (
    <Box component="main" className={styles.page} sx={{ maxWidth: 960, mx: 'auto' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="h4" component="h1">Stats</Typography>
        <CopyButton textOf={() => reportText}>Copy stats</CopyButton>
      </Stack>

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

      <Section title="Build environment">
        {EnvViz.grouped(env).map(([grouplabel, group]) => (
          <Section key={grouplabel} title={`${grouplabel} (${String(Object.keys(group).length)})`} open={grouplabel === 'main'} nested>
            <Facts rows={Object.entries(group).map(([envvar, shown]) => [envvar, <Shown key={envvar} shown={shown} />] as const)} ariaLabel={`Build environment: ${grouplabel}`} />
          </Section>
        ))}
      </Section>

      <Section title="As JSON">
        <ReadonlyBox label="Stats as JSON" text={reportText} rows={BoxRows} dense resizable />
      </Section>
    </Box>
  )
}

type SectionProps = {
  title:    string
  /** Open to begin with; folded, unless said */
  open?:    boolean
  /** A part of a part: a smaller heading, a level down */
  nested?:  boolean
  children: ReactNode
}

/** One part of the page, under a heading that folds it away */
function Section({ title, open = false, nested = false, children }: Readonly<SectionProps>) {
  return (
    <Accordion component="section" defaultExpanded={open} disableGutters variant="outlined" slotProps={{ heading: { component: nested ? 'h3' : 'h2' } }} sx={{ mt: nested ? 1 : 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant={nested ? 'h6' : 'h5'} component="span">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {children}
      </AccordionDetails>
    </Accordion>
  )
}

type FactsProps = {
  rows:       readonly (readonly [string, ReactNode])[]
  ariaLabel?: string
}

/** Facts as a two-column table, one to a row; a dash for one nobody could tell (null) */
function Facts({ rows, ariaLabel }: Readonly<FactsProps>) {
  return (
    <Table size="small" aria-label={ariaLabel}>
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

/** What may be seen of a variable's value: the value, or what stands in for it, in parentheses and set apart as no value at all */
function Shown({ shown }: Readonly<{ shown: EnvViz.EnvShownT }>) {
  if ('seen' in shown) { return <code>{shown.seen}</code> }
  return <Typography component="span" variant="inherit" color="text.secondary" sx={{ fontStyle: 'italic' }}>({shown.standin})</Typography>
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

/** The deployment's backfills, those still defined first; a state of `unknown` is one never run here. An admin's, or anyone's where the deployment exposes them. */
function Backfills({ backfills }: Readonly<{ backfills: readonly BackfillStatusT[] | null | undefined }>) {
  if (backfills === undefined) { return <Typography variant="body2" color="text.secondary">Asking the deployment…</Typography> }
  if (backfills === null) { return <Typography variant="body2" color="text.secondary">Only an admin sees these: choose a handle first.</Typography> }
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
