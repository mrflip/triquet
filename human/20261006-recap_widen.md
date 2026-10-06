# 2026-10-06: Recap widening -- one check on production before merging it

Thread 1 of the recap sprint (`whiteboard/20261005-recap/thread-1-recap_widen.md`) gives a
question a `recap` field, which a formula reads as `qn.recap`. That makes `recap` a reserved
widgeting label, like `notes` or `title`: a widgeting already labelled `recap` on production would
still be served (the schema takes it, and the backfill passes it by), but every edit to it would be
refused, and in the bag its value would sit where the question's recap does.

Before merging the PR titled `(Serial Deploy: recap)`, please check that no widgeting is labelled
`recap` (agents do not touch production):

```
./scripts/doppledo prd_janitor npx convex data widgetings --limit 30000 --format jsonl | jq -c 'select(.label == "recap")'
```

Nothing printed means nothing to do. A hit wants relabelling (by hand, before the merge), or a
word to the worker.

Then the usual order: merge up to and including that PR, wait for its production build log to say
`Backfills: every one has finished.`, then merge the rest of the sprint; the tightening last.
