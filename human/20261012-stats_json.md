# 2026-10-12: /stats as JSON -- a box, a Copy button, and /stats.json

Stacked on [#239](https://github.com/mrflip/triquet/pull/239).

**What I did**

* The stats page ends in the standard `ReadonlyBox` (dense, resizable, with its Copy button) holding
  everything on the page as compact JSON, and a *Copy stats* button sits beside the heading.
* `src/lib/stats-report.ts` makes the report in two parts: `buildReport` (the build stamp and
  Next's version) and `pageReport`, which adds what this browser runs, its connection and the
  backfills (`null` until the deployment answers, and for a browser that may not see them).
* `/stats.json` (`src/app/stats.json/route.ts`) serves `buildReport` and nothing else.

**Open questions**

* `/stats.json` has only the build's part, not the browser's or the backfills. The route is
  `force-static`, so it is a file written at build and adds no server function; the backfills are
  live, from the database, and serving them from a route would be a second server function, which
  `notes/decisions/20260928-database-decisions.md` (*Client-first*) leaves to a Coach. If you want
  them there, the choices are a Vercel function that reads Convex, or a Convex HTTP action (which
  lives on Convex's own address, not `/stats.json`).
