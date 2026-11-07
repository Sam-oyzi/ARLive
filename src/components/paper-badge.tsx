// What a page can do (Scan, Step inside, Look around, Place model), as a little tag cut from paper and
// set on the page: a cream front with a faint grain and hand-cut corners, a coloured sheet tucked
// underneath at an angle, soft shadows so it stands up off the paper, and the book's own type. The
// colours are watercolour tones from the stories, not interface blue. Used by the reader, the home
// page and the book page, so a badge looks the same wherever it is explained.
import { Box, Orbit, ScanLine, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type PaperBadgeKind = "scan" | "inside" | "panorama" | "model";

const KINDS: Record<PaperBadgeKind, { tone: string; icon: LucideIcon }> = {
  scan: { tone: "#5b4636", icon: ScanLine },
  inside: { tone: "#4f8576", icon: Orbit },
  panorama: { tone: "#4f86ad", icon: Orbit },
  model: { tone: "#c06a43", icon: Box },
};

const PAPER = "#fbf5e8";
const INK = "#3b2a1c";
// A faint paper grain, drawn by the browser (no image to download).
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .42 0 0 0 0 .33 0 0 0 0 .2 0 0 0 .11 0'/%3E%3C/filter%3E%3Crect width='90' height='90' filter='url(%23g)'/%3E%3C/svg%3E\")";
// Corners cut by hand: no two quite alike.
const CUT = "11px 14px 10px 13px / 13px 10px 14px 11px";

const SIZES = {
  xs: { front: "gap-0.5 py-px pr-1.5 pl-px", dot: "size-3.5", icon: "size-2", text: "text-[9px]", lift: 1.5 },
  sm: { front: "gap-1 py-px pr-1.5 pl-px", dot: "size-4", icon: "size-2.5", text: "text-[10.5px]", lift: 2 },
  md: { front: "gap-1.5 py-0.5 pr-2 pl-0.5", dot: "size-5", icon: "size-3", text: "text-[12px]", lift: 2 },
  lg: { front: "gap-2 py-1 pr-3 pl-1", dot: "size-7", icon: "size-4", text: "text-[15px]", lift: 3 },
} as const;

export function PaperBadge({
  kind,
  label,
  size = "md",
  tilt = 0,
  lang,
  className,
}: {
  kind: PaperBadgeKind;
  label: string;
  size?: keyof typeof SIZES;
  /** Degrees: set a little askew, the way a paper tag sits on a page. */
  tilt?: number;
  /** The label's language, so it reads the right way round (Arabic) and is spoken right. */
  lang?: string;
  className?: string;
}) {
  const { tone, icon: Icon } = KINDS[kind];
  const s = SIZES[size];
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ rotate: `${tilt}deg` } as CSSProperties}>
      {/* One coloured sheet underneath, showing only as a thin edge: enough to read as cut paper
          without covering more of the picture than the tag itself. */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: tone,
          borderRadius: CUT,
          transform: `translate(${s.lift * 0.5}px, ${s.lift * 0.7}px) rotate(${tilt >= 0 ? 1.5 : -1.5}deg)`,
        }}
      />
      <span
        className={cn("relative flex items-center leading-none font-bold whitespace-nowrap", s.front, s.text)}
        style={{
          // A little see-through, like thin paper, so the sketch underneath still shows.
          background: `${GRAIN}, linear-gradient(170deg, rgb(255 250 240 / 0.88), rgb(251 245 232 / 0.82))`,
          borderRadius: CUT,
          color: INK,
          fontFamily: "var(--font-story), Georgia, serif",
          // Lit from above: a bright top edge and a light shadow, just lifted off the page.
          boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.7), 0 1px 2px rgb(60 40 20 / 0.22)`,
        }}
      >
        <span
          className={cn("grid shrink-0 place-items-center rounded-full", s.dot)}
          style={{ background: tone, color: PAPER, boxShadow: "inset 0 -1px 0 rgb(0 0 0 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.25)" }}
        >
          <Icon aria-hidden="true" className={s.icon} strokeWidth={2.4} />
        </span>
        <bdi lang={lang}>{label}</bdi>
      </span>
    </span>
  );
}
