import nextPackage from 'next/package.json'
import * as BuildStamp from '../../lib/build-stamp'
import * as StatsReport from '../../lib/stats-report'

// Made once, as the app is built, and served as a file: the build can say nothing more later, and
// this adds no server function (notes/decisions/20260928-database-decisions.md, *Client-first*).
export const dynamic = 'force-static'

/** What the build says of itself, as JSON: the page at `/stats` without what only a browser can add */
export function GET(): Response {
  const stamp = BuildStamp.gather(process.env, BuildStamp.runGit, new Date(), process.version)
  return Response.json(StatsReport.buildReport(stamp, nextPackage.version))
}
