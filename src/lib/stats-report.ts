import type { BuildStampT } from './build-stamp'
import type { BackfillStatusT } from './rows'

/** What `/stats.json` says, and the top of what the stats page copies: the build, from the build */
export type BuildReportT = {
  build: BuildStampT
  /** The version of Next the build ran on */
  next:  string
}

/** What the stats page copies: the build's report, then what only a browser can say */
export type PageReportT = BuildReportT & {
  browser: {
    react:       string
    convex:      string
    /** The address of the database this browser talks to */
    backend:     string | null
    connected:   boolean
    connections: number
  }
  /** How far each backfill has run; null until the deployment has answered, and for a browser that may not see them */
  backfills: readonly BackfillStatusT[] | null
}

/**
 * What a build says of itself, as `/stats.json` serves it. It is made as the app is built, so it
 * holds nothing a browser or the deployment would add.
 *
 * @param stamp - The build's stamp (`BuildStamp.gather`).
 * @param next_version - The version of Next the build ran on.
 *
 * @example buildReport(stamp, '16.0.1')  // => { build: stamp, next: '16.0.1' }
 */
export function buildReport(stamp: BuildStampT, next_version: string): BuildReportT {
  return { build: stamp, next: next_version }
}

/**
 * Everything the stats page shows, as one value: the build's report with what this browser runs
 * and how far the deployment's backfills have run.
 *
 * @param build - The build's report (`buildReport`).
 * @param browser - What this browser runs and where it is connected.
 * @param backfills - The backfills; undefined while the deployment has not answered, null where it will not tell this browser.
 *
 * @example pageReport(buildReport(stamp, '16.0.1'), { react: '19.2.0', convex: '1.28.0', backend: null, connected: true, connections: 1 }, undefined)
 *   // => { build: stamp, next: '16.0.1', browser: { react: '19.2.0', … }, backfills: null }
 */
export function pageReport(build: BuildReportT, browser: PageReportT['browser'], backfills: readonly BackfillStatusT[] | null | undefined): PageReportT {
  return { ...build, browser, backfills: backfills ?? null }
}
