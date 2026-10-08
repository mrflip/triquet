# Thread 8: Security fixes, certain ones (2026-10-07)

Branch `20261007-security_fixes`, PR filed at landing; see the report. Suites: `pnpm justify` green
(4,947 unit tests); the new headers test in `e2e/routing.spec.ts` green on lane 3, and failing
without the config; `pnpm e2e --touched` at landing (the `convex/` changes reach the whole suite).

* **Built**: one `fix:` commit per finding, each with a test that fails without it. Findings marked
  fixed, with commits, in `security-findings.md` and `whiteboard/TODO.md`.
  - **O4** (f0a2370): `identFor` (`convex/reading.ts`) answers null when the ident its newest
    identing names is not held by the session, so `askerOf` makes the session anonymous. Tests in
    `tests/convex/reading.test.ts` and `tests/convex/functions.test.ts`.
  - **O5** (abe9692): `PA.HuntsPerOrg` (99) in `src/lib/vv/patterns.ts`; `new_hunt` refuses past
    it (`orgFull`, a new refusal in `src/lib/notices.ts`), counted through the hunts'
    `by_orglabel_and_label` index by `huntsCountedInOrg` (`convex/reading.ts`). `newHunt` is split:
    `makeHuntFor` (label taken, app full, the writes) is what `testing:makeHunt` calls, past the
    org's cap. Tests in `tests/convex/idents.test.ts`, `reading.test.ts`, `testing.test.ts`.
  - **O7** (f1d71f0): `src/lib/mustachery.ts`, `OwnKeysContext`: mustache's context held to the
    view's own keys, calling nothing. `renderPrompt` renders in it; templating's `BagContext` now
    extends it (budgets and helper names on top), so the two dialects share one rule. Tests in
    `tests/lib/mustachery.test.ts` and `tests/lib/ask/prompts.test.ts`.
  - **O6** (20dd564): `SecurityHeaders` in `next.config.ts`, on every response (`/:path*`):
    `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
    strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(),
    payment=(), usb=()`. Test: `e2e/routing.spec.ts`, the first test (`/`, `/my/hunts`, `/api/ask`).
    `notes/stack.md`'s CSP item points at it.
* **Decisions taken**:
  - **O5 is a per-org cap, 99.** A hunt's org is its maker's username, so the org's hunts are the
    hunts that username made, counted by an index that already exists: no schema change, no
    migration. 99 is a tenth of the app's 999 and follows the caps' 99/999 pattern; nobody writing
    quizzes by hand comes near it.
  - **`testing:makeHunt` goes past the org's cap.** CI runs e2e on one worker, whose one ident makes
    every test's hunt (some 250 a run): a cap it obeyed would fail CI. It holds the admin key, and
    limits are for the public.
  - **`X-Frame-Options`, not `frame-ancestors`.** `frame-ancestors` is a CSP directive, and the CSP
    stays a discussion; `DENY` does the same work in every browser.
  - **Permissions-Policy names only long-standing features**, so Chrome logs no unrecognized
    feature (`interest-cohort` and the like left out); clipboard is left alone (the copy buttons
    use it).
  - **`OwnKeysContext` in a module of its own** (`lib/mustachery.ts`, thread 7's suggested name)
    rather than exported from `templating.ts`, so the prompt renderer does not import the field
    templates' bag, helpers and models.
* **Discoveries**:
  - Under mustache's own context `renderPrompt('[{{constructor}}]', {})` came to `[{}]` (it called
    `Object`), and a function in the input (a JSONata formula can hand one back) was called.
  - A per-username cap does not stop one session: it may assert any number of new usernames, and
    anonymous sign-in is unlimited. Closing that is a rate limit, a design call (below).
* **For the Coach**:
  - **O5's remainder**: rate-limiting sign-in and new idents (`notes/stack.md`, *Later*), if the
    app's hunt room ever needs defending from a determined session. In TODO.
  - **`X-Frame-Options: DENY`** means nothing may embed the app (a Notion page, a slide). Say if
    that is wanted, and the header becomes `SAMEORIGIN` or an allowlist.
  - Before deploying, any production org already at 99 hunts or more would be refused its next
    one; none is likely.
  - Untouched, as directed: O1, O2, O3, O8, O9, and images in filled values. No lint or type
    suppressions.
