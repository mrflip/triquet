# Drag and drop between places: the board beside the list

October 2026, the categories sprint's first thread (`whiteboard/20261004-categories/`). Extends
the September decision to use Pragmatic drag-and-drop for every drag
(`notes/decisions/2026-09-drag-and-drop.md`); nothing here reopens it.

## What changed

Until now every drag in the app was a list reordered by its grips, and `useReorderable` was the
only place Pragmatic was wired up. The category wheel is not a list: a category is dragged from
one slot of a ring to another, into a pool beside it, and back. The ring has no "between": a
category lands *in* a slot, and what was there swaps out.

So `src/components/use-reorder.ts` now holds a second shape beside the list, a **board**:

* `usePlace` -- a place a piece can be dropped on (an empty slot, the pool).
* `usePiece` -- a piece that is dragged, and is itself the place it sits in, so a piece dropped
  on another lands where that one sits. Its key handler sends it to the place a key names.

Both are Pragmatic's `draggable` and `dropTargetForElements`, as the list's are. Neither knows
what a drop means: the caller is told which piece went to which place, by a drop or by a key,
and hands back the new arrangement. For the wheel, `lib/wheel.ts` says what a move does (swap;
a piece from the pool sends the occupant to the pool; into the pool, the slot is emptied), and
it is tested there, apart from any drag.

## Rules carried over

* Pragmatic only through `use-reorder.ts`; still no `-react-drop-indicator`.
* Nothing moves until the drop, and what is on screen is what is held. The wheel shows a move at
  once by an optimistic update of the watched hunt (`showArranged` in `state/use-categories.ts`),
  never by keeping a second copy of the arrangement in the view.
* Every piece answers the keys, as every grip does. On the wheel the arrow keys move a focused
  tile round the ring, Delete or Backspace send it to the pool, and Enter or Space bring a pool
  tile to the first empty slot. A tile moved by a key keeps the focus, though it is drawn anew
  in its new place; the wheel finds it again by the category it carries.
* The whole piece is the draggable, not a grip within it: a tile is small enough to make a good
  drag preview, which a two-thousand-pixel question row is not.

## Testing

As for the list: Chromium under Playwright begins no native drag from a mouse press, so
`e2e/categories.spec.ts` sends the drag's events directly (`dropOn`), and proves the board
rearranges on them. The keys are pressed for real.
