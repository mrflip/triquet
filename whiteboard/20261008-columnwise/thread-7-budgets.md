# Thread 7: the column's budget, and the clock it reads (2026-10-08)

Read this before touching `Liquidry`'s limits, `LiquidizeFormulary.columnMs`, or any timebox that
runs on the server (`Formulas.evaluate` among them).

## The ruling

Thread 7's review measured an output-free nested loop over 300 questions at about 1 s a fill, 5
minutes a run, in every smith's browser and inside `sortQuestions`. The Coach: "Also budget the
column." So:

* `Liquidry` says what stopped a render (`RenderFailkind`): `syntax` (it does not read), `runtime`,
  or `limit` (its time, our counted budgets, Liquid's allocation limit).
* `LiquidizeFormulary.run` stops its column (`stops: true`) on a `limit`; every later question reads
  the same failure, as a `jsonata` timeout does. A template that will not read costs its own cell.
* The column has one budget for all its fills: `LiquidizeFormulary.columnMs`, **250 ms**. The runner
  gives each live column a deadline (`columnMs` from now; `jsonata` has none), and each fill's own
  deadline is the sooner of `Liquidry.RenderMs` (1000 ms) and what the column has left.

## Why 250 ms

* A 300-question column of ordinary templates fills in well inside it: each fill takes a fraction of
  a millisecond. On a deterministic test clock (a hundredth of a millisecond a read), a 100-turn
  empty loop per question stops its column at question 120.
* It bounds what one column can hang a page for, per run, at a quarter second.
* It is a quarter of the second Convex gives a mutation, and `sortQuestions` runs the whole quiz,
  every column, inside one.

## The clock, probed

A throwaway internal mutation on lane 3's local backend (removed after), 2026-10-08:

| what | inside a Convex mutation |
|---|---|
| `typeof global` | `undefined` |
| `typeof performance` | `object` |
| `performance.now()` across a 50 ms busy loop, then a render | moved 173 ms |
| `Date.now()` across the same | moved 0 |
| LiquidJS `renderLimit: 30` on a 400 by 400 empty loop | no error; took 122 ms |

LiquidJS reads `global.performance`, then `window.performance`, then falls back to `Date.now()`.
In Convex it finds neither, so its time limit reads a clock that stands still: it never fired on the
server. `Liquidry` now takes over the render limit LiquidJS asks at every piece of a template and
every turn of a loop (`clocked`), reading `clockNow()`, which is `performance.now()`.

`Formulas.evaluate` (JSONata) times itself with `Date.now()` too: on the server a long formula is
stopped only by its depth guard. In `whiteboard/TODO.md`, not fixed here.
