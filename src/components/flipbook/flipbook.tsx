"use client";

// A page-turning book. The turning leaf is a chain of narrow strips, each hinged to the previous
// one and rotated a little further, so the paper bends along its width instead of swinging like a
// door. Each strip shows its slice of the front and back page and is lit with a gradient across its
// width (from the angle at one edge to the angle at the other), so the curve shades smoothly.
// Drag (or throw) a page, click a page, or use the arrow keys.
//
// `single` shows one page at a time, for phones held upright: the page is hinged on its left edge,
// curls away to the left to reveal the next one, and the previous page curls back in over it.
// Swipe, tap the outer thirds to turn, or tap the middle (onTap) to show the reader's controls.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { completesPageTurn, pageTurnSpring, PAGE_PULL_PX } from "./page-turn";
import { PAPER_EDGE, PAPER_THICKNESS, STITCH_HIGHLIGHT, STITCH_POSITIONS, STITCH_THREAD, PaperCurl, type PaperPull } from "./paper-curl";

import { pageImage } from "@/lib/page-images";
import { nearbyReaderPages, visibleReaderPages } from "@/lib/reader-pages";

export type FlipPage = { id: string; imageUrl: string; title: string; ar: boolean };

export type FlipBookHandle = {
  next: () => void;
  prev: () => void;
  /** Turn forward the way a reader's finger does (Auto read): the same curl and release as a drag. */
  turnByHand: () => void;
  /** Jump (without animation) to the spread showing this page index. */
  goToPage: (index: number) => void;
};

type Turn = { dir: 1 | -1; p: number; pull?: PaperPull };
type Drag = {
  pointerId: number;
  dir: 1 | -1;
  startX: number;
  startY: number;
  edgeY: number;
  turn?: Turn;
  /** The furthest the page was pulled forward, in pixels. */
  furthest?: number;
};

// Strips in a turning leaf: fewer on phones, where every strip is two textured 3D layers.
const STRIPS = 18;
const STRIPS_SINGLE = 10;
/** Extra bend at mid-turn, in radians, split across the strips. */
const BEND = 0.6;
const PAPER = "#fbf8f1";
const RADIUS = 6;
const LENS = 180;
const ZOOM = 2.4;
const BACK_COVER: FlipPage = { id: "back-cover", imageUrl: "", title: "Back cover", ar: false };
/** A scripted turn: the corner is drawn this far across in this long, then let go like a drag. */
const HAND_PULL = 0.32;
const HAND_PULL_MS = 700;
/** Where a hand takes hold of the outer edge, from the top (0) to the bottom (1). */
const HAND_GRIP = 0.8;
/** Single page: taps this close to either side (share of the width) turn the page; the rest show the controls. */
const SIDE_TAP = 0.2;

const spreadOf = (pageIndex: number) => Math.floor((pageIndex + 1) / 2);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** How much a surface tilted by `angle` from the page plane is darkened. */
const shadeAt = (angle: number) => (1 - Math.abs(Math.cos(angle))) * 0.5;

/** Page-stack edges: a few hairlines of paper peeking out on the outer side, more where more pages are. */
function stack(side: "left" | "right", pages: number): string {
  const layers = Math.min(5, Math.ceil(pages / 2));
  const dir = side === "left" ? -1 : 1;
  const lines = Array.from({ length: layers }, (_, i) => `${dir * (i + 1)}px ${i + 1}px 0 ${i % 2 ? "#e4dccb" : "#f3eee2"}`);
  return lines.join(", ");
}

function PageFace({
  page,
  side,
  width,
  height,
  closedCover,
  children,
  extra,
}: {
  page: FlipPage | null;
  side: "left" | "right";
  width: number;
  height: number;
  closedCover?: boolean;
  children?: ReactNode;
  extra?: ReactNode;
}) {
  if (!page) return null;
  const radius = side === "left" ? `${RADIUS}px 0 0 ${RADIUS}px` : `0 ${RADIUS}px ${RADIUS}px 0`;
  return (
    <div
      className="absolute top-0 overflow-hidden"
      style={{ left: side === "left" ? 0 : width, width, height, borderRadius: radius, background: page.imageUrl ? `${PAPER} url("${page.imageUrl}") center / cover no-repeat` : PAPER }}
    >
      {closedCover && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
        borderRadius: "inherit",
        boxShadow: "inset 0 0 0 1px rgb(146 117 79 / 0.32), inset 0 -2px rgb(255 249 229 / 0.63)",
        background: `linear-gradient(to ${side === "left" ? "left" : "right"}, rgb(151 123 83 / 0.28), rgb(255 249 232 / 0.30) 2px, rgb(158 131 92 / 0.14) 4px, transparent 10px)`,
      }} />}
      {extra}
      {children}
    </div>
  );
}

export const FlipBook = forwardRef<
  FlipBookHandle,
  {
    pages: FlipPage[];
    backCoverImageUrl?: string;
    /** page height / width */
    aspect: number;
    initialPage?: number;
    /** Show a magnifying lens that follows the pointer. */
    magnifier?: boolean;
    /** Extra UI drawn on top of a resting page (badges, toggles). */
    renderOverlay?: (page: FlipPage, index: number, side: "left" | "right") => ReactNode;
    onSpreadChange?: (pages: number[]) => void;
    onTurnChange?: (turning: boolean) => void;
    /** One page at a time instead of two-page spreads. */
    single?: boolean;
    /** Single mode: a tap in the middle of the screen. */
    onTap?: () => void;
    className?: string;
  }
>(function FlipBook({ pages, backCoverImageUrl, aspect, initialPage = 0, magnifier, renderOverlay, onSpreadChange, onTurnChange, single = false, onTap, className }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [spread, setSpread] = useState(() => spreadOf(initialPage));
  // Single mode's position: a page index, or pages.length for the back cover.
  const [index, setIndex] = useState(initialPage);
  const singleRef = useRef(single);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const animation = useRef(0);
  const drag = useRef<Drag | null>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const reducedMotion = useRef(false);
  const turning = useRef(false);
  const turnListener = useRef(onTurnChange);
  turnListener.current = onTurnChange;
  const updateTurn = useCallback((next: Turn | null) => {
    if (turning.current !== !!next) {
      turning.current = !!next;
      turnListener.current?.(!!next);
    }
    setTurn(next);
  }, []);

  const n = pages.length;
  const hasBackCover = n > 0 && (!!backCoverImageUrl || (n > 1 && n % 2 === 1));
  const spreads = Math.floor(n / 2) + 1 + Number(hasBackCover);
  const page = (i: number) => (i >= 0 && i < n ? pages[i]! : null);
  const backCover = backCoverImageUrl ? { ...BACK_COVER, imageUrl: backCoverImageUrl } : BACK_COVER;
  const left = (s: number) => hasBackCover && s === spreads - 1 ? backCover : page(2 * s - 1);
  const right = (s: number) => page(2 * s);
  // Single mode always ends on the back cover when there is one.
  const singleCount = n + Number(n > 0 && !!backCoverImageUrl);
  const singlePage = (i: number) => (i < n ? page(i) : i === n && singleCount > n ? backCover : null);

  // The page that was asked for, until the reader turns one: a phone first lays the book out as a
  // spread, and switching to one page must open this page, not the spread's left one.
  const asked = useRef<number | null>(initialPage);

  // Turning the phone keeps the reader on the same page.
  useEffect(() => {
    if (singleRef.current === single) return;
    singleRef.current = single;
    cancelAnimationFrame(animation.current);
    drag.current = null;
    updateTurn(null);
    if (single && asked.current !== null && spreadOf(asked.current) === spread) setIndex(asked.current);
    else if (single) setIndex(hasBackCover && spread === spreads - 1 ? singleCount - 1 : Math.max(0, 2 * spread - 1));
    else setSpread(Math.min(spreads - 1, spreadOf(index)));
  }, [single, spread, spreads, index, hasBackCover, singleCount, updateTurn]);

  // Fit two pages side by side inside the container.
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Give the open spread the bandwidth first. Reuse its decoded images for text and curls.
    const open = visibleReaderPages(single ? index : Math.max(0, 2 * spread - 1), n, single);
    const nearby = nearbyReaderPages(open.length ? open : n ? [n - 1] : [], n);
    const urls = new Set(nearby.map((i) => pages[i]!.imageUrl).filter(Boolean));
    const nearBack = single ? index >= n - 2 : spread >= spreads - 3;
    if (backCoverImageUrl && nearBack) urls.add(backCoverImageUrl);
    for (const url of images.current.keys()) if (!urls.has(url)) images.current.delete(url);
    for (const url of urls) {
      const important = open.some((i) => pages[i]!.imageUrl === url) || url === backCoverImageUrl;
      images.current.set(url, pageImage(url, important ? "high" : "low").image);
    }
  }, [pages, backCoverImageUrl, single, index, spread, n, spreads]);

  useEffect(() => {
    if (single) onSpreadChange?.(index < n ? [index] : []);
    else onSpreadChange?.([2 * spread - 1, 2 * spread].filter((i) => i >= 0 && i < n));
  }, [single, index, spread, n, onSpreadChange]);

  useEffect(() => () => {
    cancelAnimationFrame(animation.current);
    turnListener.current?.(false);
  }, []);

  const animateTo = useCallback((dir: 1 | -1, from: number, to: 0 | 1, pull?: PaperPull) => {
    cancelAnimationFrame(animation.current);
    const finish = () => {
      updateTurn(null);
      if (to !== 1) return;
      asked.current = null;
      if (singleRef.current) setIndex((i) => i + dir);
      else setSpread((s) => s + dir);
    };
    if (reducedMotion.current) {
      finish();
      return;
    }
    const start = performance.now();
    updateTurn({ dir, p: from, pull });
    const step = (now: number) => {
      // Sampling wall time avoids stretching a turn when a phone drops a costly frame.
      const { position, finished } = pageTurnSpring(from, to, now - start);
      if (finished) finish();
      else {
        updateTurn({ dir, p: position, pull });
        animation.current = requestAnimationFrame(step);
      }
    };
    animation.current = requestAnimationFrame(step);
  }, [updateTurn]);

  const canTurn = useCallback(
    (dir: 1 | -1) => (single ? index + dir >= 0 && index + dir < singleCount : spread + dir >= 0 && spread + dir < spreads),
    [single, index, singleCount, spread, spreads],
  );

  const flip = useCallback(
    (dir: 1 | -1) => {
      if (turn || drag.current || !canTurn(dir)) return;
      animateTo(dir, 0, 1);
    },
    [turn, canTurn, animateTo],
  );

  // The page's height at the last render, for the scripted pull.
  const pageHeight = useRef(0);
  const turnByHand = useCallback(() => {
    if (turn || drag.current || !canTurn(1)) return;
    if (reducedMotion.current) return animateTo(1, 0, 1);
    cancelAnimationFrame(animation.current);
    const start = performance.now();
    updateTurn({ dir: 1, p: 0, pull: { edgeY: HAND_GRIP, offsetY: 0 } });
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / HAND_PULL_MS);
      const eased = easeInOut(t);
      // Lifted slightly as it is drawn across, as a real pull does.
      const pull = { edgeY: HAND_GRIP, offsetY: -0.05 * pageHeight.current * eased };
      if (t < 1) {
        updateTurn({ dir: 1, p: HAND_PULL * eased, pull });
        animation.current = requestAnimationFrame(step);
      } else {
        // Letting go: exactly what releasing a drag does.
        animateTo(1, HAND_PULL, 1, pull);
      }
    };
    animation.current = requestAnimationFrame(step);
  }, [turn, canTurn, animateTo, updateTurn]);

  useImperativeHandle(
    ref,
    () => ({
      next: () => flip(1),
      prev: () => flip(-1),
      turnByHand,
      goToPage: (target: number) => {
        asked.current = null;
        cancelAnimationFrame(animation.current);
        drag.current = null;
        updateTurn(null);
        if (singleRef.current) setIndex(Math.max(0, Math.min(singleCount - 1, target)));
        else setSpread(Math.max(0, Math.min(spreads - 1, spreadOf(target))));
      },
    }),
    [flip, turnByHand, spreads, singleCount, updateTurn],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable], [role='menu']"))) return;
      if (e.key === "ArrowRight") flip(1);
      if (e.key === "ArrowLeft") flip(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip]);

  // ---------- layout ----------
  const pageW = single
    ? Math.max(0, Math.min(size.w, size.h / aspect))
    : Math.max(0, Math.min(size.w / 2, size.h / aspect) * 0.88);
  const pageH = pageW * aspect;
  pageHeight.current = pageH;
  const destination = spread + (turn?.dir ?? 0);
  const leafDir = turn?.dir;
  const shiftFor = (s: number) => (left(s) ? 0 : -pageW / 2) + (right(s) ? 0 : pageW / 2);
  const shift = turn ? shiftFor(spread) + (shiftFor(destination) - shiftFor(spread)) * easeInOut(turn.p) : shiftFor(spread);

  // Pages lying flat while a leaf turns.
  const leftStatic = leafDir === -1 ? left(destination) : left(spread);
  const rightStatic = leafDir === 1 ? right(destination) : right(spread);
  const front = leafDir ? (leafDir === 1 ? right(spread) : left(spread)) : null;
  const back = leafDir ? (leafDir === 1 ? left(destination) : right(destination)) : null;
  // How many sheets are stacked on each side (for the page-edge effect).
  const pagesLeft = Math.max(0, 2 * spread - 1);
  const pagesRight = Math.max(0, n - 2 * spread);

  // ---------- pointer ----------
  /** Menus opened from a page render elsewhere in the document but still bubble here through React. */
  const offPage = (e: React.PointerEvent) =>
    !e.currentTarget.contains(e.target as Node) || !!(e.target as HTMLElement).closest("button, a, input, label, [role='menu']") || nearControl(e);
  /** A finger landing just beside a small button on the page (a near miss on the language chip) never turns it. */
  const nearControl = (e: React.PointerEvent) =>
    [...e.currentTarget.querySelectorAll("button, a")].some((control) => {
      const r = control.getBoundingClientRect();
      return e.clientX > r.left - 16 && e.clientX < r.right + 16 && e.clientY > r.top - 14 && e.clientY < r.bottom + 14;
    });

  function onPointerDown(e: React.PointerEvent) {
    if (turn || drag.current || spreads < 2 || e.button !== 0 || offPage(e)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // The rect already includes the centring shift; its middle is the spine.
    const dir: 1 | -1 = e.clientX > rect.left + rect.width / 2 ? 1 : -1;
    if (spread + dir < 0 || spread + dir >= spreads) return;
    const edgeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    drag.current = { pointerId: e.pointerId, dir, startX: e.clientX, startY: e.clientY, edgeY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (magnifier && e.pointerType === "mouse") {
      const rect = e.currentTarget.getBoundingClientRect();
      setLens({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = (d.startX - e.clientX) * d.dir;
    const dy = e.clientY - d.startY;
    if (!d.turn && (dx < PAGE_PULL_PX || dx < Math.abs(dy))) return;
    const lift = Math.min(0.2, Math.abs(dy) / pageH * 0.45);
    const p = Math.min(1, Math.max(0, dx / (pageW * 2 * 0.62), lift));
    const offsetY = Math.max(-pageH * 0.5, Math.min(pageH * 0.5, dy));
    d.furthest = Math.max(d.furthest ?? 0, dx);
    d.turn = { dir: d.dir, p, pull: { edgeY: d.edgeY, offsetY } };
    updateTurn(d.turn);
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    // Only the browser cancelling counts as cancelled; some browsers say they lost the pointer before
    // they say it was lifted, and that is a release too.
    const released = e.type !== "pointercancel";
    if (!d.turn) {
      if (e.type === "pointerup" && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 10 && !(e.target as HTMLElement).closest("button, a, input, label")) animateTo(d.dir, 0, 1);
      return;
    }
    const { p, pull } = d.turn;
    const commit = completesPageTurn(released, (d.startX - e.clientX) * d.dir, d.furthest);
    animateTo(d.dir, p, commit ? 1 : 0, pull);
  }

  // ---------- the turning leaf ----------
  // A plain render function (not a component) so the strips update in place every frame.
  /** `backFade` shows the leaf's own picture faded on its back (single page) instead of `back`. */
  function renderLeaf(t: Turn, front: FlipPage | null, back: FlipPage | null, left: number, backFade?: number) {
    const theta = t.p * Math.PI;
    const bend = BEND * Math.sin(theta);
    const hinge = theta - bend;
    const strips = single ? STRIPS_SINGLE : STRIPS;
    const joint = (2 * bend) / (strips - 1);
    const sw = pageW / strips;
    const forward = t.dir === 1;
    const sign = forward ? -1 : 1;
    // Gradients run away from the spine on the front; the back face is mirrored.
    const away = forward ? "right" : "left";
    const toward = forward ? "left" : "right";

    let chain: ReactNode = null;
    for (let i = strips - 1; i >= 0; i--) {
      const near = hinge + joint * i; // angle at the strip's spine-side edge
      const far = near + joint; // and at its outer edge
      const shadeNear = shadeAt(near);
      const shadeFar = shadeAt(far);
      const frontX = forward ? i * sw : pageW - (i + 1) * sw;
      const backX = forward ? pageW - (i + 1) * sw : i * sw;
      const face = (p: FlipPage | null, x: number, isBack: boolean, fade?: number): ReactNode => (
        <div
          className="absolute inset-0"
          style={{
            background: p?.imageUrl ? `${PAPER} url("${p.imageUrl}") ${-x}px 0 / ${pageW}px ${pageH}px no-repeat` : PAPER,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: `${isBack ? "rotateY(180deg) " : ""}translateZ(${PAPER_THICKNESS / 2}px)`,
          }}
        >
          {fade !== undefined && <div className="absolute inset-0" style={{ background: PAPER, opacity: fade }} />}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to ${isBack ? toward : away}, rgb(40 28 16 / ${shadeNear}), rgb(40 28 16 / ${shadeFar}))`,
            }}
          />
        </div>
      );
      chain = (
        <div
          className="absolute top-0"
          style={{
            width: sw + 1, // a hair of overlap hides seams between strips
            height: pageH,
            transformStyle: "preserve-3d",
            ...(forward ? { left: i === 0 ? 0 : sw, transformOrigin: "left center" } : { right: i === 0 ? 0 : sw, transformOrigin: "right center" }),
            transform: `rotateY(${sign * (i === 0 ? hinge : joint)}rad)`,
          }}
        >
          {face(front, frontX, false)}
          {backFade === undefined ? face(back, backX, true) : face(front, frontX, true, backFade)}
          {i === strips - 1 && (
            <div className="absolute inset-y-0" style={{
              left: (forward ? sw + 1 : 0) - PAPER_THICKNESS / 2,
              width: PAPER_THICKNESS,
              background: PAPER_EDGE,
              transform: "rotateY(90deg)",
            }} />
          )}
          {chain}
        </div>
      );
    }
    return (
      <div
        className="pointer-events-none absolute top-0"
        style={{ width: pageW, height: pageH, transformStyle: "preserve-3d", left }}
      >
        {chain}
      </div>
    );
  }

  // ---------- single page ----------
  function singleDown(e: React.PointerEvent) {
    if (turn || drag.current || e.button !== 0 || offPage(e)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // Where the page was grabbed, top to bottom: it sets the angle of the fold, like a book app.
    const pageTop = rect.top + (rect.height - pageH) / 2;
    const edgeY = Math.max(0, Math.min(1, (e.clientY - pageTop) / pageH));
    drag.current = { pointerId: e.pointerId, dir: 1, startX: e.clientX, startY: e.clientY, edgeY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer already went away; the drag ends on the next up/cancel.
    }
  }

  function singleMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.turn) {
      // Wait for a clearly sideways swipe; anything else may still be a tap.
      if (Math.abs(dx) < PAGE_PULL_PX || Math.abs(dx) < Math.abs(e.clientY - d.startY)) return;
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      if (!canTurn(dir)) return;
      d.dir = dir;
    }
    const offsetY = Math.max(-pageH * 0.5, Math.min(pageH * 0.5, e.clientY - d.startY));
    d.furthest = Math.max(d.furthest ?? 0, -dx * d.dir);
    d.turn = { dir: d.dir, p: Math.min(1, Math.max(0, (-dx * d.dir) / (pageW * 0.9))), pull: { edgeY: d.edgeY, offsetY } };
    updateTurn(d.turn);
  }

  function singleUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    const released = e.type !== "pointercancel";
    if (!d.turn) {
      if (e.type !== "pointerup" || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 10) return;
      // Like a book app: a tap near either edge turns the page that way, and the middle (top to
      // bottom, page or not) shows or hides the controls.
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      if (x < SIDE_TAP) {
        if (canTurn(-1)) animateTo(-1, 0, 1);
      } else if (x > 1 - SIDE_TAP) {
        if (canTurn(1)) animateTo(1, 0, 1);
      } else onTap?.();
      return;
    }
    const commit = completesPageTurn(released, (d.startX - e.clientX) * d.dir, d.furthest);
    animateTo(d.dir, d.turn.p, commit ? 1 : 0, d.turn.pull);
  }

  if (single) {
    // Forward, the current page curls away to the left. Back, the previous page curls in over it:
    // the same motion played in reverse, so both use a leaf hinged on the left edge.
    const forward = turn?.dir !== -1;
    const leafPage = turn ? (forward ? singlePage(index) : singlePage(index - 1)) : null;
    const under = turn && forward ? singlePage(index + 1) : singlePage(index);
    const leafTurn: Turn | null = turn ? { dir: 1, p: forward ? turn.p : 1 - turn.p, pull: turn.pull } : null;
    const singleLift = leafTurn ? Math.sin(leafTurn.p * Math.PI) : 0;
    const resting = !turn && under;
    const isBack = under === backCover;
    const leafImage = images.current.get(leafPage?.imageUrl ?? "");
    return (
      <div
        ref={container}
        className={className ?? "relative size-full"}
        style={{ perspective: Math.max(1600, pageW * 5), perspectiveOrigin: "50% 45%", touchAction: "none" }}
        onPointerDown={singleDown}
        onPointerMove={singleMove}
        onPointerUp={singleUp}
        onPointerCancel={singleUp}
        onLostPointerCapture={singleUp}
      >
        {pageW > 0 && under && (
          // Edge to edge, like a book app: no desk, no spine, just the page.
          <div
            className="absolute top-1/2 left-1/2 select-none"
            style={{ width: pageW, height: pageH, transform: "translate(-50%, -50%)", transformStyle: "preserve-3d" }}
          >
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ background: under.imageUrl ? `${PAPER} url("${under.imageUrl}") center / cover no-repeat` : PAPER }}
            >
              {turn && forward && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[55%] bg-[linear-gradient(to_right,rgb(52_38_20_/_0.22),transparent_85%)]" style={{ opacity: singleLift * 0.7 }} />
              )}
            </div>
            {resting && (
              <div className="absolute inset-0">{!isBack && renderOverlay?.(under, index, "right")}</div>
            )}
            {leafTurn && leafPage && (leafTurn.pull ? (
              <PaperCurl width={pageW} height={pageH} direction={1} progress={leafTurn.p} pull={leafTurn.pull} stitchOpacity={0}
                front={leafImage} back={leafImage} backFade={0.82} spineLeft={0} detail="low" />
            ) : renderLeaf(leafTurn, leafPage, null, 0, 0.82))}
          </div>
        )}
      </div>
    );
  }

  const lift = turn ? Math.sin(turn.p * Math.PI) : 0;
  const castShadow = lift * 0.62;
  const shadowWidth = pageW * 2 - 2 * Math.abs(shift);
  const stitchOpacity = pageW ? Math.max(0, 1 - 2 * Math.abs(shift) / pageW) : 0;
  // Strong enough to feel 3D, mild enough that a lifted page doesn't balloon past the book.
  const perspective = Math.max(2000, pageW * 7);

  const staticPages = (
    <>
      <PageFace
        page={leftStatic}
        side="left"
        width={pageW}
        height={pageH}
        closedCover={!turn && !rightStatic}
        extra={leafDir === -1 && <div className="absolute inset-y-0 right-0 w-[46%] bg-[linear-gradient(to_left,rgb(52_38_20_/_0.30),transparent_82%)]" style={{ opacity: castShadow }} />}
      />
      <PageFace
        page={rightStatic}
        side="right"
        width={pageW}
        height={pageH}
        closedCover={!turn && !leftStatic}
        extra={leafDir === 1 && <div className="absolute inset-y-0 left-0 w-[46%] bg-[linear-gradient(to_right,rgb(52_38_20_/_0.24),transparent_82%)]" style={{ opacity: castShadow }} />}
      />
      {!turn && leftStatic && rightStatic && (
          <div aria-hidden="true" className="pointer-events-none absolute top-0" style={{
            left: pageW * 0.8,
            width: pageW * 0.4,
            height: pageH,
            background: "linear-gradient(90deg, transparent 0%, rgb(64 47 29 / 0.025) 24%, rgb(64 47 29 / 0.09) 40%, rgb(64 47 29 / 0.17) 48%, rgb(64 47 29 / 0.15) 53%, rgb(64 47 29 / 0.07) 63%, rgb(64 47 29 / 0.02) 77%, transparent 100%)",
          }} />
      )}
      {!turn?.pull && stitchOpacity > 0 && STITCH_POSITIONS.map((position) => (
            <svg key={position} aria-hidden="true" className="pointer-events-none absolute" viewBox="0 0 8 44" fill="none" style={{
              left: pageW, top: pageH * position, width: 8, height: Math.min(44, pageH * 0.09),
              opacity: stitchOpacity, transform: "translate(-50%, -50%)",
            }}>
              <ellipse cx="4.5" cy="3" rx="1.5" ry="1.2" fill="#624b31" opacity=".48" />
              <ellipse cx="4.5" cy="41" rx="1.5" ry="1.2" fill="#624b31" opacity=".48" />
              <path d={STITCH_THREAD} stroke="#70583b" strokeWidth="1.8" strokeLinecap="round" opacity=".65" />
              <path d={STITCH_HIGHLIGHT} stroke="#e1cbaa" strokeWidth=".8" strokeLinecap="round" />
            </svg>
      ))}
    </>
  );

  const showLens = magnifier && lens && !turn && lens.x >= 0 && lens.y >= 0 && lens.x <= pageW * 2 && lens.y <= pageH;

  return (
    <div ref={container} className={className ?? "relative size-full"} style={{ perspective, perspectiveOrigin: "50% 45%" }}>
      {pageW > 0 && (
        <div
          className="absolute top-1/2 left-1/2 touch-none select-none"
          style={{
            width: pageW * 2,
            height: pageH,
            transform: `translate(calc(-50% + ${shift}px), -50%)`,
            transformStyle: "preserve-3d",
            cursor: magnifier ? "none" : turn ? "grabbing" : "grab",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
          onPointerLeave={() => setLens(null)}
        >
          {(leftStatic || rightStatic || turn) && (
            <div aria-hidden="true" className="pointer-events-none absolute" style={{
              left: pageW - shift - shadowWidth / 2,
              top: pageH * 0.67,
              width: shadowWidth,
              height: pageH * 0.55,
              transform: "translateZ(-3px)",
            }}>
              <div className="absolute inset-0" style={{
                background: "radial-gradient(ellipse at 50% 53%, rgb(58 44 26 / 0.38), rgb(58 44 26 / 0.17) 38%, transparent 71%)",
                filter: "blur(24px)", opacity: 1 - lift * 0.42,
              }} />
              <div className="absolute inset-x-[8%] top-[36%] h-[43%]" style={{
                background: "radial-gradient(ellipse at 50% 37%, rgb(44 32 14 / 0.46), rgb(44 32 14 / 0.16) 48%, transparent 76%)",
                filter: "blur(9px)", opacity: 1 - lift * 0.5,
              }} />
            </div>
          )}
          {/* the book block, with page edges showing how much is left on each side */}
          {(leftStatic || (leafDir !== -1 && left(spread))) && (
            <div
              className="absolute top-0 left-0"
              style={{ width: pageW, height: pageH, background: PAPER, borderRadius: `${RADIUS}px 0 0 ${RADIUS}px`, boxShadow: stack("left", pagesLeft) }}
            />
          )}
          {(rightStatic || (leafDir !== 1 && right(spread))) && (
            <div
              className="absolute top-0"
              style={{ left: pageW, width: pageW, height: pageH, background: PAPER, borderRadius: `0 ${RADIUS}px ${RADIUS}px 0`, boxShadow: stack("right", pagesRight) }}
            />
          )}

          {staticPages}

          {/* overlays sit on the resting pages only */}
          {!turn && leftStatic && leftStatic !== backCover && (
            <div className="absolute top-0 left-0" style={{ width: pageW, height: pageH }}>
              {renderOverlay?.(leftStatic, 2 * spread - 1, "left")}
            </div>
          )}
          {!turn && rightStatic && (
            <div className="absolute top-0" style={{ left: pageW, width: pageW, height: pageH }}>
              {renderOverlay?.(rightStatic, 2 * spread, "right")}
            </div>
          )}

          {turn && (turn.pull ? (
            <PaperCurl width={pageW} height={pageH} direction={turn.dir} progress={turn.p} pull={turn.pull} stitchOpacity={stitchOpacity}
              front={images.current.get(front?.imageUrl ?? "")} back={images.current.get(back?.imageUrl ?? "")} />
          ) : renderLeaf(turn, front, back, turn.dir === 1 ? pageW : 0))}

          {showLens && (
            <div
              className="pointer-events-none absolute z-10 overflow-hidden rounded-full"
              style={
                {
                  width: LENS,
                  height: LENS,
                  left: lens.x - LENS / 2,
                  top: lens.y - LENS / 2,
                  background: PAPER,
                  boxShadow:
                    "0 0 0 5px #c8a56b, 0 0 0 6px rgb(90 64 28 / 0.6), 0 0 0 9px rgb(255 255 255 / 0.25), 0 18px 34px -8px rgb(40 28 16 / 0.55), inset 0 0 22px rgb(40 28 16 / 0.35)",
                } as CSSProperties
              }
            >
              {/* the same two pages, enlarged around the point under the lens */}
              <div
                className="absolute top-0 left-0"
                style={{
                  width: pageW * 2,
                  height: pageH,
                  transformOrigin: "0 0",
                  transform: `translate(${LENS / 2 - lens.x * ZOOM}px, ${LENS / 2 - lens.y * ZOOM}px) scale(${ZOOM})`,
                }}
              >
                {staticPages}
              </div>
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,rgb(255_255_255/0.45),transparent_38%)]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
});
