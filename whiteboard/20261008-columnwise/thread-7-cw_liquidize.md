# Thread 7: The `liquidize` formulary (2026-10-08)

Branch `20261008-cw_liquidize`, PR filed at landing; see the report. Suites: `pnpm justify` green
(5385 unit tests); the two new e2e tests in `e2e/widgets.spec.ts` green on lane 3. Additive to the
schema (`widgets.formulary` gains `liquidize`, its config `{}`): no chain, no backfill.

* **Built**:
  - `src/models/widget.ts`: `liquidize` in `FormularykindVals`; `LiquidizeDefaultInput` (`$`);
    `liquidizeConfig` (none), the widget arm (its `formula` a Liquid template, at most 3600), the
    row arm, `Widget.exported`; `liquidizeParams` (`template`, or `template_from: { ref, formula }`,
    never both), `LiquidizeWidgetT`, `LiquidizeParamsT`.
  - `src/models/column.ts`: `ColumnValidators.ref`, a ref in the plain grammar alone (what
    `template_from.ref` is held to; 3c's tightened `source` is the same check).
  - `src/models/widgeting.ts`: `EntryParamnames` became **`FormularyParamnames`**, adding
    `template` and `template_from` (reserved words, `engines`) to the params allowlist;
    `Widgeting.runsAt` lets a `liquidize` run at `quiz`.
  - `src/lib/formulary/liquidize.ts`, `LiquidizeFormulary`: `paramsOf()` (the params validator, with
    Liquid's and JSONata's sentences on `template` and `template_from.formula`), `check`, `input`
    (the bag itself for `$`, else `Formulas.plainJson`; an object or nothing), `ownOf(widgeting)`,
    `templateOf`, `run`, `advice`. Registered in `Formularies`; the runner needed no arm of its own,
    since it runs every `live` formulary alike.
  - `src/lib/templating.ts`: `fill` takes any plain object as its bag (the one fill, shared by the
    nomination and `liquidize`); `liquidize` joins `ComputedFormularies`, so its values reach a
    template with their images linked.
  - Views: `LiquidizeFields.tsx` (the widget editor: template, input formula, preview over a real
    question, the advice button); `LiquidizeParamsFields.tsx` (the widgeting dialog: *Its template*,
    its widget's, its own, or *Read from* a ref with a formula); the Widgets panel's
    `TemplateInForce`; `FormularyWords.liquidize` (*Templates*); `templateFromGist`;
    `NewColumnWidthPx.liquidize` 220; `widget-edit.ts`'s `LiquidizeDraft`; `rows.ts`'s `widgetFrom`.
  - **`TemplateField.tsx` and `FormulaField.tsx`, copied from thread 3b's branch** (its `9cb83ae`),
    with their tests: `TemplateField` byte for byte; `FormulaField` with `FormulaPreset` declared in
    the file rather than imported from 3b's `src/lib/column-menu.ts`, which is not on this base.
  - Seed `blurb` (title *Template*), twenty-three seeds now.
  - Tests: `tests/lib/formulary/liquidize.test.ts`, `tests/components/LiquidizeParamsFields.test.ts`,
    and cases beside the widget, widgeting, column, seeds, templating, rows, widget-edit, formularies
    and layout-actions (Convex) tests. E2E: a template written in the library and previewed; a
    widgeting's own template and one read from `notes`, filled in on the grid and kept over a reload.

* **Decisions taken**:
  1. **`template_from` reads as a column's ref and formula do**: an absent formula is identity (a
     field itself, a widgeting's `value`), not `$`; a `missing` or `errored` widgeting passes by, so
     a bot not yet asked makes the cell `missing`, and a failed ask makes it `errored`, naming the
     source. The record's §3 said "`$` by default", which for a widgeting reads the whole widgeted
     and would make `{ ref: 'shout' }` an error; §3 is amended. The Coach may overrule.
  2. **The ref is resolved against the bag the widgeting sees**, in its own module (`pickedOf`),
     not through `Columns.resolve`, which reads the finished run: `quiz.<label>`, then `butnot`,
     then what the question holds, then the bag's words. A widgeting after it, or gone, is `missing`.
  3. **The input is the formula bag**, as a `jsonata` widget's; an input formula must come to an
     object, as an `aibot`'s. `$` hands the bag on untouched (JSONata returns the very object), so
     no JSON round trip per question; anything else goes through `Formulas.plainJson`.
  4. **The nomination is not rebuilt as a `liquidize`.** Both fill through `Templating.fill`; their
     policies differ (a nominated text that will not fill stays as typed; a `liquidize` that will not
     is `errored`), so one function each around the one fill.
  5. A template that will not read is `errored` with `The template: ` and Liquid's sentence; it never
     stops the column (a template read from the bag differs per question).
  6. The widget's template is not checked as Liquid on the server, as a `jsonata` widget's formula is
     not: the widget editor names it as it is typed, and a cell says it once run. A widgeting's
     params are checked where written, server and planner, by `paramsOf`.
  7. Picking another place for a template to come from, in the widgeting dialog, lets go of what
     the last one said.

* **Deviations**: none from the plan. The params editor for a `liquidize` widgeting sits in the
  widgeting dialog beside thread 2's `EntryParams` (thread 4 asked for no new work there; without
  it the params cannot be set). 5a lifts it into the folded line, as it does `EntryParamsFields`.

* **Discoveries**:
  - The server runs the quiz when it sorts (`sortQuestions`), so a `liquidize` (and a template read
    from a bot's reply) runs in a Convex mutation too. Recorded in `notes/security.md`.
  - Nothing checks a widget's formula at its entrypoint for any formulary (`check` is unused).

* **For catch-up with 3b** (the orchestrator's look-ahead): count `liquidize` in 3b's
  `Templating.computes` (here it is in `ComputedFormularies`, which `computes` reads: keep it there);
  add the `liquidize` default (markdown) to `readoutOf`; take 3b's `TemplateField.tsx`,
  `FormulaField.tsx` and their tests whole (`FormulaPreset` back to `column-menu`); and consider 3b's
  `ColumnRefField` and `ColumnMenu.refChoicesOf` for the *Read from* select in
  `LiquidizeParamsFields.tsx`, in place of `templateRefsOf`.

* **For the Coach**:
  - After the deploy, `seeding:seedWidgets`, for `blurb`.
  - Decision 1 (absent formula is identity) is the one to read; it amends the record's §3.
  - `whiteboard/TODO.md`, *From columnwise sprint, thread 7*: the recap as a quiz-tier `liquidize`,
    and what must be settled first.
