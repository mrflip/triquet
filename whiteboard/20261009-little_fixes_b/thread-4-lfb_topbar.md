# Thread 4: The top bar, the account, and small removals (2026-10-09)

Branch `20261009-lfb_topbar`, PR filed at landing; see the report. Suites: justify green
(typecheck, lint, unit tests); the full e2e suite is run at landing, its result in the report and
the PR. The review's three `fix:` commits ride along: a percent's params are checked with its
preset beneath them (`entryParamsIssues`), the header names no quiz to a visitor refused its
mode, and the account-menu spec says Escape to the dialog.

One commit per ask, in the Coach's order:

* **Built**
  - *One top bar* (`f58b9e74`). `SiteHeader` now reads logo / ~org / hunt title / realm label /
    quiz title, then *New quiz* and *Lock quiz*. The quiz's title is `QuizSwitcher`, now a
    crumb: a `Button` opening a `Menu` of links to the realm's quizzes, in the mode the page is
    in, a locked one marked 🔒. The realm's label links to the hunt's quizzes page, which is
    the nearest page listing the realm (principle 9). The second bar is gone from `Workbench`.
    The header sits outside the database connection, so the page tells it what it cannot know
    for itself: `src/state/shown.tsx` (renamed from `shown-hunt.tsx`) holds one state of parts.
    `useShowHunt`, `useShowQuiz` (from `QuizRoute`, in both modes), `useShowQuizActs` (from
    `Workbench`: what the two buttons do) and `useShowAccount` each say one part. When narrow:
    below md the middle crumbs fold into MUI's own ellipsis (`maxItems`); below sm the logo
    shows only its mark (`Logo markBelow`) and the buttons show only their icons, named by
    `aria-label`. The crumbs give way to the buttons: the org first, then the hunt, the quiz's
    title last. The logo and the realm's label keep their width (`data-yield`).
  - *No Quiz pill, no Your hunts on the categories page* (`eaa3aff0`). Its `.pillQuiet` rule
    was used nowhere else and went with it. The error pages' Your hunts links stay.
  - *The account* (`751e24f6`). `AccountMenu` sits at the bar's far right on every page: an
    avatar with your initial (a bare figure where no one is known) opening a `Popover`. Inside
    are your name, retitled in place with `IdentTitle` (lifted out of `HuntsList`, which keeps
    its "You are ..." line), your @label, then a `MenuList` of *Your hunts*, *Be someone else*
    and *About*. About moved out of the bar into it. `ShowAccount`, mounted in the synced
    layout, says who is looking.
  - *Percent* (`19504b24`). A new entry kind, `percent`, is a preset of the number family
    (`NumberPresets`: 0 to 100 beneath anything the widget or widgeting says). It is offered
    after *A number* in the kind picker, and its box shows `%` (`EntrySuffixes`, which feeds
    react-number-format's `suffix`, in the grid and in Quiz entries). The params editor shows
    a preset's bounds through as placeholders. There is a new seed, `percentage`, titled
    Percent, after Number.
* **Decisions taken**
  - The header learns everything from the page through one context of parts. I chose that
    over portals into header slots: one mechanism, the header owns its layout, and each part
    is a memoized object whose functions (`carryOut`, `dispatch`, `act`) are already stable.
  - The switcher is an MUI `Menu` of links, not the native select. A crumb wants to read as
    text, and opening a quiz is navigating anyway. The specs open it through `switcherQuizzes`
    in `e2e/support.ts`.
  - The account menu is a `Popover`, not a `Menu`. The name field then sits outside the
    menu's list, so no keydown workaround is needed for type-ahead.
  - On About, which never connects to the database, the account menu still shows, but
    without a name.
  - `percent` is a preset of `number`, not a family of its own, so every number path (editor,
    validation, params, gist) serves it unchanged. The value is kept as 0-100, not 0-1, so the
    Coach's recap template (`Correct Answer %: {{ qn.correct_pct }}`) reads the same.
  - The seed's label is `percentage`: seed labels are kept from the kind names.
* **Deviations**
  - *New quiz* lost its "+": it now has an add icon, and its name is "New quiz". The lock
    button gained a lock icon.
  - `notes/ux/obj_act_matrix.md` gains a *top bar* surface, and its quiz, realm and ident rows
    follow the moved controls. `notes/vocabulary.md` names `percent`.
* **Discoveries**
  - Schema: `EntryKindVals` reaches `convex/schema.ts`, through the widget row's `config`
    union. Adding `percent` is a widening only. Every stored row still fits, so there is no
    backfill and no Serial Deploy. `convex/_generated/` did not change.
  - A preset's bounds sit beneath a widget's own, so a Percent widget can be bounded otherwise
    (say, up to 150).
  - Container load (~60) makes `routing` time out in 30 s here and there. Each test that
    failed passed alone, and when rerun together.
* **For the Coach**
  - Production gets the Percent seed only when someone runs
    `./scripts/doppledo prd_janitor npx convex run seeding:seedWidgets` (safe to rerun).
    Relabelling or retiring your `correct_pct` widget is yours. See
    `human/20261009-lfb_topbar.md`.
  - Screenshots, desktop and 800/600/390 px, are in the thread's scratch directory
    (`shots/bar3-*`, `bar4-*`: bar, open switcher, open account menu). They are not committed.
