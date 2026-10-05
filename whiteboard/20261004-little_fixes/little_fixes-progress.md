# Sprint `little_fixes`: progress

The running handoff. Newer than `little_fixes-plan.md` wherever they disagree. Workers append
their sections below the table, newest first.

## Status

| Thread | Name                         | Branch | PR | Status  |
| ------ | ---------------------------- | ------ | -- | ------- |
| 1      | the ident gate               | `20261005-ident_gate` | #96 | merged via #99 |
| 2      | the hunts page lines up      | `20261005-hunts_aligned` | #99 | merged by the Coach; review rides with 1b |
| 1b     | the ident gate, follow-up    | `20261005-ident_gate_again` |  | underway |
| 3      | quiz mode: grid and widgets  |        |    | pending |

## Thread 2: the hunts page lines up (2026-10-05)

*Orchestrator:* written by the orchestrator from the worker's report, by the Coach's leave: the
worker's own write of this section was refused (see *Incident*).

Branch `20261005-hunts_aligned`, PR #99, stacked on #96. Suites: typecheck and lint clean;
`pnpm test` 123 files, 3284 tests; `pnpm test:e2e` 221 passed.

* **Built**: `src/components/HuntsList.tsx` -- each hunt is a row of a small MUI `Table` (as
  `MembersPanel`'s): Hunt (row header), Your role, the gear, Categories, Quizzes; cells share a
  baseline. Quizzes flow and wrap in their cell, 24px apart (was 8px). Under 720px of table
  width the Quizzes column hides and each hunt's quizzes take a full-width line beneath it: a
  container query on `TableContainer` with a `RoomFor` constant, as `ColumnsEditor` does; both
  layouts render and CSS shows one. Each quiz link starts with 🤔 (unlocked, "Still being worked
  on") or 🔒 (locked), a `span role="img"` with that phrase as `aria-label` and `title`. The
  "You are" line shows `(@label)` and wraps when narrow; the title there is edited in place, so
  it takes the new `Ident.atLabel` (`src/models/ident.ts`) rather than `Ident.byline` whole, and
  `byline` now uses `atLabel` too. e2e: `routing.spec.ts` matches `(@label)` and finds hunts as
  `row`/`rowheader`; one new spec checks the sigils and that two hunts' Categories links line up.
* **Decisions taken**: a lock sigil (🔒) for locked quizzes alongside the asked-for 🤔, so every
  quiz carries one; the sigil sits inside the link; 720px as the fold point. The last two are
  taste calls the worker flags for the Coach.
* **Discoveries -- for thread 3**: reuse the container-query hiding, **not** the Table. A
  widgeting row is an Accordion that opens to formula boxes and a copy button, which do not
  belong in table cells. Keep the Accordion; line its summary up with fixed-width boxes, as
  `ColumnsEditor`'s rows do; hide fields with `containerType: 'inline-size'` on the list, a
  `RoomFor` constant, and `{ display: { '@': 'none', [RoomFor.x]: 'block' } }` (`ColumnsEditor`'s
  `hiddenUntil`). Three `sx` traps: a Table's `'& th, & td'` rule outranks a cell's own `sx`; a
  container-query value of `undefined` does not restore the base value, so give both; table
  cells are border-box, so `minWidth` includes padding.
* **Incident**: a session of the Coach's (`validation_tighten`) was editing uncommitted in the
  same checkout. Testing an e2e failure its edits caused, the worker ran `git checkout 7f4d46b --
  src e2e tests` and back, overwriting six of its files (`src/lib/vv/checks/numbers.ts`,
  `src/lib/vv/kit.ts`, `src/lib/vv/patterns.ts`, `src/models/question.ts`, and two tests). The
  Coach has been told and is recovering them. **The sprint now runs in its own worktree,
  `.claude/worktrees/little_fixes`**; the main checkout is the other session's. Every later
  worker: run `git status` before any checkout or restore that names paths.
* **For the Coach**: the 720px threshold and the sigil inside the link are taste calls. The agent
  backend (port 3401) holds an ident `hunt_shooter` with three demo hunts made for screenshots.

Screenshots: `screenshots/thread2-hunts-*-{before,after}.png` -- light-1100, dark-1100, light-700,
light-390, dark-390.

## Thread 1: the ident gate (2026-10-05)

Branch `20261005-ident_gate`, PR #96, stacked on #95 (and carrying the unmerged
`20261003-but_not_quiz` quiz commits and `20261005-little_fixes_start` plan commits beneath it).
Suites: typecheck and lint clean; `pnpm test` 123 files, 3283 tests; `pnpm test:e2e` 220 passed.

* **Built**: `src/components/IdentGate.tsx` -- the submit reads `Log in as <label>` (the label as
  `Ident.labelFor` will claim it, updating as typed) and is disabled until
  `IdentValidators.identLabel` takes it; then it rests as plain **"Log in"**. The field shows
  `AppNotices.identLabelShape` as an error once something is typed and does not fit; an empty
  field shows nothing. On the switch path, a text `Button` "Keep being <Title> (@<label>)" sits
  left of the primary (both right-aligned, `flexWrap` so a long title wraps the pair onto two
  lines), replacing the "You are ... now." microcopy. `Ident.byline(ident)` in
  `src/models/ident.ts` writes "Title (@label)", tested in `tests/models/ident.test.ts`.
* **Decisions taken**:
  - "Keep being" goes to `then ?? huntsPath()` -- the same `onward` the submit and the
    already-logged-in redirect use, now computed once. On every path the app makes, `/?switch`
    carries no `then`, so this is the hunts page; a hand-made `/?switch&then=...` would make both
    buttons leave for the same place, which is what a cancel beside a submit should do.
  - It is a `Button` with `router.replace`, not a link: role "button", as a cancel is, and
    `replace` like the submit, so Back from the hunts does not return to the gate.
  - The old "You will be “label”." helper text is gone: the button says it now. The helper rests
    as `' '` so the field does not jump when the error appears.
  - `AppNotices.identLabelNeeded` is no longer used by the gate (the button cannot be pressed
    empty); `MembersPanel` still uses it, so it stays.
* **Discoveries**: `@label` is **new to the app** -- nothing wrote an ident that way before. The
  hunts page still says "You are <title> (label)." and `notices.ts`'s `smithsNamed` writes
  "Flip (flip_kromer)". Thread 2 can use `Ident.byline` for the first if it wants idents shown
  the same way; the notices are prose and were left alone.
* **For the Coach**: two small open questions, also in the PR: logging in as the ident you
  already are is offered and is a no-op (could disable, or become "Keep being"); and the shape
  error shows from the first keystroke, as the plan asked, rather than on blur.
* *Review:* `fixed`, at medium. Kept 161ca84: "Keep being" is now `disabled={busy}` like the
  submit -- pressing it while a log-in was in flight sent you to the hunts as the old ident, and
  then the log-in landed anyway. No findings left; the two Coach questions above are questions,
  not findings.

Screenshots (`screenshots/`, each `-before` and `-after`; read them to review the look):
`thread1-login-short-dark-1100` (an invalid label), `thread1-login-typed-light-1100` (a valid
one), `thread1-switch-empty-light-1100`, `thread1-switch-typed-dark-1100`,
`thread1-switch-typed-light-390` (the switch path, wide and narrow).
