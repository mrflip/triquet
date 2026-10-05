# 2026-10-05: Backfills run themselves on deploy

Production's deploy now runs `migrations:runAll` after `convex deploy` and waits for
`migrations:outstanding` to empty (`scripts/convex-migrations.ts`). Branched from `main`, not the
spine, at your request, to fast-track it.

Things for you, not done here:

* **The first production deploy after this merges runs whatever `Backfills` holds**: the hunts'
  orgs, the questions' viz, then the stamps on every stamped table (as rebased onto main of
  2026-10-06). If you already ran them by hand (`human/20261005-orglabel.md`,
  `human/20261006-viz.md`) they are skipped; if not, they run now, which is what they were written
  for, but it is the first time one runs without a person watching.
* **Vercel's build concurrency.** If production builds can run at once, two `convex/` changes
  merged in quick succession can leave Convex on the older one. Worth a look in the project's
  settings; tolerated for now (`notes/deploy.md`, *Serial Deploy*).
* **`--preview-run` naming an internal function** is the one piece not proven: no preview has
  run it yet. The first preview build of this branch will say; a failure there fails only that
  preview's build.
* **`convex run` under a production deploy key** targets that deployment and ignores `--prod`
  (read in the CLI's source, 1.46.0), so the script passes no flag.
* **The PR title marker** `(Serial Deploy: <chain>)` is in `notes/git_hygiene.md` (*Filing the
  PR*), which thread workers follow; the merging rule is in `notes/deploy.md`, *Serial Deploy*.
