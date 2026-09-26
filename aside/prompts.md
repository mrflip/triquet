Outline a plan for Opus to migrate the project to use Jazz v2. (In stack.md, please record that turso is out because there were concerns about concurrent access across tabs, and the conflict resolution of last-push-wins in some cases). Don't yet write code, but please update docs where needed -- re-read them first, as they may have changed.

Unless you advise otherwise, this would not retain the current database, and presumably not retain drizzle or drizzle-zod.
From biggest to least: I *do* want to have zod validators; I *do* want a single source of truth for the schema; I *do* want to go with the grain of jazz. Let me know if those conflict.
I'm aware of the jazz trial limitations.

Currently models have/will ahve these separate pieces: 1) that part of the jazz schema, 2) WidgetValidators; 3) exporting various typedefs (`export type WidgetT = Z.output<...>`); 4) the class, with its `declare` lines and functionality.


* **Phases 1 and 2 (schema, permissions, the write side): Opus 5.5**,
  and the *same* model for both phases, one session each if possible. These are the two places
  where the work is against an alpha API newer than training, and where the judgement calls
  (enum cases vs nullable columns, what `.transform()` should carry, how an action maps to rows)
  propagate into every later file.
* **Phase 0 spikes and phase 3's deletions, dependency removal and e2e re-pointing: Opus 5.5 in plan mode**
  Mechanical, well-specified, and the checks (`lint`, `typecheck`, `test`) catch mistakes.
* **Test porting in phase 2 and 3: Sonnet 5, in parallel**, after the schema and the first two
  actions have landed as the pattern to copy.
* **Phases 4 and 5: any.**
*
## **Expand**:

Yes add the architecture section. Don't yet put work into describing the data flow, I want to talk about that.  Write the vocabulary list -- I'm curious how well it's grokked. I pulled the stuff about live() out. Please write out the patch pattern section. I am pretty sure I do want the tests you described, will add a work thread on that

## **Contract**

1. Style naming tags: leave those for the moment, I'll curate later.
2. I addressed the mechanically enforce, relocated features-v1
3. on HUMANS-whatsup.md -- I've added this to the top of the Humans file; also add it into the right guidance docs (probably at shorter length):

```
      # THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
      It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
      Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

      ## 2026-09-19: Reviewed Changes

      Coach has swept changes into future documents
```

## Refine:

Make the changes you describe in "Refine (bugs in the docs).", apart from or noting the following:
* `CLAUDE.md says "secret or secret"` -- should have been 'secret' or 'secrets'; I fixed it.
* Pull graphql from stack. make the other changes you describe to stack.md
* The thing in AGENTS.md is added by some machinery in nextjs. They must think it helps. leave for now.

## Architectural:

* `Server Components for anything that touches user data" is followed nowhere`: we will discuss more
* database, sync, etc. let's discuss more in a bit.
* I will work on validators with another agent.
* e2e testing, let's discuss more in a bit.
* I will work on the MUI First list with another agent, good job.
* fix stuff in **Dead scaffold**, **Bare name**, **test path parity**, **progress notes int code**, **Direct zod imports outside models**
  - The zod patch is very purposeful, and I understand the implications. Add a statement in the right place in the guidance docs. Do not change the patch.

1. Git repo: the git repo is not a source of truth or anything else. it exists because it's the best interface I know of for carefully reviewing diffs in text data. With it, I can look back at how I had the puzzle arranged at any point in time and extract changes. one would also, as a potential new adopter, know they could try this tool out and if they hit a limit have the most fantastic exit experience possible; the overlap of "people designing puzzle hunts" and "people who also use git" is large. So think of it as a weird way to design a "past versions" view, or an export tool, with a lot of side benefirts.
2. JSONata. as I understand it, the new version is pure async, meaning that there will be flashes of content: the design contemplates having each widget able to act on data of everything before it in one pass of the stack. The easy fix is to cache everything on write; that caching hasn't been written yet. LMK if I'm wrong about any of what I just wrote, I might well be.
* **"within the agent's training cutoff" test.** -- see above; leave it be.
  * otherwise, proceed as proposed for stack.md

Execute the above, I have to get some rest. Other than that, our TODO:
1. discuss databases
2. discuss e2e testing
3. discuss Server Components for anything that touches user data
4. discuss why there wouldn't be .tsx or use- tests; I will use a different session to develop them however.
5. discuss lightning-fs vs opfs

...and my todo with a coding agent:
1. validators duplicate implementation
2. MUI First list
