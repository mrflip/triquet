# Microcontent survey (2026-10-14)

Thread 6 (`microcontent`) of the auth_todos sprint. Every on-screen string in `src/components/`,
`src/app/`, `src/state/`, `src/lib/notices.ts` and the rest of `src/lib/` and `src/models/` that
reaches a screen, extracted with the TypeScript parser (JSX text, the string props a person reads,
string literals with prose in them), about 1,200 in all, then read by kind. The new user's screens
(front door, sandbox, hunts list, user menu) were also looked at in a browser. Read this to know
why a string is as it is, or to take up an item left for the Coach.

**Verdict:** the app was already in **sentence case**, almost everywhere, so the plan's default
stands; the conventions are now `notes/views.md`, *Microcontent*. The strays were few.

## Case

* **Fixed**: "Danger Zone" (the gear's) -> "Danger zone"; the review screen's "— PLAYTESTING"
  -> "— playtesting"; a role said mid-sentence, "You are on it as Smith" -> "You are a smith on it"
  (`quizzesAboutNotice`).
* **Kept, as proper names**: the export formats, *Raw Export*, *LL Export* and *Full History*. They
  are capitalized consistently in tabs, buttons, help text and the Coach's own content pages
  (`terms.md`: "Download a hunt's Full History"; `full-history.md` quotes the button), so they read
  as named things rather than strays. The panel holding them is "Export / Import", which by the
  rule would be "Export / import": left with them. *For the Coach*, below.
* **Left, data**: the column titles the app gives. `RefTitles` (`src/models/column.ts`) has "Alt
  Text" and "Full Answer" beside "Chains to", "BUT NOT", "Clueing"; a widgeting's column is titled
  by `Labelmaker.titleize` ("Clueing Full", "Category Data"), and the seeds' presets "Hint Full
  Sum". The title is written into each column row, so a change reaches new quizzes only. *For the
  Coach*. The grid's own field labels now read `RefTitles`, so they follow whatever is decided.
* Content pages (`src/content/`): every heading is already sentence case. Nothing changed.

## Punctuation

* **Fixed**: straight quotes around a name -> curly, as most notices had them (`userUnknownNotice`,
  `heldByVerifiedAccount`, an import's skipped widgetings and columns, a cell whose widget is gone);
  a typed `--` between clauses -> an em dash (the gear's run order, the Widgets panel, the recap
  template's help); "(...click to reveal answer...)" -> the ellipsis character.
* Consistent already: an ellipsis on a control that asks for more (*+ New column…*, *Sign out…*),
  on a waiting notice (*Opening…*); full stops on sentences, none on labels and alarm headings.
* Left: apostrophes are straight nearly everywhere, curly (`&rsquo;`) in a few JSX paragraphs
  (`CategoriesRoute`, `Footnote`). The convention says "as typed"; not worth a sweep.

## Verbs

* Consistent: *New* makes a thing (*+ New hunt*, *New quiz*), *Add* puts one into something
  (*+ Add question*, the members panel's *Add*); *Remove* takes off what keeps going, *Delete* is for
  good (`ConfirmRemove` says both).
* **Left** (*For the Coach*): a dialog that commits at its end says *Save* (Edit hunt) or *Apply*
  (the widget editor); one that keeps as it goes says *Done*. A missing field is asked for three
  ways: "Enter a label.", "Type the handle they go by.", "Give the new widget a label.".

## Terms (against `notes/vocabulary.md`)

* No "username" or "anonymous" anywhere on screen, and one "login". Fixed: that "login", in Raw
  Export's help -> "account"; "updates the URL" -> "changes the web address of every quiz in the
  hunt" (the relabel warning, which also said "this page" from a list of hunts); "used in web links"
  -> "web addresses"; the Edit hunt dialog's "Title" -> "Name", as the gear's "Hunt name" and the
  header's "Quiz name".
* **The vocabulary was behind the screen**: it said an anonymous user is *anonymous* on screen; the
  screen says *standalone account* and *verified account* (the Coach's, 218e9924), and sealed
  refusals open "Verify your account", not "Sign in with Google". `notes/vocabulary.md` now says so.
* Left: a handle is "lowercase letters, numbers and single underscores" at the front door, a label
  "letters, digits and single underscores" in the hunt dialog and the entry patterns. Minor.

## Notices (the three gathered for this thread)

* **(a) The user menu after Google**: reproduced and measured (a scratch spec sampling the menu
  every 20 ms, three runs with and without a candidate fix). It does not close itself. A click on
  the header's button in the first ~300 ms back from Google, while the address still holds
  `?code=` and the page has not hydrated, is lost, as any click on a server-drawn button is; once
  it opens, it shows only *Profile* for ~100 ms until the server says who is looking, then fills in
  and stays open. Holding the last user in `ShowUser` changed nothing (it is a fresh page load), so
  it was not kept. `userMenuSaying`'s doc (`e2e/google.ts`) now says what it waits out. No fix
  made; not worth a TODO unless the Coach sees it by hand.
* **(b) A full app at taking a handle**: a refusal of its own, `noRoomForSandbox`: "Your handle
  wasn't saved: every new handle comes with a hunt of its own, and the app already holds the most
  hunts it can (999)." It says nothing of whether the cap will move. "Saved", not "taken", since
  "That handle is taken" means someone holds it.
* **(c) The sandbox page**: on the visitor's own sandbox, the Quizzes panel now opens with
  `AppNotices.ownSandbox` ("This is your sandbox: a hunt of your own, named for your handle, to
  try things in."), which says neither when it was made nor how many quizzes it holds. The rest is
  *For the Coach*.

## For the Coach

Ranked by how much a person would notice.

1. **The sandbox's and first quiz's titles.** Both are titled from the label (`titleize`): Flip
   Kromer's sandbox is a hunt called "Flip Kromer" holding a quiz called "Flip Kromer", and a
   handle with digits gives "Tester 7348 F 9 Ed 61 Ce". Suggest the sandbox be titled "Sandbox" (or
   "Flip's sandbox") and its quiz "First quiz" or left untitled ("Untitled quiz"): a few lines in
   `makeSandboxFor`/`insertHunt`, new users only.
2. **The sandbox page for a newcomer** leads with Quizzes, then Branch (a git branch field), History
   (a git download), Categories, Members. Suggest hiding Branch for a sealed user, and offering a
   standalone account its verified account there as `/my/hunts` does (`StandaloneAccountPanel`).
3. **Column titles in Title Case** ("Alt Text", "Full Answer", "Clueing Full", "Hint Full Sum")
   beside sentence-case ones in the one header row. If they are not LL's own field names, say the
   word: `RefTitles` and the seeds' presets change in a line each, and a migration would retitle
   stored columns still holding the old default (or leave old quizzes as they are). About 25 e2e
   lines and a dozen unit lines name them.
4. **The export formats' names**: keep *Raw Export* / *LL Export* / *Full History* as proper
   names (as now, and as the content pages have them), or sentence-case them with the rest ("Raw
   export"), which also means the content pages' prose.
5. **"Account exists: click “Sign in with Google” if that's you."** equates an account with a
   person. "If it's yours" says the same without it. Your words, so left.
6. **The front door's line** "Verify your account to share puzzles and edit them anywhere" is said to
   a visitor who has no account yet, and says *puzzles* where the app says quizzes. Your words.
7. *Save* versus *Apply* for a dialog that commits at its end (suggest *Save* for both), and the
   three ways of asking for a missing field (suggest "Enter a …").
