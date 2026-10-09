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
  a facet. Facets are what a query function is written for. A facet's shape may depend on who
  reads it: a reviewer's question carries what a review needs (`Question.sentTo`), and the
  browser reads a field it was not sent as blank.
* **screen hook** -- the one hook that owns a screen's watches and hands the rest of the screen
  what it needs as props: `useHunt` for a quiz's screen, `useHuntsList` for the hunts page,
  `useIdent` for who the browser is. A screen hook may be built from smaller hooks (`useHunt`
  uses `useQuiz`), but the components below it never watch anything themselves.

## The shape of the app

* The screen hook watches a few facets and stitches them together. A quiz's screen is one watch
  on the hunt (which quizzes exist, and who is on it), one on the library (`widgets.library`),
  one on the quiz's frame, one per question the frame lists, and one on the reviews. `useQuiz`
  assembles frame and questions into the quiz the rest of the tool reads.
* A change is one mutation, `hunts.perform` (or for the library, which no hunt owns,
  `widgets.perform`), which reads the truth inside its transaction and writes the rows it comes
  to. One browser's changes are carried out in the order they were made, whichever of the two
  each rides. The server reruns every watched query function whose reads were
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
not with a `useQuery` in each row. This is the rule that keeps a grid predictable. One
exception is the one above: a facet that only one dialog shows is watched by that dialog, through
a hook of its own under `src/state/`, for as long as it is open.

The other is the mirror's feed (`useHuntFeed`, `src/state/hunt-feed.ts`): a smith's browser keeps
the hunt's history from every quiz, not only the one on screen, so the feed reads the whole hunt
beside the screen, through the client's `watchQuery` and `query` rather than through React. It
sends what the screen sends, so a watch they share is one subscription: the quiz on screen it reads
through the screen's own frame, questions and reviews. **Every other quiz it fetches, not
watches** (`quizzes.whole`, and its reviews): a watch of a quiz whole would be rerun and resent at
every write to it, a bot's every answer, in every smith's tab. Instead it watches one small facet,
every quiz's **change signal** (`quizzes.signals`), and fetches a quiz again only once its signal
has moved, at most once every minute and a half (`src/state/hunt-fetching.ts`): the history may lag
a change by that much. Those reads begin only once the page has loaded and the browser is idle, so
the screen's own reads come first. One feed serves every screen of a hunt, and is kept a moment
after the last lets go (`KeepMs`), so moving between the hunt's quizzes moves its focus rather than
reading every quiz afresh.

That is the pattern for anything large that changes in bursts and may be read late: **a cheap
signal watched, a fetch when it moves**. The signal is a row of its own, written by a trigger
(`convex/signalling.ts`), never a field of the row it speaks for, since every reader of that row
would rerun each time it moved.

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
browser per change, both of which the phase 4 measurements report
(`notes/decisions/20260928-database-decisions.md`, *Measured*). A boundary moved without a before-and-after number is a guess.

## Small rules that follow

* A query function takes ids or labels, and refuses nothing a screen might reasonably ask: a
  watch that throws takes the page down with it (`useQuery` throws into React). Keep an
  argument a query function would refuse from reaching it (see `useHunt`'s `askable`).
* A query function about a hunt also takes the browser's affirms (`useAffirms`: its ident, the
  hunt, its standing, and the quiz where there is one), built from facets the screen already
  holds, so no watch waits on another only to learn what to affirm. The server checks them
  (`convex/authorize.ts`), and a query answers a denial, stale affirms included, with its empty
  value (`emptyIfDenied`), never a throw. A watch's affirms are kept the same object while
  nothing in them changes, so the watch keeps its subscription. Such a query function is built
  with `zHuntQuery` (`convex/functions.ts`), which does both, and hands its handler a database
  that sees only the affirmed hunt; one that is not is named in `Unscoped` (`convex/authorize.ts`).
* The screen hook also hands its screen the browser's **claims** on the hunt (`useHunt`'s
  `claims`: the actor `idents.current` sends, the hunt, the standing, the quiz on screen's lock),
  which the screen's views decide what to offer from (`Approve`), rather than from a role. They
  are worked out from what the screen already watches, and cost no watch of their own.
* Every read in a query function goes through an index and is bounded by the caps in
  `lib/vv/patterns.ts`.
* Convex deduplicates identical watches in the browser: two hooks watching the same query
  function with the same arguments share one subscription. A second consumer of a facet costs
  nothing extra.
* There is no entity cache. Two facets that both carry a quiz row each hold their own copy, and
  an optimistic update patches each affected facet by hand. Keep the number of facet shapes
  small for that reason. The quiz's are all in `src/state/optimistic-quiz.ts` (`showPerformed`,
  on `hunts.perform`), one per action kind whose wait shows, so they move with the quiz's queries:
  a change to what `quizzes.open` or `questions.open` sends is a change there too.
