# Thread 3: mock_google (2026-10-13)

Branch `20261013-mock_google`, PR filed at landing; see the report. Suites at `ready`: justify
green (6489 unit tests); `google-sign-in` 23/23 on the dev server (63/63 over three repeats) and
23/23 on the optimized build; `routing` and `reviews` green beside it; the smoke tier 32/32. No full
run yet.

* **Built**:
  - **The stand-in for Google**: `scripts/mock-google.ts`, on `oauth2-mock-server` (devDependency,
    in `notes/stack.md`). `serve <role>` runs an OpenID Connect issuer on 127.0.0.1 at the role's
    new **issuer port** (`scripts/lanes.ts`: 3600 + 10 x lane + the backend's digit, so e2e-agent in
    lane 4 is 3643); `env <role>` prints what a backend needs (`AUTH_GOOGLE_ID`/`SECRET`
    placeholders, `TRIQUET_MOCK_GOOGLE_ISSUER`). Which account a sign-in answers as rides on a
    request header (`x-triquet-mock-google`, `encodeSignIn`), or a refusal (Google's
    `error=access_denied`); a sign-in naming none is a fresh account. The token exchange checks
    PKCE for real.
  - **`scripts/convex_dev`**: for the roles `e2e`, `e2e-agent`, `e2e-built` (CI's too) it starts the
    stand-in unless it answers (log: `data/convex-<role>/mock-google.log`), stops it on the way out,
    and sets the stand-in's address and placeholder keys in place of Doppler's Google keys. Other
    roles are as before, and lose `TRIQUET_MOCK_GOOGLE_ISSUER`. `scripts/convex_backend` reads its
    ports past the new fourth one.
  - **`convex/auth.ts`**: `mockGoogleIssuerOf(env)` gives the Google provider the stand-in's issuer
    only with `TRIQUET_CLEARABLE=yes` and an `http` loopback address; otherwise Google's stands
    (`notes/security.md`, a new entry). Declared in `convex.config.ts`.
  - **e2e helpers**: `e2e/google.ts` (`answerGoogleAs`, `freshGoogleAccount`, `signUpWithGoogle`
    with `{ account, label, from }`, `continueWithGoogle`, `userMenuSaying`, `mockIssuerUrl`,
    `GoogleButton`); in support, **`landedAfterSignUp(page, label, then?)`**, the one place a
    sign-up's landing is said (`assumeUserlabel` and `signUpWithGoogle` both end in it), and
    `huntMadeFor(label, layout)`, pulled out of the fixture's way in; in admin, `keptOf(label)`
    over a new internal query `testing:keptOf` (gated by `TRIQUET_CLEARABLE`).
  - **The spec** (`e2e/google-sign-in.spec.ts`, titles requoted to `"`): sign-up from the front
    door (name and handle offered from Google's, then `email_verified`, `locale`, `hd` kept); sign-up
    from a link to a hunt, landing back there; an unverified email; a refused consent at the front
    door and from the user menu (the unfinished-sign-in alarm, nothing changed); verifying a
    standalone account from the menu (handle, hunt and page kept); a returning account switching a
    fresh browser; the merge and its name choice, both tests driven for real (`@smoke` on the merge).
    The two "stopped before Google" tests are gone: the real round trips cover them.
  - **Unit tests**: `tests/scripts/mock-google.test.ts` (the codec, the consent step, and a whole
    authorize-and-exchange against a live stand-in); `mockGoogleIssuerOf`'s cases in
    `tests/convex/auth.test.ts`; `testing:keptOf`; the lanes' fourth port.
  - **Notes**: stack, security (new entry; the thread 6 stand-ins entry amended), deploy (an e2e
    backend's keys), e2e (*Signing in with Google goes all the way through*), testing, laptop.
    `whiteboard/TODO.md`'s line struck.

* **Decisions taken**:
  1. **`oauth2-mock-server` held up**: no patch and no switch needed. Convex Auth already passes
     oauth4webapi's `allowInsecureRequests` on discovery, token and userinfo, and the local Convex
     backend fetches 127.0.0.1 freely. The provider's `issuer` option is the sanctioned override;
     `@auth/core`'s `AUTH_GOOGLE_ISSUER` is not honoured for an object provider (Google's own
     `issuer` wins), so it cannot redirect production either.
  2. **The account rides on a header, not a control endpoint.** Playwright sees only the first
     address of a redirect chain, but carries a continued request's headers through the rest, so
     a spec routes the deployment's sign-in route and the header reaches the stand-in's consent
     step. Parallel-safe, per test, with no state shared between workers and no port to know.
  3. **The stand-in is started by `scripts/convex_dev`**, beside the backend it serves, as the suite
     starts its other servers (through Playwright's `webServer`), not by a global setup.
  4. **e2e roles always use the stand-in**, never Doppler's Google keys, so `googleKeyed()` is true
     in CI as locally and every Google test runs everywhere (no skips left).
  5. **`mergeInto` is removed** (nothing else used it), and so is `vouchFor`'s email (its one user
     now signs up for real). **`vouchFor` stays**: the fixture's kept sessions, `routing` and
     `reviews` use it. It could go: each worker would sign its kept users up with Google once,
     and the specs' `vouchFor(await startHunt(page))` would become `continueWithGoogle`. Not done:
     it touches every spec's way in, for no coverage the Google spec lacks.

* **Deviations**: none from the plan. Nothing added to `tests/convex/users.test.ts`: every case
  found was reachable by the spec, or already unit-tested (`googleProfileOf` keeping no
  verification for an unverified email).

* **Discoveries**:
  - **The user menu closes itself if opened in the moment after a return from Google.**
    `ShowUser` hands the header `null` while `useMe` is not `loaded`, which it briefly is not as the
    code's exchange settles, so a menu opened then vanishes. A person could see it; the spec waits
    it out (`userMenuSaying`). Worth a look by thread 6 or a TODO entry.
  - `oauth2-mock-server` sends `token_endpoint_auth_methods_supported: ["none"]` but accepts the
    Basic credentials Convex Auth sends; nothing to do.
  - **A brand-new backend picks the stand-in up on its first run** (the review's question):
    `convex_dev` sets `TRIQUET_MOCK_GOOGLE_ISSUER` and the keys before the first push but
    `TRIQUET_CLEARABLE=yes` only after it, and `auth.ts` reads both as it loads. Checked from cold
    (the lane's `data/convex-e2e` moved away, so the run started a backend with no keys at all): 23/23, so
    the backend loads the modules afresh once the variable is set, as it does for Convex Auth's own
    keys (`convex_auth_keys`, also after the push). No change to `convex_dev`.
  - `assumeUserlabel` now also waits for `(@label)` on the hunts list (inside `landedAfterSignUp`),
    one read more per front-door visit.

* **For thread 5**: change `landedAfterSignUp` in `e2e/support.ts` (it takes the label, so
  `~label/label` is one line); `signUpWithGoogle(page, { from })` passes `from` as the `then`
  to it, and `signing up with Google > from a link to a hunt` is the deep-link case the Coach said
  you keep. `huntMadeFor` is exported for specs that need someone else's hunt.

* **For the Coach**: nothing outside the repo. CI needs nothing new (the stand-in runs from the
  installed packages; no Doppler, no Google). Lint suppression: one `eslint-disable-line
  unicorn/prefer-https` in `tests/convex/auth.test.ts`, on a case whose point is an `http` address
  that is not this machine.
