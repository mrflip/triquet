import { describe, expect, it } from 'vitest'
import * as BuildStamp from '../../src/lib/build-stamp'

const BuiltAt = new Date('2026-10-06T12:00:00Z')

const MergeSha = '358e01eafbb5155bbdc2aa8407c98de2e780a0c3'

/** What Vercel hands a production build of a merge into main */
const VercelEnv: BuildStamp.EnvBag = {
  VERCEL_ENV:                     'production',
  VERCEL_URL:                     'triquet-abc123-mrflip.vercel.app',
  VERCEL_DEPLOYMENT_ID:           'dpl_123',
  VERCEL_GIT_REPO_OWNER:          'mrflip',
  VERCEL_GIT_REPO_SLUG:           'triquet',
  VERCEL_GIT_COMMIT_SHA:          MergeSha,
  VERCEL_GIT_COMMIT_REF:          'main',
  VERCEL_GIT_COMMIT_MESSAGE:      "Jsonballs: every resource at its key path (#126)\n\nStacked on #125.\n\n**Jsonballs.** Each resource…",
  VERCEL_GIT_COMMIT_AUTHOR_LOGIN: 'mrflip',
  VERCEL_GIT_PREVIOUS_SHA:        '431b871e8651bc6c7bdb0f1afaf5d59fce3d05a9',
  VERCEL_GIT_PULL_REQUEST_ID:     '',
}

/** A git that answers from a table, keyed by its arguments joined with spaces, and fails at anything else */
function gitAnswering(answers: Record<string, string>): BuildStamp.GitRunnerT {
  return (args) => answers[args.join(' ')] ?? null
}

describe("BuildStamp.gather", () => {
  it("takes a Vercel build's facts from its environment, and the merge's commits from git", () => {
    const git = gitAnswering({
      [`log --max-count=${String(BuildStamp.MergedMax)} --format=%h %s ${MergeSha}^1..${MergeSha}^2`]: "6595883 docs: swept\n9c2beca fix: older exports",
    })
    const stamp = BuildStamp.gather(VercelEnv, git, BuiltAt, 'v24.1.0')
    expect(stamp).to.deep.eq({
      built_at:      '2026-10-06T12:00:00.000Z',
      source:        'vercel',
      deploy_env:    'production',
      deploy_url:    'triquet-abc123-mrflip.vercel.app',
      deployment_id: 'dpl_123',
      repo:          'mrflip/triquet',
      sha:           MergeSha,
      ref:           'main',
      message:       VercelEnv.VERCEL_GIT_COMMIT_MESSAGE,
      author:        'mrflip',
      pull:          { number: 126, title: 'Jsonballs: every resource at its key path', branch: null, body: "Stacked on #125.\n\n**Jsonballs.** Each resource…" },
      merged:        [{ sha: '6595883', subject: 'docs: swept' }, { sha: '9c2beca', subject: 'fix: older exports' }],
      previous_sha:  '431b871e8651bc6c7bdb0f1afaf5d59fce3d05a9',
      node_version:  'v24.1.0',
      links: {
        commit:  `https://github.com/mrflip/triquet/commit/${MergeSha}`,
        pull:    'https://github.com/mrflip/triquet/pull/126',
        compare: `https://github.com/mrflip/triquet/compare/431b871e8651bc6c7bdb0f1afaf5d59fce3d05a9...${MergeSha}`,
      },
    })
  })

  it("asks git for each fact away from Vercel", () => {
    const git = gitAnswering({
      'rev-parse HEAD':              'abc1234def',
      'rev-parse --abbrev-ref HEAD':  '20261006-stats_page',
      'log -1 --format=%B abc1234def': "feat: a stats page",
      'log -1 --format=%an abc1234def': 'Pat Smiths',
      'remote get-url origin':       'git@github.com:mrflip/triquet.git',
    })
    const stamp = BuildStamp.gather({}, git, BuiltAt, 'v24.1.0')
    expect(stamp).to.include({ source: 'git', deploy_env: 'local', sha: 'abc1234def', ref: '20261006-stats_page', message: "feat: a stats page", author: 'Pat Smiths', repo: 'mrflip/triquet', pull: null, previous_sha: null })
    expect(stamp.merged).to.deep.eq([])
    expect(stamp.links).to.deep.eq({ commit: 'https://github.com/mrflip/triquet/commit/abc1234def', pull: null, compare: null })
  })

  it("says nothing it could not tell, with neither Vercel nor git", () => {
    const stamp = BuildStamp.gather({}, () => null, BuiltAt, 'v24.1.0')
    expect(stamp).to.deep.eq({
      built_at: '2026-10-06T12:00:00.000Z', source: 'none', deploy_env: 'local', deploy_url: null, deployment_id: null,
      repo: null, sha: null, ref: null, message: null, author: null, pull: null, merged: [], previous_sha: null,
      node_version: 'v24.1.0', links: { commit: null, pull: null, compare: null },
    })
  })

  it("treats a variable Vercel leaves empty as one it did not set", () => {
    const stamp = BuildStamp.gather({ ...VercelEnv, VERCEL_GIT_COMMIT_AUTHOR_LOGIN: '', VERCEL_GIT_COMMIT_AUTHOR_NAME: 'Flip', VERCEL_GIT_PREVIOUS_SHA: '' }, () => null, BuiltAt, 'v24.1.0')
    expect(stamp.author).to.eq('Flip')
    expect(stamp.previous_sha).to.be.null
    expect(stamp.links.compare).to.be.null
  })
})

const PullCases: [[string, string?], BuildStamp.PullT | null, string][] = [
  // regular usage:
  [["Jsonballs (#126)\n\nEvery resource…"],                               { number: 126, title: "Jsonballs",      branch: null,             body: "Every resource…" }, 'a merge titled as its pull request, with the description below'],
  [["Merge pull request #7 from mrflip/20260930-misc\n\nOdds and ends"],  { number: 7,   title: "Odds and ends",  branch: "20260930-misc", body: "" },                'GitHub\'s merge commit names the branch, and the title follows'],
  [["Merge pull request #7 from mrflip/feat/nested\n\nOdds\n\nMore"],     { number: 7,   title: "Odds",           branch: "feat/nested",   body: "More" },            'a branch with a slash keeps everything past the owner'],
  [["feat: jsonballs", "131"],                                           { number: 131, title: "feat: jsonballs", branch: null,            body: "" },                'a preview build falls back on the pull request it was built for'],
  [["docs: swept from the main checkout"],                                null,                                                                                      'a commit that names no pull request'],
  // trivial cases:
  [[""],                                                                  null,                                                                                      'an empty message names none'],
  [["docs: swept", ""],                                                   null,                                                                                      'an empty preview id is no pull request'],
  // weird cases:
  [["Fix (#12) in the middle of things"],                                 null,                                                                                      'a number not at the end of the first line is not the pull request'],
  [["Wraps (#3) twice (#4)\nbody"],                                       { number: 4,   title: "Wraps (#3) twice", branch: null,          body: "body" },            'only the number that ends the line counts'],
  [["docs: swept", "not-a-number"],                                       null,                                                                                      'a preview id that is no number is ignored'],
]

describe("BuildStamp.pullOf", () => {
  for (const [[message, pull_id], expected, describes] of PullCases) {
    it(describes, () => {
      expect(BuildStamp.pullOf(message, pull_id)).to.deep.eq(expected)
    })
  }
})

describe("BuildStamp.mergedOf", () => {
  it("reads one commit to a line, the subject keeping its spaces", () => {
    expect(BuildStamp.mergedOf("6595883 docs: swept\n9c2beca fix: older exports")).to.deep.eq([
      { sha: '6595883', subject: 'docs: swept' },
      { sha: '9c2beca', subject: 'fix: older exports' },
    ])
  })
  it("reads nothing from a git that answered nothing", () => {
    expect(BuildStamp.mergedOf(null)).to.deep.eq([])
  })
})

const RepoCases: [string | null, string | null, string][] = [
  // regular usage:
  ["git@github.com:mrflip/triquet.git",      "mrflip/triquet", 'an ssh remote'],
  ["https://github.com/mrflip/triquet",      "mrflip/triquet", 'an https remote without the suffix'],
  ["https://github.com/mrflip/triquet.git",  "mrflip/triquet", 'an https remote with it'],
  ["https://github.com/mr.flip/tri-quet.git", "mr.flip/tri-quet", 'dots and hyphens in either part'],
  // trivial cases:
  [null,                                     null,             'no remote'],
  // weird cases:
  ["https://gitlab.com/mrflip/triquet.git",  null,             'a remote that is not on GitHub'],
]

describe("BuildStamp.repoOf", () => {
  for (const [remote, expected, describes] of RepoCases) {
    it(describes, () => {
      expect(BuildStamp.repoOf(remote)).to.eq(expected)
    })
  }
})

describe("BuildStamp.runGit", () => {
  it("hands back what git printed, trimmed", () => {
    expect(BuildStamp.runGit(['rev-parse', '--is-inside-work-tree'])).to.eq('true')
  })
  it("hands back null when git fails", () => {
    expect(BuildStamp.runGit(['rev-parse', 'no-such-ref-at-all^{commit}'])).to.be.null
  })
})
