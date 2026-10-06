import { execFileSync } from 'node:child_process'

// What a build can say about itself, gathered as it is built: which commit, the pull request whose
// merge it is, and when. Vercel hands a build its git facts in its environment; anywhere else git
// is asked. Every fact is a best effort, and one nobody could tell is null. Server-side only: a
// view takes the stamp as a prop, and imports nothing here but its types.

/** A process's environment, or as much of one as a caller cares to give */
export type EnvBag = Record<string, string | undefined>

/** Runs git with `args`, and hands back what it printed, trimmed; null when git failed or printed nothing */
export type GitRunnerT = (args: readonly string[]) => string | null

/** The pull request a commit's message names */
export type PullT = {
  number: number
  title:  string
  /** The branch it merged, when the message says (GitHub's merge-commit form does) */
  branch: string | null
  /** The rest of the message: on a merge into main, the pull request's description */
  body:   string
}

/** One commit a merge brought in */
export type MergedCommitT = {
  sha:     string
  subject: string
}

/** Everything a build could tell about itself */
export type BuildStampT = {
  /** When this was built, as an ISO timestamp */
  built_at:      string
  /** Where the facts came from: Vercel's environment, the checkout's git, or neither */
  source:        'vercel' | 'git' | 'none'
  /** `production`, `preview` or `development` on Vercel; `local` anywhere else */
  deploy_env:    string
  /** The deployment's own address, on Vercel */
  deploy_url:    string | null
  deployment_id: string | null
  /** `owner/name` on GitHub */
  repo:          string | null
  sha:           string | null
  ref:           string | null
  /** The commit's whole message */
  message:       string | null
  author:        string | null
  pull:          PullT | null
  /** What the merge brought in, newest first; empty for a commit that is not a merge, or a clone too shallow to tell */
  merged:        MergedCommitT[]
  /** The commit of the deployment this one follows, on Vercel */
  previous_sha:  string | null
  node_version:  string
  links: {
    commit:  string | null
    pull:    string | null
    /** Every change between the deployment before and this one */
    compare: string | null
  }
}

/** How many of a merge's commits a stamp lists, at most */
export const MergedMax = 40

/**
 * Everything this build can tell about itself, from Vercel's environment where it has one, and
 * otherwise from git.
 *
 * @param env - The build's environment: `process.env`.
 * @param git - How to ask git (`runGit`, or a stand-in).
 * @param now - The moment of the build.
 * @param node_version - The Node that builds it: `process.version`.
 * @returns The stamp; a fact nobody could tell is null.
 *
 * @example gather({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: '358e01e…', VERCEL_GIT_COMMIT_MESSAGE: 'Jsonballs (#126)\n\nEvery resource…', … }, runGit, new Date(), 'v24.1.0')
 *   // => { source: 'vercel', deploy_env: 'production', pull: { number: 126, title: 'Jsonballs', branch: null, body: 'Every resource…' }, … }
 * @example gather({}, () => null, new Date('2026-10-06T12:00:00Z'), 'v24.1.0')
 *   // => { source: 'none', deploy_env: 'local', sha: null, pull: null, merged: [], built_at: '2026-10-06T12:00:00.000Z', … }
 */
export function gather(env: EnvBag, git: GitRunnerT, now: Date, node_version: string): BuildStampT {
  // Vercel sets some of its variables empty rather than leaving them out
  const given    = (key: string): string | null => ((env[key] ?? '') === '' ? null : env[key] ?? null)
  const vercelSha = given('VERCEL_GIT_COMMIT_SHA')
  const sha      = vercelSha ?? git(['rev-parse', 'HEAD'])
  const message  = given('VERCEL_GIT_COMMIT_MESSAGE') ?? (sha ? git(['log', '-1', '--format=%B', sha]) : null)
  const owner    = given('VERCEL_GIT_REPO_OWNER')
  const slug     = given('VERCEL_GIT_REPO_SLUG')
  const repo     = (owner && slug) ? `${owner}/${slug}` : repoOf(git(['remote', 'get-url', 'origin']))
  const pull         = message ? pullOf(message, given('VERCEL_GIT_PULL_REQUEST_ID') ?? undefined) : null
  const previous_sha = given('VERCEL_GIT_PREVIOUS_SHA')
  const gitSource    = sha ? 'git' : 'none'
  return {
    built_at:      now.toISOString(),
    source:        vercelSha ? 'vercel' : gitSource,
    deploy_env:    given('VERCEL_ENV') ?? 'local',
    deploy_url:    given('VERCEL_URL'),
    deployment_id: given('VERCEL_DEPLOYMENT_ID'),
    repo,
    sha,
    ref:           given('VERCEL_GIT_COMMIT_REF') ?? git(['rev-parse', '--abbrev-ref', 'HEAD']),
    message,
    author:        given('VERCEL_GIT_COMMIT_AUTHOR_LOGIN') ?? given('VERCEL_GIT_COMMIT_AUTHOR_NAME') ?? (sha ? git(['log', '-1', '--format=%an', sha]) : null),
    pull,
    merged:        sha ? mergedOf(git(['log', `--max-count=${String(MergedMax)}`, '--format=%h %s', `${sha}^1..${sha}^2`])) : [],
    previous_sha,
    node_version,
    links: {
      commit:  (repo && sha) ? `https://github.com/${repo}/commit/${sha}` : null,
      pull:    (repo && pull) ? `https://github.com/${repo}/pull/${String(pull.number)}` : null,
      compare: (repo && sha && previous_sha) ? `https://github.com/${repo}/compare/${previous_sha}...${sha}` : null,
    },
  }
}

/**
 * The pull request a commit's message names: GitHub's merge commit (`Merge pull request #12 from
 * owner/branch`, then the title), or a title it ends with `(#12)`, as a merge whose message is
 * the pull request's title and description says, and as a squash does. Failing those, the pull
 * request a preview was built for, titled with the message's first line.
 *
 * @param message - A commit's whole message.
 * @param pull_id - The pull request a preview build is for (`VERCEL_GIT_PULL_REQUEST_ID`), if any.
 * @returns The pull request; null for a message that names none, with no preview's to fall back on.
 *
 * @example pullOf('Jsonballs (#126)\n\nEvery resource…')                                  // => { number: 126, title: 'Jsonballs', branch: null, body: 'Every resource…' }
 * @example pullOf('Merge pull request #7 from mrflip/20260930-misc\n\nOdds and ends')      // => { number: 7, title: 'Odds and ends', branch: '20260930-misc', body: '' }
 * @example pullOf('feat: jsonballs', '131')                                                // => { number: 131, title: 'feat: jsonballs', branch: null, body: '' }
 * @example pullOf('docs: swept from the main checkout')                                    // => null
 */
export function pullOf(message: string, pull_id?: string): PullT | null {
  const [head = '', ...rest] = message.trim().split('\n')
  const body = rest.join('\n').trim()
  const githubMerge = /^Merge pull request #(\d+) from [^\s/]+\/(\S+)$/.exec(head)
  if (githubMerge) {
    const [title = '', ...after] = body.split('\n')
    return { number: Number(githubMerge[1]), title: title.trim(), branch: githubMerge[2] ?? null, body: after.join('\n').trim() }
  }
  const titled = / \(#(\d+)\)$/.exec(head)
  if (titled) { return { number: Number(titled[1]), title: head.slice(0, titled.index).trim(), branch: null, body } }
  if (pull_id && /^\d+$/.test(pull_id)) { return { number: Number(pull_id), title: head, branch: null, body } }
  return null
}

/**
 * The commits git listed, one `<sha> <subject>` to a line.
 *
 * @example mergedOf('6595883 docs: swept\n9c2beca fix: older exports')  // => [{ sha: '6595883', subject: 'docs: swept' }, { sha: '9c2beca', subject: 'fix: older exports' }]
 * @example mergedOf(null)                                               // => []
 */
export function mergedOf(listing: string | null): MergedCommitT[] {
  if (! listing) { return [] }
  return listing.split('\n').filter(Boolean).map((line) => {
    const [sha = '', ...subject] = line.split(' ')
    return { sha, subject: subject.join(' ') }
  })
}

/**
 * The GitHub repository a remote's address names, as `owner/name`.
 *
 * @example repoOf('git@github.com:mrflip/triquet.git')      // => 'mrflip/triquet'
 * @example repoOf('https://github.com/mrflip/triquet')      // => 'mrflip/triquet'
 * @example repoOf('https://gitlab.com/mrflip/triquet.git')  // => null
 */
export function repoOf(remote: string | null): string | null {
  const [, ownerAndName] = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(remote ?? '') ?? []
  return ownerAndName ?? null
}

/** Git, run in the working directory: what it printed, trimmed, or null when it failed, was not there, or printed nothing */
export function runGit(args: readonly string[]): string | null {
  try {
    // git is wherever the build machine keeps it, and only ever reads the checkout here
    const printed = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim() // eslint-disable-line sonarjs/no-os-command-from-path
    return printed || null
  } catch {
    return null
  }
}
