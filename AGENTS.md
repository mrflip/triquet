# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repo is pre-implementation: conventions, stack decisions, and tooling config exist, but
there is no application code yet (no `package.json`, no `src/`, no tests at the root).

The first steps we will work on are to lay the foundations for a first-class, small-now,
medium-sized maybe someday web app according to the guidelines found in /notes and otherwise
referred to here. Part of that will be to adapt some files from old projects -- .eslintrc, etc --
carrying forward its intent but discarding cargo-culted segments, workaround, obsolete directives
and the other wounds of experience.

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

* **Prefer the toolkit to the home brew.** If you find yourself writing a lot of code to solve a
  problem, or banging rocks together instead of calling a toolkit entrypoint, there's a good
  chance we've misdirected you or that we're solving the wrong problem. Say so.
* **Maintainability and legibility beat performance** unless we have demonstrated that something
  is slow. Cleverness is rarely called for -- but if it seems to be, propose it.
* **Never treat secret keys or other sensitive data with imaginative code.** Use best practices
  and established libraries, always.
* **On new toolkits**: nothing still being proven, but we're happy to move with the front of the
  crowd as soon as it's clear that will have the best long-term relevance. Developer ergonomics
  are important.

## Non-Negotiables

* Every new piece of code gets a proportional doc block and test suite.
* Validate at module entrypoints; write confident, paranoia-free code past that boundary.
* Progress notes, development caveats and open questions go in `HUMAN-whatsup.md` or `/whiteboard` --
  never in doc blocks or code comments.
* `eslint.config.mjs` is the final authority on formatting. Run the linter; however, if it conflicts with the higher guidelines of
  legibility and productivity, you are approved for `@eslint-disable-line` (`no-param-reassign`, `no-explicit-any`) or `@ts-expect-error` if they are the correct compromise -- apply them but **report it in chat**.
* ignore **everything in /aside/**/**, **everything with the word `secret` or `secret` unless it also says `template`**.
  - also do not design anything that needs such a file. Use doppler.

## Notable files and directories:

These are **not** loaded automatically. Read them when the work touches them.

* `/HUMAN-whatsup.md` -- our collaboration sketchpad; this is for me to read and you to braindump into, and WILL drift from reality.
* `/STYLE.md`  -- the naming vocabulary (`val`, `ckey`, `keypath`, `bag`, `kind`, `handle` and
  the rest of the tag glossary), brace and indentation rules, quote conventions, doc block
  formatting. These conventions are specific and unguessable -- the inform where to improvise
  from general TypeScript habit.
* `/whiteboard`
* `/notes` -- add durable artifacts here. In particular:
  - `stack.md` -- guidelines on how we choose stack elements, and which ones to discuss before implementing
  - `notes/guidelines.md` -- the Sketch/DNA/Real/Live validation lifecycle and its `Validator` pattern, the documentation policy, testing philosophy. **Read before designing a module entrypoint or a data model.**
* `/.claude/rules/testing.md` (symlinked to `notes/testing.md`) -- test conventions. Loads automatically when you touch a test file; you don't need to fetch it.
* `/eslint.config.mjs` -- mechanically enforced style, and the best source of truth for any
  formatting question. Where it and a prose document disagree, it is a bug -- flag it.

To any extent reasonable, prefer to author content in markdown rather than HTML.

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
* Never `type` to mean "kind": `woodkind`, not `woodType`. `type` is reserved for data model type.
* `const` by default; `var` only where the value is genuinely reassigned. Functional style is
  strongly preferred.
* Parenthesize and space every negation: `if (! approved) { ... }`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
