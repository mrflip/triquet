# 2026-10-13: Sprint oauth's follow-ups done

You merged the oauth stack ([#226](https://github.com/mrflip/triquet/pull/226) to
[#235](https://github.com/mrflip/triquet/pull/235), with
[#237](https://github.com/mrflip/triquet/pull/237)'s review follow-ups), and asked me to carry on
with the plan while you read *What needs your word*. With your yes, the main checkout went back to
`main` and two follow-up threads ran on a fresh spine. They took only the security review's
recommendations that wait on no decision of yours. Both reviews came back clean. The closing full
e2e run, on the top, passed 311/311 with no flakes.

The plan's *Follow-up threads (2026-10-13)* has the briefs; `oauth-progress.md` has the reviews.
The live mirror is https://claude.ai/code/artifact/89643f81-3e20-48c4-9cde-ef9268d7a1c6.

## The PRs (one stack)

| PR | Thread | Stacked on |
|---|---|---|
| [#242](https://github.com/mrflip/triquet/pull/242) | 10, `seal_hardening`: sealing fails closed; `adopt` keeps off sandboxes and names the user it found | `main` (carries three `docs:` sweep commits beneath it) |
| [#243](https://github.com/mrflip/triquet/pull/243) | 11, `oauth_tidy`: the code review's leftovers | #242 |

Merging #243 takes #242 with it. Neither needs a migration or a step in production. #243 changes
the Convex Auth patch's text (one shared function, no change in behaviour), so the lockfile's patch
hash moves.

**#242:**
* **F5:** a user row without `isAnonymous` is sealed, and its `admin` counts for nothing. That
  includes the code exchange, where such a user would be upgraded or merged. The review confirmed
  only the finishing browser's own user can be, and nothing writes such a row.
* **F6:** `adopt --smith-all` and `--reviewer-all` skip anonymous users' sandboxes, and count what
  they skipped. `--smith` or `--reviewer` naming one is refused, and so is relabelling an anonymous
  user that holds one. A relabel says whether the handle it leaves is free.
* **F4:** `adopt`'s dry run names the user it found by Google name and creation time, for you to
  recognize before it acts.

**#243:**
* A handle's address check reads one row.
* One loop rewrites a user's copies on huntships. A retitle now also repairs a drifted handle
  copy, with a test.
* `auth:offered` reads no session (a new one-line `zPlainQuery`, on convex-helpers).
* `UserlabelGate`'s `name` is renamed.
* The patch deletes a dying code's verifier in one function.
* `adopt` gives no anonymous user a handle a hunt's address holds (from #242's review).

## Decisions taken in YOLO

1. The main checkout went back to `main` on your yes, after the replay of the merged stack
   conflicted, as expected for rewritten SHAs.
2. F5 reaches the code exchange: one predicate everywhere.
3. A sandbox, for `adopt`'s grants: `~label/label`, held by an anonymous user who is on it.
4. #243's refusal is wider than the review's case: an anonymous user gets no address-held handle
   at all.
5. `zPlainQuery` is a new wrapper. `notes/convex.md` named none for an unscoped public query.

## Still yours (unchanged from `human/20261012-sprint_oauth_done.md`)

* **F2** (smiths listed to strangers) and **F3** (sign a verifier once: a fifth part to the patch),
  before production's Google keys.
* **Wording to approve:** the policy and terms, the handle, sealing and sign-in screens, and
  Google's "G". Also F7 (`sealedJoin` reveals anonymity) and F8 (sign out on a shared browser).
* **Your calls:** the reserved words, `jose` and `@fontsource/roboto`, upstream #306, and a
  deploy-skew policy.
* **Production:** `scripts/adopt`, on your word at the time. If it runs after #242 deploys, its dry
  run names the user it found.
* **Minor, recorded:** a sandbox an `adopt` run relabelled away before #242 would not count as
  sealed. That matters only if such a run happened.
