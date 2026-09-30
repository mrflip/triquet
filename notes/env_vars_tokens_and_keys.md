# Environment variables, tokens and keys

Where each Convex credential lives, and what it can reach. The values live in Doppler, which syncs
them onward; none is ever in the repo.

## The kinds of Convex key

* **Production deploy key**: reaches the production deployment, with the permissions chosen when
  it is made (`deployment:deploy`, `deployment:env:write`, ...).
* **Preview deploy key** (`preview:<team>:<project>|...`): reaches the project's preview
  deployments and nothing else, with no permissions to choose. With the convex CLI it makes or
  reuses a preview named for a branch; as a Management API bearer token it lists, re-expires and
  deletes previews. Production answers it "not found".
* **Team access token**: acts with every power of the team member who made it. Keep it out of CI.

## Where each one goes

* `CONVEX_DEPLOY_KEY`: Prod deploy key, has only deployment:deploy. Syncs to Vercel Production.
* Preview deploy key. Goes in web/preview, masked, and syncs to Vercel Preview. With it, deploy
  targets a preview deployment named after the current Git branch when running in CI (and
  `pnpm build:vercel` sets that preview to expire 36 hours out).
* `CONVEX_PREVIEW_PRUNER_KEY`: a preview deploy key of its own, so it can be revoked alone. Syncs
  to GitHub Actions, for `.github/workflows/convex-previews.yml`, which deletes a closed pull
  request's preview.
* `dev_aijanitor`, for tending the cloud by hand:
  - `CONVEX_PREVIEW_DEPLOY_KEY`: a preview deploy key; `scripts/convex_preview` puts it in
    `CONVEX_DEPLOY_KEY`'s place.
  - `CONVEX_UBER_PRD_DEPLOY_KEY`: a production deploy key with wider permissions.
  - `CONVEX_TEAM_KEY`: a team access token.

## Planned

* A prod key with env-var read/write (plus deploy only if Actions will ever deploy). Goes into
  GitHub as a masked secret under a distinct name like `CONVEX_ENV_SYNC_KEY`, never into Vercel.
