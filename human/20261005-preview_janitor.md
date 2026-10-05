# 2026-10-05: Preview janitor -- `pnpm previews`, and why the limit was hit

* **`pnpm previews`** lists every Convex preview, oldest first (made, expires, branch, label);
  `pnpm previews drop-oldest [count]` deletes the `count` (5) oldest. Run once today: the five
  oldest, all from 2026-09-30, are gone; 33 remain.
* **The 36-hour lifetime is working.** Every preview built since 2026-10-03 expires 36 hours
  after its last build. Only the 2026-09-30 ones still had Convex's five-day default.
* **The close-a-PR pruner has never worked.** All 27 runs of `.github/workflows/convex-previews.yml`
  failed: GitHub has no `CONVEX_PREVIEW_PRUNER_KEY` secret (`gh secret list`), so the script sees
  an empty key and refuses. The Doppler-to-GitHub sync for that key needs setting up; once it is,
  re-run the workflow by hand for the merged branches still holding a preview. Until then a sprint
  of thirty PRs holds thirty previews for a day and a half.
