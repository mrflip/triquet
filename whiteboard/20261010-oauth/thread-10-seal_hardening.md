# Thread 10: seal_hardening (2026-10-13)

Branch `20261013-seal_hardening`, PR filed at landing; see the report. Cut from `main` at
`ceb19e8e`. Suites at `ready`: justify green (typecheck, lint, 220 unit files, 6397 tests). No e2e
yet: the thread touches `convex/` and `src/models/`, so the landing's `--touched` reaches the
whole suite.

* **Built**:
  - **F5, fail closed.** `User.isAnonymous` (`src/models/user.ts`) is `isAnonymous !== false`;
    `Actor.isSignedInWithGoogle` (`src/lib/actor.ts`) stays its negation, so it is
    `isAnonymous === false`. `Actor.ofUser`'s `anonymous` now reads `User.isAnonymous` too (it read
    `=== true` inline), so a row without the field is sealed and its `admin` counts for nothing.
    The three convex-tests that inserted users without the field write `isAnonymous: false`; a
    new test in `huntship_actions.test.ts` proves a row without it is refused as `sealedJoin`; the
    unit tests of the predicate and `ofUser` cover the absent field.
  - **F6, `adopt` and sandboxes** (`convex/adopt.ts`). `isSealedSandbox(db, hunt)`: a hunt
    `~label/label` (`Hunt.isSandbox`) whose userlabel an anonymous user holds, with that user on
    it. A grant on every hunt passes over such hunts and counts them once (the outcome's new
    `skipped`); a grant naming one by address is refused. `leftBehind` refuses relabelling an
    anonymous user when `~label/label` of its userlabel exists (a retitle, keeping the userlabel,
    goes through), and says what becomes of a userlabel a relabel moves off: the userlabel change
    gains `leaves: 'free' | 'address' | null`.
  - **F4, the dry run names the user**: the outcome's `user` gains `name` (Google's, null for none)
    and `created_at` (`Stamps.of(user).created_at`); `scripts/adopt`'s `userLine` prints them:
    `... signed in with Google as "Flip Kromer", not an admin; made 2026-10-13T05:18:05.944Z.`
    Nothing new is stored.
  - `scripts/adopt.ts`: `leftLine` and `skippedLine` beside `changeLine` and `outcomeLines`.
  - Notes: `notes/deploy.md`, *Adopting a user* (what it keeps to; the userlabel it leaves; read
    the user before acting); `notes/security.md` (F4, F5 and F6 struck or amended in thread 9's
    entry, thread 4's entry qualified); `notes/vocabulary.md` (*anonymous*: fails closed);
    `whiteboard/TODO.md` (three items struck, saying what was done).
  - **Proved on lane 1's `agent` backend** (reset first; `prove.sh` in the thread's scratchpad):
    an anonymous user made its sandbox through `hunts:performOuter` (an imported session and
    `convex run --identity`); the Coach's command (`--smith-all --reviewer-all`) named the user by
    its Google name and time, passed over the sandbox and said so, and acted; `--smith
    ~anon_alice/anon_alice` and relabelling `anon_alice` were refused in words; retitling it was
    planned; a relabel away from `mrflip` said it is left free, and one away from `pat_smith`
    said its hunt's address still holds it.
* **Decisions taken**:
  - **One predicate, everywhere, the exchange included.** `userAtExchange` reads
    `User.isAnonymous` too, so a browser's user without the field would be upgraded or merged as
    an anonymous one is. That is the starting browser's own user, proven at the exchange, and
    nothing writes such a row; a second, "positively anonymous" predicate there would split
    decision 8's one predicate. Recorded in `notes/security.md`.
  - **"An anonymous user's sandbox" is read from who is on it**, not only from the shape: a
    sandbox merged into a Google user (its anonymous user taken off, thread 5's merge) or upgraded
    in place is that user's hunt, and `--smith-all` reaches it (a test holds both). Two indexed
    reads per sandbox-shaped hunt.
  - **The relabel refusal reads the shape alone** (anonymous, and `~label/label` exists), since
    the harm (a second hunt) needs only that. So it also refuses relabelling a merged-away user
    still holding its handle, which nothing needs.
  - **`--reviewer-all` and `--reviewer` keep off sandboxes too**, not only the smith flags: sealing
    keeps a sandbox its user's alone whatever the role.
  - **Kept off `relabelFor`** (thread 11 edits it): the refusal and `leaves` live in a new
    `leftBehind` beside it, and `PlanT` carries `leaves` and `skipped` at its top level.
  - **`created_at` rather than `_creationTime`**, as `Stamps.of` reads a row's making, printed in
    ISO-8601 UTC by `Stamps.isoOf`.
* **Discoveries**:
  - The three convex-tests named by the plan passed under the new predicate unchanged: they put
    their field-less users on hunts by inserting huntships directly, never asking `join_hunt`.
    They were repaired anyway, and the new `sealedJoin` test is what fails if the predicate is
    loosened again.
  - `convex run --identity '{"subject": "<user_id>|<session_id>"}'`, with an imported
    `authSessions` row, acts as a user on a local backend through the public functions: a way to
    seed a real sandbox without a browser.
  - `convex/_generated/` did not change: no function was added or renamed.
* **For thread 11**: `relabelFor` is as thread 4 left it. `leftBehind` uses `huntsCountedInOrg`
  to ask whether any hunt holds a userlabel as its address, the same width
  `holderOfUserlabel` has; a `.first()` reader, if thread 11 adds one, would serve both.
