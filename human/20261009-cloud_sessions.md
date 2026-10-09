# 2026-10-09: Cloud sessions -- a session hook, and the docs split into laptop and cloud

Branch `20261009-cloud_sessions`, from a cloud session. What it needs from you:

- **The laptop's sessions change too.** CLAUDE.md no longer holds the lanes, worktrees and
  thread steps: they moved verbatim into `notes/laptop.md`, which the new session-start hook
  prints when `$TQ_IS_SANDBOXED` is `true`. Worth one laptop session to see that it arrives (a
  managed setting that blocks project hooks would hide it; CLAUDE.md says to read it if absent).
- **Settled since:** cloud PRs open ready for review, not as drafts, and a cloud session files
  one branch and one PR per milestone (stacked when one builds on another unmerged).
- **Node.** The cloud container runs Node 22.22 and pnpm 12.4.2; `.tool-versions` pins 24.21 and
  12.7. Typecheck, the unit tests and e2e all pass on 22. Nothing here changes the pin.
- **Doppler in the cloud** stays optional: without it `scripts/doppledo` runs bare there, as CI
  does. Adding `DOPPLER_TOKEN_DEV_CLAUDE` and `DOPPLER_TOKEN_DEV_E2E` to the cloud environment
  makes the hook install the CLI and `doppledo` use them as on the laptop.
- **Not done:** the managed settings' deny list (no force-push, no `doppler secrets`) still lives
  only in the devcontainer, per your note.
