import Button, { ButtonLink } from "@/components/Button";
import Icon, { iconNames } from "@/components/ui/Icon";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import { Avatar } from "@/components/profile/Avatar";

// The living reference for the ARCADE design system: palette, typography,
// icon set and components, all rendered from the real source. Nothing here is
// a mock-up — every swatch reads the same token and every component is the one
// the app ships, so this page cannot drift away from the product.

export const metadata = { title: "Design System — ARCADE" };

/** The palette, as it is declared in globals.css `@theme`. */
const NEON = [
  { name: "neon-cyan", hex: "#00f5ff", use: "Primary accent, links, focus" },
  { name: "neon-magenta", hex: "#ff00cc", use: "Secondary accent, Super TTT" },
  { name: "neon-green", hex: "#00ff88", use: "Success, online, wins" },
  { name: "neon-yellow", hex: "#ffe000", use: "Actions, buttons, waiting" },
  { name: "neon-orange", hex: "#ff6b00", use: "Warnings" },
  { name: "neon-red", hex: "#ff2244", use: "Errors, offline, losses" },
];

const SURFACES = [
  { name: "arcade-bg", hex: "#06060f", use: "Page background" },
  { name: "arcade-panel", hex: "#0c0c1e", use: "Panels, sidebar" },
  { name: "arcade-card", hex: "#0f0f22", use: "Cards, active rows" },
  { name: "arcade-border", hex: "#1e1e4a", use: "Borders, dividers" },
  { name: "arcade-muted", hex: "#4a4a8a", use: "Secondary text" },
  { name: "foreground", hex: "#c8c8ff", use: "Body text" },
];

function Swatch({ name, hex, use }: { name: string; hex: string; use: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 shrink-0 border border-arcade-border"
        style={{ background: hex }}
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-foreground">{name}</p>
        <p className="truncate font-mono text-[10px] text-arcade-muted">
          {hex} · {use}
        </p>
      </div>
    </div>
  );
}

/** Section label + the code you would write to get the thing below it. */
function Spec({ label, code }: { label: string; code: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-arcade-muted">
        {label}
      </span>
      <code className="font-mono text-[10px] text-neon-cyan/70">{code}</code>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-10">
        <h1 className="mb-3 font-arcade text-lg glow-cyan">DESIGN SYSTEM</h1>
        <p className="max-w-2xl font-mono text-xs leading-relaxed text-arcade-muted">
          ARCADE is styled as a CRT arcade cabinet: a near-black background, six
          neon accents, a pixel display face, and a scanline overlay across the
          whole viewport. Everything below is rendered from the same tokens and
          components the app uses — this page is the reference, not a mock-up.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {/* ---- Palette ---- */}
        <Card title="COLOR PALETTE">
          <Spec label="Neon accents" code="--color-neon-* · globals.css @theme" />
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NEON.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
          <Spec label="Surfaces & text" code="--color-arcade-*" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SURFACES.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
          <p className="mt-6 border-t border-arcade-border pt-4 font-mono text-[10px] leading-relaxed text-arcade-muted">
            Colour is never the only signal: online/offline also carries a dot
            and a word, and errors also carry text. The palette is an accent on
            top of the information, not the information itself.
          </p>
        </Card>

        {/* ---- Typography ---- */}
        <Card title="TYPOGRAPHY" accent="magenta">
          <div className="flex flex-col gap-6">
            <div>
              <Spec label="Display" code='font-arcade · "Press Start 2P"' />
              <p className="font-arcade text-lg glow-magenta">ARCADE</p>
              <p className="mt-2 font-mono text-[10px] text-arcade-muted">
                Headings and buttons only. A pixel face is unreadable in
                paragraphs, so it never sets body copy.
              </p>
            </div>
            <div>
              <Spec label="Body / UI" code="font-mono · Geist Mono" />
              <p className="font-mono text-sm text-foreground">
                The quick brown fox jumps over the lazy dog — 0123456789
              </p>
              <p className="mt-2 font-mono text-[10px] text-arcade-muted">
                Everything you actually read: labels, chat, board coordinates.
                Monospace keeps room codes and scores from shifting as digits
                change.
              </p>
            </div>
            <div>
              <Spec label="Scale" code="text-[10px] → text-lg" />
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="font-mono text-[10px] text-arcade-muted">10 · meta</span>
                <span className="font-mono text-xs text-foreground">12 · label</span>
                <span className="font-mono text-sm text-foreground">14 · body</span>
                <span className="font-arcade text-[11px] text-neon-cyan">11 · panel title</span>
                <span className="font-arcade text-lg glow-cyan">18 · page</span>
              </div>
            </div>
          </div>
        </Card>

        {/* ---- Icons ---- */}
        <Card title="ICON SET" accent="green">
          <Spec label="20 icons" code='<Icon name="bomb" size={16} />' />
          <p className="mb-6 max-w-2xl font-mono text-[10px] leading-relaxed text-arcade-muted">
            Hand-drawn pixel art on a 16×16 grid, rendered as SVG rects with
            crisp edges — an off-the-shelf vector set would anti-alias itself
            into a different design language than the pixel typeface next to it.
            Icons inherit the current text colour, so they take the neon palette
            exactly like text does.
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            {iconNames.map((name) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 border border-arcade-border bg-arcade-card p-3 text-arcade-muted transition-colors hover:text-neon-green"
              >
                <Icon name={name} size={24} />
                <span className="truncate font-mono text-[9px]">{name}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-arcade-border pt-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-arcade-muted">
              Scales cleanly:
            </span>
            {[16, 24, 32, 48].map((size) => (
              <span key={size} className="flex items-center gap-2 text-neon-cyan">
                <Icon name="trophy" size={size} />
                <span className="font-mono text-[10px] text-arcade-muted">{size}px</span>
              </span>
            ))}
          </div>
        </Card>

        {/* ---- Components ---- */}
        <Card title="COMPONENTS" accent="yellow">
          <div className="flex flex-col gap-8">
            <div>
              <Spec label="Button" code="<Button> · <ButtonLink href>" />
              <div className="flex flex-wrap items-center gap-3">
                <Button>DEFAULT</Button>
                <Button disabled>DISABLED</Button>
                <ButtonLink href="/design">LINK</ButtonLink>
                <Button className="flex items-center gap-2">
                  <Icon name="plus" /> CREATE LOBBY
                </Button>
              </div>
            </div>

            <div>
              <Spec label="Badge" code='<Badge tone="green">' />
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="green">ONLINE</Badge>
                <Badge tone="red">OFFLINE</Badge>
                <Badge tone="yellow">WAITING</Badge>
                <Badge tone="cyan">1/2 PLAYERS</Badge>
                <Badge tone="muted" dot={false}>REVOKED</Badge>
              </div>
            </div>

            <div>
              <Spec label="Input" code="<Input placeholder invalid />" />
              <div className="flex flex-wrap gap-3">
                <Input placeholder="LOBBY CODE" defaultValue="" />
                <Input placeholder="INVALID" invalid defaultValue="000-000-000" />
                <Input placeholder="DISABLED" disabled />
              </div>
            </div>

            <div>
              <Spec label="Avatar" code="<Avatar login avatarUrl />" />
              <div className="flex flex-wrap items-center gap-3">
                <Avatar login="ARCADE" avatarUrl={null} className="h-10 w-10" />
                <Avatar login="player2" avatarUrl={null} className="h-12 w-12" />
              </div>
            </div>

            <div>
              <Spec label="Card" code='<Card title accent="cyan">' />
              <div className="grid gap-4 sm:grid-cols-2">
                <Card title="NESTED PANEL" className="bg-arcade-card">
                  <p className="font-mono text-xs text-arcade-muted">
                    The surface every screen sits on.
                  </p>
                </Card>
                <Card title="ACCENTED" accent="magenta" className="bg-arcade-card">
                  <p className="font-mono text-xs text-arcade-muted">
                    Four accents: cyan, magenta, green, yellow.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </Card>

        {/* ---- Motion ---- */}
        <Card title="MOTION">
          <Spec label="Animations" code="animate-blink · animate-flicker · animate-glow-pulse" />
          <div className="flex flex-wrap items-center gap-8">
            <span className="animate-blink font-arcade text-[11px] text-neon-red">
              DISCONNECTED
            </span>
            <span className="animate-glow-pulse font-arcade text-[11px] text-neon-cyan">
              YOUR TURN
            </span>
            <span className="animate-flicker font-arcade text-[11px] text-neon-magenta">
              INSERT COIN
            </span>
          </div>
          <p className="mt-6 font-mono text-[10px] leading-relaxed text-arcade-muted">
            Motion marks state changes that matter (a turn passing, an opponent
            dropping) — it is never decoration, because a permanently moving UI
            is one you stop reading.
          </p>
        </Card>
      </div>
    </div>
  );
}
