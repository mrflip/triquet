# Convex Auth v2: where it stands (2026-10-11)

For the Coach, and for any thread touching sign-in. Checked against the repo
(get-convex/convex-auth, branches `main` and `reboot`), npm, and the v2 docs. Nothing here is
from memory. Estimates are marked as ours.

## Timeline

* **v1** (`main`): 0.0.96 is npm's `latest` (2026-09-30), and the line is in **maintenance mode**.
  A maintainer said so on PR #306 (2026-05-02): "Given the maintenance mode status of Convex
  Auth…". Since June it has had dependency bumps and a few fixes: 0.0.93 and 0.0.94 in June,
  0.0.95 in August, 0.0.96 in September.
* **v2** (`reboot`):
  - Alphas: `2.0.0-alpha.1` (2026-08-24) and `alpha.2` (2026-09-16), with none since, though 55
    commits have landed.
  - Stated target: the v2 docs say it "is targeting a public stable release in Q3 2026". That has
    passed.
  - The alpha banner: "Do not use… in production… no guaranteed upgrade path to the stable v2
    release; only the newest alpha gets bug fixes."
  - Pace: about 17 commits a week over the last ten weeks, from three people (Nicolas Ettlin 74%,
    Christian Wyglendowski, Shawn Erquhart).
  - Still open: a full rename and reorganization of the public API (draft stack #689-#694,
    2026-10-09), a schema-breaking session redesign (#686), and half-merged TOTP.
  - The v1-to-v2 migration guide is a stub.
* **Our estimate:** a beta or release candidate no earlier than late Q4 2026, and stable more
  likely in Q1 2027.

## What v2 is, and its advantages

* **Built as Convex components**, with no Auth.js dependency: OAuth is its own code.
* **The app owns the `users` table.** You write a `createUser` mutation; v2 keeps only `accounts`,
  `sessions` and spent refresh tokens, in its own component tables.
* **Safer token storage.** Refresh tokens are stored as hashes, with reuse detection. Access tokens
  last a minute by default.
* **Server rendering is optional.** It offers httpOnly-cookie handlers for Next.js server
  rendering; an app like ours, rendered in the browser, keeps tokens in `localStorage` as now.
* **Providers:** anonymous; username or email with a password; passkeys; Google, Apple and GitHub.
  TOTP is partly merged.

## Risks

* **Severe churn.** Each alpha rewrote about 10,000 lines of the core. The pending stack renames
  the entry point, every import path and the components, and warns that an unnamed install
  "starts with empty tables".
* **No migration path yet.** The tables, token format and key names differ from v1
  (`AUTH_PRIVATE_KEY` and `AUTH_JWKS`, against v1's `JWT_PRIVATE_KEY` and `JWKS`). Existing
  sessions would very likely not survive, and every browser would sign in again. For us, an
  anonymous browser that signs in again is a new user, which strands its usernames: the same
  problem as thread 2, for every browser at once.
* **Fewer features than v1:**
  - no magic links, OTP or phone sign-in;
  - three OAuth providers, against Auth.js's whole catalogue in v1;
  - no account linking;
  - rate limiting incomplete.
* **Anonymous-to-OAuth linking is not in v2 either.** Its callbacks get only the provider's
  details, and the one draft that links accounts (#429, anonymous to password) has been stale
  since July.
* **A small team.**

## What it means for this sprint

* **Build on v1 (0.0.96) now.** v2 isn't ready, and v1 works for Google.
* **Upgrade in place (thread 2's preferred option) has an upstream basis.** PR #306, "Pass
  authUserId to createOrUpdateUser for secure account linking", is open, and the maintainer
  called its approach "viable". Applying #306's change with `pnpm patch` would be carrying
  upstream's own pending fix, not inventing one.
* **Moving to v2 later is a thread of its own,** once it is stable and has a migration guide.
  Because every browser would sign in afresh, that move needs to carry anonymous browsers'
  usernames across: v2's lack of linking matters most to us there.

Sources:
* v2 docs index, `packages/docs/content/docs/index.mdx` on `reboot`: https://auth-v2.previews.convex.dev
* PR #306, the maintenance-mode remark: https://github.com/get-convex/convex-auth/pull/306
* Issue #231, transfer anonymous to OAuth: https://github.com/get-convex/convex-auth/issues/231
* `KNOWN_ISSUES.md` on `reboot`, and draft PRs #429, #686 and #689-#694.
