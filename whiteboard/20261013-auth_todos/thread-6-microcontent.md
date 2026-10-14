# Thread 6: microcontent (2026-10-14)

Branch `20261014-microcontent`, PR filed at landing; see the report. Stacked on #253 and the
sprint's other landed threads. Suites at `ready`: justify green (6523 unit tests); as chosen specs
on the lane, `routing` 56/56, then `quizzes`, `reviews` and `google-sign-in` 46/46. The full suite
runs at landing, as the sprint's end run.

* **Built**:
  - **The survey**, `microcontent-survey.md` beside this file: every on-screen string, extracted
    with the TypeScript parser and read by kind (case, punctuation, verbs, terms, the three notices
    gathered for this thread), what was fixed and what is left for the Coach. Read it to take up
    any item it leaves, or to know why a string stands as it does.
  - **The conventions**, `notes/views.md`, *Microcontent*: sentence case (the app had already
    settled on it), full stops, quotes, dashes and ellipses, the screen's words, one string for the
    screen and the spec.
  - **Fixes, a commit per kind**: case ("Danger zone", "— playtesting", a role lower case
    mid-sentence through `quizzesAboutNotice`; the grid's field labels read `RefTitles`);
    punctuation (curly quotes round names, em dashes for `--`, the ellipsis character); terms (web
    address for "URL" and "web links", account for "login", the Edit hunt dialog's "Name"; the
    vocabulary's account words brought up to the screen's).
  - **(b)** taking a handle in a full app refuses with `noRoomForSandbox`, "Your handle wasn't
    saved: …" (`makeHuntFor` takes the refusal to throw; `makeSandboxFor` passes it), unit-tested.
  - **(c)** a new user's own sandbox says what it is (`AppNotices.ownSandbox`, the Quizzes panel's
    blurb), asserted in `routing`, and its absence on another hunt's page.
  - The TODO line is struck.

* **Decisions taken**:
  1. **Sentence case**, as planned: the survey found it already the app's rule.
  2. **The export formats keep their capitals** (*Raw Export*, *LL Export*, *Full History*) as
     proper names: they are capitalized everywhere they appear, the Coach's content pages included,
     so changing them would mean the Coach's prose too. Left as a question.
  3. **Column titles are left** ("Alt Text", "Full Answer", titleized widgeting columns): written
     into each column row, so a change reaches new quizzes only and wants a migration or a choice.
     The grid's field labels now read `RefTitles`, so a decision is one line.
  4. **"wasn't saved", not "wasn't taken"**, for (b): "That handle is taken" already means someone
     holds it.
  5. **(a) is not fixed**: see *Discoveries*.

* **Deviations**: the plan put the survey in the thread file; the orchestrator's look-ahead asked
  for a standalone file, which is what was done. The plan said "fix them in commits by kind": the
  e2e specs that name a changed string moved in the same commit.

* **Discoveries**:
  - **(a) The user menu after Google does not close itself.** Measured with a scratch spec (since
    removed) sampling the menu every 20 ms, three runs with and three without a candidate fix: a
    click in the first ~300 ms back from Google, while the address holds `?code=` and the page has
    not hydrated, is simply lost; once open, the menu shows only *Profile* for ~100 ms, then fills
    in and stays. Holding the last user in `ShowUser` changed nothing (it is a fresh page load), so
    it was dropped. `userMenuSaying`'s doc now says what it waits out.
  - `notes/vocabulary.md` said an anonymous user is *anonymous* on screen; the screen has said
    *standalone account* since the Coach's 218e9924. Fixed.
  - `HuntEditModal` explains its title field in helper text, which `notes/views.md` keeps for what
    is wrong with a field. Left: a view change, not copy.

* **For the Coach**: the survey's *For the Coach*, ranked; the top three are the sandbox's and its
  first quiz's titles (both the label titleized: "Flip Kromer" and "Flip Kromer"), the sandbox page
  leading a newcomer with git's Branch and History, and the Title Case column titles. Two lines of
  your own copy are flagged, not changed: "Account exists: click “Sign in with Google” if that's
  you." (an account is not a person: "if it's yours"), and the front door's "Verify your account
  to share puzzles…" said before there is an account.
