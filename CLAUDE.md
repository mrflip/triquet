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

**Storage is Convex**, since September 2026. Rows, not a tree; row ids are internal and things
are referred to by label; Zod validates every function's arguments and every row written, never
rows read back. `notes/convex.md` holds the conventions and where this project departs from
Convex's own guidelines, and loads itself when work touches `convex/` or the browser's side of it.

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

  Views are TSX composed from MUI components; raw HTML elements are for semantics MUI lacks. (Markdown is for documents and content, not UI.)
  `notes/views.md` has the tripwires that mean "stop and ask", the styling rules, and the skills to reach for; it loads itself when work touches a view.
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

You should be running in a container; check `$TQ_IS_SANDBOXED` is "true" to verify.

**Use `pnpm dev:agent` (port 3001)** and similar: `pnpm build:agent`** (served 3004 by
`pnpm start:agent`), `pnpm test:e2e` (port 3002). Each role has a local Convex backend of its
own (`scripts/convex_backend <dev|agent|e2e|e2e-agent>`): port `34xx`, HTTP actions on `35xx`,
data and the CLI's `cli.env` in `data/convex-<role>/`. `scripts/convex_dev <role>` starts it
when it is not running, pushes `convex/` to it and runs a command beside it; `scripts/convex_reset <role>` empties one.
If you meet another shared resource -- a port, a cache or output directory,
a database -- give yourself a parallel one the same way, and add its script to `package.json`.

A change under `convex/` regenerates `convex/_generated/`, which is committed: push it to your backend (`scripts/convex_dev`) and commit what it writes, a large regeneration in a commit of its own. There are no migrations: a schema push refuses documents that no longer fit, and a local backend is emptied and pushed again.

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
* `/STYLE.md`  -- the naming vocabulary (`val`, `ckey`, `keypath`, `bag`, `kind`, `handle` and
  the rest of the tag glossary), brace and indentation rules, quote conventions, doc block
  formatting. These conventions are specific and unguessable -- the inform where to improvise
  from general TypeScript habit.
* `/whiteboard` -- work threads in progress, under a `YYYYMMDD-threadname` directory.
* `/notes` -- add durable artifacts here. In particular:
  - `notes/vocabulary.md` -- what we mean by widget, expressing, botting, ish, label and the rest.
    **Read before naming anything in the domain.**
  - `notes/guidelines.md` -- high-level validation, documentation, and testing policy. **Read before
    designing a module entrypoint or a data model.**
  - `notes/queries_hooks_and_subscriptions.md` -- the words for reading from Convex (query
    function, watch, fetch, facet, screen hook) and where to draw the lines between them. **Read
    before adding a query function, a state hook, or a `useQuery`.**
  - `notes/stack.md` *(auto-loads)* -- what we build with. Consult it when
    adding a package, and to get a sense of how we like to set the shiny<>dependable slider.
  - `notes/deploy.md` -- agents never deploy to production, but look here if humans request your guidance.
  - `notes/testing.md` *(auto-loads)* -- test conventions.
  - `notes/convex.md` *(auto-loads)* -- how we use Convex, where we depart from its guidelines, and which Convex skill to name when.
  - `notes/views.md` *(auto-loads)* -- how a view is built: MUI first, the tripwires, and which MUI skill to name when.
  - `notes/prior-work/` -- retrospectives and old prompts. Unreliable narrators: history, not spec.
* `/eslint.config.mjs` -- mechanically enforced style, and the best source of truth for any
  formatting question. Where it and a prose document disagree, it is a bug -- flag it.
* `/notes/relics.md` -- consult **only** when explicitly told we will work in the relics lagoon.

Markdown is preferred over HTML when both are valid choices. The UI is TSX with MUI components.

## Conventions At A Glance

Enough to keep you out of trouble on a small edit. STYLE.md is the real source.

* Semicolonless. Two-space indents, no tabs.
* Always brace blocks, even single-statement ones: `if (nope) { return }`
* Opening brace at end of line; cuddle `} else if (...) {` and `} catch (err) {`.
* No single-letter names for variables. For TS templates, be suggestive (eg `<MT>` for a model instance) or use `TT` for a for a truly generic type
* Never bare `name`, `value`, `node`, `query` as a variable name. Use `err`, never
  `error`. Use `type` only in the context of actual datatype; for "variety of" use kind or flavor, eg `woodkind`
* **Emit JSON with `UU.jsonify`** wherever a person or a diff will see it, with optional `{ pretty: true }`. Use `JSON.stringify` if it's metal-to-metal (eg a request body bound straight for a parser). Import utilities of that kind with `import * as UU from '../lib/useful'`
* `const` by default; when necessary, `let`; never `var`.
* Functional style is strongly preferred.
* Parenthesize and space every negation: `if (! approved) { ... }`
* Style with MUI (`sx`, the theme, and its components) first: `notes/views.md` has the rules.

## Git

History on main is semi-linear. Read `notes/git_hygiene.md` before any complicated operation (eg a rebase that touches more than one branch), or when your guidance on git is requested, or if performing operations on the github repo.
- Push rebased branches with `git push --force-with-lease --force-if-includes`. Never plain `--force`
- Start a new line of work with `pnpm run newb <branchlabel>`, which branches `YYYYMMDD-<branchlabel>` on the current working tree, stacked on main. However: open PRs against `main`, even when stacked; write "stacked on #N" in the description.
- Before pushing, and when at a milestone: rebase onto origin/main and run the full test suite.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` and `notes/convex.md` first**: they show Convex APIs and patterns, and may override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be found in .agents/skills/convex* -- notes/convex.md has an overview of them.

<!-- convex-ai-end -->

Where Convex's guidelines and this project's rules differ, this project wins: `notes/convex.md`
lists every departure.
