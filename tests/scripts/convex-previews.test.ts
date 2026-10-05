import { describe, expect, it } from 'vitest'
import * as ConvexPreviews from '../../scripts/convex-previews'

const Rows: ConvexPreviews.DeploymentRow[] = [
  { name: 'prestigious-coyote-542', deploymentType: 'prod',    previewIdentifier: null },
  { name: 'prestigious-gull-995',   deploymentType: 'dev',     previewIdentifier: null },
  { name: 'nautical-gazelle-285',   deploymentType: 'preview', previewIdentifier: '20260929-failure_logging', expiresAt: 1_791_093_778_715 },
  { name: 'laudable-parrot-769',    deploymentType: 'preview', previewIdentifier: '20260930-edit_hunt' },
]

describe('previewKeyOf', () => {
  it("gives a preview deploy key with the team and project it names", () => {
    expect(ConvexPreviews.previewKeyOf('preview:flip:triquet|eyJ...')).to.deep.equal({ deploykey: 'preview:flip:triquet|eyJ...', teamslug: 'flip', projectslug: 'triquet' })
  })
  const RefusedCases: [string | undefined, string][] = [
    ['prod:prestigious-coyote-542|eyJ...', 'a production deploy key'],
    ['dev:prestigious-gull-995|eyJ...',    'a dev deploy key'],
    ['preview:flip:triquet|',              'a preview prefix with no token behind it'],
    ['preview:flip|eyJ...',                'a preview prefix with no project'],
    ['',                                   'an empty key'],
    [undefined,                            'no key at all'],
  ]
  for (const [deploykey, blurb] of RefusedCases) {
    it(`refuses ${blurb}`, () => {
      expect(() => ConvexPreviews.previewKeyOf(deploykey)).to.throw(/not a preview deploy key/)
    })
  }
})

describe('previewFor', () => {
  const PreviewForCases: [string, string | undefined, string][] = [
    // regular usage:
    ["20260929-failure_logging", 'nautical-gazelle-285', 'finds the preview named for the branch'],
    ["20260930-edit_hunt",       'laudable-parrot-769',  'finds a preview with no expiry set'],
    // trivial cases:
    ["20260930-no_such_branch",  undefined,              'a branch that never built has none'],
    ["",                         undefined,              'an empty branch name matches nothing'],
    // weird cases:
    ["20260929-failure-logging", undefined,              "the deployment's hyphenated reference is not its branch"],
    ["prestigious-coyote-542",   undefined,              'production is never a preview, even by name'],
  ]
  for (const [branch, expected, blurb] of PreviewForCases) {
    it(blurb, () => {
      expect(ConvexPreviews.previewFor(Rows, branch)?.name).to.equal(expected)
    })
  }
  it("finds nothing among no deployments", () => {
    expect(ConvexPreviews.previewFor([], '20260930-edit_hunt')).to.equal(undefined)
  })
})

describe('previewsByAge', () => {
  const AgedRows: ConvexPreviews.DeploymentRow[] = [
    { name: 'prestigious-coyote-542', deploymentType: 'prod',    previewIdentifier: null,                       createTime: 1 },
    { name: 'basic-gnat-186',         deploymentType: 'preview', previewIdentifier: '20261004-category_personas', createTime: Date.UTC(2026, 9, 4, 11, 42) },
    { name: 'utmost-dog-883',         deploymentType: 'preview', previewIdentifier: '20260930-chai_in_vitest',    createTime: Date.UTC(2026, 8, 30, 11, 44) },
    { name: 'third-squid-122',        deploymentType: 'preview', previewIdentifier: '20261001-quiz_review',       createTime: Date.UTC(2026, 9, 4, 0, 18) },
    { name: 'laudable-parrot-769',    deploymentType: 'preview', previewIdentifier: '20260930-edit_hunt' },
  ]
  it("gives the previews alone, the oldest made first, an unknown making time oldest of all", () => {
    expect(ConvexPreviews.previewsByAge(AgedRows).map((row) => row.name)).to.deep.equal(['laudable-parrot-769', 'utmost-dog-883', 'third-squid-122', 'basic-gnat-186'])
  })
  it("gives nothing among no deployments", () => {
    expect(ConvexPreviews.previewsByAge([])).to.deep.equal([])
  })
  it("leaves the rows it was handed in their order", () => {
    ConvexPreviews.previewsByAge(AgedRows)
    expect(AgedRows[1]?.name).to.equal('basic-gnat-186')
  })
})

describe('previewLine', () => {
  it("gives the times to the minute in UTC, the branch, and the label", () => {
    const row = { name: 'utmost-dog-883', deploymentType: 'preview', previewIdentifier: '20260930-chai_in_vitest', createTime: Date.UTC(2026, 8, 30, 11, 44, 4), expiresAt: Date.UTC(2026, 9, 5, 11, 44, 4) }
    expect(ConvexPreviews.previewLine(row)).to.deep.equal({ made: '2026-09-30 11:44', expires: '2026-10-05 11:44', branch: '20260930-chai_in_vitest', label: 'utmost-dog-883' })
  })
  it("dashes what the row does not say", () => {
    expect(ConvexPreviews.previewLine({ name: 'laudable-parrot-769', deploymentType: 'preview', previewIdentifier: null, expiresAt: null })).to.deep.equal({ made: '-', expires: '-', branch: '-', label: 'laudable-parrot-769' })
  })
})

describe('expiryAfter', () => {
  it("is the given hours past now", () => {
    expect(ConvexPreviews.expiryAfter(Date.UTC(2026, 8, 30, 12), 36)).to.equal(Date.UTC(2026, 9, 2, 0))
  })
  it("takes fractional hours", () => {
    expect(ConvexPreviews.expiryAfter(0, 0.5)).to.equal(30 * 60 * 1000)
  })
})

describe('vercelPreviewBranch', () => {
  const VercelCases: [ConvexPreviews.EnvBag, string | undefined, string][] = [
    [{ VERCEL_ENV: 'preview',    VERCEL_GIT_COMMIT_REF: '20260930-edit_hunt' }, '20260930-edit_hunt', 'a preview build gives its branch'],
    [{ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' },               undefined,            'a production build gives none'],
    [{ VERCEL_ENV: 'preview' },                                                 undefined,            'a preview build with no branch gives none'],
    [{},                                                                        undefined,            'a build outside Vercel gives none'],
  ]
  for (const [env, expected, blurb] of VercelCases) {
    it(blurb, () => {
      expect(ConvexPreviews.vercelPreviewBranch(env)).to.equal(expected)
    })
  }
})
