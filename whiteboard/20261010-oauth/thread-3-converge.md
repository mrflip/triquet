# Thread 3: converge (2026-10-11)

Branch `20261011-converge`, PR filed at landing; see the report. Suites at `ready`: justify green
(typecheck, lint, 206 unit files, 5995 tests); a full e2e run before review, 299/299, no flakes (lane 1,
load 14.8). The landing proof is still to come.

**Caught up onto thread 8 (#229), before review.** One conflict, `tests/models/hunt.test.ts`
(both sides kept); `convex/_generated/api.d.ts` regenerated, not merged. Three `fix:` commits
after: `tests/convex/check_reserved.test.ts` makes its hunt as a `googleUser`; a userlabel already
held (the user row, the huntship's copy, a ghosting, `add_huntship`, the `testing:` commands) is
held to `CK.heldUserlabel`, while claiming one (`assume_userlabel`) stays on `CK.userlabel`, with a
test that a user holding a since-reserved word stays writable and addable; thread 8's "ident"
prose now says userlabel (`isIdentlabel` is `isHeldUserlabel`). The reserved list still names
`ident`, `identing` and `hunting` as model nouns, past tables: left, as removing a reserved word is
thread 8's call. No e2e since the catch-up.

* **Built**: the schema step (`users` ours, `huntships`, `ghostings`, `user_id` on reviews; idents,
  identings and huntings gone); our `createOrUpdateUser` (`userForSignIn`); the actor built from
  the user's row (`Actor.ofUser`, the one place `admin` is read; `TRIQUET_EVERYONE_ADMIN` for local
  backends); userlabels taken once and only when free (`holderOfUserlabel`); sealing as policy
  (`Actor.isSealed`, four `sealed…` refusals); `smithOfSandbox` for thread 5; other users reached
  only as a face through the census; the browser (`useMe`, `UserlabelGate`, no "Be someone else");
  thread 2's clear deleted; tests by kind of user (`anonymousSession`, `anonymousUser`,
  `googleUser`); e2e vouched for by `testing:vouchFor`; the notes. **Every name and file, with
  where it lives: `converge-map.md`**, beside this file.

* **Decisions taken**:
  1. **Words**: the actor with no userlabel is `unlabelled`; *anonymous* means only Convex Auth's
     `isAnonymous` (the actor carries it as `anonymous`); *sealed* is the policy predicate
     (`Actor.isSealed`). Pulled from thread 1's note.
  2. **"Anonymous" for sealing reads `users.isAnonymous`**, not "has a Google account". Thread 5's
     upgrade in place must clear `isAnonymous` when a Google account joins an anonymous user, and
     its admin-needs-Google rule can read the same field in `Actor.ofUser`. Thread 4's "signed in
     with Google" (an account with `provider: 'google'`) agrees with it for every user our code
     makes; `vouchFor` is the one writer of `isAnonymous: false` without an account, on test
     deployments alone.
  3. **One refusal, `userlabelClaimed`, for all three holders** (user, ghosting, address). Its
     words fit a user best; a ghosting or an address reads as "someone else holds that handle",
     which is true enough and says nothing of who.
  4. **`userlabelSet`**: a user holding a userlabel asking for another is refused by policy; asking
     for its own again is no change. "Be someone else" went with it: with a userlabel set once,
     switching would mean leaving a user behind, which is thread 6's *Sign out*.
  5. **A user's own email is in no query yet** (`users.current` omits it); thread 6 adds the
     owner's query.
  6. **The admin switch is a yes, not a list**: `TRIQUET_EVERYONE_ADMIN=yes`, a literal in
     convex.config, so no variable can name an admin.
  7. **Test helpers**: `googleUser` exists now, pulled forward from thread 5 (see *Deviations*),
     since every hunt test with a reviewer needs a user sealing does not bind.
  8. **`ValidatorKit.zid` takes convex-test's ids of Convex Auth's tables**: `PA.Convexid` admits
     `<20 digits><table name>` with a capital in it (`authAccounts`), which convex-test mints and a
     deployment never does; the all-caps id stays refused.
  9. **Members keep `label` and `title`** in `MemberT`, `SmithT` and a review's `reviewer` (the face
     shown), to keep the diff to meaning; `UserT` and the row say `userlabel`.

* **Deviations**:
  - **Pulled forward from thread 5**: the `googleUser` test helper (a seeded Google account row),
    and the `ValidatorKit` id pattern change it needed. Thread 5 should build its sign-in tests on
    it rather than a second helper.
  - **e2e stands in for Google with `testing:vouchFor`**, an internal mutation on clearable
    deployments, rather than a provider. The plan forbids a provider that signs anyone in without
    proof; this signs nobody in, but it is a way past sealing on a test backend, so it is named in
    `notes/security.md` for thread 9.
  - The move commit does not build alone, as thread 1's did not.
  - `src/lib/vv/patterns.ts` and `strings.ts` prose that says "ident" is left where thread 8
    rewrites the same lines; it is mended at catch-up (below).

* **Discoveries** (for later threads):
  - **At catch-up onto thread 8**: switch the user row's `userlabel` and the huntship's copy (and
    `add_huntship`'s `userlabel`, which names a held one) to `CK.heldUserlabel`, keep
    `assume_userlabel` on `CK.userlabel`; carry `tests/convex/check_reserved.test.ts`, which makes
    hunts through `hunts.performOuter` (its makers must be `googleUser`s, or labelled as their
    sandbox); and mend the "ident" prose in `patterns.ts`, `strings.ts`, `addresses.ts`,
    `labelmaker.ts`, `src/models/hunt.ts` and `vocabulary.md`'s *label* entry.
  - **Thread 5**: `userForSignIn` is where the OAuth table goes; clear `isAnonymous` on upgrade;
    make `Actor.ofUser`'s admin read count only for a non-anonymous user (one line); `smithOfSandbox`
    is ready; `googleUser` is the helper to sign in beside.
  - **Thread 6**: the sealing refusals point nowhere yet. Places that should offer Google: the
    hunts list's `sealedHunts` line, the Members panel's `sealedMembers` notice, and the
    `NotOnHunt` page, which tells an anonymous visitor to ask a smith to add them (who will be
    refused, `sealedJoin`). An anonymous smith opening its own sandbox's quiz at `!playtest` is
    shown "Not yet on this hunt", since it may not review; worth its own words.
  - **Thread 9**: a smith adding a handle learns whether that user is anonymous (the `sealedJoin`
    refusal); the privacy policy's *Who sees what* does not say so.
  - `scripts/measure-latency.ts` was already stale (a *Continue* button, `/h/` addresses); its
    words were renamed only.
  - `notes/policy_approve.md`'s code examples and `notes/future-models.md` still say ident: they
    are illustrations and history, left as they are.

* **For the Coach**:
  - **Merge order**: this PR's schema push needs production's people cleared first
    (`notes/deploy.md`, *Clearing production's people*, step 3). Run the clear from `main` as the
    first merge step left it, since this PR deletes the script.
  - **Your own local backends** (`dev`, `e2e`) refuse this schema: `scripts/convex_reset dev`.
  - **Deploy skew**: a tab running the old bundle gets "Could not find public function" for
    `idents:*` until it reloads (no shim), and its session is gone with the clear anyway.
  - **Words a visitor now reads**: the four `sealed…` notices, `userlabelSet` ("This browser
    already has a handle, and a handle is chosen once."), `userUnknown` ("Nobody goes by the handle
    …"), the Members panel's "Their handle", the front door's "it becomes yours for good", and
    "give them your handle" in the not-on-hunt notices.
