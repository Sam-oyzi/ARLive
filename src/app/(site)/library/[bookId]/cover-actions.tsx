"use client";

// The book cover as a hub: tap it and the book's actions pop out around it as circles (Read just
// below, the others round the sides), so a phone gets every choice in one tap instead of a stack of
// buttons. It works on any screen; phones also get a "Tap the book" hint, since that's where it matters.
import Link from "next/link";
import { BookOpen, Box, Camera, Hand, MoreHorizontal, ShoppingBasket } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import styles from "./cover-actions.module.css";

export type CoverAction = { key: "read" | "model" | "scan" | "buy"; href: string; label: string };

const ICONS: Record<CoverAction["key"], typeof BookOpen> = { read: BookOpen, model: Box, scan: Camera, buy: ShoppingBasket };
/** While the circles are out the cover steps back a little, to give them room on a narrow phone. */
const OPEN_SCALE = 0.92;
/** Anything on the page can open the circles (the "More" button under the description does). */
const OPEN_EVENT = "pagewakes:cover-actions";

type Spot = { x: number; y: number };

export function CoverActions({ actions, title, children }: { actions: CoverAction[]; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();
  // Read first (it gets the place of honour, under the cover), then the rest.
  const ordered = [...actions.filter((a) => a.key === "read"), ...actions.filter((a) => a.key !== "read")];
  const hasRead = ordered[0]?.key === "read";

  useEffect(() => setPortal(document.body), []);

  /** Where each circle lands: round the cover, and always inside the screen with room for its label. */
  const layout = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    // The cover as it will be drawn (stepped back), and how close a circle may come to the screen edge.
    const half = { w: (box.width * OPEN_SCALE) / 2, h: (box.height * OPEN_SCALE) / 2 };
    const edge = 36;
    const reachX = Math.max(40, Math.min(half.w + 34, cx - edge, width - cx - edge));
    const reachY = half.h + 34;
    const clampY = (y: number) => Math.max(edge + 20 - cy, Math.min(height - edge - 34 - cy, y));
    const others = hasRead ? ordered.length - 1 : ordered.length;
    const next: Spot[] = [];
    if (hasRead) next.push({ x: 0, y: clampY(half.h + 36) });
    for (let i = 0; i < others; i++) {
      // Left, (over the top), right: an arch round the upper half of the cover.
      const angle = others === 1 ? Math.PI : Math.PI - (i * Math.PI) / (others - 1);
      const lift = others === 2 ? half.h * 0.15 : 0;
      next.push({ x: Math.cos(angle) * reachX, y: clampY(-Math.sin(angle) * reachY + lift) });
    }
    setSpots(next);
  }, [hasRead, ordered.length]);

  const show = useCallback(() => {
    // A cover half off the screen leaves no room round it: bring all of it into view first.
    const box = wrap.current?.getBoundingClientRect();
    if (box && (box.top < 64 || box.bottom > window.innerHeight - 48)) wrap.current?.scrollIntoView({ block: "center" });
    layout();
    setOpen(true);
    setUsed(true);
  }, [layout]);

  const hide = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus({ preventScroll: true });
  }, []);

  // While open: the page holds still (so the circles stay put), Escape closes, focus starts on Read.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
      if (event.key === "Tab") {
        const items = links.current.filter(Boolean) as HTMLAnchorElement[];
        const at = items.indexOf(document.activeElement as HTMLAnchorElement);
        event.preventDefault();
        items[(at + (event.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      }
    };
    const onResize = () => layout();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    requestAnimationFrame(() => links.current[0]?.focus({ preventScroll: true }));
    return () => {
      root.style.overflow = before;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, hide, layout]);

  // "More" elsewhere on the page: bring the cover into view, then open.
  useEffect(() => {
    const onOpen = () => {
      const el = wrap.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (box.top >= 64 && box.bottom <= window.innerHeight - 48) return show();
      // Open once the scroll has really stopped: the circles are placed from where the cover ends up.
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        window.removeEventListener("scrollend", go);
        // If the smooth scroll never got there (a busy or backgrounded page), jump the rest of the way.
        const now = el.getBoundingClientRect();
        if (now.bottom < 48 || now.top > window.innerHeight - 48) el.scrollIntoView({ block: "center" });
        show();
      };
      window.addEventListener("scrollend", go);
      window.setTimeout(go, 900);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [show]);

  return (
    <div ref={wrap} className={cn("relative", open && "z-[70]")}>
      <div className={cn("rounded-[24px] transition duration-300 sm:rounded-[28px]", open ? "scale-[0.92]" : !used && styles.hintRing)}>
        {children}
      </div>
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? hide() : show())}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={open ? `${title}: put the options away` : `${title}: open the book's options`}
        className="absolute inset-0 cursor-pointer rounded-[24px] outline-offset-4 sm:rounded-[28px]"
      />
      {!open && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center md:hidden">
          <span className="flex items-center gap-1.5 rounded-full bg-ink-950/75 px-3 py-1.5 text-xs font-bold text-white shadow-lift">
            <Hand className="size-3.5" /> Tap the book
          </span>
        </span>
      )}

      {open && portal && createPortal(<div aria-hidden="true" className={cn("fixed inset-0 z-[60] bg-ink-950/60 backdrop-blur-[3px]", styles.scrim)} onClick={() => hide()} />, portal)}

      {open && (
        // Taps pass through to the cover underneath: tapping the book again puts the options away.
        <div id={menuId} role="menu" aria-label={`${title} options`} className="pointer-events-none absolute inset-0">
          {ordered.map((action, i) => {
            const Icon = ICONS[action.key];
            const spot = spots[i] ?? { x: 0, y: 0 };
            const primary = action.key === "read";
            return (
              <Link
                key={action.key}
                ref={(el) => { links.current[i] = el; }}
                href={action.href}
                role="menuitem"
                aria-label={action.label}
                title={action.label}
                onClick={() => hide(false)}
                className={cn(
                  "pointer-events-auto grid size-11 place-items-center rounded-full shadow-[0_6px_16px_-6px_rgb(0_0_0/0.6)] ring-2 outline-none transition hover:scale-105 focus-visible:ring-brand-300",
                  primary ? "bg-brand-600 text-white ring-white/50" : "bg-white text-brand-700 ring-white/60",
                  styles.spot,
                )}
                style={{ "--x": `${spot.x}px`, "--y": `${spot.y}px`, "--delay": `${i * 35}ms` } as CSSProperties}
              >
                <Icon aria-hidden="true" className="size-5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Opens the circles from elsewhere on the page (phones: under the description). */
export function MoreActionsButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      <MoreHorizontal aria-hidden="true" /> {children}
    </button>
  );
}
