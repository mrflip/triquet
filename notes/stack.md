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

A dependency that appears in none of these is unlisted: propose it in chat before adding it.

Everything here is chosen against the same four-way test: futureproof, safe, pleasant to work
with, and old enough to be within the agent's training cutoff.

Version numbers and release status drift. Before pinning anything, check the current release --
don't trust a recalled version number, including one recalled by an agent.

---

## Use

### Application framework

* **Next.js** (App Router) on **Vercel**. **Client-first**: the app runs on static hosting plus
  stateless functions, and works with the network off except for asking. Pages prerender at
  build; user data never renders on a server. The ask route is the one named server function.
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
* **Jazz v2** (`jazz-tools`, pinned to its 2.0.0 alpha) as the database: local-first, a copy in
  each browser, synced through a Jazz server. **On trial, and a deliberate exception** to the
  four-way test above: it is alpha and newer than the agent's cutoff. Work from the installed
  source and the `jazz` skill, never from memory. See `notes/decisions/2026-09-jazz.md`.
  - Rows, not a tree: actions write rows, views subscribe to rows. The relational shape lives in
    `src/db/schema.ts` in Jazz's own DSL (tables are not authored in Zod); only a column holding
    a structured value takes a Zod schema, through `JZS.json()` (or `jsonText`, while a nullable
    JSON column cannot hold a value). Row ids are Jazz's and internal; refer by label. Field names
    stay `underscore_case`. Read one table per query; write through `perform`.
  - **Gone for good:** libSQL, Drizzle and their migrations (Sept 2026).
  - **Turso is not coming back**, in local mode or cloud: concerns about concurrent access
    across tabs, and a conflict resolution that is last-push-wins in some cases.
* pnpm
* Material UI's own components for tables, inputs, dialogs and menus; @mui/icons-material for icons
* **Pragmatic drag-and-drop** (`@atlaskit/pragmatic-drag-and-drop`, plus `-hitbox`) for every
  drag, wired up only in `useReorderable` (`src/components/use-reorder.ts`). Do **not** take
  `-react-drop-indicator`. Every grip also answers the arrow keys.
  See `notes/decisions/2026-09-drag-and-drop.md`.

### Routing

* **Next's App Router owns the address.** A quiz lives at `/my/quiz/<label>`; `src/lib/routes.ts`
  is the one place a URL's shape is written. The address decides which quiz is on screen, and
  nothing decides the address in return: never add a second mechanism that writes the URL.
  Navigation is a transition, so wait for the arrival before acting on the quiz moved to.
  See `notes/decisions/2026-09-path-routing.md`.

### Small libraries in use

Settled; reach for these before writing the equivalent.

* **unique-names-generator** for fresh labels. (Row ids are Jazz's own; `lib/ids.ts` mints a UUID
  for a question or quiz the tool holds before it is written.)
* **safe-stable-stringify**, behind `UU.jsonify`. Don't import it directly.
* **Papa Parse** for TSV/CSV, in and out. **fflate** for zipping a download.
* **clsx** for composing class names in the grid.
* **cross-env** for the agent scripts.

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
  quiz; `lib/quizgit.ts` and `state/quiz-mirror.ts` are the only files that touch either.
* **The repository is not a source of truth, and nothing reads app state back from it.** It is
  there because git is the best interface we know for reviewing diffs of text: a past-versions
  view, an export, and a promise to an adopter that their work leaves with them, in a form the
  people who build puzzle hunts already know how to use. Design it as that.

### AI

* **`@anthropic-ai/sdk`**, called only from `src/app/api/ask/route.ts` (`lib/ask/failures.ts` reads
  its error classes). Model ids live in
  `src/lib/ask/models.ts`, by tier; check the current ids before changing them. Credentials are
  reached only through `src/lib/credentials.ts`.

### Secrets and CI

* **Doppler.** Never a `.env` file in the repo, never a secret pasted into a chat, never a
  secret in a code comment. Syncing to Vercel and to GitHub Actions comes with deployment.
  Dev mode scripts run under `doppler run`, each with its own config and so its own ports,
  build directory and Jazz server: the directory's default for `dev`, `dev_claude` for
  `dev:agent`, `dev_e2e` for `test:e2e`. There is a convenience script, `./scripts/doppledo`
  for running as an alternative stage_actor (eg `dev_agent`).
  The Jazz admin and backend secrets live only in the
  janitor configs (`dev_janitor`, `dev_aijanitor`, `prd_janitor`), which the housekeeping
  scripts in `scripts/` run under. Staging, production and CI get their environment from Doppler's
  syncs, not the CLI; CI runs `playwright test` directly.
* **GitHub Actions** (`.github/workflows/ci.yml`): `tsc --noEmit`, `eslint`, `vitest run`,
  `next build` and the Playwright suite. All gate a merge; agent-authored PRs go through the
  same gates as anyone's.

### Testing

* **Vitest** with chai-style assertions. See `notes/testing.md`.
* **`jazz-tools/testing`** (`startLocalJazzServer`, `createPolicyTestApp`) for anything that
  touches rows or policies; `createPolicyTestApp` by default. Model the real topology when sync
  or permissions are the behaviour under test.
* **Playwright** for end-to-end, kept to a thin layer: the handful of flows where a break is
  invisible to unit tests (auth round-trip, upload, publish).

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

## Later, i.e when we get there

* **A second device without logging in**: Jazz's `exportLocalFirstSecret` (and its
  recovery-phrase helpers) carry a local-first account to another browser. The no-login path to
  multi-device, if authors want it before TODO 1's sign-in.
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
* Authentication, **deferred until the Jazz move lands** (TODO 1 in
  `notes/decisions/2026-09-jazz.md`). Shape agreed: local-first accounts with no login as the
  default; later, one hosted hub (Clerk or WorkOS) federating Google as Jazz's single issuer,
  `linkJWT` at the threshold, a written collision policy. Better Auth is the named alternative
  and would put our own server in the login path. Provision through the Vercel Marketplace.
* Rich-text editing: do we want markdown+preview, or a wysiwg? how do we keep safe?
  - **TipTap**? **unified / remark / rehype** for the pipeline, via **react-markdown** for rendering.
  - `remark-parse` → `remark-gfm` → `remark-rehype` → **`rehype-sanitize`** → render.
  - react-markdown renders to React elements rather than `dangerouslySetInnerHTML`. Keep it that
    way. If you find yourself reaching for raw HTML injection, stop and raise it.
  - `rehype-sanitize` runs with an explicit allowlist schema, defined in one place and reviewed
    when it changes. Never sanitize ad hoc at a call site.
  - Render on the server wherever possible.
  - **Shiki** for syntax highlighting in rendered code blocks, server-side.
* **Sentry**, probably? Mind the Zod patch: a `ZodError` carries user text, so scrub before sending.

### Open with a Coach (Sept 2026)

Raised in review and not yet decided. Until one is settled, don't build further in its
direction, and don't "fix" the code to match the line above that it contradicts.

Settled in Sept 2026, and recorded in `notes/decisions/`: where the database lives (Jazz,
local-first), the rendering policy (client-first; pages prerender at build), client state
(Jazz subscriptions, one per table, assembled into the quiz tree; `perform` writes rows), models versus schema
(relational shape in `schema.ts`, structured values in Zod), and the shape of identity (deferred;
see *Authentication* above). Still open:

* **Where the sync server runs** for the trial: Jazz Cloud or our own. Tied to where Jazz Cloud
  takes the JWKS settings, which the docs do not show.
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
