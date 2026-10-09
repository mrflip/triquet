# Thread 3: measurements of the specs' new way in (2026-10-09)

The detail behind the summary in `thread-3-e2e_fixtures.md`. Read it to compare a later thread's
numbers for `routing`, `reviews` or `categories`.

Test-seconds from the run's JSON report, summed per spec. Each pair ran back to back on lane 3:
first the base's specs and support, then this branch's. The load came from the other lanes and
swung from 12 to 36.

| Pair, load | routing (48 tests) | reviews (8) | categories (8) | Failures |
|---|---|---|---|---|
| 1, before (load 12) | 358 s, mean 7.5 | 94 s, mean 11.8 | 47 s | 2 timed out |
| 1, after (load 24) | 254 s, mean 5.3 | 124 s, mean 15.5 | 47 s | none |
| 2, before (load 36) | 298 s, mean 6.2 | 83 s, mean 10.4 | 35 s | 1 timed out |
| 2, after (load 33) | 250 s, mean 5.2 | 53 s, mean 6.6 | 33 s | none |

The fairest pair is pair 2, at about the same load: **routing down 16%, reviews down 36%**.
`routing` alone at load 18 took 187 test-seconds, against 488 for the base alone, but the base ran
at load 10 rising to 43, so that is no fair comparison. The run's wall time for the three specs
fell from 78 to 70 s in pair 2. Pair 1's reviews number is inflated:
that run's two-visitor tests all landed together at the load's peak (10 to 15 s each).

The gain is smaller than the way in alone would suggest. About twenty of routing's tests are
about the front door or the hunts list and keep it. Each moved test saves the front door and the
hunts list (about 2 s) and, with a friend, a second front door and the Members panel (about 2 s
more). The base's reviews and routing timed out three times in two runs under load. This
branch's never did, in six.

A temporary probe in `support.ts`, taken out again, timed the teardown's wait for a page's token
exchange (`sessionLeftBy`): 2 to 200 ms over 30 teardowns, so the guard costs nothing measurable.
