# 2026-10-04: Categories thread 4 -- chart colours that are not the brand's swatches, and Recharts installed

* **Two new palette tokens, `seriesA` and `seriesB`** (`src/app/palette.ts`), for a chart's
  lines: the brand's purple and verdigris made vivid enough to chart (light `#614092` and
  `#008c7a`, dark `#9274c3` and `#37a69a`). The theme's own `primary`/`secondary` failed the
  dataviz validator. In dark mode, bermuda and the lifted verdigris are indistinguishable to a
  deuteranope (ΔE 3.1), and every brand accent reads as grey on a chart (OKLCH chroma under 0.10).
  The new pair passes every check in both modes. Say if you would rather the brand bend
  differently.
* **Recharts 3.10 is in `package.json`**, per the plan's YOLO decision 6 and listed in
  `notes/stack.md`. `@mui/x-charts` stays the alternative. Only `SpreadPanel.tsx` imports
  Recharts, so swapping is a one-file change if you prefer MUI's.
