# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repo is at early implementation: we've laid the foundation for a first-class, small-now,
medium-sized maybe someday web app according to the guidelines found in /notes and otherwise
referred to here.

We are building a lightweight tool for constructing trivia quizzes, which sometimes can have "meta" puzzles --
a second layer of puzzle that is revealed as the first solutions start coming in. This tool helps
store, edit and refine the question text, and also to assess questions for fairness and difficulty/

Nobody is using the app yet, so there is no existing data to preserve: a change to a data shape or
a validator needs no migration path for anyone's quizzes.

**Storage is Convex**, replacing Jazz in September 2026; the move was also an evaluation, whose
verdict is in `notes/database-decisions.md` and whose decision is `notes/decisions/2026-09-convex.md`. The plan and its handoff are
`whiteboard/convex_yay-plan.md` and `whiteboard/convex_yay-progress.md` (read the progress
document's *Rules overrides* before touching `convex/`). Rows, not a tree: a view dispatches an
action, the `hunts.perform` mutation writes the rows it comes to, and views subscribe to query
functions that assemble what a screen shows. Row ids are Convex's `_id` and internal; refer by
label. Zod validates every function's arguments and every row written, never rows read back.
Turso is out for good.

**The app is client-first**: static hosting plus stateless functions, and the database. The ask route is the one named server function. Never add a second
without a Coach. See `notes/decisions/2026-09-client-first.md`.

Project instructions, loaded at the start of every session. Keep this file short and true:
everything here costs context on every task, whether or not the task needs it.

## Working Relationship

This project follows an Agent-Coach approach. Experienced human architects are the Coaches, with
you (the AI agent) developing the code: two equally important roles. Coaches want pushback where
warranted, and encourage you to think independently, governed by the guardrails outlined here
and in the linked documents.

If a guardrail looks wrong for the case at hand, say so and propose the alternative. Do not
quietly route around it, and do not treat a convention you find inconvenient as optional.

## Philosophy and Values

The top three values while writing code are **empathy, safety and readability**.

* **Prefer the toolkit to the home brew** (see the Library-first rule under Non-Negotiables). If you are banging rocks together, we have probably misdirected you or we are solving the wrong problem. Say so.
* **Maintainability and legibility beat performance** unless we have demonstrated that something
  is slow. Cleverness is rarely called for -- but if it seems to be, propose it.
* **Never treat secret keys or other sensitive data with imaginative code.** Use best practices
  and established libraries, always.
* **On new toolkits**: boring, agent-friendly, ergonomic, zero-ops, with a disciplined interface
  (`notes/stack.md` spells the test out). Nothing still being proven, but we're happy to move with
  the front of the crowd as soon as it's clear that will have the best long-term relevance.

## Non-Negotiables

* **Library first. Hand-rolling is a decision, not a default.** Before writing any mechanism a library could own (drag and drop, focus handling, keyboard navigation, popovers, tables, form state, virtualization, date math, parsing), look in this order:
  1. A Material UI component or an existing dependency.
  2. A new library. `notes/stack.md` says whether it is settled (**Use**), needs a Coach (**Discuss**), or is unlisted (propose it in chat).
     An unlisted one that is widely used, solves the problem (and then some) without dragging in machinery, and ideally is recommended by the neighbouring library: install it, list it in `notes/stack.md`, and tell the Coach afterwards, rather than writing our own. The worked example is `react-number-format` for number fields, which MUI's own docs pair with `TextField`.
  3. Only then hand-roll -- and only after a Coach says yes in chat. Record the decision and its reason in `notes/stack.md` under *Hand-rolled on purpose*.

  Tripwires that mean "stop and ask": you are attaching native DOM event handlers beyond click/change; you are writing a raw `<table>`, `<button>` or `<dialog>` where MUI has one; you are adding a CSS-module rule that re-creates something `sx` or the theme can do; you are writing a small state machine for an interaction; you are past ~30 lines on behavior that is not specific to quizzes.

  Views are TSX composed from MUI components; raw HTML elements are for semantics MUI lacks. (Markdown is for documents and content, not UI.)

  A decision recorded under *Hand-rolled on purpose* closes the tripwire for that code: don't re-flag it without a new reason.

  The same goes in reverse: if you find hand-rolled code that a library should own, say so in chat rather than extending it. Flag it once, briefly, and only when you are already touching that code -- don't propose migrating code you aren't otherwise changing.
* Every new piece of code gets a proportional doc block and test suite.
* Validate at module entrypoints; write confident, paranoia-free code past that boundary.
* Progress notes, development caveats and open questions go in `HUMAN-whatsup.md` or `/whiteboard` --
  never in doc blocks or code comments.
* `eslint.config.mjs` is the final authority on formatting. Run the linter; however, if it conflicts with the higher guidelines of
  legibility and productivity, you are approved for `@eslint-disable-line` (`no-param-reassign`, `no-explicit-any`) or `@ts-expect-error` if they are the correct compromise -- apply them but **report it in chat**.
* To help keep your context clean, we've drawn curtains over a couple areas of the file tree
  - ignore **everything in /aside/**/**, **everything with the word `secret` or `secrets` unless it also says `template`**.
    (also do not design anything that needs such a file. Use doppler.)
  - ignore **everything in /relics/**, unless we tell you that we are *specifically working with files in there*. If we are, use the directives in `.claude/rules/relics.md`

## Global resources

You should be running in a container, and can verify by checking that `TQ_IS_SANDBOXED` is set to "true".

Never touch a resource a human may already be using. Next.js allows one dev server and one build
per directory, so as an agent **use `pnpm dev:agent` (port 3001) and `pnpm build:agent`** (served
on 3004 by `pnpm start:agent`), never
`pnpm dev` / `pnpm build`, and run e2e only as `pnpm test:e2e` (port 3002). Doppler supplies each
its ports and directories (`dev_claude`, `dev_e2e`). Each role has a local Convex backend of its
own (`scripts/convex_backend <dev|agent|e2e|e2e-agent>`): port `34xx`, HTTP actions on `35xx`,
data and the CLI's `cli.env` in `data/convex-<role>/`. `scripts/convex_dev <role>` starts it
when it is not running, pushes `convex/` to it and runs a command beside it; `pnpm dev:agent` and
the e2e suite go through it, and `scripts/convex_reset <role>` empties one. Never the human's
`dev` (3400). Never kill a process that doesn't belong to `agent` or `e2e`.
If you meet another shared resource -- a port, a cache or output directory,
a database -- give yourself a parallel one the same way, and add its script to `package.json`.
A bespoke port is fine: follow the pattern, `30xx` for the web server and `34xx` for its Convex
backend, with a matching `data/convex-<name>/` and `.next-<name>` (`pnpm test:e2e:agent` is the
worked example: 3003/3403, for when a human's own run holds 3002). Agents will get containers of
their own in time; until then, share by convention.

Start a new line of work on its own branch with `pnpm run newb <label>`, which makes
`YYYYMMDD-<label>` from where you stand. Use it freely. A change under `convex/` regenerates
`convex/_generated/`, which is committed: push it to your backend (`scripts/convex_dev`) and
commit what it writes, a large regeneration in a commit of its own. There are no migrations: a
schema push refuses documents that no longer fit, and a local backend is emptied and pushed again.

## Architecture

Where code lives. Imports run down this list, never up: a lower layer knows nothing of the ones
above it. (`lib` and `models` are peers, and lean on each other freely. `convex/_generated/` is
beneath everything: any layer may import its types, `api` and `Doc` among them.)

* `src/app/` -- Next.js App Router: pages, the theme and palette, and the route handlers under
  `api/`. Pages are thin; they hand off to a component.
* `src/components/` -- TSX views. `Workbench` is the whole tool; `cells/` are the grid's cell
  editors and readouts; `panels/` sit below the grid. Hooks that only serve a view (`use-draft`,
  `use-reorder`) live beside it.
* `src/state/` -- the browser's side of the data: the hooks that subscribe to the server's queries
  and call its mutations (`use-hunt`, `use-ident`, `use-hunts-list`, `use-account-actions`), the
  browser key, the asking and bots hooks, and the quiz history mirror with its commit scheduler.
* `convex/` -- the server, and the whole of it:
  `schema.ts` (derived from the row validators), one file per noun of public functions,
  `reading.ts` (indexed reads), `writing/` (the actions a mutation carries out), `authorize.ts`
  (the only place authorization is written). Module names are underbar_case: Convex refuses a
  hyphen. It may import from `src/lib` and `src/models`, nothing else in `src/`; `src/lib/rows.ts`
  holds the projections from rows to tree.
* `src/models/` -- one file per domain noun: its `Validator` block, its DNA/Real types, and a
  class of statics (`fill`, `blank`, `exposed`). Nothing here is instantiated.
* `src/lib/` -- facilities: pure functions around one concern each, imported as a namespace
  (`Labelmaker`, `Chain`, `Expressed`). `lib/vv/` is the validator toolchest; `lib/ask/` is
  everything about putting a question to a bot; a `port.ts` is the browser's side of one
  route handler, and the only place that route is fetched from.
* `tests/` mirrors `src/` path for path; `e2e/` holds the Playwright specs; `fixtures/` holds
  sample data.

The quiz's git repository (isomorphic-git, in the browser) is **not a source of truth**. It is a
past-versions view and an exit door: the best interface we know for reviewing diffs of text, and
a promise to an adopter that their work leaves with them. Nothing reads app state back from it.

## Notable files and directories:

Unless marked *(auto-loads)*, these are not loaded for you. Read them when the work touches them.

* `/HUMAN-whatsup.md` -- **from agents, to Coaches.** A conversational scratchpad, not a record of
  decisions: write to it, don't read it as input. Add your entry at the top, under a level-two
  header that leads with the date: `## 2026-09-19: Reviewed Changes`.
* `/AGENTS.md` -- points non-Claude tools at this file; `.clinerules`, `.cursorrules` and
  `.github/copilot-instructions.md` symlink to it. Next.js maintains a block of its own in there.
* `/STYLE.md`  -- the naming vocabulary (`val`, `ckey`, `keypath`, `bag`, `kind`, `handle` and
  the rest of the tag glossary), brace and indentation rules, quote conventions, doc block
  formatting. These conventions are specific and unguessable -- the inform where to improvise
  from general TypeScript habit.
* `/whiteboard` -- work threads in progress, one file or folder per thread.
* `/notes` -- add durable artifacts here. In particular:
  - `notes/vocabulary.md` -- what we mean by widget, expressing, botting, ish, label and the rest.
    **Read before naming anything in the domain.**
  - `notes/guidelines.md` -- validating at entrypoints, the `Validator` pattern and its DNA/Real
    types, the patch pattern, the documentation policy, testing philosophy. **Read before
    designing a module entrypoint or a data model.**
  - `notes/queries_hooks_and_subscriptions.md` -- the words for reading from Convex (query
    function, watch, fetch, facet, screen hook) and where to draw the lines between them. **Read
    before adding a query function, a state hook, or a `useQuery`.**
  - `notes/stack.md` *(auto-loads with `package.json`)* -- what we build with: settled (**Use**),
    raise first (**Discuss**), and kept by hand (**Hand-rolled on purpose**). Consult it when
    adding a package, and to get a sense of how we like to set the shiny<>dependable slider.
  - `notes/decisions/` -- the longer reasoning behind a stack choice, one file per decision.
  - `notes/database-decisions.md` -- what we want from storage and hosting, and each candidate
    scored against it; Convex's verdict lands here.
  - `notes/deploy.md` -- how a change reaches production, and what a schema change means for a
    deployment. Agents never deploy to production.
  - `notes/testing.md` *(auto-loads with any test file)* -- test conventions.
  - `notes/prior-work/` -- retrospectives and old prompts. Unreliable narrators: history, not spec.
* `/eslint.config.mjs` -- mechanically enforced style, and the best source of truth for any
  formatting question. Where it and a prose document disagree, it is a bug -- flag it.
* `/notes/relics.md` -- consult **only** when explicitly told we will work in the relics lagoon.

To any extent reasonable, author documents and content in markdown rather than HTML. (UI is TSX with MUI components.)

## Conventions At A Glance

Enough to keep you out of trouble on a small edit. STYLE.md is the real source.

* Semicolonless. Two-space indents, no tabs. Single quotes by default; `"` only when a key must
  be quoted.
* Always brace blocks, even single-statement ones: `if (nope) { return }`
* Opening brace at end of line; cuddle `} else if (...) {` and `} catch (err) {`.
* No single-letter names. `ii` / `jj` / `kk` are the only sanctioned short ones.
  - This also applies to Typescript: if genericity is salient, use `<MT>` for a model instance, `<SK>` for an unvalidated POJO, `TT` for a generic type -- never `T`, `I`, etc
* Never bare `name`, `value`, `node`, `error` or `query` as a variable name. Use `err`, never
  `error`.
* **Emit JSON with `UU.jsonify`, not `JSON.stringify`** (`import * as UU from '../lib/useful'`) wherever
  a person or a diff will see it -- an export, a file, a message: keys come out alphabetical at every
  depth, so diffs show changes rather than shuffles. `{ pretty: true }` for files. A request body
  bound straight for a parser may use `JSON.stringify`. Utilities of that kind live in `lib/useful.ts`.
* Never `type` to mean "kind": `woodkind`, not `woodType`. `type` is reserved for data model type.
* `const` by default; `let` only where the value is genuinely reassigned. Never `var`. Functional style is
  strongly preferred.
* Parenthesize and space every negation: `if (! approved) { ... }`
* Style with MUI (`sx`, the theme, and its components) first. `workbench.module.css` is for layout MUI cannot express; new rules there need a reason.

## Git

History on main is semi-linear: each PR branch is rebased onto current main and lands as a merge commit. Procedures and reasoning are in `notes/git_hygiene.md`; read it before any rebase that touches more than one branch.

- Never merge main into a branch, and never use GitHub's "Update branch" in merge mode. To catch up: `git fetch origin && git rebase origin/main`.
- A branch must contain no merge commits; the `semi-linear` CI check rejects them.
- Push rebased branches with `git push --force-with-lease --force-if-includes`. Never plain `--force`, and never force-push a branch another agent owns.
- Open PRs against `main`, even when stacked; write "stacked on #N" in the description.
- Don't merge PRs. Philip merges.
- Every commit lands in main individually: each should pass tests, and messages follow the existing log style.
- Before marking a PR ready: rebase onto origin/main, run the full test suite, push.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

Where Convex's guidelines and this project's rules differ (`CVX`, not `v`; no `returns` on a query
that hands back documents; tests in `tests/convex/`; the per-table caps in `lib/vv/patterns.ts`),
this project wins: see *Rules overrides* in `whiteboard/convex_yay-progress.md`.
