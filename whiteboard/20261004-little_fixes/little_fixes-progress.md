# Sprint `little_fixes`: progress

The running handoff. Newer than `little_fixes-plan.md` wherever they disagree. Workers append
their sections below the table, newest first.

## Status

| Thread | Name                         | Branch | PR | Status  |
| ------ | ---------------------------- | ------ | -- | ------- |
| 1      | the ident gate               | `20261005-ident_gate` | #96 | complete |
| 2      | the hunts page lines up      |        |    | pending |
| 3      | quiz mode: grid and widgets  |        |    | pending |

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

Screenshots (`screenshots/`, each `-before` and `-after`; read them to review the look):
`thread1-login-short-dark-1100` (an invalid label), `thread1-login-typed-light-1100` (a valid
one), `thread1-switch-empty-light-1100`, `thread1-switch-typed-dark-1100`,
`thread1-switch-typed-light-390` (the switch path, wide and narrow).
