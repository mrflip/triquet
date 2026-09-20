---
paths:
  - "package.json"
  - "notes/stack.md"
---

# Stack

What we build with, and what we haven't decided yet. Two sections:

* **Use** -- settled. Reach for these without asking. They're proven, widely adopted, and cheap to back out of if we're wrong.
* **Discuss** -- stop and raise it with a Coach before building on it. Either it's a **one-way
  door** (the choice propagates into data shapes, user records, or automation we can't casually
  unwind), or it's **infrastructure with a long "why isn't this connecting" tail** where an hour
  of planning saves a day of IAM errors, or which adds running friction to development

Everything here is chosen against the same four-way test: futureproof, safe, pleasant to work
with, and old enough to be within the agent's training cutoff.

Version numbers and release status drift. Before pinning anything, check the current release --
don't trust a recalled version number, including one recalled by an agent.

---

## Use

### Application framework

* **Next.js** (App Router) on **Vercel**. Server Components for anything that touches user data;
  client components only where interaction demands it.
* **TypeScript**, as strict as reasonably possible: . See `eslint.config.mjs`.
* **Material UI** for the component layer.
* **Zod 4** for validation at every module entrypoint. See `GUIDELINES.md` for the
  Sketch/DNA/Real/Live lifecycle this feeds.
* **es-toolkit/compat** for the lodash-shaped utility surface.
* **Turso** (libSQL) as the primary database, with **Drizzle ORM** on top. `drizzle-zod` and `drizzle-kit`, checked into the repo
  - the app must always work with turso in local mode; cloud mode is an add-on
* pnpm
* Material UI's own components for tables, inputs, dialogs and menus; @mui/icons-material for icons
* **Pragmatic drag-and-drop** (`@atlaskit/pragmatic-drag-and-drop`, plus its `-hitbox` package)
  for every drag. Chosen over dnd-kit in Sept 2026 on release evidence rather than reputation:
  dnd-kit's stable line (`@dnd-kit/core` 6.3.1) had not been published since Dec 2024, and its
  rewrite (`@dnd-kit/react`) is still 0.x, so the choice was between stagnant and unproven.
  Pragmatic is on a monthly cadence, is what Jira and Trello drag with, is framework-agnostic,
  and brings three tiny dependencies. It decorates the DOM we already have rather than asking
  for wrapper components, which is what lets the question grid stay a real `<table>`.
  - `useReorderable` in `src/components/use-reorder.ts` is the only place it is wired up.
  - Take `-hitbox` for `attachClosestEdge` and `getReorderDestinationIndex`; **do not** take
    `-react-drop-indicator`, which drags in `@atlaskit/tokens` and `@compiled/react` and would
    put a second design-token system beside MUI's. The indicator is two lines of CSS.
  - It ships no keyboard dragging on purpose. Every grip therefore also answers the up and down
    arrows; a grip that is focusable must never be a grip that does nothing.

### Testing

* **Vitest** with chai-style assertions. See `.claude/rules/testing.md`.
* **Playwright** for end-to-end, kept to a thin layer: the handful of flows where a break is
  invisible to unit tests (auth round-trip, upload, publish).
* **MSW** for network mocking, so the same handlers serve tests and local development.
* **Bruno** for full stack testing

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

## Later, i.e when we get there

* **Doppler**, synced to Vercel and to GitHub Actions. Never a `.env` file in the repo, never a
  secret pasted into a chat, never a secret in a code comment.
* **GitHub Actions** for everything: `tsc --noEmit`, `eslint`, `vitest run`, `next build`. All
  four gate a merge.
* A **Content Security Policy** that would survive a sanitizer bug. Set it in `next.config`
  headers, no `unsafe-inline` for scripts, and treat any exception as a discussion.
* Background work: **Web Workers** via **Comlink** for anything that would otherwise block paint: image
  processing, large parses, diffing.
* Images
  - Resize **before** upload, in a worker: `createImageBitmap` + `OffscreenCanvas`.
  - Upload **direct to object storage with a presigned URL**
  - **sharp** for any server-side processing that survives the above.
  - Serve through **next/image**

### Agents

* **Claude Code**, governed by `CLAUDE.md`, `STYLE.md`, `GUIDELINES.md`, and `.claude/rules/`.
* Agent-authored PRs go through the same CI gates as anyone's.

---

## Discuss

Raise these before building on them. Each one has a question attached; the answer is what makes
it a decision rather than a default.

* **CodeMirror 6** for the editing surface: markdown source with live preview.
* Object storage and delivery — S3? Vercel? Cloudflare? Abuse the DB? Something else?
* Authentication: Auth.js? Clerk? WorkOS? Cognito?
* GraphQL: **GraphQL Yoga**? **graphql-codegen**
  - I have experience with **urql** but let's consider **TanStack Query**
* Rich-text editing: do we want markdown+preview, or a wysiwg? how do we keep safe?
  - **TipTap**? **unified / remark / rehype** for the pipeline, via **react-markdown** for rendering.
  - `remark-parse` → `remark-gfm` → `remark-rehype` → **`rehype-sanitize`** → render.
  - react-markdown renders to React elements rather than `dangerouslySetInnerHTML`. Keep it that
    way. If you find yourself reaching for raw HTML injection, stop and raise it.
  - `rehype-sanitize` runs with an explicit allowlist schema, defined in one place and reviewed
    when it changes. Never sanitize ad hoc at a call site.
  - Render on the server wherever possible.
  - **Shiki** for syntax highlighting in rendered code blocks, server-side.
* **Sentry**, probably?
