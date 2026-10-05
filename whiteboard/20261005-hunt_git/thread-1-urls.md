# Thread 1: The URL scheme (2026-10-05)

Branch `20261005-urls`, PR pending, stacked on #121. Suites: typecheck, lint and unit (128 files,
3690 tests) green; review clean at medium, nothing to fix; e2e 244 passed at `--workers=4`. The machine was loaded (avg ~50 on 16
cores), and at the default 50% of workers a first run timed out loading pages in specs this
thread doesn't touch; with fewer workers every spec passed.

* **Built**:
  - **Pages** (`src/app/(synced)/[org]/...`): `/~org` (that org's hunts that the visitor is
    on), `/~org/hunt`, `/~org/hunt/quizzes`, `/~org/hunt/categories`,
    `/~org/hunt/quizzes/realm/quiz` and `.../quiz/!mode`. The `[mode]` page re-exports its
    parent's.
  - **`src/components/use-address.ts`**: `useAddressed(kind)` reads the page's own address
    through `Addresses.locationFrom(usePathname())`, and calls `notFound()` when the address
    names some other kind of thing, or nothing. `useCanonical(current, canonical)` replaces the
    address with the form the resource has now.
  - **`Routes`** (`src/lib/routes.ts`) goes through `Addresses.urlOf` for `orgPath`, `huntPath`,
    `quizzesPath`, `categoriesPath` and `quizPath(labels, mode)`. Also `modeFromAct` (old
    `?act=`) and `movedPath`, which keeps the query (all but `act`) and the fragment across a
    move. `HuntLabels = { org, hunt }`. `QuizLabels` is still `{ hunt, realm, quiz }`, the
    labels that find a quiz, and `quizPath` takes `HuntLabels & QuizLabels`.
  - **The org on every listing**: `HuntListingT.org`, computed by `orgFor(members)` in
    `src/lib/rows.ts`, so `ListedHuntT` and `ShallowHuntT` both carry it. `hunts.list` now reads
    each hunt's members as well, one more indexed read per hunt. `convex/_generated/` did not
    change, and no schema changed.
  - **Modes for acts**: `Hunting.modeFor(role)` (smith→`edit`, reviewer→`playtest`) and
    `Hunting.mayOpen(claims, mode)` replace `actFor`/`mayAct`. `ActVals` is gone; `ModeVals` is
    `Addresses`'.
  - **Moves**: old addresses (`/h/<hunt>`, `/h/<hunt>/<realm>/<quiz>?act=`, `/c/<hunt>/categories`),
    another org, a stale realm and a relabelled quiz all go through one mechanism: each route
    computes its canonical path once the hunt arrives and replaces to it (`useCanonical`). The
    old pages render the same route components with `org: null`. `placeIn` (`use-hunt`)
    searches every realm, the named one first.
  - **Header**: an `~org` crumb before the hunt's title, linking to `/~org`.
  - **e2e**: `NewHuntUrl`, `huntOf(page)` and `quizPathOf` in `support.ts`; the routing,
    categories, reviews, history, panels and quizzes specs move with the scheme. A new
    `routing.spec.ts` block, *an address in another form than its own*, covers the old
    addresses, another org, a stale realm, the quizzes page and not-found.
* **Decisions taken**:
  - **A quiz address with no mode opens `!playtest` for everyone** (Decision 5): it moves there
    whatever the visitor's role. That holds urls.md rule 4 (the URL says what is shown, never who
    is looking), and the app allows it, since anyone on the hunt may playtest. The app's own links
    (hunts list, hunt page, quizzes page, QuizNotFound) carry the mode the visitor's role works
    in (`Hunting.modeFor`), so a smith clicking through still lands on `!edit`. One side effect:
    the playtest screen opens one's review as it is shown, so a smith who follows a bare link
    gets an empty review of their own, as `!playtest` (and `?act=review`) always did for a smith.
  - **`/my/hunts` stays** the visitor's own page (where they land after logging in), listing
    every hunt they are on, whosever org. `/~org` lists that org's hunts that the visitor is on
    (`HuntsList org=`), offers "+ New hunt" only on their own org, and omits the orphaned
    histories.
  - **Pages read their address through `locationFrom`, not Next's params.** There is one parser,
    and it does its own unescaping, so the review question (whether Next hands `~`/`!` params
    unescaped) no longer matters. `%7E` is forgiven, as thread 0 built it.
  - **The org slot takes ident labels only (6 to 24 characters)** in `orgFrom`, as thread 0's
    review suggested. Ident labels have always been bounded so, so no address that works today
    breaks.
  - **`orgFor` falls back on the earliest member** when a hunt has no smith. The policies never
    leave a hunt without one, but the fallback means one hunt with broken data cannot blank
    anyone's hunts list. It throws only for a hunt with nobody on it, which nobody can be shown.
    `Addresses.orgOf` itself is unchanged (the Coach's question below).
  - **Nobody not on the hunt is moved**: with no hunt read, there is no org to move them to.
    They see *Not yet on this hunt* at whichever address they came by, and move once a smith
    adds them.
  - **`/~org/hunt/quizzes` is a small screen** inside `HuntRoute` (`screen: 'quizzes'`) that
    lists the quizzes. Nothing in the app links to it yet. `/~org/hunt/members` has no page and
    is not found; the hunt's own page lists its members.
* **Deviations**: none from the plan. `notes/decisions/2026-09-resource-urls.md` is marked
  superseded. `notes/stack.md` (*Routing*), `notes/vocabulary.md` (**org**, and **mode** in place
  of **act**) and `notes/views.md` (`mayOpen`) are brought up to date.
* **Discoveries**:
  - Next 16's App Router takes `~pat` in a top-level `[org]` and `!edit` in a `[mode]`, with no
    middleware. Static siblings (`/about`, `/my`, `/h`, `/c`, `/api`, the icons) still win.
    `notFound()` from a client page renders the default 404 ("This page could not be found.").
  - The e2e warm-up compiles only the quiz page. Under the dev server on a loaded machine, a
    route's first visit (`/~org`, the hunt page) can take longer than `expect`'s 10s.
  - **For thread 6**: write links with `Routes.huntPath({ org, hunt })` and
    `Routes.quizPath({ org, hunt, realm, quiz }, mode)`. Every `HuntListingT` (the hunts page's
    and `OrphanedRepos`' `hunts` among them) carries `org`.
* **For the Coach**:
  - Still open from thread 0: whether the org is the earliest *current* smith (as built, so
    demoting a hunt's maker moves its address and the old one moves after it) or the earliest
    member whatever their role. The change is one line in `Addresses.orgOf`, plus its test.
  - A bare quiz address opens `!playtest` for everyone, where it used to open by role. If you
    would rather the old behaviour, a role-based move in `QuizRoute` brings it back, at the cost
    of rule 4.
  - The review confirmed the side effect: a smith following a bare quiz link lands on
    `!playtest`, where `ReviewScreen`'s `open_review` on mount inserts an empty, unshared
    `reviews` row (one per smith per quiz; it never reaches the repository). If you want no
    stray row, the fix is to open the review on its first write in `ReviewScreen`, a later change.
