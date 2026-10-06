# 2026-10-06: Vercel previews on PR open -- needs three secrets and a label before its PR opens

Branch `20261006-vercel_previews`, landed on the spine, **PR not opened**: its own opening is the
acceptance test, so the secrets come first.

* **What changed.** `vercel.json` turns Vercel's push builds off for every `20*` branch
  (`git.deploymentEnabled`); `main` still builds production on merge. `.github/workflows/preview.yml`
  asks Vercel's REST API (`POST /v13/deployments`, with `gitSource`) for a preview of the head
  commit when a PR opens, reopens or is marked ready, and again on the `preview` label, which it
  then takes off. It polls until READY or ERROR (fifteen minutes at most), writes the branch and
  deployment addresses to the job summary, and keeps one PR comment with the branch address,
  rewritten on each refresh. Docs: `notes/deploy.md` (*The pieces*, *Previews*), `notes/stack.md`
  (GitHub Actions), `notes/env_vars_tokens_and_keys.md`.

## Before opening the PR

1. **Make a Vercel access token** scoped to the `mrflips-projects` team (Account Settings ->
   Tokens), named for this workflow alone so it can be revoked alone.
2. **Add three secrets to GitHub Actions**, through Doppler's GitHub sync as
   `CONVEX_PREVIEW_PRUNER_KEY` goes: `VERCEL_TOKEN` (the token), `VERCEL_PROJECT_ID` (`prj_...`,
   the `triquet` project's *Settings -> General*), `VERCEL_TEAM_ID` (`team_...`, the team's
   settings). A missing one fails the job with its name.
3. **Make the `preview` label**: `gh label create preview --description "Rebuild the Vercel preview"`.

## Acceptance test, on this PR's opening

* (a) The deployment in Vercel's dashboard shows the commit's message, as a push-built one did.
* (b) `https://triquet-git-20261006-vercelpreviews-mrflips-projects.vercel.app/` serves it (Vercel
  drops the underscore, as `20261005-hunt_repo` became `huntrepo`; the
  job summary and PR comment name the address it assigned).
* (c) A push to any `20*` branch makes no deployment in Vercel at all, not even a cancelled one.
  (Only once the branch holds `vercel.json`: Vercel reads it from the commit pushed.)
* And: adding `preview` rebuilds and the label comes off; the PR keeps one comment, not two.

## Open

* **The risk, plainly:** Vercel's docs say `deploymentEnabled: false` stops deployments "upon
  commits", but not whether it also refuses an API Git deployment of that branch. If it does,
  the *Start the deployment* step fails with Vercel's refusal in the log. The fallback is the
  CLI, which builds from GitHub's checkout instead of Vercel's:
  `vercel deploy --meta githubDeployment=1 --meta githubCommitRef=<branch>`, then
  `vercel alias set <deployment-url> triquet-git-<slug>-mrflips-projects.vercel.app`. That gives
  the branch address by hand; whether Vercel's dashboard then shows the commit message is a
  second thing to check.
* **Duplicate comments?** I could not find whether Vercel's GitHub app comments on a PR for a
  deployment made through the API. The workflow posts its own, one per PR. If Vercel's bot
  comments as well, the workflow's comment step can go.
* **`forceNew=1`** on every request, so a refresh of an unchanged commit still rebuilds: that is
  how a preview whose Convex deployment has expired (36 hours after its build) gets a fresh one.
  It costs a build each time the label goes on, which is the point of the label.
* **Branches not named `20*`** (a Coach's hand-cut branch, Dependabot) still build on every push,
  as before.
* The Convex preview now lives 36 hours from the PR's opening rather than from its last push; a
  reviewer coming to it later adds `preview` first. Said in `notes/deploy.md`, *Previews*.
