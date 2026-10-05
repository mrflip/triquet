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
