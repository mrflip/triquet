import type { Metadata } from 'next'
import nextPackage from 'next/package.json'
import { Stats } from '../../../components/Stats'
import * as BuildStamp from '../../../lib/build-stamp'
import * as EnvViz from '../../../lib/env-viz'

export const metadata: Metadata = { title: 'Stats', robots: { index: false, follow: false } }

// Rendered once, as the app is built, so the stamp and the environment are the build's own; nothing here runs on a server after.
// The environment is masked here, before it is handed to the view, so no value it hides reaches a browser.
export const dynamic = 'force-static'

/** Which build this is, the pull request it came from, the environment it was built in, and how far the deployment's backfills have run. Linked from nowhere. */
export default function StatsPage() {
  const stamp = BuildStamp.gather(process.env, BuildStamp.runGit, new Date(), process.version)
  return <Stats stamp={stamp} next_version={nextPackage.version} env={EnvViz.visualize(process.env)} />
}
