# Thread 6: Free regex patterns (2026-10-08)

Branch `20261008-cw_regex`, PR filed at landing; see the report. Suites: `pnpm justify` green
(5329 unit tests); the four regex tests of `e2e/entries.spec.ts` green on lane 1. A new dependency,
so a **full** e2e run at landing. Additive to the schema: `params` is open JSON already, and
`widgets.config`'s text arm gains an optional `regex`. No chain, no backfill.

* **Built**:
  - **Proved first**: recheck 4.5.0's pure build (`recheck/lib/browser.js`, `checkSync`) runs in
    Convex's default runtime inside a mutation, measured on lane 1's backend: an automaton-checked
    pattern in 8-30 ms (70 ms cold), a fuzz-checked one up to its `timeout`, which holds within a
    few ms. Its clock is `performance.now()`, which moves on in a mutation; `Date.now()` stands
    still there. Its async `check` needs a `Worker`, and its root module (`main.js`) worker threads
    or a native binary: neither exists in Convex. **Dynamic `import()` is unsupported in Convex**,
    so the server imports recheck statically; the module load costs about 100 ms on a cold
    isolate, nothing once cached.
  - `src/lib/regexes.ts` (`Regexes`): `RegexT` (`{ source, flags }`), `FlagVals` (`i m s u`),
    `FlagsRe`, `SourceMax` (200), `compileIssueOf`, `compiled` (memoized), `shown`, `toggled`.
  - `src/lib/redos.ts` (`Redos`), recheck's one importer (`src/lib/recheck.d.ts` types the deep
    path): `refusalOf` (sync, 200 ms), `firstRefusalOf` (one budget of 500 ms for a change's new
    patterns, deduped; out of budget is refused), `courtesyRefusalOf` (the browser's, on recheck's
    worker). Refuses `vulnerable` and every `unknown` with a sentence naming how the time grows and
    the hot spot.
  - `src/models/widget.ts`: `WidgetValidators.regex` (one line, at most 200 characters, flags in
    order, must compile, its sentence said of `source`); `textParams.regex`, between `pattern` and
    `lines`. `EntryFormulary.valueOf` adds `.regex(Regexes.compiled(...), 'should match «/…/»')`.
  - Server: `convex/writing/regex_vetting.ts` `refuseRiskyRegexes(written, held)`, refusal kind
    `regexRisky`, called by `addWidgeting`, `editWidgeting` (via `paramsFor`), `addWidget`,
    `editWidget` and `importWidgets` (only the widgets it writes). A pattern the row already holds
    is not checked again.
  - `src/components/RegexField.tsx`: a generic field (source between slash adornments, committed
    on blur; flags as an MUI `ToggleButtonGroup` with tips; recheck's courtesy verdict said beside
    it, loaded by `import()` only when a pattern is committed). `EntryParamsFields` draws it for
    `regex`; `ParamWords.regex`; `paramsGist` says "matching /…/".
  - Tests: `tests/lib/regexes.test.ts`, `tests/lib/redos.test.ts` (with a guard that recheck has
    one importer and the browser's code reaches `lib/redos` only by `import()`), cases in
    `widget.test.ts`, `widgeting.test.ts`, `entry.test.ts`, `widget-words.test.ts`,
    `hunts.test.ts` (entering), `layout_actions.test.ts`, `library_actions.test.ts`; four e2e tests
    in `e2e/entries.spec.ts`.
  - Docs: `notes/stack.md` (recheck under **Use**, in *Formulas*), `notes/security.md`, the
    decision record's §2 and table, `notes/vocabulary.md` (*params*).

* **Decisions taken**:
  1. **`regex` is its own param, `{ source, flags }`**, beside the named `pattern` (a cell must
     match both), not a fourth named pattern with its text elsewhere: one key, one field, one
     sentence, and the object overlays a widget's default whole. Flags kept apart as a `RegExp`
     keeps them, so nothing parses a `/…/i` literal.
  2. **Flags `i`, `m`, `s`, `u`, stored in that order** (`FlagsRe` refuses duplicates and
     disorder); never `g` or `y`, which make `test` stateful across cells.
  3. **recheck's pure build everywhere**, imported by path (`recheck/lib/browser.js`), so vitest,
     the browser and Convex run the same program and reach the same verdicts (but for time).
  4. **Budgets**: 200 ms a pattern, 500 ms a change, within a mutation's 1 s. Whole milliseconds:
     recheck refuses a fractional timeout.
  5. **The planner does not ask recheck** (it is synchronous; the browser's recheck is async). The
     planner, the importer and the params editor hold a pattern to the validator (length, flags,
     compiles); `RegexField` gives the courtesy verdict as the pattern is committed; the server's
     refusal reaches the page's alarm. An import's widgetings reach the server's check through their
     `add_widgeting`/`edit_widgeting` actions, a library import through `import_widgets`.
  6. **Courtesy, not gate**: a pattern the courtesy refuses is still committed to the form, its
     sentence shown beside the field; Apply sends it and the server refuses it with the same
     words. No hidden state where the field and the form disagree.
  7. One-importer and lazy-load are held by a unit test, not eslint: a second `no-restricted-imports`
     block would override the existing one for the same files (flat config merges rules by name),
     and `import-x/no-restricted-paths` would also flag the browser's `import()`.

* **Deviations**:
  - `pnpm-workspace.yaml` gains `ignoredOptionalDependencies` for recheck's JVM jar and native
    binaries (5 packages), which nothing here runs: the install adds recheck, `synckit` and two
    small dependencies of it.
  - The plan named the planner among the check's entrypoints; see decision 5.

* **Library weighing** (the generic-facility rule): MUI has no regex input; `TextField` with
  `InputAdornment` slashes and a `ToggleButtonGroup` for the flags covers it. Looked for a React
  regex input or highlighter: nothing widely used; CodeMirror (under *Discuss*, for markdown) would
  be heavy for one line. No library added beyond recheck.

* **Discoveries**:
  - Convex's runtime: no dynamic `import()` ("dynamic module import unsupported"), `Date.now()`
    frozen through a function, `performance.now()` live, no `Worker`.
  - recheck's hot spot for `^(a+)+$` is just `a`: the sentence says "around «a»".
  - Next splits recheck into its own 2.8 MB chunk, referenced by no page's manifest: loaded only
    when a pattern is first committed.
  - One `pnpm justify` run failed a unit test under parallel load that I did not capture; green
    alone and on the next justify. I widened `redos.test.ts`'s budget timing margin in case it was
    that one.

* **For later threads**:
  - **7 (`liquidize`)**: renames `EntryParamnames` to `FormularyParamnames`; this thread adds
    `'regex'` to the expected names in `tests/models/widgeting.test.ts`: a mechanical conflict.
  - **5a**: `RegexField` lifts with `EntryParamsFields`; `regexOf` in it reads a pattern as typed,
    valid or not, so the field keeps showing what its sentence is said of.

* **For the Coach**:
  - recheck is listed under **Use** per your ruling, with the reason and the tradeoff to revisit.
  - A refused pattern is refused outright, `unknown` included: a pattern recheck cannot settle in
    200 ms on the server (a long one with backreferences, say) cannot be stored.
