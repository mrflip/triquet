# Thread 7: `PA.Userlabel`, and a Labelmaker that takes a pattern's bag (2026-10-05)

Branch `20261005-userlabel`, PR filed at landing; see the report. Suites: typecheck and lint
clean; `pnpm test` 126 files, 3577 tests. e2e not run before review (no view changes; the
landing runs it).

* **Built**:
  - `PA.Userlabel` and `PA.Userbegun` (`src/lib/vv/patterns.ts`), renamed from `PA.Identlabel`
    and `PA.Identbegun`: the same patterns (6 to 24, label-shaped; and a username as far as it
    has been typed). The validator kit's check follows: `CK.userlabel` (`src/lib/vv/checks/strings.ts`,
    `src/lib/validator.ts`), was `identlabel`. Callers: `Ident` (`src/models/ident.ts`),
    `IdentGate`, `MembersPanel`, `tests/lib/vv/checks/strings.test.ts`.
  - `Labelmaker.normalize(str, opts)` (`src/lib/labelmaker.ts`) takes `NormalizeOpts =
    Readonly<PA.Patternbag>`. It uses `max`, clamped to 2..40 (a label's own bounds), and drops
    `re`, `min` and `msg`. The repair now puts the `z` in front *before* the cut, then trims a
    trailing `_` and pads to two: `max` holds after every repair.
  - `Ident.labelFor(name)` passes `PA.Userlabel`. `'2nd Avenue Puzzle Solvers Club'` makes
    `z2nd_avenue_puzzle_solve` (24), was `z2nd_avenue_puzzle_solver` (25).
  - Tests: `tests/lib/labelmaker.test.ts` (max with a prepended letter, the trailing-`_` cut,
    max under 2, a whole bag, re/min/msg dropped); `tests/models/ident.test.ts` (the digit-first
    long name, every case at most 24, and that name in the "every label a name makes" check).
* **Decisions taken**:
  - **Renamed, no alias.** `notes/vocabulary.md` says *username* is what the screen calls an
    ident's label, so `Userlabel` names the same thing; nothing outside `src/` and `tests/`
    named `Identlabel` but historical whiteboard files, left as written. The kit check was
    renamed too (`identlabel` -> `userlabel`), as kit checks are named after their patterns.
    `IdentValidators.identLabel` and the check's `.describe('ident label')` stay: those name the
    ident's field, and the domain noun is still *ident*.
  - **`min` is dropped, not honoured.** Honouring it could only mean padding with `z`s, so a
    name like "Bo Li" would offer `bo_liz` as a username nobody chose. Left short, the label is
    refused by the validator and thread 4's gate says why. The two-character floor stays: it is
    a label's own minimum, and `normalize` promises a valid label.
  - **`maxlen` is gone.** `Ident.labelFor` was its only caller; it now passes the bag.
* **Discoveries**:
  - The old repair had a second, latent bug: with a leading digit, the post-prefix cut could
    leave a trailing `_`, and `LabelValidators.label` then *threw* (e.g. `9` + 37 `x` + ` yy`
    at the default 40). Prefixing before cutting fixes both; a test pins it.
* **For the Coach**: nothing needing a decision. The Coach's wontfix (Enter in an emptied
  username field) is the orchestrator's to record; untouched here.

No screenshots: nothing on screen changes but the 25th character of a digit-first long name.
