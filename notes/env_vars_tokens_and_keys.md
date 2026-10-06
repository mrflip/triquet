# Environment variables, tokens and keys

Where each Convex and Vercel credential lives, and what it can reach. The values live in Doppler,
which syncs them onward; none is ever in the repo.

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

## Vercel's token, and where it goes

* **Vercel access token**: acts as the account that made it, within the scope chosen when it is
  made. Ours is scoped to the `mrflips-projects` team alone.

A repository secret and two repository variables, for `.github/workflows/preview.yml`, which
asks Vercel for a pull request's preview. Their values live in Doppler and sync to GitHub Actions,
as `CONVEX_PREVIEW_PRUNER_KEY` does; a Coach adds them. The workflow names any that is missing and
stops.

GitHub Actions keeps secrets (`secrets.X`: encrypted, masked in logs) and variables (`vars.X`:
plain text) apart, and a name read from the wrong one is simply empty. Doppler's sync sends a
masked value to the secrets and an unmasked one to the variables, so the workflow reads each
from the side its masking puts it on.

* `VERCEL_TOKEN`: a secret, masked in Doppler. The team-scoped access token, made for this alone
  so it can be revoked alone. Never in Vercel's own environment or an app config.
* `VERCEL_PROJECT_ID`: a variable, unmasked. The `triquet` project's ID (`prj_...`, on its
  settings' *General* page).
* `VERCEL_TEAM_ID`: a variable, unmasked. The team's ID (`team_...`, on the team's settings).
  Neither ID is secret, and left unmasked they stay legible in the workflow's logs.

## Planned

* A prod key with env-var read/write (plus deploy only if Actions will ever deploy). Goes into
  GitHub as a masked secret under a distinct name like `CONVEX_ENV_SYNC_KEY`, never into Vercel.
