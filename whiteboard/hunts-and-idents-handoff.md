# Hunts and idents: handoff after PR 2

For the agent picking up at PR 3 (reviews) of `whiteboard/hunts-and-idents.md`. The plan still
stands; this is what building PRs 1 and 2 taught, and where the built code differs from the plan.

## Where things stand

* **`20260927-hunts` is rebased onto main** (after #10, the e2e practices, and #11, Jazz's worker
  URL) and holds, in order: the plan, PR 1 (bots: players became bots, *player* reserved for a
  human taking the quiz), PR 2 (idents and hunts), the history files under hunt and realm, and
  exports without ids. Unit (1946), lint, type, migration and e2e (150) suites green. Start PR 3
  from there with `pnpm run newb reviews`. The old `20260927-bots` branch predates the rebase;
  don't build on it.
* **The e2e database** (`data/jazz-e2e/`) holds PR 2's schema. After PR 3's migration, expect to
  reset it before the first e2e run. It also grows by ~150 hunts a full run, and every browser
  syncs the whole directory (every hunt, realm and quiz) before it opens anything: at ~550 hunts
  a second visitor's first load took 7 s, and the friend specs in `routing.spec.ts` timed out
  under a parallel run. If those go slow or red after many local runs, reset it. CI starts
  empty. The real fix is PR 5 and 6: the directory narrowed to the ident's own hunts.
* Neither is merged or deployed. They must deploy together: after PR 1 alone, the author's
  existing `playing` widgets break.

## The shape PR 2 left

Read these before adding the review screen; PR 3 plugs into all of them.

* **Rows.** `HeldRows` (`state/quiz-rows.ts`) is two parts. The **directory** (hunts, realms,
  quizzes) is every hunt's, read whole, so any address resolves and `/my/hunts` can list
  everything. The **hunt contents** (expressions, questions, widgets, columns, bottings) are the
  open hunt's only: expressions by `hunt_id`, the quiz children by `quiz_id: { in: quiz ids }`,
  bottings by `question_id: { in: question ids }` (`huntQueries`, `bottingsQuery`).
  - `useDirectory()` subscribes to the directory (the hunts list uses it, with
    `huntListingsOf`). `useHeldRows(huntLabel)` adds the contents of the hunt the label names.
    `loadDirectory(db)` and `loadHeldRows(db, hunt_id)` are the same as one-off reads.
  - An `in` list changes whenever a quiz or question is added, and `useAll` delivers `undefined`
    while a changed query first runs. `useKept` in `use-held-rows.ts` holds each table's last
    delivery for the same hunt meanwhile, so the page never blanks. Id lists are keyed as sorted
    text (`idsKey`/`idsIn`) so an unrelated directory delivery makes no new query.
  - `huntRowsOf`, `quizRowsOf` and `huntRowFor(held, label)` pick one hunt's or quiz's rows
    out; `huntFrom(held, hunt_id)` builds the `HuntT` tree the views read. `huntFrom` returns
    null until realms *and* their quizzes have arrived: each table arrives on its own, so a hunt
    seen with no realm is "not yet", not "empty".
  - **Reviews and reviewings** join the hunt contents the same way: reviews by
    `quiz_id: { in: quiz ids }`, reviewings by `review_id: { in: review ids }` (a second
    dependent key, like bottings), each through `useKept`.
* **Actions.** Two vocabularies in `state/actions.ts`:
  - `HuntAction`, carried out by `perform(db, held, open, action)` against `OpenQuiz`
    (`{ hunt_id, realm_id, quiz_id }`, from the address). `open_review`, `set_overall`,
    `set_review_phase`, `set_reviewing` and `peek_answer` belong here: they act on the quiz the
    address names.
  - `AccountAction` (`assume_ident`, `new_hunt`), carried out by `performAccount` in
    `state/account-actions.ts` through `useAccountActions()`. For actions with no open quiz.
* **Who the visitor is.** `useIdent()` gives `{ ident, loaded }`: the account's newest identing
  by `$createdAt`, an unstamped one counting as now. A review's `ident_id` is `ident.id`.
  `perform` does not know the ident today; the review actions will need it passed in (on the
  action, or as a new argument threaded through `useHunt`'s dispatch). Decide once and say which.
* **The page.** `app/h/[hunt]/[realm]/[quiz]/page.tsx` reads the segments and `act`, and hands
  off to `components/QuizRoute.tsx`, which sends an identless visitor to
  `/?then=<path and query>`, replaces a missing `act` with `smith`, and waits while `useHunt`'s
  `finding` is `'waiting'`. `act === 'review'` currently renders `AppNotices.reviewComingSoon`:
  that line is where `ReviewScreen` goes. `useHunt(labels)` hands back
  `{ finding, hunt, realm, quiz, dispatch, unsaved, saveNotice }`; the review screen takes the
  same `dispatch` and sets `data-unsaved={unsaved}` on its `main`, which e2e waits on.
* **Looking something up.** A browser that has never synced holds nothing. `lookUp(db, query)`
  (`state/lookup.ts`) reads locally, then asks the server for up to `ServerLookupMillis` (3 s)
  when it found nothing. Use it wherever "not found" must be true rather than "not synced yet"
  (e.g. PR 5's `add_hunting` resolving an ident label).
* **Addresses.** Only `lib/routes.ts` writes one: `quizPath(labels, act)`, `rootPath(then)`,
  `huntsPath()`, `switchIdentPath()`, `actFrom`, `thenFrom`. See
  `notes/decisions/2026-09-resource-urls.md`.

## Where the build differs from the plan

* **The quiz history (the mirror: each quiz's git repository in the browser) follows the quiz.**
  Relabelling a quiz is a new label on the same thing, and editing it new content for the same
  thing, so both land in the one history. That is why the repository's storage folder is named
  by the quiz's id, which the smith never sees. Inside the repository everything is by label:
  `tq/hunt/<hunt>/realm/<realm>/quiz/<quiz>.qq.tsv` and `.tq.json`, and the hunt's expressions
  at `tq/hunt/<hunt>/<hunt>.tqexpressions.json`. A relabel at any level is a move git shows as
  a rename. Repositories made before this layout are not migrated (the Coach's call); their
  next commit writes the new paths and drops the old ones, as any commit does. The mirror
  records only what this tab edited.
* **Ids never reach the smith** in anything they read, export or diff; labels do. Smiths export,
  edit and re-import, and merge questions between drafts; labels are how they say which is
  which, and a collision of labels there is a feature, not a bug. The Export box and each
  `.tq.json` are built by `lib/exporting.ts` (`huntExported`, `quizExported`): no ids at any
  depth, `chains_to` as the target's label. Import resolves a pasted chain by label, and picks a
  quiz out of a whole export by label then title; it still accepts ids, for backups made before
  this. Anything new a smith sees (the review screen, the reviews panel) follows the same rule.
* **Known race: a duplicate ident under a slow server.** Assuming an ident looks its label up
  locally, then asks the server for up to `ServerLookupMillis` (3 s). A browser that has never
  synced, on a slow or loaded server, gets no answer in time and makes a second ident with the
  same label; `useIdent` then shows that one, by id, rather than the earlier one the label rule
  says wins. Seen once in e2e under heavy machine load (`routing.spec.ts`, "makes one who types
  an ident someone else made"). It matters for PR 3, because a review hangs off an ident: two
  idents with one label would split one person's reviews. The likely fix is for `useIdent` to
  resolve the identing's ident through its label (the earliest ident with that label), so a
  duplicate folds into the original once sync delivers it. Raise it with the Coach before PR 3
  builds on `ident.id`.
* **`QuizNotFound` kept its listing** of the hunt's quizzes and of the history repos (marking
  those not in this hunt), but dropped the "make a quiz called…" offer, per the plan.
* **Old exports still import.** `importWorkspace` stays beside `importHunt` for the author's
  pre-hunt backups. It restores questions only: custom expressions, widgets and columns are not.
* **`HuntsList`** (at `/my/hunts`) lists every hunt, has *+ New hunt* and a *Be someone else*
  link to `/?switch`. PR 5 filters it by hunting.

## Jazz, alpha.56, learned the hard way

* **Migrations.** Let `./scripts/doppledo dev_claude ./scripts/jazz_migration` write them, then
  read them. uuid columns are `s.add.ref(table, { default })` / `s.drop.ref(table,
  { backwardsDefault })`; there is no `s.add.uuid`. A rename is `s.renameFrom('old')`. A new
  required ref on existing rows needs a default; PR 2 used the nil uuid, which orphans the old
  rows on purpose.
* **Changing an enum's value list fails the typed migration check** (no lens retypes an enum)
  but the server applies it. PR 1's migration carries an explained `@ts-expect-error` for this;
  PR 3's `phase` and PR 5's `role` are new enums, so they should not hit it. Adding a value to an
  existing enum later would.
* **`in` queries** are `where({ col: { in: [...] } })`, not `where({ col: [...] })`.
* **The unit test server is shared, and every hunt table is readable by every account.** The
  directory, and any whole-table read in a test, sees every other test's rows. Scope assertions
  to your own hunt or quiz id; never assert a table's count.
* **Whole-table subscriptions don't survive the e2e suite.** With every table read whole, each
  browser synced every spec's hunt and heard every other worker's edits: the full run took
  21 minutes and 26 specs failed on timeouts and lost edits, while each file passed alone.
  Scoping reads to the open hunt fixed it. Keep new tables scoped.
* **`hopTo` scopes correctly but crashes the unit tests** in alpha.56: it leaves an operation
  suspended in the Node runtime, and the next `testApp.as(...)` (a `set_identity_claims`)
  re-enters it and aborts the worker with SIGABRT ("synchronous node operation … reentered a
  suspended operation"). Also, `.select('*', ...)` after a hop reads `*` as the starting table's
  columns. Use `where` with `in` lists instead.
* **`$createdAt` arrives late.** A row read back at once may lack it. Order with a fallback to
  now (`askedAt`, `madeAt`), and in tests wait a couple of ms between writes you order by it
  (`seedHunt`'s `act` does).
* **After a schema change the e2e database can wedge**: every subscription stays `waiting` and the
  hunts page never leaves "Opening your hunts…". The browser console log (`Rows: hunts:waiting
  …`, from `use-held-rows.ts`) shows it. Reset with
  `./scripts/doppledo dev_e2e ./scripts/nuke-jazz_local` while no e2e server runs. Expect to do
  this after each PR's migration. The agent dev server's `data/jazz-agent/` can need the same
  under `dev_claude`.

## Next.js and tooling

* **`useSearchParams` needs a `Suspense` boundary** above it or the build fails the prerender.
  The quiz page and `/` both have one.
* **MUI's `component={Link}`** from a client component needs the client re-export in
  `components/NextLink.tsx`; import `Link` from there.
* **Stale generated route types.** After removing or renaming a route, `tsc` complains about
  `.next-agent*/types` and `.next-e2e/types` naming the old one. Delete those `types` folders.
* **Lint findings to expect**, and the fixes this codebase settled on: a class of statics only
  (`implements` the type, with `declare` fields); cognitive complexity (split into named helpers);
  `no-thenable` on an object with a `then` key (build `URLSearchParams` from an array of pairs);
  declarations before an early return (move them after it).
* **Shell.** zsh does not word-split a variable, so a file list in one variable is one argument.
  Write bulk renames as a bash script in the scratchpad, and use `/usr/bin/grep` for `-Z`.

## e2e conventions now

* **Read `notes/testing.md`'s Playwright section first**: main reworked the suite (specs import
  `test` and `expect` from `e2e/support.ts`, assert only with retrying matchers, and a Playwright
  lint holds them to it). The fixture's `page` starts in a fresh ident's fresh hunt, on its quiz
  at `?act=smith` (`startAt: FreshHunt`, by way of `startHunt`); a spec about the way in says
  `test.use({ startAt: null })`, as `routing.spec.ts` does. Test bodies do not `goto('/')`,
  which is the ident gate; to start over, use `page.reload()` or `loadAfresh`.
* **Hunts are shared across specs**, so find everything by your own random labels and titles,
  never by position in a list.
* **A second visitor** is a second `browser.newContext()`: see `otherVisitor(browser)` in
  `e2e/routing.spec.ts`, which closes its contexts in `afterEach`. PR 3's share-and-see flow and
  PR 5's role redirect both need it; lift it into `support.ts` when a second spec wants it.
* **The Export box shows the hunt**: `{ realms: [{ quizzes: [...] }], expressions, ... }`. There
  is no `active_quiz_id`; find a quiz by title or label.
* **Every address ends in `?act=…`**, so a URL pattern anchored with `$` on the path never
  matches. `newQuiz` and `openQuiz` compare `new URL(page.url()).pathname` instead. Under load
  the address changes a moment before the screen does, so both helpers also wait for the new
  quiz's title to show; a spec that types straight after a navigation types into the old quiz.
* **A queued second write lands later than it looks.** Two dispatches in a row (the gear's Apply
  sends a relabel and a version) run one after the other, the second rereading the rows. A spec
  that reopens a view after such a change calls `waitUntilSaved` first; the modal seeds its
  fields once, on opening.
* The full suite, 150 specs, runs in about three minutes locally. If it creeps back toward
  twenty, something is reading every hunt's rows again.

## For PR 3 in particular

* The answer lock, the chained BUT NOT and the row-height rule are specified in the plan; reuse
  `ButnotPreview` (`cells/chain.tsx`), `GrowingField` and `StretchField` (`cells/fields.tsx`).
* "Smiths see only shared reviews" is a client-side filter until PR 6. Since everything is
  readable by everyone, write the filter in one function so PR 6 can delete it.
* `open_review` must be idempotent under two tabs: find the (quiz, ident) review before inserting,
  and when two exist anyway, read the earliest by `$createdAt`, as labels do.
* Add *review*, *reviewing* and *phase* to `notes/vocabulary.md` (the plan has the wording).
* **Wide open is still wide open**: a reviewer can set `act=smith` and edit. Accepted for the
  week; don't add half-measures before PR 5.
