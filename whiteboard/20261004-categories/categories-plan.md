# Categories: a wheel of subject categories, personas that answer by it, and a quiz's spread

Sprint plan, 2026-10-04. Mode: **YOLO**. Review level: **medium**. Issued by the Coach (Flip).
**Status: threads 1 (PR #85) and 2 (PR #87) done, reviews clean; thread 3 underway.**

Four threads, stacked in order. `categories-progress.md`, beside this file, is newer than this
plan wherever the two disagree.

## The spike

The Coach's earlier spike, *Wuxing of Trivia*: <https://wuxingll.netlify.app/>, with two
screenshots beside this file. `all_categories_default_order.png` is the default order;
`example_categories.png` is the order
`0,18,4,5,6,7,8,9,10,11,12,13,14,15,16,17,1,20,21,19,22,3,23,2`, with two slots emptied into the
pool. **Read it for behaviour and look, never for code**: nothing is airlifted, and what we build
follows our conventions, library-first.

The 24 categories, by default index (clockwise from the top), with the spike's tile titles:

| # | Title | # | Title | # | Title |
|---|---|---|---|---|---|
| 0 | Math & Econ | 8 | Art | 16 | Pop Music |
| 1 | Gen Sci | 9 | Classical Music | 17 | Sports |
| 2 | Chem & Bio | 10 | Classic Lit | 18 | Games |
| 3 | Geogr | 11 | Classic Film | 19 | Food & Drink |
| 4 | Euro Hist | 12 | Theater | 20 | Lifestyle |
| 5 | US Hist | 13 | Recent Lit | 21 | Curr Events |
| 6 | World Hist | 14 | Recent Film | 22 | Biz & Tech |
| 7 | Lang | 15 | TV | 23 | Physics & Eng |

The spike's dashed lines are two triangles (slots 0/8/16 and 4/12/20) and a 6–18 diameter.
Undo/redo, *Copy Postable Link* and *Save to imgur* are out of scope.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/stack.md`, `notes/testing.md`, `notes/convex.md`,
`notes/views.md`):

* `notes/vocabulary.md` and `STYLE.md`, before naming anything. This sprint adds words
  (category, wheel, slot, pool, persona, estimate, difficulty); thread 1 writes the first of them
  into the vocabulary, and later threads add theirs there.
* `notes/guidelines.md`, before designing an entrypoint or a row validator.
* `notes/queries_hooks_and_subscriptions.md`, before adding a query function, a state hook or a
  `useQuery` (threads 1, 3, 4).
* `notes/deploy.md`, *Schema pushes* (threads 1 and 3 change row shapes).
* `notes/decisions/2026-10-drag-and-drop-boards.md` and `src/components/use-reorder.ts` (thread 1).
  *Orchestrator:* the older `2026-09-drag-and-drop.md` now sits in `aside/`, which agents do not read.
* `notes/decisions/2026-10-widgets.md`, `src/models/{widget,widgeting,widgeted,column}.ts`,
  `src/components/cells/entry.tsx` (thread 3).
* `src/lib/routes.ts` and `src/app/(synced)/h/[hunt]/[realm]/[quiz]/page.tsx`: how an address
  is written and how a client-rendered page reads it (thread 1).

## Ground rules

`notes/git_hygiene.md` (*A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md` govern. Particular to this sprint:

* **The categories are fixed this sprint**: 24, titled as above, in code (a catalogue in
  `src/models`), each with a label of its own (a category is named by label, as everything here
  is, never by its index). What a hunt stores is its *arrangement* of them, nothing else.
* **Additive schema only.** New fields are optional, or widen an enum or a union, so every row
  already written still fits; an absent arrangement means the default order. If a thread finds it
  needs more than that, it stops and says so.
* **Local backends are yours to empty**: `scripts/convex_reset agent` and `e2e-agent`, never `dev`
  or `e2e`, never production.
* **No new server function.** Everything here is client-side maths over rows the browser already
  watches, plus ordinary Convex mutations.
* **Library first.** Drag and drop is Pragmatic, through `use-reorder.ts` (thread 1); charts are
  one new library (thread 4); pills, selects and toggles are MUI's.

## Decisions taken in YOLO

Calls the Coach's text left open, made here so every thread builds to the same answer. Each is a
two-way door; the Coach may overturn any of them.

1. **The arrangement is stored with its holes.** A hunt holds 24 slots, each a category label or
   empty; the pool is whichever categories no slot holds. The **total order** is derived by the
   Coach's rule: walk the slots from the first, and each empty slot takes the lowest-numbered
   (default index) category left in the pool. So the editor reopens as it was left, and
   everything downstream (personas, estimates, the chart) reads only the total order.
2. **Personas sit at slots, not at categories.** Masie at slot 0, Artie at slot 8, Poppy at slot
   16: the triangle's vertices, which hold Math & Econ, Art and Pop Music in the default order.
   Rearranging the wheel changes what each persona knows; that is the point of arranging it.
3. **The persona curve is linear between two plateaus.** With θ the angle between a category's
   slot and the persona's (0° to 180°; one slot is 15°): best within 15° (the slot and either
   side), worst beyond 165° (the opposite slot and either side), linear between. A null category
   counts as θ = 90°, which this curve puts exactly halfway, as the Coach asked.

   | difficulty | best | worst | null (halfway) |
   |---|---|---|---|
   | easy | 90% | 60% | 75% |
   | medium | 75% | 30% | 52.5% |
   | hard | 60% | 0% | 30% |

   A list of estimates combines independently: p(right) = 1 − Π (1 − pᵢ).
4. **A pill holds a category and a difficulty**; a new pill's difficulty is `medium`. Difficulty
   is `easy` / `medium` / `hard`.
5. **Column hooks are column sources with a part**: `<widgeting>.<part>`, widening the column
   source pattern (additive). A category-estimate widgeting offers the parts `estimates` (the
   list), `masie`, `artie`, `poppy` and `average`; its stored widgeted is only the list, and the
   persona parts are worked out on render from the hunt's total order.
6. **The chart library is Recharts**, the most-downloaded React charting library, as the Coach
   asked for "the most popular". (`@mui/x-charts` also has a radar chart; see *For the Coach*.)
7. **The route is `/c/<hunt>/categories`**, exactly as asked, written once in `src/lib/routes.ts`.

## Threads

### Thread 1: categories and the category editor

> look at https://wuxingll.netlify.app/#order=0,18,4,5,6,7,8,9,10,11,12,13,14,15,16,17,1,20,21,19,22,3,23,2
> and the file whiteboard/20261004-categories/*.png. These are a spike I made a while ago to figure out "opposing" categories: a pleasant feature of a trivia question is to have "entry points" from, say, history and TV ("What name will be borne by CVN-80? It is also contemplated for a future vessel with hull number NCC-1701"). You then want to make sure that people deciding if they want to compete can find questions that appeal, and to balance difficulty across subject areas. We'll add (1) a doodad to define and arrange subject categories; (2) an entry field type to capture one or more "subject category and difficulty" estimates; (3) a way to visualize that spectrum
>
> make a route /c/:huntlabel/categories
> I would like to be able arrange categories in a circle by drag/drop. For this sprint, assume the category titles are fixed as you see in the spike. A hunt starts with the default ordering (0 (math) - 23 (Physics & Engineering)). I can drag a category out of the circle into the "pool", for the purposes of the editor -- but at all times, there is a total order on the categories (counting from the first slot, when you hit a blank space assign the lowest-numbered entry in the pool).
>
> Note that we don't want a direct airlift of that code into our codebase: what you add should follow our much stricter code conventions, should be library-first, etc.
>
> The notion of a category list and the category editor should be thread 1

*Gloss.* Likely touches: a new `src/models/category.ts` (the fixed catalogue: label, title,
default index; and the arrangement's validator), a pure facility in `src/lib/` for the
arrangement (the total-order rule, the pool, a move, ring distance and neighbours), an optional
field on the hunt row with its mutation (`convex/hunts.ts`, `writing/hunt_actions.ts`,
`authorize.ts`) and its read in the hunt watch, `src/lib/routes.ts`, a client page under
`src/app/(synced)/c/[hunt]/categories/`, and the editor view. A way there: a link from wherever
the hunt is managed today.

Drag and drop: Pragmatic, and `stack.md` says it is wired up only in `useReorderable`. A wheel
with slots and a pool is not a list reorder; extend `use-reorder.ts` (a sibling hook in that file
is fine), keep every tile answering the keyboard, and update the stack line and the decision
note to say what changed. Dropping on an occupied slot swaps; dropping a pool tile on an occupied
slot sends the occupant to the pool. Edits save as they happen.

*Look-ahead.* Build the wheel's geometry once, as a view that takes the arrangement and lays out
24 slots on a circle, with room outside it (thread 2 puts persona boxes at slots 0, 8 and 16)
and a read-only mode. The total order must be readable on the quiz screen as well as on this
route (threads 3 and 4): put it where the hunt is already watched. Ring distance and neighbours
belong in the facility now; thread 2 needs distance, thread 4 neighbours.

### Thread 2: category personas

> Next, add the notion of a category persona. Outside the circle, at the three equilateral vertices near "math", "art" and "pop music", put text boxes for "Masie", "Artie" and "Poppy". For the category they're next to and either side of, they get 60% of hard, 75% of medium, and 90% of easy questions. For the categories opposite on the circle, they get 0% of hard, 30% of medium and 60% of easy questions. Given a null category, they answer as if it's  90degrees away (halfway between their best and wors). Given a category estimation list `[{category, hard/med/easy}, ...]`, give the result using independent distributions (p(wrong(list)) = p(wrong[0])*...)
>
> that's thread 2.

*Gloss.* Decisions 2, 3 and 4 above settle the maths. Likely touches: `src/models/persona.ts`
(the three, fixed, with their slots) and a pure facility (`Personas` or similar: the chance one
persona answers one estimate, and a list), well tested at the table's corners and the null case;
the estimate's validator (`{ category: label | null, difficulty }`), defined here since thread 3
stores it; the editor view gains the three boxes outside the wheel. "Text boxes": MUI cards
naming the persona, and what they are best and worst at in the current order; the names are
fixed like the category titles.

*Orchestrator, after thread 1:* the boxes go in `CategoryWheel`'s `outside` prop (`[{ slotIdx, node }]`,
centred `WheelGeometry.outsideRadius` from the middle). In thread 1's terms the curve is
`d = Wheel.ringDistance(personaSlot, order.indexOf(label))` (0..12), `t = clamp((d - 1) / 10, 0, 1)`,
`p = best + t * (worst - best)`; null is `t = 0.5`. The order is always `Wheel.orderOf(wheel)`,
never the holed wheel.

*Look-ahead.* Thread 3 calls the list function per question with the hunt's total order, so its
signature takes the order and the list and returns a number in [0, 1]. Keep it pure and cheap: it
runs per cell, per render.

### Thread 3: the category estimate entry

> Let me add a category estimate entry widgeting to a quiz. The box for adding an estimate has pills, each with a pull-down (intially blank) for the category. I can restore a pill to having a blank (null) category, and if there is more than one pill the last entry in the pulldown is "(remove)"; picking that removes the pill. If there is no blank pill in the cell, there's a "+" button in the grid cell to add another category pill. If the only pill for a question is blank, send null (getting the "neutral category" estimate).  Blank pills don't contribute to the category list.
> The output of this type of widget will provide column hooks for the category+difficulty list, the estimates for masie, artie and poppy, and their average.
>
> that's a thread

*Gloss.* A new entry kind (named per the vocabulary; it is the first entry whose value is a
list), so: widen `EntryKindVals` and the widgeted value union (additive), its cell editor in
`cells/` (MUI chips, each with a select holding the categories in total order, blank, and
"(remove)" when there is more than one pill; a difficulty control per pill; the "+" only when no
pill is blank), and decision 5's column sources with a part. The value written: blank pills are
dropped; if every pill is blank, one estimate with a null category (and that pill's difficulty).
The flat bag should carry the worked-out parts too, so a later formula can read
`qn.<label>.masie`.

*Orchestrator, after thread 1:* on the quiz screen the total order is
`Wheel.orderOf(hunt.wheel)`, from the `hunt` that `useHunt` already hands `Workbench`, `Panels`
and the editors. No new watch is needed.

*Orchestrator, after thread 2:* the value's validator is `EstimateValidators.estimates`
(`src/models/estimate.ts`): widen `WidgetedValidators.enteredValue` and `EntryValueFor` with it.
It refuses a category twice and a null beside a real category, so each pill's select leaves out
categories other pills hold; the all-blank value is `[Estimate.neutral(difficulty)]`. The four
persona parts come from one `Personas.chancesOf(order, estimates)` per question.

*Look-ahead.* Thread 4 reads every question's estimates for the quiz; expose a pure way to get
them (the stored list, nulls included) that does not go through a column.

### Thread 4: the category spread chart

> add the most popular library for simple data visualizations. In a panel below the grid, show the category wheel, with a radar chart of the number of questions. in a different line color, show a "smoothed" radar chart -- each question's weight is distributed {9, 16, 50, 16, 9} to that category and its four neighbors. A question with N categories assigned assigns 1/N to each of those.
> Let me click to make the radar plot expand full-width (in the page, not as a modal)
> thread

*Gloss.* Decision 6: Recharts, listed in `stack.md` on install. A new panel in `panels/`, one
radar with two series over the 24 categories in total order: the raw count (each question's
weight 1, split 1/N across its N non-null categories) and the smoothed one (each share spread
9/16/50/16/9 percent across the category and two neighbours each side, round the ring). The
weighting is a pure, tested function. Questions whose only estimate is null count in neither
series; say how many there are under the chart. If a quiz works more than one category-estimate
widgeting, read the first in run order. "The category wheel" can be the chart's own angle axis,
drawn with the wheel's tiles as its ticks, clockwise from the top: simpler than aligning two
drawings. Click toggles between its resting size and the panel's full width, in the page.
*Orchestrator, after thread 1:* neighbours are `Wheel.neighboursOf(order, label, 2)`; the order is
`Wheel.orderOf(hunt.wheel)`.

## For the Coach

* **`@mui/x-charts` vs Recharts.** CLAUDE.md's library-first order puts MUI first, and MUI X
  Charts has a radar chart that would take the theme natively. You asked for the most popular;
  that is Recharts, and decision 6 follows you. Say the word and thread 4 uses MUI's instead.
* The spike's screenshots were in `whiteboard/29261004-categories/` (a typo'd year, and
  untracked); they now live beside this plan, committed.
