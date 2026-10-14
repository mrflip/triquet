# Thread 2: No held userlabel (2026-10-13)

Branch `20261013-one_userlabel`, PR filed at landing; see the report. Suites: justify green
(typecheck, lint, the unit tests); `pnpm e2e --touched` (the whole suite) at landing. The
reviewer's two `fix:` commits ride along: `adopt:plan` refuses a grant to a user whose userlabel
the list keeps now (perform threw writing the huntship), and `check_reserved:held` walks only
users holding a userlabel, through `by_userlabel`, so they come back alphabetically.

* **Built**:
  - One userlabel check, `CK.userlabel` (`src/lib/vv/checks/strings.ts`): label-shaped, of
    `PA.Userlabel`'s length, none of the reserved words, top-level ones included. `heldUserlabel`
    is gone from the checks, the validator kit and `UserValidators`. Everywhere it stood now takes
    `userlabel`: the user row, `huntships.userlabel`, `ghostings.userlabel`, a hunt's `orglabel`,
    the adoption's `find`/`org`, `add_huntship` and `settle_name_choice`, `hunts.open`'s org, and
    `convex/testing.ts`. `Addresses.isHeldUserlabel` is `isUserlabel`, on the same check.
  - `User.relabelled` is folded into `User.labelled`: a merge and a settled name choice take the
    merged browser's handle through it. `relabelUser` no longer lets a held userlabel skip the check.
  - `scripts/check_reserved` is now the guard to run **before** the list grows. The internal query
    is `check_reserved:held` (was `refused`): it answers every userlabel users and ghostings hold
    and every hunt's org and label, unjudged. The script (`scripts/check-reserved.ts`, run by tsx
    now, as `scripts/adopt` is) judges them by the checkout's own list (`Labelmaker.isReserved`,
    top-level). It names each holder the list would lock out, and, apart, each hunt whose own label
    the list keeps from new ones. Its doc blocks, and `notes/deploy.md`, *Checking the reserved
    list against production*, say so.
  - Notes: `notes/vocabulary.md` (the label entry), `notes/security.md` (the 2026-10-11 thread 8
    entry, amended), `notes/convex.md` (*Denormalized fields*), `notes/deploy.md`. TODO: the
    *Tiny Tasks* bullet and the *Not yet* entry on a sealed user's sandbox are struck.

* **Decisions taken**:
  - **The guard judges locally.** Before this, `check_reserved:refused` judged on the deployment by
    the list deployed there. That can only say what a list *already deployed* leaves standing, and
    by then the rows are locked. So the deployment now hands over the labels and the checkout
    judges them. It also reads users and ghostings, not only hunts: an anonymous user holding a
    handle with no sandbox yet is a holder no hunt shows. I pulled this forward because without it
    "keep `check_reserved` as the guard" could not be done.
  - Users holding a userlabel (through `by_userlabel`, after review) and ghostings are walked
    (`for await`), not taken to a cap: no `PA` bound caps them, and `notes/convex.md`'s *Bounded
    reads* allows a walk. Hunts keep `take(PA.HuntsInApp.max)`.
  - `adopt:plan` refuses a **retitle alone** of a user whose userlabel the list now keeps, with a
    message saying to give it a new one (`--userlabel`). Without this, plan said yes and perform
    threw a ZodError. With a new userlabel it goes through (tested).

* **Deviations**: the function's rename and new contract (`refused` -> `held`) and the script's
  new report go past the plan's "say so in its doc block". Nothing else calls either.

* **Discoveries**: what a row already holding a top-level word meets now. Production's clear
  leaves none, and `check_reserved` names any.
  - **A user holding one** can make no hunt (the new hunt's `orglabel` fails `HuntValidators.row`),
    and nobody can put it on a hunt (`add_huntship`'s arg). Adopt cannot find it by userlabel
    (`--holding`), so use `--email` or `--id`. It can still retitle itself: a user row's patch is not
    re-validated whole.
  - **A hunt of an org so named** is out of reach: `hunts.open` refuses the org, and
    `Addresses.orgFrom` reads it as none. Every write through `updateHunt` (retitle, rebranch,
    relabel) is refused, since it re-validates the whole row. Tests:
    `tests/convex/check_reserved.test.ts`. A hunt's own **label** kept since is unaffected: it is
    held to the list only as it is made.
  - **A merged browser's handle so named** cannot be settled either way: `settle_name_choice`'s
    `merged` is refused at its args, so the choice stays pending. The guard covers it, because
    merged users still holding a userlabel are among the users it reads.
  - **An anonymous browser holding a handle so named** cannot sign in with Google into an account
    holding no userlabel: `mergeInto` takes its handle through `User.labelled`, the full check, and
    the sign-in fails. `check_reserved` names such a user.
  - **The guard covers growth of the top-level list only.** A hunt whose own label a top-level
    word keeps stays writable. A word added to the list every label is kept from
    (`PA.ReservedLabelGroups`) leaves every row so labelled unwritable: hunts, quizzes and columns
    alike. The script names such a hunt with the standing ones and says the base list would lock
    it, but it reads no other table's labels. Growing the base list needs its own survey.
  - For **thread 4**: `strings.ts`'s userlabel doc block states the length only as
    `PA.Userlabel`'s, and so does `validator.ts`'s (it said "6 to 24"). What still says six:
    `PA.Userlabel.msg`, and tests `tests/models/user.test.ts` ("a userlabel shorter than six",
    `'flips'`) and `tests/lib/vv/checks/strings.test.ts` (`'fivee'` refused).
  - For **thread 5**: a userlabel now always passes `HuntValidators.newLabel` as a sandbox's label
    (same words, and its 6-24 sits inside a label's length), so the sandbox needs no check of its
    own.

* **For the Coach**:
  - Before the next deploy, if unsure, run
    `./scripts/doppledo prd_janitor scripts/check_reserved` from this branch or later. It should
    say "Nothing holds a userlabel or org the reserved list here keeps". It ran clean against this
    lane's empty local backend.
  - From now on, grow `PA.ReservedToplevelGroups` or its prefixes only after that command, run from
    the branch that grows the list, names no holder. A hunt's org never moves, so a word one holds
    stays off the list.
