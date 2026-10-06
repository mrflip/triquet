# Thread 2: measurements of the fast way in (2026-10-06)

The detail behind the summary in `thread-2-e2e_fast_way_in.md`: every full run, the way in timed
part by part, and why the targets were missed. Read it to compare a later thread's numbers, or
before working on the way in again.

Test-seconds are summed from each run's JSON report. The load on this machine swung from 3 to 44
while I measured, and test-seconds follow the load closely. So the fair comparison is the pair I
ran back to back, at the same load, on this lane: thread 1's top, then this branch.

| | Tests | Test-seconds | Mean | Wall | Load |
|---|---|---|---|---|---|
| Before, thread 1's proving run | 239 | 942 | 3.9 s | 149 s | 3.2 to 10.6 |
| Before, back to back (11038c3) | 239 | 1148 | 4.8 s | 179 s | 8.7 to 28 |
| After, back to back | 239 | 846 | 3.5 s | 137 s | 28 to 26 |
| After, the quietest run | 239 | 762 | 3.2 s | 121 s | 2.7 to 25 |
| After, the proving run | 239 | 1039 | 4.3 s | 165 s | 27.6 to 33 |

So at equal load: **about 26% fewer test-seconds and 23% less wall time.** The build cache was
warm or seeded throughout.

**Peak memory: unchanged, about 355 MB both before and after.** The container has no
`/usr/bin/time`, so this is `getrusage(RUSAGE_CHILDREN).ru_maxrss` around the run. That is the
largest single process in the run's tree, most likely the Next dev server, not the sum of all of
them.

**Neither target is met.**

* **The way in takes about 1.3 to 1.4 s, not under one second.** I timed its parts by hand, with
  instrumentation I took out again:
  * `makeHunt` takes about 0.1 s.
  * Loading the quiz's page under the dev server takes about 0.8 s. Waiting only for the first
    response saves nothing: the time just moves to the grid wait.
  * The grid then takes about 0.55 s to appear. The page waits for its session, then the ident,
    then the hunt, one after another.

  What is left is the quiz page's own first load. The way in cannot shorten it, and the dev server
  stays.
* **The mean test takes 3.2 s at its quietest, not 2.5 s.** The rest is in the test bodies and in
  the specs that are about the way in. Some of those I left alone (see *For the Coach*):
  * `routing` has 44 tests averaging 4.4 s, and walks the front door on purpose.
  * `widgets` has 36 tests, and is about the gear.
  * `reviews` averages 7.5 s: the reviewer's front door.
