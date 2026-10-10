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

## Round two: the rest of the audit, about 70% of it

Same branch. The cloud container's git proxy refuses a tag push, so the marker is a branch
instead, `guidance_doctor-20261010`, cut at `d611dcbe` with no PR of its own. The Convex and guidelines notes joined the backup zip before they were
touched.

**Done**

* **Commit prefixes** are the combined scheme in `notes/git_hygiene.md`, *Commit messages*:
  `secure` (takes precedence), `model` (beats `db` when the schema or a migration moves),
  `db`, `widget`, `qedit`, `qmeta`, `qbase`, `ui`, `export`, `tools`, `agent`, `docs`, `plan`,
  `tests`, `e2e`, `gen`. This round's commit uses it.
* **The e2e-skip section** keeps its two lists and loses the sermon.
* **Convex**: `convex.json` disables `ai-files` (so `convex dev` neither prompts nor rewrites
  CLAUDE.md); `notes/convex.md` points at the guidelines file by section instead of "read it
  whole"; the skills bundle is pruned to the six the notes name, in both `.claude/skills/` and
  `.agents/skills/`, and `skills-lock.json` follows. `npx convex ai-files install` brings the rest
  back.
* **Contradictions closed**: CLAUDE.md's *(auto-loads)* marks now say what each file loads on;
  the eslint-disable rule reads "apply, then report" in both CLAUDE.md and STYLE.md; `notes/e2e.md`
  maps the three spellings of the e2e command.
* **Loose words**: "proportional" gets its clause in CLAUDE.md; "the corner is small" is about five
  spec files; "dagger functions" are arrow functions; IUCWIDT and the camel-case taste rule are
  gone; STYLE.md says CLAUDE.md's digest covers a small edit; `notes/cloud.md` no longer narrates
  the hook; `notes/testing.md` keeps one sentence on the chai lint; `notes/e2e.md`'s assertion
  section keeps only what lint cannot catch.

**Left over**, to see over time whether they are missed

* STYLE.md's import section and *Visual Weight* prose; the lodash-flavoured *Choosing Examples*
  list in `notes/testing.md`.
* `notes/e2e.md`'s *Locate as a person would* paragraph, which `prefer-native-locators` half
  enforces.
* CLAUDE.md's library-first bullet still says "with a Coach's yes"; `notes/cloud.md` routes a
  cloud session around it rather than the rule changing.
* A section-by-section map of which parts of Convex's guidelines this project uses.
* A note that the `Claude-Session` trailer the cloud git file relies on is the harness's doing.
* The *Rebase conflicts* tag procedure, kept whole.
