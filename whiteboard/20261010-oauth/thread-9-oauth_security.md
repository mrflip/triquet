# Thread 9: oauth_security (2026-10-12)

Branch `20261012-oauth_security`, PR filed at landing; see the report. Cut from the spine's top
(`bbbcd155`, thread 6 landed); stacked on #234, and merges after the clear, as #229 to #234 do.
Suites: justify green; the full e2e suite at landing, the sprint's closing full run (its log line
and any flakes in the report and the PR's Tests: line). Review: `fixed`, two commits.

**The review of the whole sprint, `29850126...bbbcd155`.** One fix; eight findings left for the
Coach, none blocking. The full review, with each finding's evidence and recommendation and what
held: `oauth-security-review.md` beside this file (read it before acting on any finding, or to
know what was checked). The briefs: `notes/security.md`, 2026-10-12, thread 9. The open items:
`whiteboard/TODO.md`, *From oauth sprint, thread 9*.

| # | Finding | Severity | Disposition |
|---|---|---|---|
| F1 | The front door's `?then=` is an open redirect for a visitor holding a handle (`/?then=/%09/evil.example`); a Google sign-in comes back to it | Medium | **Fixed** (three `fix:` commits: mine, and the review's two) |
| F2 | `hunts:open` lists smiths' handles and titles (Google names, by default) to any caller, no session needed; old addresses look across every org, and labels are ~430k guessable pairs | Low to Medium (privacy) | Left: the Coach's call; the policy changes with it |
| F3 | Convex Auth signs a verifier as often as asked, so a leaked verifier id works its whole 15 minutes | Low | Left: "sign once", a fifth part to the patch |
| F4 | `adopt --email` trusts Google's email claim, `email_verified` dropped | Low | Left: the Coach watches the one run |
| F5 | "Signed in with Google" is `isAnonymous !== true`: a row missing the field is unsealed | Low (hardening) | Left: fail closed recommended |
| F6 | `adopt`: `--smith-all` reaches anonymous sandboxes; relabelling an anonymous user lets it make a second; the old userlabel is left free | Low (command line) | Left: recommended refusals |
| F7 | `sealedJoin` tells a smith a handle is anonymous; the policy is silent | Low (privacy) | Left: wording |
| F8 | Sign out leaves the hunt histories (IndexedDB) for the next person at that browser | Low (privacy) | Left: wording or a clear |
| F9 | `/api/ask` still answers any POST (O1); bring-your-own-key is now unblocked | pre-existing | Noted |

* **Built**: `Routes.thenFrom` reads `then` as the browser will (`onSite`, in `src/lib/routes.ts`,
  now shared with `isSyncedPath`), refuses a backslash anywhere, and answers the path as read;
  seven new cases in `tests/lib/routes.test.ts`. **The review (`fixed`) added two commits:**
  one refuses a path that reads as `//…` once dot segments resolve (`/.//evil.example`,
  which answering the path as read had turned into `//evil.example`, an open redirect my fix
  opened); the other answers null for an address `new URL` cannot parse (`/%09/[`), which threw
  in the front door's render and in Convex Auth's redirect callback. `notes/security.md` gains two entries (the open
  findings; the fix); `whiteboard/TODO.md` a thread 9 section, and O1 and O3 corrected (O3 said
  "anyone with a userlabel"; it is anyone).
* **Decisions taken**:
  - **F1 fixed though it predates the sprint**: it is on the sign-in path (a Google sign-in comes
    back to the front door, query and all), and the fix is local and plainly right.
  - **F5 and F6 left, not fixed**: each changes a predicate or a decision a thread recorded
    (thread 5's one predicate, thread 4's `--smith-all` and relabel), and neither is reachable
    today without a deploy key or a row nothing writes.
  - **F3 left**: the patch is the Coach's design (option 1), and a fifth part to it wants their
    eye, though the change is small.
* **Discoveries**:
  - The `security-review` skill's filter passed nothing at confidence 8; its two Low items are F3
    and F4. The `convex-reviewer` checklist found nothing new. `/code-review high` gave 13, of
    which F1, F2, F4, F5 and F6 stand; the rest are efficiency and style, in TODO.
  - Every item of the progress document's *For thread 9* list was weighed: the review's *What held*
    says which are sound and which recorded decisions were carried out (sealing, `sealedDelete`,
    option 1, the redirect rule, no shims).
* **For the Coach**: the eight left findings, each with a recommendation in the review. The
  likeliest to want a decision before production's Google keys: **F2** (real names to strangers,
  now that titles start as Google names) and **F3** (sign a verifier once).
