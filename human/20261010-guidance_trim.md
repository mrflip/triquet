# 2026-10-10: Guidance trimmed for the cloud PR workflow

The first cuts from the guidance audit (the Claude doc *Cloud PR Workflow Guidance Audit*), as
agreed in chat. The files as they stood are in `notes/20261010-guidance_bkup.zip`, committed
first. What a minimal cloud PR session loads went from about 13,000 words to about 11,000.

**What moved where**

* `notes/git_hygiene.md`: *Merging (Coach only)* and the graph commands are now
  `notes/git_hygiene-coach.md`, a new file for what only the Coach does. *The shape we keep*,
  *Looking at the graph* (now *Stray branches*) and *Before discarding anything* are a short
  paragraph each. The e2e-skip section is untouched: that was under *Too strict*, not the cuts.
* `notes/git_hygiene-cloud.md`: *Why the bar is lower here* is gone (cloud.md says it); the
  branch-ownership recipe is one paragraph.
* `notes/testing.md`: the Playwright section is now `notes/e2e.md`, a rule of its own that loads on
  `e2e/**` only (symlinked from `.claude/rules/e2e.md`); the convex-test helper inventory is a
  module doc block at the top of `tests/support/convex.ts`, and the paragraph keeps only the rules
  the doc blocks do not carry.
* `CLAUDE.md`: the library-first rule is one bullet with pointers; the worked example lives in
  `notes/stack.md` only. The `convex-ai` block at the end is gone. `convex dev` will not nag about
  it (it checks the guidelines and skills hashes, not CLAUDE.md), but `npx convex ai-files update`
  would put it back; `npx convex ai-files disable` stops that, and is yours to run or not.
* `STYLE.md`: tags with no use in `src/` or `convex/` are gone (`dotkey`, `anypath`, `funcOrKey`,
  `funcOrPath`, `ruleOrKey`, `reducer`, `comparator`), with the indent and `var` rules eslint
  enforces.
* `notes/cloud.md`: a new section, *The harness and this repo*, says which rule wins where Claude
  Code's own instructions differ (draft PRs, merge-on-conflict, asking in chat, `wip:` commits).

**Not done, by scope**

* The commit-prefix scheme is proposed in the doc, not applied; *Commit messages* in
  `notes/git_hygiene.md` still says `feat:`/`fix:`.
* `npx convex ai-files disable` and pruning the Convex skills to the six the notes name.
* The *Too strict* and *Too loose* items (the e2e-skip sermon, the undefined words).

**Tests:** `pnpm lint`, `pnpm typecheck`, and `vitest run tests/scripts/spine.test.ts
tests/convex/hunts.test.ts` (295 passing). e2e skipped: documents, a comment in a script and a
doc block in test support; nothing the suite runs through changed.
