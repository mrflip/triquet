# 2026-10-09: Sprint little fixes B done -- four threads, four PRs open, one stack

Your seventeen small asks became four threads, each one PR with a commit per ask, each reviewed
before it landed. All four landed and the stack ends on a full e2e run: 293 passed, 0 failed, no
flakes, on thread 2's landing. Plan and progress: `whiteboard/20261009-little_fixes_b/`; the live
mirror is the sprint doc (https://claude.ai/code/artifact/8cc61164-58c9-4990-b805-f640ae8d3d7b).
An API session limit stopped two workers for about an hour mid-sprint; both resumed with their
work intact.

## PRs, in the order they landed (one stack; #204 beneath it has merged)

1. **#212** -- thread 1: the (i) `InfoTip`, one `ConfirmRemove` (text and bin forms, a question in
   a popover where the button was), the entries note gone and a divider, the column menu's keys
   scoped. Review: clean.
2. **#214**, stacked on #212 -- thread 3: panels fold folded / open / big (double-click cycles;
   the arrows go straight to big), Raw Export's placeholder and resize grip, *This quiz* copy
   with its widgets, the Library tab renamed Widgets, Recap and Quiz entries swapped. Review:
   two fixes (an imported quiz entry checked against the paste's revised params; the spread
   panel's fold).
3. **#216**, stacked on #214 -- thread 4: one top bar (logo / ~org / hunt / realm / quiz switcher,
   New quiz, Lock quiz), `AccountMenu`, the Quiz pill and the categories page's Your hunts gone,
   a `percent` entry kind. **Widens the widget row's `config` union** (no backfill, no Serial
   Deploy). Review: three fixes (Percent bounds checked with its preset; no quiz crumb for a
   visitor refused its mode; the account-menu spec).
4. **#217**, stacked on #216 -- thread 2: widgeting rows in fixed slots with a formulary icon
   (sigma, robot, keyboard, braces), column rows with readout / Templated / Collapsed as in-place
   icon toggles that become full controls unfolded, the rest of the explaining prose behind an
   (i), and a race fixed in the shared e2e helper `foldTo`. Review: one fix (a tooltip's "as as").

Merging #217 alone lands the whole stack.

## Decisions taken in YOLO

All two-way doors; the plan lists them.

* "entity" read as the Entries note; "home" in the top bar read as the realm.
* Account is a menu at the bar's right: your name (editable), @label, Your hunts, Be someone
  else, About (moved out of the bar).
* "Drag handles" on the export boxes read as resize grips.
* "correct pct" became a generic `percent` kind beside `number`; your own `correct_pct` widget
  keeps its label and kind.
* The quiz copy carries the library widgets it uses, and no label.
* The (i) and remove-with-confirm open as popovers over their buttons (library focus and Escape
  handling) rather than swapping in place.

## For you

* **Production seed**: the Percent widget reaches production only when you run
  `./scripts/doppledo prd_janitor npx convex run seeding:seedWidgets` (safe to rerun);
  `human/20261009-lfb_topbar.md` has the note.
* **Two "Widgets"**: the renamed tab sits right above the Widgets panel. Rename the panel (*At
  work*, *Widgetings*) or the tab (*Widget library*)?
* **Templated race**: toggling Templated on two columns within one server round trip can lose
  the first; the Templates section always had it. A fix is an optimistic update or add/remove
  actions -- a design call.
* **Still visible, not behind an (i)**: the grid's "Each question chains..." footnote, the hunts
  page's blurb, the login gate's guidance. Move them?
* **Smaller**: scope the "Reorder <label>" names by list?; copying a quiz to a bare login takes
  two pastes (Widgets tab, then Import) -- one paste?; a copy of a quiz with no questions
  imports nothing; switching quizzes remounts the route, so the quiz crumb blinks.
* **Unread by review**: thread 4's reviewer was refused a read-only grep of `src/state/use-hunt.ts`
  and `src/models/hunting.ts` by the permission check and did not work round it; its QuizRoute
  fix stands on types typecheck accepts.
