# Thread 6: google_ui (2026-10-12)

Branch `20261012-google_ui`, PR filed at landing; see the report. Cut from the spine's top
(`f12a3e18`, thread 5 landed). Suites at `ready`: justify green (215 unit files, 6289 tests); e2e on
lane 3, `google-sign-in` and `routing` 62/62, `google-sign-in` alone 27/27 (three times over), and
the whole suite 309/309 (Google keys present, as under `dev_e2e`), no flakes. Not yet `pnpm e2e`.

**Against thread 5r's fixes** (landing beneath, per the orchestrator): this thread leaves
`src/state/use-google-sign-in.ts` alone and passes no `redirectTo` of its own; both doors call
`useGoogleSignIn().start`, which comes back to the page it left, always a real synced page (the
front door, the hunts, a hunt, a quiz). It reads only the unchanged `GoogleSignInHandle` type.

* **Built**:
  - **What a user is told of itself** (`users.own`, `ownUserOf` in `convex/reading.ts`, `OwnUserT`
    in `src/models/user.ts`): whether it is signed in with Google, the email Google sent, the
    handle the front door offers (`suggested`), and the pending name choice (`nameChoice`: the
    merged browser's handle and title, and the user's own). The one function that returns an email,
    of the session's own user only (`Unscoped`, and `authorize.test.ts`). One facet, watched once
    (`useOwnUser`, from `ShowUser`), handed to the header and the page through `ShownUserT`
    (`own`, `google`, `onSignOut`), never watched by a component.
  - **Suggestions** (`User.suggestionsFor`): the Google name, then the email before the @, each
    through `User.labelFor`, then each numbered `_2` to `_9` (which also mends one too short);
    only claimable ones (`flawIn`, so no reserved word). The server offers the first that
    `holderOfUserlabel` finds free (no user, no ghosting, no address).
  - **Settling a name choice**: the user action `settle_name_choice { merged, keep }` on
    `users.perform` (`settleNameChoice` in `writing/user_actions.ts`; policy
    `Approve.maySettleNameChoice`; refusal `nameChoiceGone`). The merged-away user gives up its
    handle; the handle not kept goes into a ghosting; keeping the merged handle relabels and
    retitles the user through `User.relabelled` (the held rule) and rewrites its huntships' copies
    (`rewriteUserlabel`, now shared with thread 4's `relabelUser`). No address moves.
  - **Views**: `GoogleSignIn.tsx` (`GoogleSignInButton`, Google's dress; `GoogleSignInOffer`, a
    reason above the button, drawn only where `google.offered`); `NameChoiceDialog` in the synced
    layout, on whichever page; `UserMenu` (email to its owner, *Sign in with Google to keep … on
    every device* for an anonymous user, *Sign out…* asking first in the menu's own place);
    `UserlabelGate` (the Google door beneath the fields; back from Google, whom Google signed in,
    and the offered name and handle, to take or change); `NotOnHunt` (an anonymous stranger told a
    smith can put them on only once they sign in, with the offer; an anonymous smith at its
    sandbox's `!playtest` told *Reviewing comes with Google*, with *Work on this quiz*).
  - **Sealing's doors** (orchestrator's look-ahead): the `sealed…` notices no longer say "coming
    soon"; the hunts list's and the Members panel's refusals carry the offer; the gear
    (`HuntEditModal`, `relabelable` from `mayOffer('relabel_hunt')`) and the manage dialog
    (`workbenchOffers` gains `relabelHunt`, `deleteHunt`) hide the label field and *Delete this quiz
    and its hunt* from an anonymous smith, saying why, with the offer.
  - **Sign out**: `useSignOut` (`src/state/use-session.ts`): Convex Auth's `signOut`, then a whole
    new page at `/`.
  - **Assets**: `public/google/g-logo.svg`; `@fontsource/roboto` (Roboto Medium only, not
    preloaded, `--font-google-button` in `src/app/fonts.ts`).
  - **Tests**: convex-test (`users.own`, `ownUserOf`, settling in `user_actions.test.ts`, the stand-ins,
    the email's privacy); `User.suggestionsFor`; the notices; `offers` (an anonymous smith's column);
    `UserlabelGate.test.tsx` (what the front door says); a soundness check (*no two users, nor a
    user and a ghosting, hold one userlabel*); e2e in `google-sign-in.spec.ts` (the front door's
    button, stopped at the deployment's sign-in route; the menu; sign out; the name choice) and
    `routing.spec.ts` (an anonymous smith's gear, manage dialog and playtest).
  - **e2e stand-ins**: `testing:vouchFor` may set an email; `testing:mergeInto` marks a merge
    (the mark only). Both refused without `TRIQUET_CLEARABLE=yes`; `notes/security.md` says so.
  - **Notes**: security (three entries), convex (*Denormalized fields*), e2e, vocabulary
    (*merge*, *ghosting*), stack (Roboto).

* **Decisions taken**:
  1. **Settling is a user action** on `users.perform`, not a mutation of its own: it is the visitor
     acting as themselves, before any hunt is in play, as taking and retitling a handle are.
  2. **The action names the choice by the merged handle** (`merged`) as well as the one to keep, so
     a stale tab cannot settle a second pending choice it never showed. Any pending choice can be
     settled, not only the first `nameChoiceFor` returns.
  3. **A ghosting's `user_id` is whoever held the retired handle**: the merged-away user, or, when
     its handle is kept, the user it merged into (then equal to `into_user_id`), as the pre-plan's
     table says ("the user who held it"). The validator's description says so.
  4. **One query for the owner's own facts** (`users.own`), not one per fact: all change rarely
     and together, and the menu, the gate and the dialog each want some.
  5. **None of the suggestions free**: the handle follows the Google name as typed, as for anyone.
  6. **Sign out only for a user signed in with Google.** An anonymous user signing out would lose
     its handle with no way back; it is offered Google instead.
  7. **Sign out reloads the page** at `/`, so nothing the app held of the user outlives it.
  8. **The name choice can be put off** (*Decide later*), for the tab; asked again on the next load.
     Until then the Google account's handle stands, as thread 5 left it.
  9. **The Members panel's offer** appears only once the panel has refused (`sealedMembers`), beneath
     the refusal; the hunts list's, the gear's and the manage dialog's stand where the refusal does.
  10. **The spec's `@smoke` moved** from the redirect test, which CI skips (no keys), to the name
      choice, which runs everywhere.
  11. **The unfinished-sign-in notice** (`useGoogleSignInOutcome`) stays in `ShowUser`.

* **Deviations**:
  - **`testing:mergeInto`, a second stand-in** beside `vouchFor`, so e2e reaches the name choice.
    The plan asked for convex-test of the settling mutation, which is there too; the dialog is
    otherwise reached by nothing automated. Thread 9 reviews it with `vouchFor`.
  - **Google's "G" is drawn from Google's published sign-in markup, not fetched** (the rule: never
    fetch from Google). It renders as Google's mark, light and dark; the file says to check it
    against the official asset (*For the Coach*).
  - No link to the privacy policy on the sign-in screen: the footer already links it on every page.
  - `NotOnHunt` gained two props (`sealed`, `editPath`).

* **Discoveries**:
  - **Browse a lane's dev server at `localhost`, not `127.0.0.1`.** Next 16 blocks its dev resources
    from another origin, the page never hydrates, and every screen sits at *Opening…*. The suite
    already uses `localhost`.
  - A press on the header's menu straight after a reload can land before hydration and do nothing:
    wait for something the server sent first (the `google-sign-in` spec waits for `(@label)`).
  - Thread 5's spec's redirect test reads `auth:signIn` and the 302; this thread's button test stops
    the browser itself at the deployment's sign-in route with `page.route`, which a navigation the
    page makes does pass through (unlike the 302 the server makes).

* **For thread 9**: `users.own` (the one email-returning function), `settle_name_choice`'s check
  that the merged user merged into the actor, `testing:mergeInto` and `vouchFor`'s email.

* **For the Coach**: `human/20261012-google_ui.md` (read it to approve the wording or check
  Google's "G"): every new string, a draft; Google's "G" to check against the official asset;
  `@fontsource/roboto` added under `notes/stack.md`'s rule (Fontsource is settled; Google's
  guidelines set the button in Roboto Medium).
