# Thread 7: Security review (2026-10-07)

Branch `20261007-security_review`, PR filed at landing; see the report. Suites: `pnpm justify` green;
`e2e/reviews.spec.ts`'s new test green on lane 3 (and failing without the panel's change);
`pnpm e2e --touched` at landing.

* **Built**:
  - **Findings**: `whiteboard/20261005-recap/security-findings.md` (read it if you are thread 8, or
    deciding a *For the Coach* call): what was fixed, what in the sprint was checked and found sound,
    what is left, and nine findings outside the sprint (O1-O9), each certain or uncertain, with
    evidence and a fix sketch. Summarized in `whiteboard/TODO.md`, *From recap sprint, thread 7*.
  - 040f219 `src/lib/templating.ts`: `FillWriter.renderTokens` counts a section's own text against
    `FilledMax` each time it is written out (`BagContext.spendText`), and `shape` counts what a
    helper is handed against `ShapedMax` (1,000,000). A 3,472-character field template ran Node out
    of memory before; 150 nested `{{#quote}}`s took 1.5 s per fill.
  - 0f5d08f `src/lib/markdown.ts`: `markdownsOwnLinesOf` gathers markdown's own lines into a set
    once (`lineNumsIn`) instead of walking every block per line.
  - 1d0a349 `imagesAsLinks` on `MarkdownText`/`MarkdownFace` (`src/components/cells/markdown.tsx`,
    `ImageLink`): used by `ReviewsPanel` and the reviewer's faces in `ReviewScreen`;
    `notes/markdown.md`'s image row says so. Tests: templating, markdown (a timing test: 1 s with
    the fix, 16 s without), cells/markdown, and `e2e/reviews.spec.ts` (a review's image reaches the
    smith as a link, with no `img`).
* **Review** (`fixed`): 8ef955a draws a linked image in a reviewer's words as the link's words, not a
  link inside a link; 0545078 gives the one-pass indent rule's timing test ten seconds, so a loaded
  bid does not time it out. After the review, at the orchestrator's word: the default recap
  template's budget on a very large quiz recorded (sprint item 3 in the findings, and TODO), and
  O7 corrected (mustache does call the empty function it builds, as a section; severity unchanged).
* **Decisions taken**:
  - **Reviewers' words keep no images on sight** (thread 12 left it here): a link by alt text,
    fetched if followed. Smiths' texts keep images (picture rounds need reviewers to see them).
  - **bbjank's protocol sets stay its own** (http/https links, https images), not
    `Markdown.Allowlist`'s (which adds `mailto`): both strict.
  - **A separate helper budget** (`ShapedMax`) rather than counting helper input against
    `FilledMax`: a recap's legitimate helpers see each field once, and double counting would eat into
    a long quiz's room.
* **Discoveries**:
  - Literal template text was never counted until the fill finished (thread 4's "bounded, not
    stopped early"); harmless alone thanks to V8's string ropes, fatal once a helper split it.
  - The residual cost of a very long text of lists is micromark's own parse (superlinear past
    ~200k characters), not ours.
  - The out-of-sprint sweep was delegated to a read-only agent and its findings checked by hand
    (`isAdmin`, `claimFor`, `identFor`, `hunts.open`, `prompts.ts`).
* **For the Coach**: O1 (the ask route is an open, paid proxy wherever bots are switched on) and O2
  (every username is a library admin) are the two that matter; both need a word from you before
  thread 8 can finish them (`human/20261007-security_review.md`). The decision on reviewers' images
  is a two-way door. No lint or type suppressions.
