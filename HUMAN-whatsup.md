# What's up

Braindump from the v1 delivery cycle: Features-v1's ten milestones, M1 through M10, each its own
commit. Everything below is either a decision I made that you might want to overturn, or a thing
I noticed and did not act on. Nothing here is load-bearing for the code.

## Things I'd most like you to look at

**`ModelTier` is `'quick' | 'careful'`, not `'quick' | 'default'`.** The spec's own `.describe()`
calls the second one "the more careful number extraction". `default` names a fallback, not a
thoroughness, and it would have read as a bug the first time someone added a third tier.

**The UI says "Clueing", not "Question".** You asked for the field to be `clueing`, and once the
sum columns are called Clueing Full Sum the column header may as well match. The footnote under
the grid explains the vocabulary. If you'd rather the author saw "Question" on screen while the
code says `clueing`, that's a one-line change in `src/components/columns.ts` -- but then the
eight sum headers need deciding too.

**Descending chain order roots at the *highest* Q#.** §M3 says every restart roots at the lowest,
in both directions. Taken literally, walking `1→2→3→4` backwards gives you 1, 2, 3, 4 -- which
is not backwards, and contradicts the milestone's own "flip it and read it backward". So
descending roots high and steps to whatever chains *into* the current question. The
lowest-Q#-wins rule still governs the real choice, which is a merge. Questions with no Q# stay at
the end in both directions: an absent Q# is not a high one.

**The Sheets export's BUT NOT joiner.** §M7 field 2 says to fold the hint in with
`... BUT NOT ....`, but every hint in the spec is already written as "BUT NOT ...", so a literal
joiner stutters. `foldButnot` supplies the phrase only when the hint doesn't carry it. If hints
are meant to be stored *without* the prefix, say so and this gets simpler.

**Import matches on id before title -- but only a local id.** Without this, pasting your
own export straight back appends a duplicate of every question you hadn't named yet, which
breaks M8's own "done when". Ids from another browser still mean nothing, so title is
still the key that matters for the cross-browser case. Related: a pasted question with neither a
known id nor a title is *appended* rather than merged onto whichever blank it happens to
sit next to. Both are judgement calls.

**Sorting by an ishes column sorts by how many spans were found.** §5 lists `q_ishes`/`bn_ishes`/
`h_ishes` as sortkeys but never says what they sort by, and a list has no other ordering. An
empty result sorts as nought; a cell nobody has asked about sinks to the bottom like every other
absence.

## Stack decisions I made without asking

* **localStorage, not Turso.** stack.md names Turso as the primary database, but §1's operating
  principles are explicit: no account, no server, no sync, works with the network off. One
  versioned key holds the whole workspace. When v2 grows accounts, `lib/storage` is the only
  file that knows where a workspace lives.
* **`ulid` for ids**, per your Coach note. Minted through `monotonicFactory` so a burst of
  records keeps its creation order rather than shuffling within the millisecond.
* **`clsx`** for class joining -- `noUncheckedIndexedAccess` makes every CSS-module member
  `string | undefined`, so template literals were producing `"cell undefined"`.
* **`@playwright/test`**, which stack.md already lists. Kept to the thin layer it describes: 62
  specs, all of them a milestone's "done when" rather than coverage for its own sake. They earned
  their place immediately -- see "bugs the tests caught" below.
* **`@anthropic-ai/sdk`** and one route handler at `/api/ask`. A key must never reach a page, so
  the asking half needs a server; everything else works with the network off. The key comes from
  `ANTHROPIC_API_KEY` in the environment (Doppler), never a file in the repo. With no key
  configured the route answers `unavailable` and the tool keeps working without its asking half.
* **Two real model tiers**: `claude-haiku-4-5` for the hasty guess, `claude-opus-5` for
  extraction. §M4/M5 ask for this explicitly and it is not a cost dodge -- a careful answer to
  the ambiguity question would answer the wrong question.
* **Structured outputs** (`zodOutputFormat` over the model's own `ishItem` schema) for the
  extractions, rather than parsing JSON out of prose. The schema the app stores and the schema
  the model is held to are then literally the same object.

## Bugs the tests caught

Worth recording because two of them were silent data loss.

1. **`QuestionPatch` was `question.partial()`** -- and Zod applies a field's `.default()` through
   `.partial()`. Committing one field therefore carried every other field's default along and
   wiped what the author had: typing a title erased the clueing next to it. Found by the
   very first Playwright run. The patch schema is now built from defaultless field schemas. This
   is the same caveat §5 flags for the import path, met a milestone early.
2. **Sortable ish headers collided with askable cells** -- both became buttons named "Clueing
   ishes". Askable cells are now labelled "Ask <column>".
3. **The sort arrow was inside the header button's text**, so the button renamed itself from
   "Q#" to "Q# ↑" on the first click. It's decorative now; `aria-sort` on the header carries the
   direction.

## eslint rules I turned off, and why

All of these are in a named block in `eslint.config.mjs` with the reason inline. Each one
contradicts one of our own documents rather than being inconvenient:

* `unicorn/single-line-block-comment-style` -- STYLE.md sanctions the one-line doc block.
* `unicorn/no-null` -- guidelines.md's Real phase *requires* null.
* `unicorn/consistent-class-member-order` -- guidelines.md's worked example declares fields first.
* `unicorn/name-replacements` -- would force `err` → `error`, the one name STYLE.md forbids.
* `unicorn/consistent-boolean-name` -- fights the spec's own `locked` / `stale` / `truncated`.
* `unicorn/prefer-ternary` -- fights the guard clause STYLE.md endorses.
* `vitest/valid-title` -- testing.md's bulk example lists title from a variable by construction.
* `@typescript-eslint/consistent-type-definitions` -- `type FooT = Z.output<...>` can't be an
  interface, so its neighbours shouldn't have to be.

And two reconfigured rather than disabled: `unicorn/catch-error-name` now wants `err`, and
`unicorn/filename-case` accepts PascalCase as well as kebab, because components are PascalCase.

**Three things in STYLE.md the linter contradicts, which by STYLE.md's own rule makes them bugs
in the document:**

* STYLE.md says `var` where a value is genuinely reassigned. `no-var` is on, and `let` is the
  right modern answer -- `var` is function-scoped and hoisted. I used `let`.
* `@stylistic/space-unary-ops` can't tell a TS non-null assertion (`foo!.bar`) from an unspaced
  negation, so it warns on every one. I avoided non-null assertions instead, which is the house
  preference anyway; `tests/support/present.ts` is there so tests don't need them either.
* `unicorn/no-unnecessary-global-this` and `unicorn/prefer-global-this` disagree with each other
  about `globalThis.window`. Resolvable, but worth knowing.

## Deliberately not done

* **No question deletion.** §7 names it as the first gap worth filling, and it is.
* **No undo.** §7.
* The **Prompts used** panel shows the templates but there's no way to edit them. Right for v1.
* The bulk run sends the whole quiz in one request with no chunking. A 200-question quiz would
  want splitting; nothing in v1 gets near it.
* `src/state/workspace-store.ts` is glue and is only tested through the reducer and
  `lib/storage`. It takes an injected `Storage` and `EventTarget` so it *can* be tested directly
  if it grows.
* The `/api/ask` route has no unit tests -- it would need the SDK mocked, and the interesting
  logic (prompts, contract, failure mapping, bulk landings) is all in tested modules either side
  of it. The e2e specs stub the route rather than the SDK.

## If you want to run it

    pnpm dev              # the app
    pnpm test             # 309 vitest specs
    pnpm test:e2e         # 62 playwright specs, starts its own dev server on :3100
    pnpm lint && pnpm typecheck && pnpm build

Asking Claude needs `ANTHROPIC_API_KEY` in the environment. Without it the grid works and the
askable cells say "Asking Claude isn't available in this view."
