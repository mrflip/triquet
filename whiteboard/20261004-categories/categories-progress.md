# Categories: progress

The running handoff for the categories sprint. Newer than `categories-plan.md` wherever the two
disagree. Workers add their sections below, newest first.

## Status

| Thread | Name | Status |
|---|---|---|
| 1 | Categories and the category editor | complete, PR #85, review clean |
| 2 | Category personas | complete, PR #87, review clean |
| 3 | The category estimate entry | underway |
| 4 | The category spread chart | pending |

## Thread 2: Category personas (2026-10-04)

Branch `20261004-category_personas`, PR #87, stacked on #85. Suites: typecheck and lint clean;
`pnpm test` 114 files, 2880 tests; `pnpm test:e2e` 213 passed.

* **Built**:
  - `src/models/estimate.ts`: `DifficultyVals` (`easy medium hard`), `DifficultyDefault`
    (`medium`), and `EstimateValidators` (`difficulty`, `estimate`, `estimates`). They are built over
    `CategoryValidators`, so `category` is the category enum or null. `estimate` fills a missing
    difficulty with `medium`. `estimates` takes 1 to 24 estimates, each category once, and allows a
    null category only as the lone estimate. Types: `EstimateT`, `EstimatesT` (and their DNA).
    Statics: `Estimate.fill`, `Estimate.neutral(difficulty?)`.
  - `src/models/persona.ts`: `PersonaLabelVals` (`masie artie poppy`), `PersonaTitles`,
    `PersonaSlots` (0, 8, 16), `PersonaChanceBounds` (the Coach's table by difficulty, as 0..1),
    `Persona.titleOf`, `Persona.slotIdxOf`.
  - `src/lib/personas.ts` (`import * as Personas`). All pure, and all take the **total order**:
    - `chanceOf(personalabel, order, estimate)`
    - `chanceOfAll(personalabel, order, estimates)`: independent, 1 − Π(1 − pᵢ); an empty list
      gives 0.
    - `chancesOf(order, estimates)` → `{ masie, artie, poppy, average }` (`PersonaChancesT`).
      **Thread 3 should call this once per question**: it returns every column part except
      `estimates`.
    - `averageChanceOf(order, estimates)`
    - `strongestOf` / `weakestOf(personalabel, order)`: the three categories around the persona's
      slot and around the slot opposite, counter-clockwise first.
  - `src/components/PersonaCard.tsx`: `PersonaCard` (an MUI `Card`, `role="group"` named for the
    persona, `data-persona`). It shows "Best: <the category in their slot>" and "Worst: <the one
    opposite>". `personaAdornmentsOf(order)` gives `CategoryWheel`'s `outside` list.
    `CategoriesScreen` passes it for smiths and reviewers alike, with a note under the wheel giving
    the table in words.
  - e2e: `categories.spec.ts` has a new test, "sets Masie, Artie and Poppy at the triangle's
    corners…" (it follows a swap into slot 0), and the reviewer test now checks Artie's card.
* **Decisions taken**:
  - The curve is exactly the plan's: `t = clamp((d − 1) / 10, 0, 1)`, null `t = 0.5`. A persona's
    slot is fixed, so dragging Theater into slot 0 makes Masie best at Theater.
  - Duplicate categories in a list are refused, as is a null estimate alongside a real one. The
    stored list is then always either all categories, each once, or `[{ category: null, … }]`.
    That is the shape thread 3's write already makes (blank pills dropped; all blank → one null).
  - The word is **chance** (0..1), not *get rate*: get rate is a reviewer's own 0..100 guess.
  - The persona cards name only the category in the slot and the one opposite. The microcopy
    covers "or either side of it". At 560px the cards' text is 8px; anything more would not fit.
* **Deviations**:
  - `CategoryWheel` now renders `outside` adornments beside the tiles' `list`/`group` box rather
    than inside it, so the read-only `role="list"` owns only listitems. Nothing else in thread 1's
    behaviour changed, and its e2e specs pass untouched.
  - The vocabulary's *ident* entry said "a persona in the app"; it now says "who someone is in the
    app", so *persona* means one thing. The code's own doc comments on ident (`src/models/ident.ts`,
    `convex/schema.ts`) still say "a persona in the app". I left them alone to keep this thread out
    of the ident model.
* **Discoveries**:
  - **For thread 3**:
    - Widen `WidgetedValidators.enteredValue` and `EntryValueFor` with
      `EstimateValidators.estimates`. The list is plain JSON, well under `WidgetedJson`'s bound.
    - Since duplicates are refused, the pill's category select should leave out categories other
      pills hold, or the write will fail validation.
    - `Estimate.neutral(difficulty)` is the all-blank value's one element.

*Review:* clean at medium; no fixes. Left, minor and unconfirmed in a browser: at slots 8 and 16
the persona card (17cqi wide, centred 45.5 out) may cover the outer corner of that slot's tile by
about 1.8 x 1.4cqi, more if a title wraps, so that corner can't be grabbed for a drag. A layout
call (move the card, or `pointerEvents: 'none'` on the adornment wrapper); for the Coach.

## Thread 1: Categories and the category editor (2026-10-04)

Branch `20261004-category_wheel`, PR #85, carrying `chore: redact notes` (the Coach's
`20261004-redact`) and the sprint's plan commit beneath it. Suites: typecheck and lint clean; `pnpm test` 111 files, 2818 tests; `pnpm test:e2e` 212 passed (a first full run lost 4 specs to the local backend timing out under load; they passed alone and on a second full run).

* **Built**:
  - `src/models/category.ts`: the 24 categories (`CategoryLabelVals`, `CategoryTitles`), the
    `Category` statics (`titleOf`, `defaultIdxOf`) and `CategoryValidators` (`categoryLabel`, an
    enum; `wheel`, 24 slots of label-or-null, no category twice). `WheelT` is the stored shape.
  - `src/lib/wheel.ts` (`import * as Wheel`): `defaultWheel`, `poolOf`, `orderOf` (the total
    order), `placed` (a move: swap; from the pool the occupant goes to the pool; into the pool the
    slot empties), `stepped`, `firstEmptyIdxOf`, `ringDistance` (0..12), `around(idx, reach)` (slot
    indices, counter-clockwise first) and `neighboursOf(order, label, reach)` (labels). **Thread 2
    wants `ringDistance(personaSlot, order.indexOf(label))`; thread 4 wants `neighboursOf(order,
    label, 2)`** -- both take the total order, never the holed wheel.
  - The hunt row's optional `wheel` (`src/models/hunt.ts`); the account action
    `arrange_categories { hunt_id, wheel }` (`src/models/actions.ts`, carried out by
    `arrangeCategories` in `convex/writing/hunt_actions.ts`, authorized as a smith of the hunt by
    `mayActOnAccount`'s existing `hunt_id` rule).
  - **Where the total order is read**: `ShallowHuntT.wheel` (`src/lib/rows.ts`, `shallowHuntOf`),
    filled with the default wheel for a hunt that has none. So on the quiz screen it is
    `useHunt(...).hunt.wheel`, already handed to `Workbench`, `Panels` and the editors as `hunt`;
    the total order is `Wheel.orderOf(hunt.wheel)`. No new watch.
  - The route `/c/<hunt>/categories` (`Routes.categoriesPath`; page under
    `src/app/(synced)/c/[hunt]/categories/`), `src/components/CategoriesRoute.tsx` (ident gate,
    not-on-hunt, no-such-hunt, then the screen) and its screen hook `src/state/use-categories.ts`
    (watches `hunts.open`, arranges with an optimistic update, `showArranged`). Linked from each
    hunt on the hunts list ("Categories") and the quiz gear's Hunt section.
  - `src/components/CategoryWheel.tsx`: the wheel, read-only (total order, `role="list"`) or an
    editor (`onArrange`): holed wheel, empty slots showing the category the total order puts
    there, the pool beneath, dashed triangles 0/8/16 and 4/12/20 and rim marks at 6/18. Geometry
    is pure, in `src/components/wheel-geometry.ts` (`WheelGeometry`, `spotOf`, `poolSpotOf`,
    `poolHeightOf`). **Thread 2's persona boxes go in the `outside` prop**:
    `[{ slotIdx: 0, node: <Card/> }, ...]`, centred `WheelGeometry.outsideRadius` (45.5 of 100)
    from the middle; there is about 11 hundredths of room past the tiles. Every length is in
    hundredths of the wheel's width (`cqi` against the wheel's own box).
  - Drag and drop: `usePiece` and `usePlace` in `src/components/use-reorder.ts`, a board of
    places beside `useReorderable`'s list. Keys: arrows move a focused tile round the ring
    (swapping), Delete/Backspace send it to the pool, Enter/Space bring a pool tile to the first
    empty slot; focus follows the tile.
* **Decisions taken**:
  - The wheel is changed by an account action (`idents.performAccount`), like `retitle_hunt`, not
    by `hunts.perform`: the categories page has no quiz open, and `hunts.perform` needs one.
  - The field is optional for good (`Absentable` in `tests/convex/schema.test.ts`, said in
    `notes/deploy.md`), not widened-then-tightened: absence means the default wheel, so no
    production migration. In HUMAN-whatsup for the Coach.
  - Category labels: `math_econ gen_sci chem_bio geography euro_hist us_hist world_hist language
    art classical_music classic_lit classic_film theater recent_lit recent_film tv pop_music sports
    games food_drink lifestyle current_events biz_tech physics_eng`; titles are the spike's.
  - Reviewers see the wheel read-only on the same route; strangers get `NotOnHunt` (its `labels`
    prop is now nullable, for an address naming no quiz).
  - Below 560px the wheel scrolls sideways inside its box rather than shrinking past legibility.
  - The spike's 6-18 line is drawn as it looks in the spike: short marks at the rim, not a full
    diameter.
* **Deviations**: the drag-and-drop decision note the plan names lives in `aside/` now (moved by
  `af677fb`), which agents may not read; the board's decision is a new note,
  `notes/decisions/2026-10-drag-and-drop-boards.md`, and the stack line points at both.
* **Discoveries**:
  - The wheel is not in the Export box: `HuntT` (what Export emits) carries no wheel, and there is
    no hunt import to bring one back. Left so; see *For the Coach*.
  - `getByRole('region', { name: 'Pool' })` does not contain the pool's tiles: every tile is a
    sibling on one stage, keyed by its category, so it is one element wherever it moves (and a key
    move puts focus back on it). Find a pool tile by its name, "<Title>, in the pool"; a wheel tile's is "<Title>, slot N"; an empty slot is
    `[data-empty][data-place="N"]`. Read-only tiles are listitems named "N. <Title>".
  - "slot" was a retiring word (a bot's textkind pair); the vocabulary now says it means a wheel
    slot.
* **For the Coach**: whether the wheel belongs in the hunt's export; whether an optional-forever
  field is acceptable (HUMAN-whatsup).

*Review:* clean at medium; no fixes, no findings. For the record: a stored wheel is exactly 24
slots over the category enum, so adding a category later needs a migration (and, until then,
`updateHunt`'s whole-row validation would refuse a retitle of a hunt with a stored wheel).
