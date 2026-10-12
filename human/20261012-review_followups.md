# 2026-10-12: The stack review's follow-ups, on the Coach's word

What the Coach decided of the review's leftovers (`human/20261012-oauth_stack_review.md`), done as
one PR stacked on [#231](https://github.com/mrflip/triquet/pull/231):

* **An anonymous visitor not on a hunt** is now told to sign in with Google first, and then to
  contact the smith with their handle (`sealedNotOnHuntNotice`): "You are not yet a member of this
  hunt. Sign in with Google first — coming soon — then contact its smith, Flip (flip_kromer), and
  give them your handle, “ada_lovelace”: a handle is put on a hunt only once it is signed in. This
  page opens for you as soon as they add you." There is no search for a person in the app, so
  whoever holds the link is presumed to know the smith. `NotOnHunt` takes the visitor's actor to
  tell; the three routes that show it hand it on. The friend-link spec asserts the new sentence.
  The two whiteboard notes that recorded the old behaviour say what it is now.
* **The since-reserved userlabel that can never make its sandbox** is in `whiteboard/TODO.md`
  under a new *Not yet* heading, with the fix to make when wanted.
* **The privacy policy's email line** stays: it reads as the broader promise the Coach may build to.
* **Test titles in `"`**: `notes/testing.md` had the rule in a clause; it is now its own paragraph,
  saying to requote the titles of a file one is already in. `whiteboard/TODO.md` gains a *Soon*
  heading with the review of every test file against the guidance, and the lint rule that would
  settle it.

**Tests:** lint and typecheck on the touched files; `tests/lib/notices.test.ts` and
`tests/components/NotOnHunt.test.tsx` (23 tests); the friend-link spec of `e2e/routing.spec.ts`
alone. CI runs the rest.

**Wording to approve:** the new notice's sentence, above.
