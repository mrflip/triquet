# THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

## 2026-09-20: Guidance-doc review, swept in

Docs and small code fixes from the review of `CLAUDE.md`, `stack.md` and `guidelines.md`. Nothing
committed. Lint, typecheck and unit tests pass; e2e not run (no UI or route behaviour changed).

**Judgement calls you may want to overturn**

* **`stack.md` is now a lookup table.** The long drag-and-drop and routing write-ups moved to
  `notes/decisions/`; each leaves a short pointer carrying its rules. The grid entry stayed
  whole under *Hand-rolled on purpose*, since agents need to meet it.
* **Hand-rolling decisions are now recorded in `stack.md`**, not here, to match this file no
  longer being input. `CLAUDE.md`'s Library-first step 3 says so.
* **I left the lines under discussion alone** (Server Components, "thin" Playwright, Turso local
  mode) and listed them under *Open with a Coach* in `stack.md`, with a note not to "fix" the
  code toward them meanwhile.
* **"Direct zod imports" turned out to be two real ones.** `db/client.ts` and the ask route built
  schemas from raw `Z`; both now use the kit. The rest import `zod` for types only, which
  `guidelines.md` now says is fine. I did not touch the two-kits duplication.
* **`.describe()` strings**: I left them. They read as the information dumps guidelines bans from
  doc blocks, but they feed the JSON Schema and the chatbot prompt. Worth one sentence in
  guidelines saying which they are.
* **`downloading.ts` is tested against a stubbed `document`**, the first test here to fake the
  DOM. Fine for six lines; not a pattern to grow before the component-testing thread decides.

**Noticed, not acted on**

* `notes/testing.md` still says "Sketch/DNA/Real/Live"; guidelines no longer defines those
  phases. I reworded the `CLAUDE.md` pointer and left `testing.md`'s sentence for you.
* `models/player.ts` imports the `players` table from `db/schema` (for `drizzle-zod`): the one
  place a model reaches up into `db`. Client code only takes types from it, and
  `models/player-label.ts` exists so it never needs more. Recorded in `CLAUDE.md`'s architecture
  section as the sanctioned exception.
* `lib/vv/kit.ts` cites `whiteboard/vv.md` in a doc block. Left for the validators thread.
* `notes/prior-work/202609-prompts.md` held a copy of `src/lib/ask/prompts.ts` when I first read
  it, not prompts. It has changed since; I did not re-read it.
* `quizgit.ts`'s path doc block describes "a hierarchy that does not exist yet". A design
  reason rather than a progress note, so it stayed.

## 2026-09-19: Reviewed Changes

Coach has swept changes into future documents