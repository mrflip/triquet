# Thread 4: the name field is the title; the label beside it follows until edited (2026-10-05)

Branch `20261005-name_title_label`, PR filed at landing, stacked on #110; see the report. Suites: typecheck and
lint clean; `pnpm test` 126 files, 3549 tests; `pnpm test:e2e:agent` 230 passed, 4 failed
(`sheets.spec.ts` 2, `widgets.spec.ts` 2: Convex's 1s function timeout under a load average of
50, from `new_hunt` and `auth:signIn`, which this thread does not touch). Those two files rerun
once the load fell: 45 passed.

* **Built**:
  - `src/components/IdentGate.tsx`: two fields side by side (stacked under `sm`). **Your name**
    takes anything (capped at `PA.Titleish.max`) and is sent as the ident's `title`. **Username**
    shows `Ident.labelFor(name)` and follows the name until the username is typed in itself;
    emptied, it follows again. While it is being cleared it stays blank, with the followed
    username as its placeholder (the button already says "Log in as" it); the name changing, or
    the field being left, fills it back in. `assume_ident` sends `{ label, title: name }`: no
    server change. "Keep being" (1b) carries over, keyed on the username.
  - `Ident.flawIn(label)` (`src/models/ident.ts`) now judges a **label as typed**, nothing
    repaired: `'shape'` when no typing on would make it a label (a capital, a space, a hyphen, an
    accent, a leading digit or underscore, `__`, more than 24), `'unfinished'` when typing on
    could (too short, nothing typed, or a trailing underscore). `Ident.flawToSay(label, left)` is
    the moment: shape at once, unfinished once the field has been left, an empty field never.
    The gate and `MembersPanel` both use the pair.
  - `PA.Identtyped` (1b's typed-text pattern) is gone; `PA.Identbegun` replaces it: a label, or
    the start of one. `LabelFlawT` is `'shape' | 'unfinished'` (was `'shape' | 'length'`).
  - `MembersPanel`'s add-member field: no more `labelFor` folding ("Flip Kromer" no longer adds
    `flip_kromer`; it turns red). Same check, same moment as the gate, `maxLength` 24; Add with a
    flaw says it; the field's `left` resets after a successful add.
  - Notices (`src/lib/notices.ts`): `usernameShape` and `identLabelShape` reworded for a label
    (no spaces or hyphens any more); `usernameLength` became `usernameUnfinished`, "at least 6
    characters long, ending in a letter or number"; new `identLabelUnfinished`;
    `identGateTitle` is "Enter your name and username to join"; `identLabelNeeded` says "they",
    since it is said of someone else.
  - `notes/vocabulary.md`: *ident* says the label is made from the name until typed in itself,
    and that the title is the name typed, never relabelled by a retitle.
  - Tests: `tests/models/ident.test.ts` (labelFor, flawIn, flawToSay; every label a name makes
    is shapely). `e2e/routing.spec.ts`: too-short (now via the name), any-name-and-a-bad-username,
    follow / stop following / follow again, title-from-name, title-from-label, the own-name
    "Keep being", and the members field's check. `brand.spec.ts` uses `AppNotices.identGateTitle`.
* **Decisions taken**:
  - **"Decoupled after"**: already so. `retitleIdent` (`convex/writing/account_actions.ts`)
    patches the title and the huntings' copies, never the label. Logging in as an ident that
    exists keeps *its* title; the name typed is used only for a new ident.
  - **When red shows**, the Coach's "click to edit, show red" with 1b's "length waits for blur":
    a username no typing on mends is red at once; one too short (or ending `_`) is red once
    either field has been left. A short *name* ("Bo Li" making `bo_li`) therefore turns the
    username red when the name is left: the plan said the derived label always fits, but a
    short name makes a short label, and the visitor needs to be told why the button is shut.
  - **Trailing underscore** is unfinished, not shape, so `flip_` does not flash red on the way
    to `flip_kromer`.
  - **Strict, not folded**: the username field takes `Flip_Kromer` as a flaw rather than
    lowercasing it, as the Coach asked for red. Same in `MembersPanel`.
  - **Notice wording** per screen: the gate says "username", `MembersPanel` says "ident label",
    matching each field's own label. The pair is two maps of the same `LabelFlawT`.
* **Deviations**: the gate's heading and blurb changed (the heading named only the username).
  The `identLabelNeeded` pronoun fix was not asked for.
* **Discoveries**:
  - The hunts page has a **"Your name" textbox** too. An e2e that clicks "Be someone else" and
    fills "Your name" at once can hit the hunts page's field and retitle the ident; wait for the
    gate's heading first (done in `routing.spec.ts`).
  - The session's scratchpad directory is **shared with thread 5's worker**: two `dev.log`s
    interleaved there. Keep scratch files in a subdirectory of your own.
  - With two workers' suites and servers in one container, the load reached 50 and local Convex
    functions hit their 1s limit, failing unrelated e2e specs. Rerun before suspecting a change.
* **For the Coach**:
  - `MembersPanel` no longer folds a typed name into a label: "Flip Kromer" is red, not
    `flip_kromer`. You said yes to reusing the check; this is what reuse means. Say if you
    would rather it folded (a one-line change back to `labelFor`).
  - Whether a short name should turn the username red once the name is left (as now), or stay
    quiet until the username field itself is touched.
  - From the review (left as found): `Labelmaker.repaired` cuts to `maxlen` before prefixing
    `z`, so a long name starting with a digit makes a 25-character username, red at once; and
    Enter in an emptied username field is stopped by `required`, though the followed username
    would be good to log in with.

Screenshots (`screenshots/thread4-*-{before,after}.png`; read them to review the look):
`login-empty-light-1100`, `login-typed-dark-1100` (a name with `!`), `login-short-light-1100`
(a short name, left), `label-edited-light-1100` (a hyphen typed into the username: red at once),
`label-edited-dark-1100` (an edited username that no longer follows the name),
`switch-own-dark-1100` (your own name on the switch path: "Keep being"),
`login-typed-light-390` (narrow: the fields stack), `members-light-1100` (the members field, red
for "Flip Kromer"). The *before* shots are the nearest the old gate had: the same text typed into
its one field.
