# Findings: where the three pictures agree, and what to call the path that wins

2026-10-09, at `ec3184a0`. Read with `notes/ux/obj_act_matrix.md` (the matrix and its holes),
and the three pictures beside this file: `navigation.md`, `relations.md`, `urls.md`.

## 1. Where the pictures differ

The relations diagram and the URL tree agree almost everywhere, because `urls.md` made them
agree: one key path makes the URL, the file and the jsonball. The navigation is the picture that
drifts, and it drifts in one direction: **things that belong to the hunt or to no hunt are
reached through a quiz.**

| Noun | Relations say | URL says | Navigation does | Difference |
|---|---|---|---|---|
| widget, library | a scope apart from every hunt | `/pub/widgets/{widget}` | modal from a quiz's toolbar and gear; bulk in a quiz's Export/Import tab | **large**: the library is navigated as if it were the quiz's |
| members | the hunt's | `/~org/hunt/members` | written in a quiz's panel; read on the hunt page with a pointer | **small**: same component, wrong page |
| hunt title, label | the hunt's own fields | `/~org/hunt` | two dialogs, neither on the hunt page | **small**: two editors, no home |
| history, branch | the hunt's | nothing | hunt page (branch, download), gear (milestone, download), a tab (download) | **small**: three doors |
| quiz | the realm's child | `…/quizzes/home/{quiz}` | made and locked only from inside another quiz | **small**: collection verbs off the collection |
| review | quiz × ident | `…/reviews/{ident}` | `!playtest` for one's own; a panel for the others' | consistent: a mode and a panel do the work |
| column, widgeting, question | the quiz's children | nothing (a fragment, at most) | the gear, the grid | consistent: structure is not addressed, by choice |
| widgeting → widget | by label | `/pub/widgets/{widget}` | *Edit the widget…* behind a door in the widgeting's panel | consistent, and the best piece of navigation in the app |
| column → widgeting | by source ref | nothing | the widgeting's panel folded beneath its column | consistent, same |
| categories | the hunt's wheel | `…/categories` | its own page, linked from hunts, hunt page, gear | consistent: the model citizen |

**The resolution each small difference suggests, by the principles in §4:**

* The hunt page becomes the hunt's home: name and label (explicit *Rename* and *Relabel*, as the
  gear's section has them), *+ New quiz*, the branch, the members panel (the same `MembersPanel`,
  which already takes members and claims), one history door. `HuntEditModal` retires; the gear's
  Hunt section keeps its link and loses its fields, or keeps both as a shortcut. The quizzes page
  either gains the collection's verbs or goes.
* The library gets its page at `/pub/widgets` (addressed already): the list with description and
  usage, *+ New widget…*, reorder, and the Library tab's import and export. The modal stays as the
  quiz's shortcut to the same component; the Library tab becomes a link.
* The Spread panel links to the wheel it draws.

## 2. What to call the path that wins, and whether every resource gets a URL

The repo already has the word. `urls.md`, *Key paths and files*: "every resource has a key path
(`Addresses.keypathOf`): the nouns and labels below its hunt, or for a widget from its scope
down. Its URL, its file in the hunt's repository and where its piece sits in a jsonball are each
made from that one list." That is the canonical path, named **key path**, and it is already the
spine the URL tree and the relations diagram share. The web's own word for the same idea is the
*canonical URL* (RFC 6596's `rel="canonical"`): one address a resource is known by, the others
being aliases that point at it. Object-oriented UX calls the screen at that address the object's
**home** (every other appearance is a *reference* that links home). I suggest the two words
together, since each names a different thing:

* **key path** is the resource's identity: what its URL, its file and its JSON place are made
  from. Already in `notes/vocabulary.md` as `keypath`.
* **home** is the screen served at the key path's URL, where the resource's collection verbs
  (create, reorder, bulk in and out) live. Every other screen that shows the resource is a
  reference, and a reference links home.

**Should each resource have a URL that is its key path?** Yes for every noun that *has* a key
path, and `urls.md` already decided which those are: hunt, categories, members, quiz, questions
alone, review, widget. Four of the seven are served. The rule that follows: **a noun with a key
path gets a page at it, eventually; a reference to the noun anywhere else links there; its
collection verbs live there.** The nouns without a key path (column, widgeting, question in its
row, a cell) are the quiz's structure and content, addressed by the quiz's URL plus, at most, a
fragment; their home is the quiz's gear or grid, and that is fine.

**How:** the page at a key path opens the same component the modal or panel opens today. The
library modal becomes the `/pub/widgets` page's component, mounted in a dialog from the quiz as
a shortcut; `MembersPanel` is the `/members` page's component and stays a panel in the quiz. A
dialog that is a shortcut to a home keeps the home's controls, so there is one editor per noun.
Deep links into the gear, if ever wanted, are fragments on the quiz's URL (`#columns`), not
modes: modes are how a quiz is opened, and the built-in names are reserved.

## 3. Thoughtful custom arrangements

Places where the navigation departs from the relations on purpose, and the departure is the
better design. A reviewer should recognise these and leave them alone.

* **The widgeting beneath its column.** The relation runs column → widgeting → widget; the
  folding editor draws it as a column's panel with the widgeting's panel folded beneath, and the
  widget behind *Edit the widget…* inside that. One place edits the whole chain, and the admin's
  global edit sits behind the one door that warns (the usage line).
* ***+ New column…* as a menu of three**: showing something the quiz has, a new entry (a
  widgeting and its column in one go, for any smith), a new widget (for an admin). The common
  case takes one click; the rarer cases are a menu item away and gated by policy.
* ***New widget…* inside the catalogue.** A smith picking a widget to put to work who finds none
  that fits writes one without leaving the picker. A shortcut to the same editor, not a second
  editor.
* **The Q1 preamble in the LL Export tab.** The field exists for that export; editing it where
  its effect is seen beats a field in the gear nobody connects to the export.
* **Quiz entries as a panel, not a column.** A quiz-tier entry has one value, so a grid column
  would repeat it on every row.
* **Archived questions in the gear, delete only there.** Archive is a viz change in the grid;
  delete waits until the question is out of sight. Removal from the outside in, applied to
  content.
* **The lock lives in the switcher, and the switcher is never locked.** Switching away, making
  another quiz and unlocking stay available on a locked quiz: locking is never a trap.
* **Mode in the address, picked by the role.** A pasted link opens the right screen for whoever
  opens it; a smith opens `!playtest` from the Members panel to see what a reviewer sees.
* ***Relabel* buttons amid in-place fields.** A label is what other things name, so it waits on
  an explicit button and says so while it waits (`ExplicitField`). Titles commit as they are
  left. The distinction is principled and the copy says it.
* **The widget editor's *Apply*.** The one Apply/Cancel editor in the app, because an edit
  changes every quiz in every hunt that works the widget. Explicit on purpose.
* **Share and withdraw on a review.** Explicit, because the act is social.
* **The danger zone's typed confirmation**, and *delete hunt* appearing only as the last quiz
  goes.
* **A paste that belongs to another quiz is sent there** (`PendingImports`): the Import tab
  reads a whole hunt and routes each quiz to its own address.
* **Stats linked from nowhere.** An admin's page; the address is the door.

## 4. Principles the choices reveal

Phrased as defaults with their exceptions, since each has one already. "By default" and "unless"
rather than "always" and "never": a worker who finds the exception should name it, not route
round the rule.

1. **The address names the resource; the mode names how it is opened; the role picks the mode.**
   (`urls.md`.) A link is the same for whoever opens it. One writer of addresses (`Routes`), one
   key path for URL, file and JSON.
2. **Edit where you read.** An owned field is edited by clicking the read-styled element and
   commits as it is left (`use-draft`; the columnwise sprint retired the dialogs). The exceptions
   are principled and few: a *label* waits on its own button, because other things name it; a
   *global* edit (a widget) waits on Apply, because it changes other people's quizzes; a *social*
   act (share, add a member, delete) is a button. New dialogs and Save buttons should be able to
   say which of the three they are.
3. **Derived values link to their source; owned fields are their own editor.** A readout (the
   run, a filled template, a chart) carries a link to the thing it was computed from, not a copy
   of its editor. Microcopy that names where to go instead of taking you there is the tell that
   a link is missing.
4. **A control is offered exactly where the policy would accept the action** (`offers.ts`,
   `Approve`). Disabled with a reason on a lock; absent for a role the policy refuses. The
   surface never decides.
5. **Removal from the outside in, at every level.** A thing goes only once nothing shows or
   works it; the author clears references first; the refusal says what still refers. Archive
   before delete for content; a confirmation typed for the irreversible.
6. **Lock is never a trap.** What gets you out of a state is never disabled by the state.
7. **Collection verbs live at the collection's home; item verbs live on the item.** Create,
   reorder, bulk in and out belong to the screen that lists the noun; edit belongs wherever the
   item is shown. (Followed for questions, columns, widgetings; not yet for quizzes, members, the
   library.)
8. **Three altitudes on the quiz screen**: the grid and header are content, the gear is
   structure, the panels are the quiz's neighbours (reviews, members, exports, the run). A verb on
   the quiz's structure goes in the gear; a verb on another noun goes in that noun's panel or
   home, not in the gear.
9. **A noun with a key path gets a page there, eventually.** Until it does, the nearest
   ancestor's page lists it and links what exists. (Categories got its page; members, the
   library and reviews are waiting.)
10. **A shortcut opens the home's component, never a second editor.** Two editors of one field
    by two mechanisms is the strongest signal of slop in the audit below.

## 5. Controls audit: missing verbs and nouns, and custom arrangements

Separate from the flow questions above. Each item says whether it looks purposeful or
accidental; a Coach's call either way.

### Missing a verb

| Noun, surface | Missing | Looks | Note |
|---|---|---|---|
| library | reorder | accidental | `move_widget` exists, is policed, is dispatchable from `useLibraryActions`, and no control sends it. The catalogue lists widgets in library order. |
| library modal | description, usage per widget | accidental | The widget editor shows both; the list shows label and title only. |
| members | change role | accidental | `mayChangeMembership`'s doc promises it; no action kind. Remove and re-add is the workaround. |
| hunt page | rename, relabel, new quiz, delete | accidental | The hunt's own page edits only its branch. |
| quizzes page | every verb | accidental | A list with nothing to do, reached by no link. |
| hunts list | delete hunt | purposeful, undocumented | Removal from the outside in; say so in copy where a smith looks for it. |
| Widgets panel | open to the widgeting, reorder | in progress | Thread 5b. The pointer microcopy goes with it; *+ New widgeting…* needs a home there or stays the gear's. |
| Spread panel | link to the wheel | accidental | |
| grid, cells | ask all, re-ask a column | purposeful so far | Each ask is a cost; double-click per cell. A column-level re-ask is a design question, not slop. |
| quiz-tier `aibot` | ask | purposeful | None exists; TODO notes it would need a button in the panel. |
| widget | relabel | purposeful | Labels are fixed once made so exports round-trip (`widgeting.ts`). |
| column headers | reorder by drag | purposeful? | Reorder is the gear's; the header's double-click collapses. Worth one line in `views.md` saying so. |
| review (smith's side) | anything | purposeful | A smith reads shared reviews; the reviewer owns them. |
| ident | a home | accidental | `/~org` is the address and shows hunts; the name is retitled at `/my/hunts` only. |

### Missing a noun (a thing with no surface at all)

* **The library as a thing**: no page, no list with its fields; only a picker, a modal and a
  paste box.
* **Members as a thing of the hunt**: a panel inside a quiz.
* **A shared review as a thing**: a section of a panel; addressed, unserved.

### Custom arrangements: purposeful or slop

| Arrangement | Verdict | Why |
|---|---|---|
| hunt name and label in `HuntEditModal` (Save dialog) **and** gear › Hunt (explicit fields) | slop | Two editors, two mechanisms, one field. Principle 10. Keep the explicit fields; put them on the hunt page. |
| hunt page's read-only Members with "from a quiz's Members panel" | slop | Principle 3's tell. The component exists. |
| Widgets panel's "add one from the gear" | slop, being fixed | Same tell; thread 5b. |
| *Widget library* in the toolbar **and** *Widget library…* in gear › Widgetings | half | Two doors to one modal is fine as shortcuts once a home exists; today they are the only doors. |
| Library import and export in Export/Import › Library | slop by location | Grouped by format, not by noun. Fine as a tab once it links to a home. |
| History in three places | slop | Pick the hunt page; the gear's *Mark a milestone* can stay as the quiz's shortcut since a milestone is marked while working. |
| Quizzes page duplicating the hunt page's Quizzes panel | slop | Fold or furnish. |
| *Edit the widget…* in the widgeting panel; *New widget…* in the catalogue; *A new widget…* in the column menu | purposeful | Shortcuts to one editor from where the need arises, all gated by `changeLibrary`. |
| the widget editor's Apply/Cancel | purposeful | Global edit. |
| Q1 preamble in LL Export | purposeful | Where its effect is seen. |
| the switcher's lock | purposeful | Never a trap. |
| archive in grid, delete in gear | purposeful | Outside in. |
| widgeting beneath column | purposeful | Follows the relation. |
| Relabel buttons | purposeful | Named by others. |
| *Be someone else* on the hunts list, assume at `/` | purposeful | The gate is the ident's door. |
| `/stats` unlinked | purposeful | Admin by address. |

## 6. What a reviewer is told

The checklist in the 2026-10-09 chat, revised by this audit, for `thread-reviewer.md` or a
`notes/ux/` page that it reads. For each noun a thread touches:

1. **Find its row** in `notes/ux/obj_act_matrix.md`. A thread that adds, moves or retires a
   control changes the row in the same PR. A noun with no row gets one.
2. **Owned fields edit where they read.** A field the policy would let this author change,
   rendered read-only, is a finding. Name the mechanism the field edits by elsewhere and ask why
   this surface does not use it. The three principled exceptions (a label, a global edit, a
   social act) are named in the doc block.
3. **Derived values link home.** Microcopy that says where to go instead of going there is a
   finding.
4. **One editor per field.** A second editor of a field by a different mechanism is a finding
   unless it is a shortcut opening the same component.
5. **Collection verbs at the home.** A list without its create, reorder or bulk verbs is a
   finding, or the doc block says why the verb is elsewhere.
6. **Gated by policy, not by surface.** Every control's presence comes from `offers`; a disabled
   control says why.
7. **Report the row's delta**, and nothing about the arrangements §3 names as purposeful unless
   the thread changed one.
