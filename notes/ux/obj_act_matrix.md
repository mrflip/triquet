# Object-action matrix

2026-10-09, as built at `ec3184a0` (origin/main after the columnwise sprint's thread 7). A row is a
noun; a column is a verb; a cell names the surface where that verb on that noun is offered, and
the policy that gates it is the action's row in `src/lib/approve.ts`. The nouns are
`notes/vocabulary.md`'s; the verbs are the action kinds in `src/models/actions.ts`. Keep this
page current when a thread adds, moves or retires a control: a PR that changes a surface changes
its row.

Two PRs open as this was written move rows: #203 (`import_carries`, beneath this branch) puts
the library's export and import inside the library modal as well as the Library tab, and #202
(`cw_runorder`, thread 5b) gives the Widgets panel the run order and the widgeting panel as its
open state. Whoever lands the second should re-read the widgeting and library rows.

The question this page answers for a reviewer is in `whiteboard/20261009-ux_flows/`: is each
noun's set of controls orthogonal and complete, and is there a path from the noun to each of its
concerns.

## Surfaces, by short name

| Short name | What it is |
|---|---|
| gate | `/`, `IdentGate` |
| hunts | `/my/hunts` and `/~org`, `HuntsList` |
| hunt page | `/~org/hunt`, `HuntRoute` (`screen="hunt"`) |
| quizzes page | `/~org/hunt/quizzes`, `HuntRoute` (`screen="quizzes"`) |
| wheel | `/~org/hunt/categories`, `CategoriesRoute` |
| workbench | `/…/quiz/!edit`, `Workbench`: header, switcher, toolbar, grid, panels |
| playtest | `/…/quiz/!playtest`, `ReviewScreen` |
| gear | `QuizManageModal`, from the header's gear |
| gear › X | one section of the gear: Label, Columns, Widgetings, Templates, History, Hunt, All quizzes, Archived, Danger |
| widgeting panel | `WidgetingPanel`, beneath its column in gear › Columns and as a row of gear › Widgetings |
| catalogue | `NewWidgeting`, opened by *+ New widgeting…* and by *+ New column… › A new entry…* |
| library modal | `LibraryModal`, from the toolbar's *Widget library* and gear › Widgetings' *Widget library…* |
| widget editor | `WidgetEditor`, from the library modal's ⚙ and *+ New widget…*, the widgeting panel's *Edit the widget…*, and the catalogue's *New widget…* |
| panels › X | a panel below the grid: Reviews, Spread, Members, Quiz entries, Export/Import (tabs Spreadsheet, Raw Export, Import, Library, Full History, LL Export), Widgets, Recap |
| hunt gear | `HuntEditModal`, from the hunts list's gear |

## The matrix

*in place* means the read-styled element is the editor and commits as it is left (`use-draft`,
the cells' fields). *explicit* means a button commits it (a *Relabel*, an *Apply*, a *Save*). A
dash means the verb exists for the noun and no surface offers it; *none* means the noun has no
such verb, by decision or by omission (the Notes column says which).

| Noun | Read, list | Create | Edit | Relabel | Reorder | Delete, archive | Bulk in, out | Home today | Policy | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| ident | header byline | gate (`assume_ident`) | hunts: name, in place (`retitle_ident`) | none | | none | | hunts | own | `/~org` is the ident's address and holds no editor. *Be someone else* at hunts. |
| hunt | hunts; hunt page; breadcrumb | hunts *+ New hunt* | title: hunt gear (explicit Save) **and** gear › Hunt (explicit Rename) | hunt gear **and** gear › Hunt | | gear › Danger, only as its last quiz goes (`delete_hunt`) | Raw Export (whole hunt, from a quiz); Full History | hunt page | `mayChangeHunt` | Its own page edits nothing of it but the branch. Two editors of one field, by different mechanisms. |
| branch | hunt page › Branch | | hunt page, explicit Switch (`rebranch_hunt`) | | | | | hunt page | `mayChangeHunt` | Not shown in the gear's History. |
| categories (wheel) | wheel; panels › Spread (as a chart) | | wheel, drag and double-click (`arrange_categories`) | | | | in the hunt's balls | wheel | `mayChangeHunt` | Linked from hunts, hunt page, gear › Hunt. Not from the Spread panel, which draws it. |
| members (hunting) | hunt page › Members (read-only); panels › Members | panels › Members *Add* (`add_hunting`) | role: none as a verb | | | panels › Members *Remove* (`remove_hunting`) | `members.tqm.json` | `/members` is addressed, unserved | `mayChangeMembership` | The hunt page's copy says "from a quiz's Members panel" instead of being one. The policy's doc promises "change their role"; no action does. |
| history (mirror) | hunt page › History; gear › History; panels › Export/Import › Full History | gear › History *Mark a milestone* | | | | | download, in all three places | three places | | Three doors, no home. |
| realm | in the address | none | none | none | none | none | | | | One realm, `home`, by decision (`urls.md`). |
| quiz | switcher; hunt page; quizzes page; hunts | switcher *+ New quiz* (`new_quiz`) | title, smith's note: header, in place; lock: switcher (`set_lock`) | gear › Label, explicit (`relabel_quiz`) | none | gear › Danger, typed confirmation (`delete_quiz`) | Export/Import: Spreadsheet, Raw Export, Import, LL Export | workbench | `mayReviseQuiz`; lock by `mayChangeHunt` | A quiz is made only from inside another quiz. Lock is toggled only in the switcher. |
| Q1 preamble | Export/Import › LL Export | | there, in place (`set_q1_preamble`) | | | | | LL Export tab | `mayReviseQuiz` | Lives where it is used. |
| recap head, tail, template | panels › Recap | | there, in place (`set_recap_*`) | | | | | Recap panel | `mayReviseQuiz` | |
| templateable sources | gear › Templates | | checkboxes, in place (`set_templateable`) | | | | | gear › Templates | `mayReviseQuiz` | |
| question | grid; playtest; gear › Archived | toolbar *+ Add question* | fields in the row, in place (`edit_question`); chain select (`set_chain`); viz button and batch (`set_viz`) | none | grip (`move_question`); header click (`sort_questions`); toolbar chain order, renumber | archive: row viz button, batch; delete: gear › Archived only (`delete_questions`) | Import tab; Spreadsheet; LL Export | grid | `mayReviseQuiz` | Delete only after archive: removal from the outside in. |
| column | grid headers; gear › Columns | gear › Columns *+ New column…* (`add_column`) | gear › Columns, in place (`edit_column`); header double-click collapses; source menu on the header | gear › Columns, explicit Relabel | gear › Columns drag (`move_column`) | gear › Columns *Remove* (`delete_column`) | with the quiz | gear › Columns | `mayReviseQuiz` | Columns lead; a column's widgeting is folded beneath it. |
| widgeting | panels › Widgets (readout); gear › Widgetings; beneath its column | catalogue (`add_widgeting`), from gear › Widgetings and *+ New column… › A new entry…* | widgeting panel, in place (`edit_widgeting`) | widgeting panel, explicit Relabel | gear › Widgetings drag (`move_widgeting`) | widgeting panel *Remove*, refused while a column shows it (`delete_widgeting`) | Import tab, by label | gear › Widgetings | `mayReviseQuiz` | The Widgets panel reads and points ("add one from the gear"). Thread 5b makes its open state the widgeting panel. |
| widgeted (a cell) | grid cell | ask: cell double-click (`record_widgeted`) | entry: cell, in place (`enter_widgeted`) | | | none: appended, never revised | Import carries entries | grid | `mayReviseQuiz`, `ask_anthropic_bot` | No *ask all*; no *ask* for a quiz-tier `aibot` (none exists). |
| quiz entry (quiz-tier widgeted) | panels › Quiz entries | | there, in place (`enter_quiz_widgeted`) | | | | not carried by Import (TODO) | Quiz entries panel | `mayReviseQuiz` | |
| review (own) | playtest | opened on arrival (`open_review`) | verdicts and overall, in place (`set_reviewing`, `set_overall`); answer lock (`peek_answer`) | | | none | `reviews/{ident}.tqr.json` | playtest | `mayWriteReview` | Share and withdraw are explicit (`set_review_phase`). |
| reviews (others') | panels › Reviews; playtest, once own is shared | | none | | | none | | Reviews panel | `mayReadReview` | Addressed (`…/reviews/{ident}`), unserved. |
| library | library modal; Export/Import › Library | | | | — (`move_widget` has no control) | none, by decision | Export/Import › Library (`import_widgets`, copy out) | `/pub/widgets` is addressed, unserved | `mayReadLibrary`, `mayChangeLibrary` | Two doors to a modal, bulk in a third place, reorder nowhere. |
| widget | library modal (label, title); widget editor | library modal *+ New widget…*; catalogue *New widget…*; *+ New column… › A new widget…* (`add_widget`) | widget editor, explicit Apply (`edit_widget`) | none: labels are fixed | — | widget editor *Remove*, refused while a widgeting works it (`delete_widget`) | Export/Import › Library | widget editor | `mayChangeLibrary` | The one Apply/Cancel editor in the app, on purpose: an edit is global. The modal's list shows no description and no usage. |

## Holes the matrix shows

Verbs with no surface, nouns with no home, and nouns reached only through another noun's
screen. Each is a finding, not yet a decision: `whiteboard/20261009-ux_flows/findings.md` sorts
them into the purposeful and the accidental.

1. **`move_widget` has no control.** The library is reordered by nothing; the catalogue and the
   modal list widgets in the order the library holds them.
2. **The library has no home.** Two doors open the same modal (toolbar, gear › Widgetings), its
   bulk import and export sit in a third place (Export/Import › Library), and `/pub/widgets` is
   addressed by `urls.md` but served by no page.
3. **Members are written only from inside a quiz.** The hunt page lists them read-only and says
   where to go; `/members` is addressed and unserved. `MembersPanel` already takes the hunt's
   members and claims, so the hunt page could show the same component.
4. **A hunt's title and label have two editors** by two mechanisms: the hunts list's gear
   (a Save dialog) and the quiz gear's Hunt section (explicit fields). The hunt's own page has
   neither.
5. **A quiz is made only from inside a quiz.** Neither the hunt page nor the quizzes page offers
   *+ New quiz*; nor lock.
6. **History has three doors and no home**: hunt page › History, gear › History, Export/Import ›
   Full History. Only the gear's marks a milestone.
7. **The Widgets panel reads and points.** Its microcopy names the gear instead of opening it.
   Thread 5b (underway) gives its rows the widgeting panel as their open state and drag handles;
   the matrix's row should be rechecked when it lands.
8. **The Spread panel draws the wheel and does not link to it.**
9. **A member's role cannot be changed.** `mayChangeMembership`'s doc block promises it; no
   action kind carries it (remove and re-add is the workaround).
10. **The quizzes page duplicates the hunt page's Quizzes panel**, with no verb of its own.
11. **An ident has no home.** `/~org` is the ident's address and shows a filtered hunts list; the
    name is retitled only at `/my/hunts`.
12. **Delete hunt is reached only through its last quiz.** Consistent with removal from the
    outside in; worth saying so somewhere a smith can read, since the hunts list offers no delete.
