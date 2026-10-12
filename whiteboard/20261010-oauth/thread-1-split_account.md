# Thread 1: split_account (2026-10-11)

Branch `20261011-split_account`, PR filed at landing; see the report. Suites: `pnpm justify` green
(typecheck, lint, 5919 unit tests); the four specs whose words changed (routing, brand,
failing-pages, stats) 66 of 66 on lane 1, as a check before review. The landing proof is still to
come.

* **Built**:
  - **Moves first**, each a commit of its own and unedited: `convex/writing/account_actions.ts`
    to `user_actions.ts`, `src/state/use-account-actions.ts` to `use-awaited-actions.ts`,
    `AccountMenu.tsx` to `UserMenu.tsx`, `ShowAccount.tsx` to `ShowUser.tsx`.
  - **User actions**: `ActionValidators.userAction` (`assume_ident`, `retitle_ident`),
    `performUser` in `writing/user_actions.ts`, `affirmUserAction`, Approve's `UserPolicies`, on
    the public mutation `idents.perform`. `assumeIdent`, `claimFor` and `retitleIdent` are as
    they were.
  - **Outer hunt actions**: `ActionValidators.outerHuntAction` (`new_hunt`, `retitle_hunt`,
    `relabel_hunt`, `arrange_categories`, `rebranch_hunt`, each naming its `hunt_id` but
    `new_hunt`), `performOuterHunt` in `writing/hunt_actions.ts` beside `newHunt` and
    `makeHuntFor` (moved there unchanged), `affirmOuterHuntAction`, `new_hunt` in Approve's
    `HuntPolicies`, on the public mutation `hunts.performOuter`. Both mutations are in `Unscoped`.
  - **The browser**: `useAwaitedActions` (`src/state/use-awaited-actions.ts`) is the machinery
    the old hook was, generic over the action; `useUserActions` and `useOuterHuntActions` each make
    their mutation and hand it over. `use-categories` calls `hunts.performOuter`.
  - **Views**: `UserMenu`, `ShowUser`, the header's shown part `user` (`ShownUserT`,
    `useShowUser`). The menu's button and dialog are named "You" on screen; e2e's helper is
    `openUserMenu`.
  - **"Username" is gone** from code, notes, notice keys and test names (`userlabelShape`,
    `userlabelUnfinished`, `userlabelReserved`, `userlabelClaimed`, `Actor.EveryUserlabel`,
    `Approve.mayAssertUserlabel`); on screen the front door's field is "Handle" and every notice
    says handle.
  - **The other accounts in our code**: the ask route's `accountOff` failure is `keyRefused`, and
    `huntgit.ts`'s author comment no longer speaks of accounts.
  - **`notes/vocabulary.md`**, *Who and where*: account, user, session, anonymous, userlabel,
    handle, huntship, sandbox, ghosting, and the user and outer hunt actions, each naming the
    thread that makes it where the code does not say so yet. `CLAUDE.md`, `notes/security.md`,
    `notes/hunt_git.md` and `notes/ux/obj_act_matrix.md` name the renamed things.

* **Decisions taken**:
  1. **Two hunt unions, not one.** The Coach's text puts making and changing a hunt "into the
     hunt-action union". The existing `huntAction` travels with a quiz's affirms (`quiz_id` and
     `realm_id` required) on the scoped `hunts.perform`, and `new_hunt` has no hunt to affirm, so
     joining it would change behaviour. These stay a union of their own in the hunt family,
     `outerHuntAction` ("from outside any quiz"), with their dispatcher in `hunt_actions.ts`.
  2. **The dispatchers and mutations**: `performUser` and `performOuterHunt`, after
     `performLibrary` and `performLayout`; `idents.perform` (thread 3's module rename makes it
     `users.perform`) and `hunts.performOuter`.
  3. **The menu's screen name is "You"**, its tooltip still "You are Flip (@flip)". e2e matches it
     `exact: true`.
  4. **`userlabelClaimed` says** "go back to the browser where you first chose it", rather than
     "create an account", which nothing offers yet. Thread 6 may point it at Google sign-in.
  5. **`accountOff` became `keyRefused`** ("This server's key isn't allowed to ask Claude
     that."): it named Anthropic's account, and "off for this account" would read as the
     visitor's own once Google sign-in exists.
  6. **Left as they are**: past sprints' `whiteboard/` files and `human/` (records); another
     service's account in notes (GitHub, Convex, Vercel); the historical decision record
     `notes/decisions/20260928-database-decisions.md`; vocabulary's retired *workspace*; MUI's
     icon name `AccountCircleOutlined`; the Playwright skill's own references under `.claude/`;
     the reserved words `account` and `accounts` in `src/lib/vv/patterns.ts`, and the prose beside
     them (thread 8's file).

* **Deviations**:
  - The four move commits do not build alone: their imports point at the old paths until the
    split commit. The plan asked for moves before edits; each message says so.
  - The tests of the outer hunt actions stay in `tests/convex/idents.test.ts`, which shares its
    helpers with them, with their `describe`s renamed `hunts.performOuter: …`.

* **Discoveries** (for thread 3 above all):
  - When `idents.test.ts` becomes `users.test.ts`, move the `hunts.performOuter` describes to
    `hunts.test.ts`.
  - Sealing's "one sandbox" lands in `Approve.mayMakeHunt` (the `new_hunt` row of
    `HuntPolicies`) and `newHunt` in `writing/hunt_actions.ts`.
  - "Anonymous" means two things today: Convex Auth's `isAnonymous` (no proof), and the actor's
    `{ kind: 'anonymous' }` (no userlabel asserted). The vocabulary says so; thread 3 should give
    the actor's kind another name or retire it.
  - "Handle" on screen meets the drag handles the screen also shows, and STYLE.md's `handle` tag.
    The front door's field is matched `exact: true` in e2e.
  - **Deploy skew** (the reviewer's note): `idents:performAccount` is gone and the wire codes are
    renamed, so a tab still running the old bundle gets "Could not find public function" for
    logging in, retitling, making a hunt, renaming and rebranching until it reloads. A known effect
    of deploying; no shim.
  - The repo has no `renderHook` tests; the awaited-actions hooks are covered by e2e, as their
    predecessor was.

* **For the Coach**: the words a visitor now reads, for approval: the field "Handle"; the notices
  "A handle is …", "That handle is kept for the app's own use …", "Someone else holds that handle.
  Choose a different one — or, if it's yours, go back to the browser where you first chose it.",
  "One handle may make at most … hunts.", "Only an admin sees these: choose a handle first.",
  "This server's key isn't allowed to ask Claude that."; the user menu's name "You".
