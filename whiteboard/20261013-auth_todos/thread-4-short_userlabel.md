# Thread 4: A userlabel may be four letters (2026-10-13)

Branch `20261013-short_userlabel`, PR filed at landing; see the report. Suites: justify green
(typecheck, lint, 6457 unit tests); the two changed e2e tests pass alone; `pnpm e2e --touched`
(the whole suite) at landing.

* **Built**:
  - `PA.Userlabel` is 4 to 24 (`src/lib/vv/patterns.ts`), its message too. Everything else reads
    the length from there: `CK.userlabel`, `UserValidators.userlabel`, the doc blocks thread 2 left
    stating only `PA.Userlabel`.
  - The two unfinished-handle notices (`AppNotices.userlabelUnfinished`, `memberLabelUnfinished`)
    said "at least 6 characters"; they now say `PA.Userlabel.min`, as the `...Full` notices say
    their caps, so the number lives in one place. The words are otherwise unchanged (thread 6's).
  - Handle suggestions (`User.suggestionsFor`): nothing pads or trims to the minimum. Numbering
    (`SuggestionNumbers`, `_2` to `_9`) adds two characters, and `Labelmaker.normalize` pads any
    label to `PA.Label.min` (2) with `z`, so now every name mends: `Flip` is offered as `flip`,
    `Jo` as `jo_2`, `J` as `jz_2` (before, any name of three letters or fewer was offered nothing
    of its own). `SuggestionNumbers` is unchanged. The doc examples follow.
  - `User.flawIn` / `flawToSay` examples and tests use `flo` for an unfinished label.
  - Notes: `notes/vocabulary.md` (*userlabel*: 4 to 24), `notes/decisions/urls.md` (the example's
    org, "an ident's label, 6 to 24" -> "a userlabel, 4 to 24").
  - Tests: every test that pinned six (`tests/models/user.test.ts`, `actions.test.ts`,
    `tests/lib/vv/checks/strings.test.ts`, `tests/convex/users.test.ts`,
    `writing/huntship_actions.test.ts`, `e2e/routing.spec.ts`'s two short-handle tests, now typing
    `flo`). New: the notices say the pattern's minimum; `HuntValidators.newLabel` takes the
    shortest and longest userlabel (thread 5's sandbox); the short words below are reserved.

* **Decisions taken**:
  - **No reserved word added.** Every four- and five-letter word that was safe only by length and
    would pass for the app's pages or voice is already on the top-level list or caught by a
    prefix: `mail`, `auth`, `acct`, `oauth`, `home`, `help` (prefix), `info`, `team`, `blog`,
    `news`, `docs`, `about`, `admin` (prefix and route), `login` (prefix), `staff`, `abuse`,
    `hello`, `sales`, `anon`, `sudo`, and the rest of a longer sweep (`root`, `user`, `quiz`, `hunt`,
    `edit`, `data`, `null`, `guest`, `owner`, `mods`, `stats`, `terms`, `legal`, `press`, `store`,
    `shop`, `jobs`, `brand`, `plans`, `email`). A test in `tests/lib/labelmaker.test.ts` pins
    twenty of them. The top-level list already governed hunt labels, which have always been
    allowed from two characters, so it was written for short words. `scripts/check_reserved` was
    not needed.
  - **The notices read the pattern** rather than saying "4": a number stated twice drifted once.

* **Deviations**: none. `whiteboard/TODO.md`'s *Tiny Tasks* holds no bullet for this thread (the
  Coach's text was not listed there), so nothing to strike.

* **Discoveries**:
  - **Forms and devices now reach userlabels.** `PA.ReservedToplevelForms`' `pub..` (exactly five
    characters beginning `pub`: `pubco`) and the device names `com0`-`com9` and `lpt0`-`lpt9`
    never met a userlabel, only shorter labels (a hunt's, a quiz's); a four- or five-letter
    userlabel meets them now. Intended, and harmless.
  - **Free four- and five-letter words a Coach might weigh** (not added; growing the list means
    `scripts/check_reserved` against production first): `bots` (the app's bot reviewers; `claude`
    and `anthropic` are already kept as its voices), `test`, `demo`, `sync`, `meta` (a domain word
    here: meta puzzles). None reads as the app's own page or voice as the listed ones do.
  - `notes/future-models.md` still says an ident's label is "between six and twenty-four letters".
    It is an early sketch of the access model (idents are gone), not a live rule; left as written.
  - Thread 3 (`mock_google`) was not beneath this branch when cut. Its specs build accounts with
    `freshGoogleAccount`; if any asserts a suggestion like `flip_2` for a short name, the landing's
    catch-up will show it.

* **For the Coach**: nothing outside the repo. A floor lowered admits more rows than before, so no
  migration and no `check_reserved` run.
