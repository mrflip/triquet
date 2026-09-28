# The views after Convex

Findings from the audit of 2026-09-28 (`20260928-audit.md`, section 1): places in
`src/state/` and `src/components/` where a habit from the local-first days is still standing.
Under Jazz a write was a local mutation that synced later, so writing often, writing from the
screen, and hearing a change the same instant were all free. Under Convex each write is a
round trip and a transaction, and a change is heard one round trip after it lands. Nothing here
is broken; each is a cost or a complication that no longer buys anything.

Nothing here is done yet (end of the second audit pass, 2026-09-28). Items 1 and 2 are small and are in `20260928-query-boundaries-plan.md` (as
its item 3) or could be; 3 to 6 want a conversation about how much of the mirror's promptness
we need.

## 1. Writes per keystroke

`QuizHeader.tsx` retitles on every keystroke (and again on blur). One mutation per character,
each rerunning the hunt's watch for every open browser. Fix: blur only, as every other field.
(Also `20260928-query-boundaries-plan.md`, item 3.)

## 2. Three ways to say "not here yet"

`useHuntsList` returns `null` until the server answers; `useQuiz` returns `undefined`;
`useIdent` returns a `{ loaded }` flag; `useHunt` returns a `finding` word (`waiting`,
`missing`, `found`). The word is the most honest, because it tells waiting from missing, which
`null` cannot. Suggest: every screen hook answers with a `finding` and the thing, and the
components stop testing for `null` and `undefined` in different places.

## 3. The history feed is a second copy of the quiz's subscriptions

`useHistoryFeed` in `use-hunt.ts` opens `watchQuery` watches on the hunt, the frame and each
question, re-implementing `useQuiz`'s follow-the-order logic, so that the git mirror hears a
change *before* the mutation that made it resolves (Convex calls a watch's listeners first).
That promptness matters for one thing: a milestone or a marked change (`markedChange`) waits
on `writesLanded()` and then flushes, and wants the edit it just made to be in the snapshot.

Two cheaper shapes:

* Feed the mirror from `useQuiz`'s result in an effect, and have `markedChange` wait one render
  (or for the next reading of the quiz whose `_id` set includes the change) before flushing. The
  watches, `follow`, `note` and the `last` bookkeeping all go.
* Or keep the watches but derive them from `useQuiz` rather than duplicating its logic: expose
  the watch handles from `useQuiz`.

Either way `useHunt` drops from four concerns to two.

## 4. Three registries of "a write is in flight"

`use-hunt.ts` keeps a module-level `Writing.count` for `beforeunload`, a React `writing` state
for `unsaved`, and `quiz-mirror.ts` keeps a `writing` set for `writesLanded()`. One registry
(the set) could answer all three: `unsaved` is "the set is non-empty", `beforeunload` is armed
while it is, and `writesLanded` awaits it. Lives beside the dispatcher, in `src/state/`.

## 5. State set during render

`useHunt` (`shown`, the quiz last found at an address) and `useQuiz` (`held`, the quiz last read
whole) both set state during render, React's sanctioned but subtle "adjust state on a prop
change" pattern. Each is there so a value survives a moment of absence: a relabel, a question
still on its way. Both read more plainly as a `useRef` updated in an effect, or as a small
reducer keyed on the address. Worth doing when item 3 is done, since the hooks are being opened
anyway.

## 6. `Sync` is Jazz's word

`SyncProvider`, `SyncNotices.tsx`, `SyncUnconfigured` and the `(synced)` route group all say
"sync", which named Jazz's server. Convex's word is the deployment. Suggest: `ConvexProvider`
is taken by Convex itself, so `DeploymentProvider` / `(deployment)` / `DeploymentNotices` /
`DeploymentUnconfigured`, or simply `Backend*`. A rename with no behaviour change; e2e specs
that locate by text are unaffected (the notices' words stay).

## 7. Quiz state fields on the row the listing reads

Not a view, but felt in the views: a quiz row carries `locked`, `last_sortkey`,
`bulk_ishes_last` and `row_ordering` beside its label and title, so every sort, lock and
recalculation reruns the hunt listing's watch for every browser (about 10 KiB read, nothing
sent when unchanged). A `quiz_state` row of its own, read only by the quiz's frame, would spare
the listing. Measure before doing it; it is a schema change, and the progress document already
records the Coach's choice to leave it for now.
