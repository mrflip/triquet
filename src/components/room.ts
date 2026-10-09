/**
 * An `sx` fragment that keeps an element out of a row until the box measuring it is `room` wide,
 * in MUI's container-query shorthand (`'@620'`): the box wears `containerType: 'inline-size'`,
 * and the view names its widths in a `RoomFor` constant beside it. Both values are given, since a
 * container-query value of `undefined` does not restore the base one.
 *
 * @example <Box sx={{ ...hiddenUntil(RoomFor.label), width: 160 }}>{column.label}</Box>
 */
export function hiddenUntil(room: `@${string}`) {
  return { display: { '@': 'none', [room]: 'block' } }
}

/**
 * The slots at the head of a column's row and a widgeting's row, as `sx` fragments, each the same
 * width whatever it holds, so that rows of either kind line up one beneath another: the grip a row
 * is dragged by (or a blank as wide, for a row that is not dragged), its fold triangle, its title
 * block (a column's title field, a widgeting's mark and labels: one width for both, narrower in a
 * narrow box), and a widgeting's tier. The box measuring them wears `containerType: 'inline-size'`.
 *
 * @example <Box sx={RowSlots.grip}>{handle}</Box>
 */
export const RowSlots = {
  grip:  { width: 16, flexShrink: 0, pt: 1, textAlign: 'center' },
  fold:  { width: 24, flexShrink: 0, pt: 0.5 },
  title: { width: { '@': 150, '@560': 260 }, flexShrink: 0 },
  tier:  { width: 112, flexShrink: 0 },
} as const
