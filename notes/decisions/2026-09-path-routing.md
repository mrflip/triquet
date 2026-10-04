# Routing: the App Router owns the address (Sept 2026)

**Decision.** A quiz lives at a path of dynamic segments, now `/h/<hunt>/<realm>/<quiz>`
(it was `/my/quiz/<label>` until hunts arrived; see `2026-09-resource-urls.md` for why the path
names the resource and `?act=` the presentation). `useParams()` reads the segments and
`useRouter().push`/`replace` move them. `src/lib/routes.ts` is the one place a URL's shape is
written.

**The address decides which quiz is on screen, and nothing decides the address in return.**
Anything that changes which quiz is open -- the switcher, a new quiz, a deletion, a relabel --
says so by navigating, and every editing action lands on the quiz the address names. (The
workspace's `active_quiz_id`, which once followed the address along behind, is gone with the
workspace: nothing but the address says which quiz is open.)

**What it replaced.** Hash routing (`#label`). That design reconciled the hash and
`active_quiz_id` in *both* directions, which needed a module-level mutable `written`, a custom
DOM event and two effects -- about ninety lines of hand-rolled router. The two effects raced,
discarding a pasted address; a second bug in the root redirect turned the same machinery into an
infinite navigation loop. The hash design was defensible while the address was cosmetic, and
stopped being so once an address became a request that can fail.

**Rules that follow from it.**

* Do not reintroduce a second mechanism that writes the URL behind the router's back.
* **Navigation is a transition, not an instant rewrite.** `history.replaceState` was synchronous;
  `router.push` is not. Anything that acts on the quiz it is moving to must wait for the arrival.
  In tests, `newQuiz` and `openQuiz` in `e2e/support.ts` do that waiting.
* A relabel is a move: it navigates. Addressing by id instead would cost the readable URL.
