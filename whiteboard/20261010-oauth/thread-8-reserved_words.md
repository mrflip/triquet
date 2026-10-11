# Thread 8: reserved_words (2026-10-11)

Branch `20261011-reserved_words`, PR filed at landing; see the report. Stacked on thread 2's
`20261011-clear_people` (the guard). Suites: justify green (typecheck, lint, 208 unit files,
6028 tests); e2e not yet run (at landing).

* **Built**:
  - **The survey.** Every top-level route is reserved: `about`, `privacy`, `terms` (pages), `my`,
    `stats` (app), `api` (every label's `routes`), and `public/brand` (pages). `c` and `h` are one
    letter, below any label's two, so no label can be them. `admin` and `root` were already kept
    from every label; `support`, `triquet` and `admin` were prefixes; `anonymous` a voice. Missing
    were `google`, `handle` and the roles. A new unit test (`patterns.test.ts`, *keeps every
    top-level route and public folder*) reads `src/app` (through its route groups) and `public`, and
    fails when a new route folder is a label the list allows.
  - **The augmented list** (`src/lib/vv/patterns.ts`, `ReservedToplevelGroups`), all whole words
    but one prefix:
    - prefix `google` (`google_team`; `googly_eyes` stays free);
    - `identity`: `handle(s)`, `profile(s)`, `password(s)`, `session(s)`, `sandbox(es)`, `anon`,
      `sign_in`, `sign_out`, `sign_up`, `log_in`, `log_out`;
    - `roles`: `smith(s)`, `reviewer(s)`, `member(s)`, `owner(s)`, `moderators`, `mods`,
      `superuser`, `sysadmin`, `sudo` (`admin…` is the prefix's);
    - `voices` gained mailboxes (`info`, the contact address's, `hello`, `sales`, `marketing`,
      `mailer_daemon`, `mailerdaemon`, `donotreply`, `do_not_reply`), placeholders for a person
      (`someone`, `anyone`, `unknown`, `deleted`) and the bot and providers (`claude`, `anthropic`,
      `gmail`).
  - **Grandfathering.** The list now governs only a label being made or claimed:
    - `HuntValidators.row` and `.hunt` hold `label` to `CK.label` (shape and the words every label
      is kept from) and `orglabel` to the new `CK.heldUserlabel` (a userlabel's shape and those
      words, not the top-level ones). `HuntValidators.newLabel` (`CK.toplabel`) is what a new or
      relabelled hunt takes: `new_hunt` and both `relabel_hunt`s in `src/models/actions.ts`.
    - `hunts.open`'s `orglabel` and `Addresses.orgFrom` take `heldUserlabel`, so `/~google_fan/…`
      still opens.
    - `HuntEditModal` lets an unchanged label through, so a grandfathered hunt can be retitled.
  - **The check**: `convex/check_reserved.ts` (`refused`, an internal query reading every hunt,
    capped at `PA.HuntsInApp`) and `scripts/check_reserved` over `scripts/check-reserved.ts`, on
    `takeAim`. Proved on lane 4's `agent` backend with four imported hunts: dry, named, and
    wrongly named (stopped, exit 1).
  - Tests: `tests/convex/check_reserved.test.ts` (the check; a grandfathered hunt opens, is
    retitled, rebranched and worked in, is refused a reserved relabel; a new hunt is refused),
    `tests/scripts/check-reserved.test.ts`, and the pattern, check, labelmaker, address and hunt
    model tests.
  - Notes: `notes/deploy.md`, *Checking the reserved list against production*;
    `notes/security.md`; `notes/vocabulary.md`, *label*.
* **Decisions taken**:
  - **No package.** `reserved-usernames` (617 words, last published 2019) and
    `the-big-username-blacklist` (525, 2018) are the candidates. Both are unmaintained, and aimed
    at subdomains and SaaS routes. Beyond our list they add 350 to 430 words, mostly noise for a
    6-character handle (`ns9`, `www3`, `mail5`) or plausible hunt names (`movies`, `music`,
    `family`, `test`). Neither holds `google`, `handle`, `triquet` or a role. I kept our own
    grouped list and took the few useful words from them (`sysadmin`, `superuser`, `info`,
    `owner`, `member`). `notes/stack.md` lists hand-rolled choices only with a Coach's yes, so
    it is not listed there yet (*For the Coach*).
  - **One list for hunts and userlabels.** A sandbox's hunt takes its userlabel, so a userlabel
    must be a hunt label that may be made. The two lists are one, and
    `Labelmaker.isReserved(word, { toplevel: true })` is **the one predicate** for threads 3 and 6.
    A test holds it to agree word for word with `CK.userlabel`. No new function.
  - **Grandfathered by validator, not by a frozen list.** Rows and lookups hold labels to their
    shape and the core words, and the top-level list is checked only where a label is made. Any
    later word is grandfathered with no further work. The other choice was two tiers: the old words
    checked everywhere, the new ones only for new labels. Every later word would have had to go in
    the second tier by hand.
  - **The check is guarded though it is read-only**: `takeAim` names the deployment it reached. With
    `--deployment` the guard's line says "acting"; the script's doc says it changes nothing.
  - **"username" is not reserved**: the word is banned from new code, and no screen shows it.
* **Deviations**:
  - **Idents are not grandfathered.** `IdentValidators.identLabel`, used by the ident row, the
    hunting row's `ident_label`, `assume_ident` and `add_hunting`, stays `CK.userlabel`, strict.
    Until thread 3 drops idents, an existing ident whose label is newly reserved (`google…`,
    `handles`, `sandbox…`) cannot be re-asserted, retitled, or added to a hunt, and cannot make a
    hunt. Production's idents are cleared before thread 3, and the check names any such org. I
    left idents alone so as not to collide with threads 1 and 3 in files thread 3 deletes.
* **Discoveries**:
  - Before this thread, a hunt whose label became reserved could not be retitled, rebranched or
    rearranged at all: `updateHunt` validates the whole row, and `HuntEditModal` checked the
    unchanged label too. Its `/~org` address also stopped parsing if the org's word was kept.
* **For thread 3**:
  - The user row's `userlabel` should take `CK.heldUserlabel` (or the kit's `heldUserlabel`), and
    `assumeUserlabel`'s argument `CK.userlabel`. A huntship's `userlabel` copy should take
    `heldUserlabel`. Otherwise a word added later makes a user's every write fail, its
    sign-in upgrade among them.
  - The free-userlabel check calls `Labelmaker.isReserved(label, { toplevel: true })`.
  - `huntship(s)` and `ghosting(s)` are model nouns: add them to `ModelNouns` (every label's list)
    if they are to be reserved. Mind that list has no grandfathering: it governs every quiz,
    question and widgeting label, rows included.
  - `check_reserved:refused` reads only `hunts`, and survives the schema change. Adding users'
    userlabels to it is yours to weigh.
* **For thread 6**: suggestions skip `Labelmaker.isReserved(candidate, { toplevel: true })`, the
  same predicate.
* **For the Coach**:
  - Run `./scripts/doppledo prd_janitor scripts/check_reserved` once this deploys. Any hunt it
    names keeps working; it tells you who holds a word now kept.
  - Confirm **no package** for the reserved list. If you agree, `notes/stack.md`'s *Hand-rolled on
    purpose* gains a line for it.
  - The list itself is a judgement call: in particular `claude` (a person's name, but the bot's on
    screen), `info`, `hello` and `members` as whole words.
