# Queries, hooks and subscriptions

How the browser reads from Convex, and where to draw the lines. Read this before adding a
query function under `convex/`, a hook under `src/state/`, or a `useQuery` anywhere.

## The words

The word *query* is ambiguous here: Convex's `useQuery` subscribes, and its `client.query` does
not. These are the terms this project uses in documents and plans, so a sentence can say which
it means.

* **query function** -- server code: a function under `convex/` that reads rows and returns
  what a screen shows (`quizzes.open`, `hunts.list`). A query function knows nothing about
  whether it is being watched or fetched.
* **watch** -- calling a query function and staying subscribed: the result arrives, and arrives
  again whenever it changes. `useQuery`, `useQueries` and `watchQuery` all make watches. Nearly
  every read the app makes is a watch.
* **fetch** -- calling a query function once and keeping the answer: `client.query`. For a
  large read the author asks for by hand (the Export box), or for a first paint.
* **facet** -- the unit a watch covers: a set of rows that change together and are shown
  together. A quiz's frame (its own fields, widgetings and columns) is a facet; one question with
  what its widgetings stored is a facet; a quiz's reviews are a facet; the library of widgets is
  a facet. Facets are what a query function is written for.
* **screen hook** -- the one hook that owns a screen's watches and hands the rest of the screen
  what it needs as props: `useHunt` for a quiz's screen, `useHuntsList` for the hunts page,
  `useIdent` for who the browser is. A screen hook may be built from smaller hooks (`useHunt`
  uses `useQuiz`), but the components below it never watch anything themselves.

## The shape of the app

* The screen hook watches a few facets and stitches them together. A quiz's screen is one watch
  on the hunt (which quizzes exist, and who is on it), one on the library (`widgets.library`),
  one on the quiz's frame, one per question the frame lists, and one on the reviews. `useQuiz`
  assembles frame and questions into the quiz the rest of the tool reads.
* A change is one mutation, `hunts.perform`, which reads the truth inside its transaction and
  writes the rows it comes to. The server reruns every watched query function whose reads were
  touched and sends the ones whose result changed. Nothing in the browser guesses what a
  change affected.
* Components take props. A cell, a row, a dialog or a panel is handed what it shows and a
  dispatcher to say what the author did.

## Where to draw the lines

**One watch per facet.** Draw the facet by what changes together and what is shown together,
not by which component shows it. Convex resends a watched result whole whenever anything the
query function read has changed, so the cost of a watch is its result's size times how often its
reads change. Two tests:

* Split a facet when a large result has a small part that changes often. A quiz's questions
  are the example: one author edits one question at a time, so each question is its own facet
  and an edit sends one question, not the quiz.
* Merge facets whose rows always change together, or are always shown together. The frame is
  the example: a quiz's fields, its widgetings and its columns are edited from one dialog and
  drawn as one grid, so they travel as one.

A facet that mixes churn rates is the thing to watch for: a query function that reads something
slow-moving *and* something fast-moving reruns at the fast rate and resends the slow part every
time. When a count or a summary is only shown in one dialog, give it a facet of its own and
watch it from that dialog. The widget editor's usage line is the example: `widgets.usage` counts
widgetings across every hunt, and `useWidgetUsage` watches it only while that editor is open.

**The server assembles.** A query function returns a screen shape, projected from rows in
`lib/rows.ts`, never rows for the browser to join. The browser may stitch sibling facets whose
union is the screen (the frame and its questions), but it never looks a row up across tables
itself, and it never validates what it reads back.

**One screen hook; components never watch.** A screen's watches live in one hook so they are
opened, counted and closed in one place, and so a screen has one loading state rather than a
dozen. A dynamic set of watches (one per question) is made with `useQueries` inside that hook,
not with a `useQuery` in each row. This is the rule that keeps a grid predictable. The one
exception is the one above: a facet that only one dialog shows is watched by that dialog, through
a hook of its own under `src/state/`, for as long as it is open.

**"Per row" is fine, in its place.** A watch per question is right because a question is the
unit an author changes, the count is bounded (a quiz holds at most 999), and the ids come from
the frame's watch. It would be wrong for an unbounded set (paginate instead), or for something
the screen wants worked out *across* rows, which belongs in the query function or the mutation.

**Fetch what is large and asked for.** The whole hunt is the largest thing the app reads, and
only the Export box wants it: a fetch when the author presses the button, never a watch. If a
screen's first paint is slow because its facets arrive one after another (the frame, then the
questions it lists), a fetch of the whole thing can stand in until the watches have delivered;
that is an overlay in the screen hook, and the wide query function is never watched as well.

**Measure before moving a line.** The cost that binds is database I/O per change and bytes per
browser per change, both of which the phase 4 harness reports (`whiteboard/convex_yay-progress.md`,
*Measurements*). A boundary moved without a before-and-after number is a guess.

## Small rules that follow

* A query function takes ids or labels, and refuses nothing a screen might reasonably ask: a
  watch that throws takes the page down with it (`useQuery` throws into React). Keep an
  argument a query function would refuse from reaching it (see `useHunt`'s `askable`).
* A query function about a hunt also takes the browser's affirms (`useAffirms`: its ident, the
  hunt, its standing, and the quiz where there is one), built from facets the screen already
  holds, so no watch waits on another only to learn what to affirm. The server checks them
  (`convex/authorize.ts`), and a query answers a denial, stale affirms included, with its empty
  value (`emptyIfDenied`), never a throw. A watch's affirms are kept the same object while
  nothing in them changes, so the watch keeps its subscription.
* Every read in a query function goes through an index and is bounded by the caps in
  `lib/vv/patterns.ts`.
* Convex deduplicates identical watches in the browser: two hooks watching the same query
  function with the same arguments share one subscription. A second consumer of a facet costs
  nothing extra.
* There is no entity cache. Two facets that both carry a quiz row each hold their own copy, and
  an optimistic update patches each affected facet by hand. Keep the number of facet shapes
  small for that reason.
