# The cloud, measured (2026-09-28)

Phase 3b of the move to Convex asked for phase 4's numbers again once the app was in
the cloud. Production is at `triquet.vercel.app`; these are its numbers beside a local backend's.
The full tables are in `notes/decisions/20260928-database-decisions.md` (*Measured in the cloud*).

## How

`scripts/measure-latency.ts` (its doc block says how to run it). It says who it is, makes a hunt,
brings in the 20-question quiz from `notes/example-quiz.json` through the Import box, and makes 56
edits of six kinds while a second browser watches. Each wait is timed in the page, from the
author's key, click or blur to the first frame showing the result. Two runs against production,
and two against the agents' production build on a local backend. The local numbers land within a
few ms of phase 4's, so this table compares directly with the one recorded then.

| Median wait (ms) | Local | Cloud |
|---|---|---|
| Reorder (arrow key) | 86 | **233** |
| Four quick presses, after the last | 171 | **420** |
| Lock or unlock | 74 | 188 |
| Add a question | 93 | 232 |
| A text commit, until saved | 58 | 149 |
| Sort by a column | 149 | **401** |
| The quiz on screen, fresh tab | 232 | 588 |

* **Where a reorder's wait goes**: about 35 ms of network, about 60 ms for the cloud to run and
  commit the mutation, then about 135 ms until the redelivered queries are on screen.
* **The watching browser** sees each change within 10 ms of the author.
* **Bandwidth does not change**: each browser downloads about 9 KiB per edit, in the cloud or
  locally.
* **Close to a best case**: a request to the deployment over a warm connection takes 28 to 45 ms
  from the machine these ran on (Cloudflare's Boston edge). An author farther away pays the extra
  distance on every edit.

## What it means

The verdict set a line: add an optimistic `move_question` once a reorder passes 150 ms. At 233
ms it has, and four quick presses take over 400. A sort is the next candidate. A text commit
needs nothing, since the author's text is on screen as they type it.

## Still open

* **Database I/O and function calls** in the cloud show only on the Convex dashboard's usage
  page; agents hold no production key. The runs were 19:17 to 19:28 UTC, about 200 mutations,
  and a one-round check of the script at 21:04.
* **The optimistic update** waits on the Coach's word.
