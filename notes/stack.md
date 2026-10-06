---
paths:
  - "package.json"
  - "notes/stack.md"
---

# Stack

What we build with, and what we haven't decided yet. A lookup table: the long reasoning behind a
choice lives in `notes/decisions/`, one file per decision, and is pointed to from here.

* **Use** -- settled. Reach for these without asking. They're proven, widely adopted, and cheap to back out of if we're wrong.
* **Discuss** -- stop and raise it with a Coach before building on it. Either it's a **one-way
  door** (the choice propagates into data shapes, user records, or automation we can't casually
  unwind), or it's **infrastructure with a long "why isn't this connecting" tail** where an hour
  of planning saves a day of IAM errors, or which adds running friction to development
* **Hand-rolled on purpose** -- mechanisms a library could own, weighed with a Coach and kept.
* **Later** -- settled in principle, not yet needed. Don't install ahead of the need.

A dependency that appears in none of these is unlisted: propose it in chat before adding it --
unless it is plainly the boring answer: widely used, solving the problem (and then some) without
dragging in machinery, and ideally recommended by the neighbouring library. Then install it, list
it here, and tell the Coach afterwards; don't write our own instead. `react-number-format`,
below, is the worked example.

Everything here is chosen against the same test: **boring** (proven, widely adopted, no weird
use cases waiting for a not-very-weird app), **agent-friendly** (old enough to be in the agent's
training), **ergonomic**, **zero-ops from as few places as reasonable**, and offering a
**disciplined interface**. The full list, as it applies to storage and hosting, is in
`notes/database-decisions.md`.

Version numbers and release status drift. Before pinning anything, check the current release --
don't trust a recalled version number, including one recalled by an agent.

---

## Use

### Application framework

* **Next.js** (App Router) on **Vercel**. **Client-first**: the app runs on static hosting plus
  stateless functions, and the database. Pages prerender at build; user data never renders on a
  server. The ask route is the one named server function.
  See `notes/decisions/2026-09-client-first.md`.
* **Node 24**, the newest LTS Vercel runs, and the same everywhere. `.tool-versions` holds the exact
  version, for asdf and CI (`node-version-file`); `engines.node` in `package.json` holds the major,
  which is all Vercel reads. `@types/node` follows the same major.
* **TypeScript**, as strict as reasonably possible: . See `eslint.config.mjs`.
* **Material UI** for the component layer.
* **`@next/mdx`** (with `@mdx-js/loader`, `@mdx-js/react`, `@types/mdx`) for static content. It is
  written as markdown under `src/content/`, imported as a component, and dressed by
  `src/mdx-components.tsx`. `.md` files are compiled too, so content stays plain markdown.
* **Zod 4** for validation at every module entrypoint, through the `Validator` kit. See
  `notes/guidelines.md`.
  - Zod is **patched** (`patches/zod@4.6.5.patch`): issues carry the refused input by default.
    Deliberate; `notes/guidelines.md` says what follows from it. A Zod bump re-cuts the patch.
* **es-toolkit/compat** for the lodash-shaped utility surface.
  - What compat lacks comes from es-toolkit itself, imported whole as `EST`: `EST.allKeyed`, an
    object of promises to an object of results, is how `convex/authorize.ts` gathers its evidence
    in one round.
* **Convex** (`convex`, pinned exact) is the database, and `convex/` at the repo root the whole
  server side. See `notes/decisions/2026-09-convex.md` for the shape of the data and the rules
  that follow, and `notes/database-decisions.md` for the verdict. Read
  `convex/_generated/ai/guidelines.md` before working in `convex/`, and work from the installed
  source, not recall.
  - **Jazz v2** was the database before it, for most of September 2026; `jazz-tools` is gone, and
    what it taught is in `notes/decisions/2026-09-jazz.md`.
  - **Turso is not coming back**; libSQL and Drizzle went with it (Sept 2026). Drizzle returns
    only through `notes/database-decisions.md`.
* **convex-helpers** (pinned exact), Convex's own companion library. Its `server/zod4` is how a Zod
  schema becomes a Convex validator (`zodOutputToConvexFields`, `zodOutputToConvex`, `zid`) and how a function takes
  Zod arguments (`zCustomQuery`, `zCustomMutation`). Its `server/rowLevelSecurity`
  (`wrapDatabaseReader`, `wrapDatabaseWriter`) wraps the database a hunt's function holds, held to
  the rules in `convex/policy_rules.ts` (see `notes/convex.md`, *Who is asking*). At 0.1.x its
  version number alone would make it *Discuss*; it is *Use* because it is the supported path, and
  what lets one schema drive the others.
* **@convex-dev/migrations** (pinned exact), Convex's own component for backfilling a live
  deployment's rows in batches, resumably, with a dry run: every migration goes through it
  (`convex/migrations.ts`, and `notes/deploy.md` for the order of steps). Added September 2026
  for the first one production needed.
* pnpm
* Material UI's own components for tables, inputs, dialogs and menus; @mui/icons-material for icons
* **Pragmatic drag-and-drop** (`@atlaskit/pragmatic-drag-and-drop`, plus `-hitbox`) for every
  drag, wired up only in `src/components/use-reorder.ts`: `useReorderable` for a list reordered
  by its grips, and `usePiece` and `usePlace` for a board of places that pieces are dragged
  between (the category wheel and its pool). Do **not** take `-react-drop-indicator`. Every grip
  and every piece also answers the keys. See `notes/decisions/2026-09-drag-and-drop.md`, and
  `notes/decisions/2026-10-drag-and-drop-boards.md` for the board.

### Routing

* **Next's App Router owns the address.** A quiz lives at
  `/~<org>/<hunt>/quizzes/<realm>/<quiz>/!edit` (or `!playtest`): the path names the resource and
  its last segment the mode (`notes/decisions/urls.md`). `src/lib/routes.ts` is the one place a
  URL's shape is written, as `src/lib/addresses.ts` names it; a page reads its own address back
  through `Addresses.locationFrom` (`useAddressed`), not from Next's params. The address
  decides which quiz is on screen, and nothing decides the address in return but its moving to
  the form the resource has now (`useCanonical`): never add a second mechanism that writes the
  URL. Navigation is a transition, so wait for the arrival before acting on the quiz moved to.
  See `notes/decisions/2026-09-path-routing.md` and `2026-09-resource-urls.md`, which this
  scheme replaced.

### Small libraries in use

Settled; reach for these before writing the equivalent.

* **unique-names-generator** for fresh labels. (Row ids are Convex's own `_id`; `lib/ids.ts` mints
  a UUID for a question or quiz the tool holds before it is written.)
* **safe-stable-stringify**, behind `UU.jsonify`. Don't import it directly.
* **Papa Parse** for reading or writing TSV/CSV a spreadsheet will open (not installed since the
  hunt_git sprint left nothing using it: the history's tables are `lib/tsv.ts`'s, which escape
  rather than quote, so one line is one row). **fflate** for zipping a download.
* **clsx** for composing class names in the grid.
* **react-number-format** (`NumericFormat`) for every box that takes a number: `NumberField` in
  `components/cells/fields.tsx`, as an MUI `TextField` (`customInput`) or, in the grid's cells,
  the grid's own borderless input. It owns what a number box needs (what may be typed, decimals,
  negatives only where asked for, a ceiling, an emptied box) with no dependencies of its own, and MUI's docs pair
  it with `TextField`. Added Sept 2026 without asking first, on purpose: see the rule above.
* **cross-env** for the agent scripts.
* **tsx** for a shell script that needs app code: plain `node` runs a `.ts` file but cannot follow
  the app's extensionless imports. `scripts/newb` runs `scripts/newb-label.ts` with it to reach
  `Labelmaker.normalize`. Already here under vitest; made direct Sept 2026 without asking first.
* **mdast-util-from-markdown**, the markdown parser under remark (and so already here through
  `@next/mdx`), for reading where markdown puts bold, italics and quote markers: `lib/ll-bbcode.ts`
  writes them as BBCode and spaces by the parsed offsets and leaves every other character as typed. Parse only; it
  renders nothing, so the rich-text questions under Discuss stay open. Added Sept 2026 without
  asking first.
* **mustache** (mustache.js, with `@types/mustache`) for an `aibot` widget's prompt template,
  rendered over what its input formula came to: `{{name}}`, sections and inverted sections, and
  nothing that runs code. HTML escaping is off (the prompt is prose for a model, never a page), and
  a value that is not a string fills in as its JSON. `lib/ask/prompts.ts` is the only file that
  imports it. Proposed by the rewidgeting sprint's plan and added Oct 2026 without asking first,
  under the rule above.
* **react-markdown**, with **remark-breaks** and **rehype-sanitize**, for showing a field's
  markdown: `src/lib/markdown.ts` holds the options and the one allowlist schema (widen it there,
  never at a call site), and `components/cells/markdown.tsx` the views that use them. It renders
  to React elements; never reach for `dangerouslySetInnerHTML` or `rehype-raw`, and HTML typed
  into a field shows as the characters typed. Rendering happens in the browser, as all user data
  does here. **Not `remark-gfm`**: its strikethrough takes a single `~`, and trivia is full of
  `~50 years`. Added Sept 2026 at a Coach's request, settling the display half of the rich-text
  question under Discuss.
* **Recharts** (3.x) for charts: the most-downloaded React charting library, declarative
  components over SVG, peer-compatible with React 19. Its first use is the category spread's radar
  (`components/panels/SpreadPanel.tsx`). Colour a series from the palette's `seriesA` and
  `seriesB` tokens (`src/app/palette.ts`, validated for both modes and for colour-blind readers),
  never a hex at the call site, and keep text in the ink tokens. Every chart gets a table of the
  same numbers beside it. `@mui/x-charts`, which would take the theme natively, was the other
  candidate; the Coach asked for the most popular. Added Oct 2026 by the categories sprint, under
  the rule above.
* **d3-array** (3.x) for the statistics and scales a chart needs that Recharts does not hand
  over: `quantile` and `ticks` set the category spread's radar scale
  (`components/panels/spread-chart.ts`). It was already installed beneath Recharts; it is listed
  directly so the import is ours to rely on. Reach for it before writing a percentile, a nice
  tick step, a bisect or a bin. Added Oct 2026 under the rule above.
* **Fontsource** (`@fontsource/zilla-slab`, `work-sans`, `jetbrains-mono`) for the three
  typefaces, whose woff2 files `src/app/fonts.ts` hands to `next/font/local`. Never
  `next/font/google`: it downloads the fonts at build time, and a bad answer from Google failed
  the CI build now and then (Turbopack's "next/font/google queries have exactly one entry"). MUI's
  own install docs load Roboto the same way. Added Sept 2026 without asking first.

### Formulas

* **JSONata**, pinned to **1.8.9**, the maintained synchronous line (`latest-v1` on npm). 2.x is
  async-only. The design has each widget able to read everything before it in one pass of the
  stack, and the sort action reads formula values too; both want a synchronous answer, and
  an async evaluator would mean cells arriving a tick late. The way to 2.x, if a formula ever
  needs it, is to work every value out on write and cache it, so a render only reads. That
  cache is not written. `lib/formulas.ts` is the only file that imports `jsonata`.
* A formula is **author-written code**. It runs behind a 100 ms and 500-level guard today. Before
  formulas can arrive from someone else (a shared or imported quiz), raise it: see Discuss.

### Quiz history

* **isomorphic-git** over **@isomorphic-git/lightning-fs**, in the browser, one repository per
  hunt (`notes/hunt_git.md`); `lib/huntgit.ts` and `state/hunt-mirror.ts` are the only files that
  touch either.
* **The repository is not a source of truth, and nothing reads app state back from it.** It is
  there because git is the best interface we know for reviewing diffs of text: a past-versions
  view, an export, and a promise to an adopter that their work leaves with them, in a form the
  people who build puzzle hunts already know how to use. Design it as that.

### Authentication

* **Convex Auth** (`@convex-dev/auth`, with the `@auth/core` it asks for, both pinned exact):
  sessions, chosen October 2026 (the `dbpolicy` sprint) over a hosted hub. Client-side only: the
  React provider (`ConvexAuthProvider`) keeps a session's tokens in the browser's storage; no
  Next.js middleware, no server function. Only the **Anonymous** provider for now: a browser is
  signed in silently on its first visit and then asserts a username, which its session holds.
  **Google is deferred**, and joins `Anonymous` in the list in `convex/auth.ts` when it comes, with
  the "anonymous here, signed in there" collision (a username held by the anonymous session on
  another device) designed then. Its keys (`JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`) live on the
  deployment: `scripts/convex_auth_keys` mints throwaway ones for a local backend, and a Coach sets
  production's (`notes/deploy.md`).

### AI

* **`@anthropic-ai/sdk`**, called only from `src/app/api/ask/route.ts` (`lib/ask/failures.ts` reads
  its error classes). Model ids live in
  `src/lib/ask/models.ts`, by tier; check the current ids before changing them. Credentials are
  reached only through `src/lib/credentials.ts`.

### Secrets and CI

* **Doppler.** Never a `.env` file in the repo, never a secret pasted into a chat, never a
  secret in a code comment. Syncing to Vercel and to GitHub Actions comes with deployment.
  Dev mode scripts run under `doppler run`, each with its own config and so its own ports,
  build directory and local Convex backend: the directory's default for `dev`, `dev_claude` for
  `dev:agent`, `dev_e2e` for `test:e2e`. There is a convenience script, `./scripts/doppledo`
  for running as an alternative stage_actor (eg `dev_agent`).
  Convex's production deploy key lives only in `prd_janitor`, which the housekeeping scripts in
  `scripts/` run under (`scripts/convex_healthcheck`); a local backend needs no key at all. Staging, production and CI get their environment from Doppler's
  syncs, not the CLI; CI runs `playwright test` directly.
* **GitHub Actions** (`.github/workflows/ci.yml`): `tsc --noEmit`, `eslint`, `vitest run`,
  `next build` and the Playwright suite, run against the optimized build. All gate a merge;
  agent-authored PRs go through the same gates as anyone's. Few jobs, several checks to each,
  since the account's twenty runners are shared by every pull request a spine push sets going:
  `lint-typecheck`, `test-generated-build` (the two the ruleset requires), and six e2e shards.
  Playwright's own image for the shards was tried in Oct 2026 and dropped: pulling it took as long
  as installing the browser, and it brought quirks of its own (root, git's ownership check).
  Two more workflows tend the previews and gate nothing: `preview.yml` asks Vercel for a pull
  request's preview when it opens and on the `preview` label, in place of Vercel's build on every
  push, which a restack spent the daily quota on (Oct 2026); `convex-previews.yml` deletes a
  closed pull request's Convex preview. Neither leans on a marketplace action: `preview.yml` is
  `curl`, `jq` and `gh` against Vercel's REST API. `notes/deploy.md`, *The pieces*.

### Testing

* **Vitest** with chai-style assertions. See `notes/testing.md`.
* **`eslint-plugin-chai-expect`** and **`eslint-plugin-chai-friendly`** on `tests/**`, in place
  of `vitest/valid-expect`, which refuses chai's property assertions (`to.be.true`) with no option
  to allow them. chai-expect catches a bare `expect(x)` and a method left uncalled; chai-friendly's
  `no-unused-expressions` lets an expect chain stand as a statement. Lint-only, so the runtime
  stays vitest's. No vitest-specific plugin exists. Added Sept 2026.
* **convex-test** (with **@edge-runtime/vm**) for Convex functions: Vitest's `convex` project
  runs `tests/convex/**` under the edge runtime, everything else under node.
* **Playwright** for end-to-end, especially the handful of flows where a break is
  invisible to unit tests (the grid, autosave and reload survival, routing, the history store).
  Its web-first assertions are the e2e style; see `notes/testing.md`.
* **`eslint-plugin-playwright`** on `e2e/**`: the mechanical form of testing.md's Playwright
  section (`no-wait-for-selector`, `prefer-web-first-assertions`, `prefer-to-have-count` and
  the rest of its recommended set). Added Sept 2026 after a review found one-shot reads and
  hand waits that nothing was watching for.

### Agents

* **Claude Code**, governed by `CLAUDE.md`, `STYLE.md`, `notes/guidelines.md`, and `.claude/rules/`.

## Hand-rolled on purpose

The Library-first rule in `CLAUDE.md` says to flag hand-rolled code a library should own. These
were weighed and kept. Don't re-open them without a new reason; do add to the list when a Coach
agrees to another.

* **The question grid is a bespoke `<table>`, not MUI's and not a DataGrid.** Reviewed Sept 2026
  and kept. Every cell is a live editor rather than a cell with an edit mode; a row's height is
  measured from its Clueing and Hint boxes and imposed on the rest; the columns carry explicit
  pixel widths from the quiz itself; and below 640px the whole table restructures into one card
  per question. MUI X DataGrid's editing, row-height and virtualization models each fight one of
  those, column reordering is behind its Pro licence, and the card restructure is not expressible
  in it at all. MUI's plain `Table` primitives are a styling veneer over the same `<table>`: they
  would add Emotion work to roughly twenty cells per row in the app's hot path and buy nothing
  structural. `src/app/theme.ts` builds MUI's palette from the same tokens the grid uses, so the
  two sit on one ground. The grid's *chrome* -- toolbars, dialogs, pickers, the editors behind
  the gear -- stays MUI, and should.
  - The one wart: the sort header in `QuestionTable` is a raw `<button>` where `TableSortLabel`
    exists. Left alone because sortable headers can be rotated (`writing-mode: vertical-lr`) and
    un-rotating that component's arrow costs more than the dozen lines it saves. Small enough to
    revisit if the vertical headers ever go.
* **The grid's batch-mode selection is a small hook, not react-stately.** Weighed Sept 2026 and
  kept. `useChecklist` (`src/components/use-checklist.ts`) holds a mode flag and a set of checked
  ids, and forgets both when the quiz changes. react-stately's `useCheckboxGroupState` would
  replace only the set, and now brings the whole `react-stately` package with it.
  `useMultipleSelectionState` answers select-all with an `'all'` sentinel and wants a React Aria
  collection for the rest. **If the grid ever needs more** -- shift-click ranges, arrow-key or
  keyboard multi-select, select-all across a filter -- **stop extending the hook and shift to
  React Aria**. Those behaviours are what react-aria's `useTable`/`useGridList` exist for, and
  hand-rolling them would be exactly what the Library-first rule forbids. That shift would
  reopen the bespoke-grid decision above, so it is a conversation with a Coach, not a refactor.
* **The grid's folded rows are a small hook too, for the same reason.** Approved by a Coach
  Sept 2026. `useFolds` (`src/components/use-folds.ts`) holds a set of folded question ids beside
  the table, which forgets it when the quiz changes. The corner's triangle follows MUI X's
  expand-all convention: anything open, it folds every row; nothing open, it unfolds them all.
  `@react-stately/disclosure`'s `useDisclosureGroupState` would own only the set, has no
  expand-all, and brings `react-stately` with it. The line above holds here too: if folding
  grows keyboard control of its own, or wants the folds kept across a reload, weigh a library
  before extending the hook.
* **Retiring stray branches is a script of our own, `scripts/git-attic`.** Approved by a Coach
  Oct 2026. The tools for it (`git-delete-merged-branches`, `git-trim`, `git branch --merged`)
  delete branches outright, and find only those whose own commits reached `main`; a branch whose
  PR merged after a rebase, or a draft of a commit that landed reworded, is invisible to them.
  The script finds those by `git cherry` and by subject line, and keeps each as an annotated tag
  saying what it was. The manual is `notes/housekeeping.md`.
* **Parallel checkouts are scripts of our own: `scripts/lanes.ts` now, and the worktree and
  landing scripts beside it.** Approved by a Coach Oct 2026. Lanes give every checkout its own
  ports from one table, stable across runs because a Convex backend's URL is baked into its
  `cli.env`, its auth keys' `SITE_URL` and every build; a free-port finder (`get-port`) would hand
  out a different one each time. The stack tools (git-town, git-branchless, git-machete,
  Graphite) restack branches, which `git rebase --update-refs` already does; none coordinates
  several worktrees landing onto one shared checkout, and Graphite and spr want merge flows of
  their own that fight the semi-linear ladder. The design is
  `whiteboard/20261005-parallel_git/parallel-git-plan.md`.
* **Bringing a PR up to date and setting it to merge is a script of our own, `scripts/automerge.ts`.**
  Asked for by a Coach Oct 2026, as the trivial case of merging under a semi-linear history.
  GitHub's "Update branch" rebases one branch alone, which strands the PRs stacked on it under
  new SHAs. The stack tools named above want merge flows of their own. `gh pr merge --auto` alone
  never updates a branch. It reuses the spine's hold, `restack` and leased pushes.
* **CI's steps are timed by a script of our own, `scripts/ci_step`.** Asked for by a Coach Oct
  2026. It is the shell every `run` step runs in, and marks each step's start and end with the
  time and how far into the job. GitHub's log viewer shows times but not elapsed; `ts` (moreutils)
  would stamp every line, but no runner image has it, and installing it costs each job an apt-get.

## Later, i.e when we get there

* **A second device**: a username belongs to the anonymous session that claimed it, so another
  browser cannot take it on. The door is a sign-in (Google, deferred: see *Authentication* under
  Use), made from the device holding the username.
* **Rate limiting** the public functions (`convex-helpers`' rate limiter), if anyone ever abuses
  a deployment's URL: every function is callable by whoever has it.
* **MSW** for network mocking, so the same handlers serve tests and local development.
* **Bruno** for full stack testing.
* A **Content Security Policy** that would survive a sanitizer bug. Set it in `next.config`
  headers, no `unsafe-inline` for scripts, and treat any exception as a discussion.
* Background work: **Web Workers** via **Comlink** for anything that would otherwise block paint: image
  processing, large parses, diffing.
* Images
  - Resize **before** upload, in a worker: `createImageBitmap` + `OffscreenCanvas`.
  - Upload **direct to object storage with a presigned URL**
  - **sharp** for any server-side processing that survives the above.
  - Serve through **next/image**

---

## Discuss

Raise these before building on them. Each one has a question attached; the answer is what makes
it a decision rather than a default.

* **CodeMirror 6** for the editing surface: markdown source with live preview.
* Object storage and delivery — S3? Vercel? Cloudflare? Abuse the DB? Something else?
* Rich-text editing: markdown typed into a plain box, or a wysiwyg (**TipTap**)? Showing it is
  settled (see **react-markdown** under *Use*); editing is still the plain box, which shows its
  markdown rendered until it is typed into.
  - **Shiki** for syntax highlighting in rendered code blocks, if code blocks ever matter.
* **Sentry**, probably? Mind the Zod patch: a `ZodError` carries user text, so scrub before sending.

### Open with a Coach (Sept 2026)

Raised in review and not yet decided. Until one is settled, don't build further in its
direction, and don't "fix" the code to match the line above that it contradicts.

Settled in Sept 2026, and recorded in `notes/decisions/`: where the database lives (Convex, after
a trial of Jazz; `notes/database-decisions.md` has the verdict), the rendering policy
(client-first; pages prerender at build), client state (Convex queries, one per thing a screen
shows, assembled on the server; `hunts.perform` writes rows), models versus schema (the Zod row
validators are the source, and `convex/schema.ts` is derived from them), and the shape of
identity (a browser key for the trial, replaced in October 2026 by Convex Auth: see
*Authentication* under Use). Still open:

* **How thick the end-to-end layer should be.** The line above says thin; the suite is sixteen
  spec files and larger than any unit area. Tied to whether components and hooks get tests of
  their own (Testing Library, Vitest browser mode).
* **lightning-fs or OPFS** under the quiz history.
* **Formulas off the main thread** (a Worker via Comlink), which would also dissolve the
  objection to async JSONata.
* **The AI layer**: the SDK direct, or a provider-neutral layer, given that a bot already
  names its `servicelabel`.
* **MUI on the grid's hot path.** The grid styles with a CSS module and tokens because Emotion
  per cell was judged too dear; say where that line sits for everything that is not the grid.
