"use client";

// A page-turning book. The turning leaf is a chain of narrow strips, each hinged to the previous
// one and rotated a little further, so the paper bends along its width instead of swinging like a
// door. Each strip shows its slice of the front and back page and is lit with a gradient across its
// width (from the angle at one edge to the angle at the other), so the curve shades smoothly.
// Drag (or throw) a page, click a page, or use the arrow keys.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PAPER_EDGE, PAPER_THICKNESS, STITCH_HIGHLIGHT, STITCH_POSITIONS, STITCH_THREAD, PaperCurl, type PaperPull } from "./paper-curl";

export type FlipPage = { id: string; imageUrl: string; title: string; ar: boolean };

export type FlipBookHandle = {
  next: () => void;
  prev: () => void;
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
  samples: { x: number; t: number }[];
};

const STRIPS = 18;
/** Extra bend at mid-turn, in radians, split across the strips. */
const BEND = 0.6;
const PAPER = "#fbf8f1";
const RADIUS = 6;
const LENS = 180;
const ZOOM = 2.4;
const SINGLE_PAGE_WIDTH = 640;
const BACK_COVER: FlipPage = { id: "back-cover", imageUrl: "", title: "Back cover", ar: false };

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
      style={{ left: side === "left" ? 0 : width, width, height, borderRadius: radius, background: page.imageUrl ? `${PAPER} url("${page.imageUrl}") center / contain no-repeat` : PAPER }}
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
    className?: string;
  }
>(function FlipBook({ pages, backCoverImageUrl, aspect, initialPage = 0, magnifier, renderOverlay, onSpreadChange, className }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const animation = useRef(0);
  const drag = useRef<Drag | null>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const reducedMotion = useRef(false);

  const n = pages.length;
  const hasBackCover = n > 0 && (!!backCoverImageUrl || (n > 1 && n % 2 === 1));
  const singlePage = size.w < SINGLE_PAGE_WIDTH;
  const lensEnabled = magnifier && !singlePage;
  const lastPosition = (singlePage ? n - 1 : Math.floor(n / 2)) + Number(hasBackCover);
  const viewingBack = hasBackCover && currentPage === n;
  const position = singlePage ? currentPage : viewingBack ? lastPosition : spreadOf(currentPage);
  const pageAt = useCallback((destination: number) => {
    if (singlePage) return destination;
    if (hasBackCover && destination === lastPosition) return n;
    return Math.max(0, 2 * destination - 1);
  }, [singlePage, hasBackCover, lastPosition, n]);
  const page = (i: number) => (i >= 0 && i < n ? pages[i]! : null);
  const backCover = backCoverImageUrl ? { ...BACK_COVER, imageUrl: backCoverImageUrl } : BACK_COVER;
  const left = (s: number) => hasBackCover && s === lastPosition ? backCover : page(2 * s - 1);
  const right = (s: number) => page(2 * s);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A turn in flight belongs to the layout it started in.
  useLayoutEffect(() => {
    cancelAnimationFrame(animation.current);
    drag.current = null;
    setTurn(null);
  }, [singlePage]);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Preload every page so turns never flash an empty sheet.
    const urls = new Set(pages.map((page) => page.imageUrl).filter(Boolean));
    if (backCoverImageUrl) urls.add(backCoverImageUrl);
    for (const url of images.current.keys()) {
      if (!urls.has(url)) images.current.delete(url);
    }
    for (const url of urls) {
      if (images.current.has(url)) continue;
      const img = new Image();
      img.src = url;
      images.current.set(url, img);
    }
  }, [pages, backCoverImageUrl]);

  useEffect(() => {
    const indexes = singlePage ? [currentPage] : [2 * position - 1, 2 * position];
    onSpreadChange?.(indexes.filter((i) => i >= 0 && i < n));
  }, [singlePage, currentPage, position, n, onSpreadChange]);

  useEffect(() => () => cancelAnimationFrame(animation.current), []);

  const animateTo = useCallback((dir: 1 | -1, from: number, to: 0 | 1, pull?: PaperPull) => {
    cancelAnimationFrame(animation.current);
    const finish = () => {
      setTurn(null);
      if (to === 1) setCurrentPage(pageAt(position + dir));
    };
    if (reducedMotion.current) {
      finish();
      return;
    }
    // Use the reference sketchbook's spring for both completed and cancelled turns.
    const stiffness = to === 1 ? 170 : 150;
    const damping = to === 1 ? 26 : 24;
    let progress = from;
    let velocity = 0;
    let previousTime = performance.now();
    setTurn({ dir, p: from, pull });
    const step = (now: number) => {
      const dt = Math.max(0, Math.min(0.032, (now - previousTime) / 1000));
      previousTime = now;
      velocity += (-stiffness * (progress - to) - damping * velocity) * dt;
      progress += velocity * dt;
      if (Math.abs(progress - to) < 0.002 && Math.abs(velocity) < 0.02) {
        finish();
      } else {
        setTurn({ dir, p: Math.max(0, Math.min(1, progress)), pull });
        animation.current = requestAnimationFrame(step);
      }
    };
    animation.current = requestAnimationFrame(step);
  }, [pageAt, position]);

  const flip = useCallback(
    (dir: 1 | -1) => {
      if (turn || drag.current || position + dir < 0 || position + dir > lastPosition) return;
      animateTo(dir, 0, 1);
    },
    [turn, position, lastPosition, animateTo],
  );

  useImperativeHandle(
    ref,
    () => ({
      next: () => flip(1),
      prev: () => flip(-1),
      goToPage: (index: number) => {
        cancelAnimationFrame(animation.current);
        drag.current = null;
        setTurn(null);
        setCurrentPage(Math.max(0, Math.min(n - 1, index)));
      },
    }),
    [flip, n],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target as HTMLElement).closest("input, textarea, select, [contenteditable], [role='menu']")) return;
      if (e.key === "ArrowRight") flip(1);
      if (e.key === "ArrowLeft") flip(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip]);

  // ---------- layout ----------
  const pageW = Math.max(0, singlePage
    ? Math.min(size.w - 56, (size.h - 64) / aspect)
    : Math.min(size.w / 2, size.h / aspect) * 0.88);
  const pageH = pageW * aspect;
  const leafDir = turn?.dir;
  const destination = position + (leafDir ?? 0);
  const singleSide = (leafDir === -1 || (!leafDir && viewingBack)) ? "left" : "right";
  const singleFace = (index: number) => hasBackCover && index === n ? backCover : page(index);
  const shiftFor = (s: number) => (left(s) ? 0 : -pageW / 2) + (right(s) ? 0 : pageW / 2);
  const shift = singlePage ? (singleSide === "left" ? pageW / 2 : -pageW / 2)
    : turn ? shiftFor(position) + (shiftFor(destination) - shiftFor(position)) * easeInOut(turn.p) : shiftFor(position);

  // On a phone the incoming page sits under the turning sheet. Its reverse is blank.
  const leftStatic = singlePage ? (singleSide === "left" ? singleFace(destination) : null)
    : left(leafDir === -1 ? destination : position);
  const rightStatic = singlePage ? (singleSide === "right" ? singleFace(destination) : null)
    : right(leafDir === 1 ? destination : position);
  const front = !leafDir ? null : singlePage ? singleFace(position) : leafDir === 1 ? right(position) : left(position);
  const back = !leafDir || singlePage ? null : leafDir === 1 ? left(destination) : right(destination);
  // How many sheets are stacked on each side (for the page-edge effect).
  const pagesLeft = singlePage ? n : Math.max(0, 2 * position - 1);
  const pagesRight = singlePage ? n : Math.max(0, n - 2 * position);
  const dragDistance = pageW * (singlePage ? 0.85 : 1.24);

  // ---------- pointer ----------
  function onPointerDown(e: React.PointerEvent) {
    if (turn || drag.current || lastPosition < 1 || e.button !== 0 || (e.target as HTMLElement).closest("button, a, input, label")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const start = singlePage && singleSide === "right" ? pageW : 0;
    const width = singlePage ? pageW : rect.width;
    if (x < start || x > start + width) return;
    const dir: 1 | -1 = x > start + width / 2 ? 1 : -1;
    if (position + dir < 0 || position + dir > lastPosition) return;
    const edgeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    drag.current = { pointerId: e.pointerId, dir, startX: e.clientX, startY: e.clientY, edgeY, samples: [{ x: e.clientX, t: performance.now() }] };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (lensEnabled && e.pointerType === "mouse") {
      const rect = e.currentTarget.getBoundingClientRect();
      setLens({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = (d.startX - e.clientX) * d.dir;
    const dy = e.clientY - d.startY;
    if (!d.turn && Math.hypot(dx, dy) < 6) return;
    const now = performance.now();
    d.samples.push({ x: e.clientX, t: now });
    while (d.samples.length > 2 && now - d.samples[0]!.t > 100) d.samples.shift();
    const lift = Math.min(0.2, Math.abs(dy) / pageH * 0.45);
    const p = Math.min(1, Math.max(0, dx / dragDistance, lift));
    const offsetY = Math.max(-pageH * 0.5, Math.min(pageH * 0.5, dy));
    d.turn = { dir: d.dir, p, pull: { edgeY: d.edgeY, offsetY } };
    setTurn(d.turn);
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    const released = e.type === "pointerup";
    if (!d.turn) {
      if (released && !(e.target as HTMLElement).closest("button, a, input, label")) animateTo(d.dir, 0, 1);
      return;
    }
    const first = d.samples[0]!;
    const last = d.samples[d.samples.length - 1]!;
    const velocity = ((first.x - last.x) * d.dir * 1000) / (dragDistance * Math.max(1, last.t - first.t));
    const { p, pull } = d.turn;
    const commit = released && (p > 0.42 || (performance.now() - last.t < 100 && velocity > 1.1));
    animateTo(d.dir, p, commit ? 1 : 0, pull);
  }

  // ---------- the turning leaf ----------
  // A plain render function (not a component) so the strips update in place every frame.
  function renderLeaf(t: Turn) {
    const theta = t.p * Math.PI;
    const bend = BEND * Math.sin(theta);
    const hinge = theta - bend;
    const joint = (2 * bend) / (STRIPS - 1);
    const sw = pageW / STRIPS;
    const forward = t.dir === 1;
    const sign = forward ? -1 : 1;
    // Gradients run away from the spine on the front; the back face is mirrored.
    const away = forward ? "right" : "left";
    const toward = forward ? "left" : "right";

    let chain: ReactNode = null;
    for (let i = STRIPS - 1; i >= 0; i--) {
      const near = hinge + joint * i; // angle at the strip's spine-side edge
      const far = near + joint; // and at its outer edge
      const shadeNear = shadeAt(near);
      const shadeFar = shadeAt(far);
      const frontX = forward ? i * sw : pageW - (i + 1) * sw;
      const backX = forward ? pageW - (i + 1) * sw : i * sw;
      const face = (p: FlipPage | null, x: number, isBack: boolean): ReactNode => (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            background: PAPER,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: `${isBack ? "rotateY(180deg) " : ""}translateZ(${PAPER_THICKNESS / 2}px)`,
          }}
        >
          {p?.imageUrl && <div className="absolute top-0" style={{ left: -x, width: pageW, height: pageH, background: `url("${p.imageUrl}") center / contain no-repeat` }} />}
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
          {face(back, backX, true)}
          {i === STRIPS - 1 && (
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
        style={{ width: pageW, height: pageH, transformStyle: "preserve-3d", left: forward ? pageW : 0 }}
      >
        {chain}
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
        closedCover={!turn && (singlePage ? viewingBack : !rightStatic)}
        extra={leafDir === -1 && <div className="absolute inset-y-0 right-0 w-[46%] bg-[linear-gradient(to_left,rgb(52_38_20_/_0.30),transparent_82%)]" style={{ opacity: castShadow }} />}
      />
      <PageFace
        page={rightStatic}
        side="right"
        width={pageW}
        height={pageH}
        closedCover={!turn && (singlePage ? position === 0 : !leftStatic)}
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

  const showLens = lensEnabled && lens && !turn && lens.x >= 0 && lens.y >= 0 && lens.x <= pageW * 2 && lens.y <= pageH;

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
            cursor: lensEnabled ? "none" : turn ? "grabbing" : "grab",
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
          {leftStatic && (
            <div
              className="absolute top-0 left-0"
              style={{ width: pageW, height: pageH, background: PAPER, borderRadius: `${RADIUS}px 0 0 ${RADIUS}px`, boxShadow: stack("left", pagesLeft) }}
            />
          )}
          {rightStatic && (
            <div
              className="absolute top-0"
              style={{ left: pageW, width: pageW, height: pageH, background: PAPER, borderRadius: `0 ${RADIUS}px ${RADIUS}px 0`, boxShadow: stack("right", pagesRight) }}
            />
          )}

          {staticPages}

          {/* overlays sit on the resting pages only */}
          {!turn && leftStatic && leftStatic !== backCover && (
            <div className="absolute top-0 left-0" style={{ width: pageW, height: pageH }}>
              {renderOverlay?.(leftStatic, singlePage ? currentPage : 2 * position - 1, "left")}
            </div>
          )}
          {!turn && rightStatic && (
            <div className="absolute top-0" style={{ left: pageW, width: pageW, height: pageH }}>
              {renderOverlay?.(rightStatic, singlePage ? currentPage : 2 * position, "right")}
            </div>
          )}

          {turn && (turn.pull ? (
            <PaperCurl width={pageW} height={pageH} direction={turn.dir} progress={turn.p} pull={turn.pull} stitchOpacity={stitchOpacity}
              front={images.current.get(front?.imageUrl ?? "")} back={images.current.get(back?.imageUrl ?? "")} />
          ) : renderLeaf(turn))}

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
