/**
 * ARCADE icon set — hand-drawn pixel art.
 *
 * Every icon is a list of `[x, y, w, h]` rectangles on a 16×16 grid, rendered
 * as `<rect>`s with `shapeRendering="crispEdges"`. That is deliberate: the
 * design language is a CRT arcade cabinet (Press Start 2P, scanline overlay),
 * and smooth anti-aliased vector icons from an off-the-shelf set look plainly
 * foreign next to a pixel typeface. Drawing on a grid keeps the icons in the
 * same visual vocabulary as the rest of the UI at any size.
 *
 * Icons inherit the surrounding text colour via `fill="currentColor"`, so they
 * pick up the neon palette (`text-neon-cyan`, `text-arcade-muted`, …) exactly
 * like text does — no per-icon colour props to keep in sync.
 *
 * Adding an icon: draw it as rects on the 16×16 grid and add it to ICONS. The
 * `IconName` union updates itself, so every call site is type-checked.
 */

/** A pixel rectangle: [x, y, width, height] on the 16×16 grid. */
type Rect = readonly [number, number, number, number];

const ICONS = {
  /** House — the Home nav item. */
  home: [
    [7, 2, 2, 1], [6, 3, 4, 1], [5, 4, 6, 1], [4, 5, 8, 1], [3, 6, 10, 1],
    [4, 7, 2, 6], [10, 7, 2, 6], // walls
    [6, 7, 4, 1], [6, 12, 4, 1], // lintel + floor
    [6, 8, 1, 4], [9, 8, 1, 4], // door frame (hole between them)
  ],
  /** Game controller — lobbies and game pages. */
  gamepad: [
    [2, 6, 12, 1], [2, 10, 12, 1], [2, 6, 1, 5], [13, 6, 1, 5], // shell
    [4, 8, 3, 1], [5, 7, 1, 3], // d-pad
    [10, 8, 1, 1], [12, 8, 1, 1], // buttons
  ],
  /** Two figures — the Friends section. */
  users: [
    [3, 4, 3, 3], [2, 8, 5, 5],
    [10, 4, 3, 3], [9, 8, 5, 5],
  ],
  /** One figure — profile / account. */
  user: [
    [6, 3, 4, 4],
    [4, 8, 8, 5],
  ],
  /** Speech bubble — chat. */
  chat: [
    [3, 3, 10, 1], [3, 9, 10, 1], [3, 3, 1, 7], [12, 3, 1, 7], // bubble
    [5, 10, 2, 1], [5, 11, 1, 1], // tail
    [5, 6, 1, 1], [7, 6, 1, 1], [9, 6, 1, 1], // ellipsis
  ],
  /** Gear — settings. */
  settings: [
    [4, 4, 8, 2], [4, 10, 8, 2], [4, 4, 2, 8], [10, 4, 2, 8], // ring (hole inside)
    [7, 2, 2, 2], [7, 12, 2, 2], [2, 7, 2, 2], [12, 7, 2, 2], // teeth
  ],
  /** Door with an outbound arrow — log out. */
  logout: [
    [2, 2, 2, 12], [4, 2, 3, 1], [4, 13, 3, 1], // door frame
    [7, 7, 4, 2], // shaft
    [11, 6, 1, 4], [12, 7, 1, 2], // arrowhead
  ],
  /** Plus — create / add. */
  plus: [
    [7, 3, 2, 10], [3, 7, 10, 2],
  ],
  /** X — close / dismiss. */
  close: [
    [3, 3, 2, 2], [5, 5, 2, 2], [7, 7, 2, 2], [9, 9, 2, 2], [11, 11, 2, 2],
    [11, 3, 2, 2], [9, 5, 2, 2], [5, 9, 2, 2], [3, 11, 2, 2],
  ],
  /** Tick — success / confirm. Blocks step by 1 (not 2) so the stroke stays
   *  connected instead of reading as loose diagonal dots. */
  check: [
    [3, 7, 2, 2], [4, 8, 2, 2], [5, 9, 2, 2], [6, 10, 2, 2], // short arm, down
    [7, 9, 2, 2], [8, 8, 2, 2], [9, 7, 2, 2],
    [10, 6, 2, 2], [11, 5, 2, 2], [12, 4, 2, 2], // long arm, up
  ],
  /** Magnifier — search / filter. */
  search: [
    [4, 2, 5, 1], [4, 8, 5, 1], [3, 3, 1, 5], [9, 3, 1, 5], // lens (square-ish)
    [10, 9, 2, 2], [12, 11, 2, 2], // handle
  ],
  /** Cup — leaderboards / wins. */
  trophy: [
    [4, 2, 8, 2], [5, 4, 6, 3], [6, 7, 4, 1], // bowl
    [2, 3, 2, 3], [12, 3, 2, 3], // handles
    [7, 8, 2, 3], [5, 11, 6, 2], // stem + base
  ],
  /** Bell — notifications. */
  bell: [
    [6, 2, 4, 2], [5, 4, 6, 4], [4, 8, 8, 2], [3, 10, 10, 1],
    [7, 12, 2, 2], // clapper
  ],
  /** Key — API keys. */
  key: [
    [2, 4, 7, 1], [2, 10, 7, 1], [2, 4, 1, 7], [8, 4, 1, 7], // bow (hole inside)
    [9, 6, 5, 2], // shaft, centred on the bow
    [11, 8, 1, 2], [13, 8, 1, 2], // teeth
  ],
  /** Bomb — minesweeper. */
  bomb: [
    [5, 6, 6, 1], [4, 7, 8, 5], [5, 12, 6, 1], // body
    [7, 4, 2, 2], // cap
    [9, 3, 1, 1], [10, 2, 1, 1], // fuse
  ],
  /** Flag — minesweeper marks. */
  flag: [
    [4, 2, 1, 11], // pole
    [5, 3, 6, 1], [5, 4, 5, 1], [5, 5, 4, 1], [5, 6, 3, 1], // pennant
    [2, 13, 9, 1], // ground
  ],
  /** Noughts-and-crosses grid — super tic-tac-toe. */
  grid: [
    [5, 2, 1, 12], [10, 2, 1, 12],
    [2, 5, 12, 1], [2, 10, 12, 1],
  ],
  /** Chevron — "go", disclosure, next. */
  chevron: [
    [5, 3, 2, 2], [7, 5, 2, 2], [9, 7, 2, 2], [7, 9, 2, 2], [5, 11, 2, 2],
  ],
  /** Two sheets — copy to clipboard (room codes, API keys). */
  copy: [
    [3, 2, 7, 1], [3, 2, 1, 8], [3, 9, 4, 1], // sheet behind
    [6, 5, 8, 1], [6, 13, 8, 1], [6, 5, 1, 9], [13, 5, 1, 9], // sheet in front
  ],
  /** Bin — delete / revoke. */
  trash: [
    [6, 2, 4, 1], [4, 3, 8, 1], // lid
    [4, 5, 1, 8], [11, 5, 1, 8], [4, 12, 8, 1], // can
    [6, 7, 1, 4], [9, 7, 1, 4], // slots
  ],
} as const satisfies Record<string, readonly Rect[]>;

/** Every icon in the set. Adding to ICONS widens this automatically. */
export type IconName = keyof typeof ICONS;

/** All icon names — used by the design-system page to render the full set. */
export const iconNames = Object.keys(ICONS) as IconName[];

type Props = {
  name: IconName;
  /** Rendered size in px (width and height). Defaults to 16. */
  size?: number;
  className?: string;
  /**
   * Accessible label. Omit for icons that merely decorate adjacent text — the
   * icon is then hidden from screen readers, which would otherwise announce it
   * as a duplicate of the label right next to it.
   */
  title?: string;
};

export default function Icon({ name, size = 16, className = "", title }: Props) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      className={`inline-block shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {ICONS[name].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} />
      ))}
    </svg>
  );
}
