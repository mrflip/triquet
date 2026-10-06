# Thread 0: One address model (2026-10-05)

Branch `20261005-addresses`, PR pending. Suites: typecheck, lint and unit (129 files, 3686
tests) green; e2e not run (no caller changes).

* **Built**: `src/lib/addresses.ts` (import as `Addresses`), pure (no React, no Convex), and
  `tests/lib/addresses.test.ts`. A resource is an `AddressT`, tagged by `kind`: `org`, `hunt`,
  `quizzes`, `categories`, `members`, `quiz`, `questions` (the questions alone), `review`,
  `widget`. From it:
  - `keypathOf(address)`: the nouns and labels below the hunt (`['quizzes', 'home', 'legends']`),
    or below the library for a widget. **The one source**: the other two are made from it.
  - `urlOf(address, mode?)`: the root (`/~org/hunt`, or `/lib` for a widget), then the key path,
    then `!mode`.
  - `filepathOf(address, 'json' | 'tsv')`: the key path as directories and stem, then the
    pre-extension and the format. `isMerged(address)`: false only for the questions alone.
  - `locationFrom(pathname)`: `{ address, mode }` or null, the inverse of `urlOf`; and
    `orgFrom('~pat')`, `modeFrom('!edit')` for one segment at a time (Next's params).
  - `orgOf(members)`: the derived org (below).
  The tests hold the three to each other: every address is its root plus its key path, every file
  its key path plus extensions, every URL reads back as the address it was made from (in every
  mode), and no two files share a path. A kind added to `AddressT` and not to the tests' `Every`
  table fails the typecheck.

## The table

| Resource | URL | File | Key path |
|---|---|---|---|
| org | `/~pat` | none | none |
| hunt | `/~pat/spring_hunt` | `hunt.tqh.json` | `[]` (the root) |
| quizzes (the list) | `/~pat/spring_hunt/quizzes` | none: each quiz is one | `quizzes` |
| categories | `…/categories` | `categories.tqc.json` | `categories` |
| members | `…/members` | `members.tqm.json` | `members` |
| quiz | `…/quizzes/home/legends` | `quizzes/home/legends.tqq.json` | `quizzes.home.legends` |
| questions alone | `…/quizzes/home/legends/questions` | `quizzes/home/legends/questions.qq.json` | `quizzes.home.legends.questions` |
| review | `…/quizzes/home/legends/reviews/lee_jones` | `quizzes/home/legends/reviews/lee_jones.tqr.json` | `…legends.reviews.lee_jones` |
| widget | `/lib/widgets/pub/dumdum` | `widgets/pub/dumdum.tqw.json` | `widgets.pub.dumdum` |

Each file has a `.tsv` beside it with the same stem. Modes (`!edit`, `!playtest`) may follow any
URL; the model does not say which a route serves.

## Decisions taken

* **A module of its own, not grown inside `routes.ts`.** `Routes` stays the app's address book
  (login, about, the hunts page, `then`), and thread 1 rewrites its `huntPath`/`quizPath`/
  `categoriesPath` as calls into `Addresses.urlOf`, keeping `Routes` the only writer of an
  address. `Addresses` is importable from `convex/` too, should a server function want a path.
* **Pre-extensions**: `tqh` hunt, `tqq` quiz, `tqc` categories, `tqm` members, `tqr` review,
  `tqw` widget, as the plan proposed. **The questions alone are `questions.qq.json`** (and
  `questions.qq.tsv`), in a directory named for the quiz beside the quiz's own file. Every merged
  ball is `*.tq?.json` and the questions alone are not, so `git ls-files '*.tq?.json'` (git's
  pathspec `*` crosses `/`) finds exactly what a merge reads; thread 3 should prove that line
  against the real git CLI.
* **The hunt's own fields sit at the root of the merged hunt**, in `hunt.tqh.json`: its key path
  is empty, so it alone takes a fixed stem.
* **The questions' key path is where they sit in the quiz's ball** (`…legends.questions`). The
  questions-alone file holds that value unwrapped, outside the merge; its exact shape (keyed with
  `position`, or a bare list the Import box takes) is thread 2's.
* **Reviews are keyed by the reviewer's ident label** under the quiz: `…legends.reviews.lee_jones`.
  The model gives them a URL; no page serves it.
* **The org is the earliest smith**: the first of the hunt's members, in the order they joined,
  whose role is `smith` (`orgOf`). A hunt's maker is its first smith, so that is the maker until
  someone demotes them; then it moves to the next smith, and the old address redirects. Null for
  a hunt with no smith, which the policies never leave.
* **Modes are a closed list**, `edit` and `playtest`; any other `!word` reads as no address.
  User views widen `ModeVals` when they come.
* **Parsing is strict**: lowercase labels only, and `@ref`, `.json` and a realm alone
  (`…/quizzes/home`) read as no address. A query string, a fragment, a trailing slash and an
  escaped `~` (`%7E`) are forgiven. Old addresses (`/h/…`, `/c/…`, `?act=`) are not this
  module's: thread 1 reads them in `Routes` and redirects.

## Deviations

* **A widget's URL keeps its scope**: `/lib/widgets/pub/dumdum`, where urls.md sketches
  `/lib/widgets/{widget}`. With the scope in it, `/lib` stands where `/~org/hunt` does and rule 10
  holds for widgets too (`widgets/pub/dumdum.tqw.json`, `{ widgets: { pub: { dumdum } } }`, the
  shape the plan gives thread 2). No widget page is built; this is the shape one would take.

## Discoveries

* **`ShallowHuntT` carries enough to name the org; `ListedHuntT` does not.** `members` comes from
  `membersOf`, which reads huntings by `by_hunt_id`, in the order they were made, so
  `orgOf(hunt.members)` works on any hunt's or quiz's screen. The hunts list carries no members.
  **The smallest addition is `org: string` on `HuntListingT`**, worked out on the server with
  `orgOf(await membersOf(db, hunt._id))` in `huntListingOf`'s callers (`hunts.list`, and the
  opening's `shallowHuntOf`, where the members are already read): one more indexed read per
  listed hunt. Thread 1's to make; no query was changed here.
* **A realm's own fields have no key path.** `quizzes.<realm>` holds quizzes keyed by label, so a
  realm's `title` or `position` cannot sit beside them (a quiz may be labelled `title`). Thread 2,
  if it writes realms at all, wants a resource of its own (`realms.<realm>`, say), added here as
  one more `kind`. With every hunt holding only `home`, leaving realms out of the balls is also
  reasonable.
* `src/models/hunting.ts` imports `Act` from `routes.ts` (`Hunting.actFor`, `mayAct`): thread 1's
  move to modes touches it. The old act maps onto the new mode as `smith` to `edit` and
  `review` to `playtest`.

## Review, carried forward

The review found nothing to fix. Its minor findings fall to later threads:

* **Labels are checked by shape, not length**: a slot passes `PA.Label.re`, not Label's 2-40 or
  Identlabel's 6-24. Thread 1 may want Identlabel's bounds on the org.
* **`orgFrom` and `modeFrom` take a segment as given**, unescaped by the caller, where
  `locationFrom` unescapes its own. Thread 1: confirm Next's params arrive unescaped.
* **`isMerged` is true for a widget**, whose ball merges into the library rather than the hunt.
  Thread 2's call whether that wants saying, or a second predicate.
* **`notes/decisions/urls.md` still writes the realm as `a`**: thread 3's docs pass.

## For the Coach

Both open, put to the Coach by the orchestrator, who recommends keeping the scope and deriving the
org from the earliest member whatever their role (thread 1 would make that change).

* The widget URL keeps its scope (*Deviations*): fine, or should the scope stay out of the URL
  and live only in the files?
* The derived org follows the earliest *current* smith, so demoting a hunt's maker moves its
  address (the old one redirects). The alternative is the earliest member whatever their role.
