"use client";

// What the badges on a page mean (Scan, Step inside, 360° view, Place model), each acted out in a
// little phone. The scenes are CSS only, drawn from the Sarra book's own art and 3D characters
// (public/experiences), so the home page stays light. The badges match the ones in the reader.
import { Box, Check, Compass, Hand, Orbit, ScanLine, Sparkles, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PaperBadge, type PaperBadgeKind } from "@/components/paper-badge";
import { cn } from "@/lib/utils";
import styles from "./page-experiences.module.css";

const BADGE_KIND: Record<"scan" | "inside" | "360" | "model", PaperBadgeKind> = { scan: "scan", inside: "inside", "360": "panorama", model: "model" };

type Experience = {
  key: "scan" | "inside" | "360" | "model";
  name: string;
  /** The badge as it appears on a page in the reader. */
  badge: { label: string; icon: LucideIcon; dark?: boolean };
  title: string;
  text: string;
  need: string;
  /** How long one loop of the scene lasts, in ms: the showcase moves on after it. */
  loop: number;
};

const EXPERIENCES: Experience[] = [
  {
    key: "scan",
    name: "Scan",
    badge: { label: "Scan printed book", icon: ScanLine, dark: true },
    title: "Scan the printed page",
    text: "Open the printed book, then point a phone at a page marked AR. The phone recognises the page and its characters hop out of the paper in 3D.",
    need: "The printed book and a phone camera",
    loop: 6000,
  },
  {
    key: "inside",
    name: "Step inside",
    badge: { label: "Step inside", icon: Orbit },
    title: "Step inside the story",
    text: "A story box appears on your floor. Walk through its wall and you're standing in the story's world: look up, down and all around you.",
    need: "A phone with a camera and a little floor space",
    loop: 9000,
  },
  {
    key: "360",
    name: "360° view",
    badge: { label: "Look around", icon: Orbit },
    title: "Look all around in 360°",
    text: "The page opens into the whole scene around you. Turn your phone, or drag with a finger or a mouse, to see what's behind you.",
    need: "Any phone, tablet or laptop",
    loop: 9000,
  },
  {
    key: "model",
    name: "Place model",
    badge: { label: "Place model", icon: Box },
    title: "Bring a character home",
    text: "Put a story character on your floor or table, life size for little hands, and walk all the way around it. No printed book needed.",
    need: "A phone with a camera",
    loop: 7000,
  },
];

const ART = "/experiences";

export function PageExperiences() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const tablist = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const experience = EXPERIENCES[active]!;

  // Scenes only play while they can be seen.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One loop of each scene, then the next, until the visitor picks one themselves.
  useEffect(() => {
    if (!auto || !inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % EXPERIENCES.length), experience.loop);
    return () => window.clearTimeout(timer);
  }, [auto, inView, active, experience.loop]);

  // On a phone the badges scroll sideways: keep the playing one in view, without moving the page.
  useEffect(() => {
    const list = tablist.current;
    const tab = tabs.current[active];
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    const offset = tab.getBoundingClientRect().left - list.getBoundingClientRect().left;
    list.scrollBy({ left: offset - (list.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const pick = useCallback((index: number, focus = false) => {
    setAuto(false);
    setActive(index);
    if (focus) tabs.current[index]?.focus();
  }, []);

  return (
    <section id="experiences" aria-labelledby={`${id}-title`} className="relative scroll-mt-20 overflow-hidden bg-[#1c1813] py-20 text-white">
      <div aria-hidden="true" className="absolute -top-40 left-1/4 size-[520px] rounded-full bg-sky-500/20 blur-[120px]" />
      <div aria-hidden="true" className="absolute -right-24 bottom-0 size-[420px] rounded-full bg-brand-500/20 blur-[110px]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-amber-200 ring-1 ring-white/10">
            <Sparkles aria-hidden="true" className="size-3.5" /> Pages that wake up
          </span>
          <h2 id={`${id}-title`} className="mt-5 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Scan, Step inside, 360°: what do they mean?
          </h2>
          <p className="mt-3 text-lg text-pretty text-white/70">
            Some pages carry a little badge. Tap it while reading on a phone, or scan the printed page, and the story jumps off the
            paper. No app to install.
          </p>
        </div>

        {/* Phones: badges, then the scene, then what it means. Laptops: badges and words beside the scene. */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:gap-x-16 lg:gap-y-8">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
            <div
              ref={tablist}
              role="tablist"
              aria-label="Page experiences"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0 lg:flex-col lg:gap-3"
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                pick((active + step + EXPERIENCES.length) % EXPERIENCES.length, true);
              }}
            >
              {EXPERIENCES.map((item, index) => {
                const selected = index === active;
                return (
                  <button
                    key={item.key}
                    ref={(el) => { tabs.current[index] = el; }}
                    type="button"
                    role="tab"
                    id={`${id}-tab-${item.key}`}
                    aria-selected={selected}
                    aria-controls={`${id}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => pick(index)}
                    className={cn(
                      "group relative shrink-0 overflow-hidden rounded-2xl text-left ring-1 transition lg:w-full",
                      selected ? "bg-white text-ink-900 ring-white" : "bg-white/[0.06] text-white ring-white/10 hover:bg-white/10",
                    )}
                  >
                    <span className="flex items-center gap-3 px-3.5 py-3 lg:px-4 lg:py-4">
                      <span className="flex shrink-0 lg:w-[172px]">
                        <PaperBadge kind={BADGE_KIND[item.key]} label={item.badge.label} tilt={index % 2 ? 1.5 : -1.5} />
                      </span>
                      <span className="hidden min-w-0 lg:block">
                        <span className="block font-display text-[17px] font-bold">{item.title}</span>
                        <span className={cn("block truncate text-sm", selected ? "text-ink-500" : "text-white/60")}>{item.need}</span>
                      </span>
                    </span>
                    {/* How long until the next scene, while the showcase plays by itself. */}
                    {selected && auto && inView && (
                      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-ink-900/10">
                        <span key={active} className="block h-full origin-left animate-auto-read bg-brand-500 motion-reduce:hidden" style={{ animationDuration: `${item.loop}ms` }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={stage} data-paused={!inView} className={cn(styles.stage, "mx-auto lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center")} aria-hidden="true">
            <Phone sway={experience.key === "360"}>
              {/* Keyed so each scene starts from its beginning when it's picked. */}
              <Scene key={experience.key} kind={experience.key} />
            </Phone>
          </div>

          <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${experience.key}`} className="text-center sm:mx-auto sm:max-w-xl lg:col-start-1 lg:row-start-2 lg:mx-0 lg:self-start lg:text-left">
            <h3 className="font-display text-2xl font-bold">{experience.title}</h3>
            <p className="mt-2 text-[17px] leading-relaxed text-pretty text-white/75">{experience.text}</p>
            <p className="mt-4 text-sm font-semibold text-amber-200">
              <Check aria-hidden="true" className="mr-1.5 inline size-4 align-[-3px]" />
              You need: {experience.need.toLowerCase()}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Phone({ sway, children }: { sway: boolean; children: ReactNode }) {
  return (
    <div className={cn("relative w-[232px] sm:w-[260px]", sway && styles.phoneSway)}>
      <div className="absolute inset-6 -z-10 rounded-full bg-sky-400/30 blur-3xl" />
      <div className="relative aspect-[9/19] rounded-[42px] bg-ink-950 p-[9px] shadow-[0_40px_80px_-20px_rgb(0_0_0/0.6),inset_0_0_0_1.5px_rgb(255_255_255/0.14)]">
        <span className="absolute top-24 -left-[3px] h-9 w-[3px] rounded-l bg-ink-700" />
        <span className="absolute top-36 -left-[3px] h-12 w-[3px] rounded-l bg-ink-700" />
        <span className="absolute top-32 -right-[3px] h-16 w-[3px] rounded-r bg-ink-700" />
        <div className="relative h-full overflow-hidden rounded-[34px] bg-ink-900">
          {children}
          {/* the camera island */}
          <span className="absolute top-2.5 left-1/2 z-20 h-5 w-16 -translate-x-1/2 rounded-full bg-black" />
        </div>
      </div>
    </div>
  );
}

/** A label on the phone screen, centred without transforms (the scenes animate those). */
function Chip({ className, children, top }: { className?: string; children: ReactNode; top?: boolean }) {
  return (
    <div className={cn("absolute inset-x-0 z-10 flex justify-center px-3", top ? "top-11" : "bottom-5", className)}>
      <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap text-white ring-1 ring-white/15">
        {children}
      </span>
    </div>
  );
}

function Scene({ kind }: { kind: Experience["key"] }) {
  if (kind === "scan") return <ScanScene />;
  if (kind === "inside") return <InsideScene />;
  if (kind === "360") return <PanoramaScene />;
  return <ModelScene />;
}

function ScanScene() {
  const corner = "border-[3px]";
  return (
    <div className={cn("absolute inset-0", styles.desk)}>
      <div className={styles.scanPage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${ART}/scan-page.webp`} alt="" width={360} height={480} className="size-full rounded-[3px] object-cover" />
        <span className={styles.scanLine} />
        <span className={cn(styles.corner, corner, "-top-2 -left-2 rounded-tl-lg border-r-0 border-b-0")} />
        <span className={cn(styles.corner, corner, "-top-2 -right-2 rounded-tr-lg border-b-0 border-l-0")} />
        <span className={cn(styles.corner, corner, "-bottom-2 -left-2 rounded-bl-lg border-t-0 border-r-0")} />
        <span className={cn(styles.corner, corner, "-right-2 -bottom-2 rounded-br-lg border-t-0 border-l-0")} />
      </div>
      {/* the lion, out of the page */}
      <div className={cn("absolute top-[45%] left-1/2 h-[7%] w-[42%] -translate-x-1/2 rounded-[50%] bg-black/45 blur-md", styles.shadowGrow)} />
      <div className="absolute inset-x-0 top-[17%] flex justify-center">
        <div className={styles.bob}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/lion-front.webp`} alt="" width={234} height={284} className={cn("w-[112px] drop-shadow-[0_10px_14px_rgb(0_0_0/0.35)]", styles.popUp)} />
        </div>
      </div>
      <Star className="top-[18%] left-[22%]" delay={0} />
      <Star className="top-[14%] right-[20%]" delay={0.25} />
      <Star className="top-[34%] right-[16%]" delay={0.45} />
      <Chip top className={styles.chipIn}>
        <Check className="size-3.5 text-green-400" /> AR page found
      </Chip>
      <Chip>
        <ScanLine className="size-3.5" /> Point at a page marked AR
      </Chip>
    </div>
  );
}

function Star({ className, delay }: { className: string; delay: number }) {
  return (
    <span className={cn(styles.sparkle, "text-amber-200", className)} style={{ animationDelay: `${delay}s` }}>
      <Sparkles className="size-4" fill="currentColor" />
    </span>
  );
}

// Floorboards running to a vanishing point above the wall line, so the floor lies flat in the picture.
const BOARDS = Array.from({ length: 17 }, (_, i) => {
  const spread = (i - 8) * 15;
  return { top: 50 + (spread * 40) / 88, bottom: 50 + spread };
});

/** The camera's view of a room: a wall and a wooden floor. */
function Room() {
  return (
    <div className={cn("absolute inset-0", styles.room)}>
      <svg viewBox="0 0 100 48" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[48%] w-full">
        <defs>
          <linearGradient id="pe-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a47950" />
            <stop offset="1" stopColor="#c99b6c" />
          </linearGradient>
        </defs>
        <rect width="100" height="48" fill="url(#pe-floor)" />
        {BOARDS.map((board) => (
          <line key={board.bottom} x1={board.top} y1="0" x2={board.bottom} y2="48" stroke="#8a6440" strokeOpacity="0.45" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        <rect width="100" height="1.2" fill="#7d5a39" opacity="0.6" />
      </svg>
    </div>
  );
}

function InsideScene() {
  const faces = [
    { transform: "translateZ(calc(var(--cube) / 2))", position: "0% 0" },
    { transform: "rotateY(90deg) translateZ(calc(var(--cube) / 2))", position: "33.33% 0" },
    { transform: "rotateY(180deg) translateZ(calc(var(--cube) / 2))", position: "66.66% 0" },
    { transform: "rotateY(-90deg) translateZ(calc(var(--cube) / 2))", position: "100% 0" },
  ];
  return (
    <div className="absolute inset-0" style={{ "--cube": "96px" } as CSSProperties}>
      <div className={cn("absolute inset-0", styles.walkIn)}>
        <Room />
        <div className={cn(styles.ring, styles.ringPulse)} />
        <div className={styles.cubeWrap}>
          <div className={styles.cube}>
            {faces.map((face) => (
              <div key={face.position} className={styles.face} style={{ transform: face.transform, backgroundImage: `url(${ART}/world-owl.webp)`, backgroundPosition: face.position }} />
            ))}
            <div className={styles.face} style={{ transform: "rotateX(90deg) translateZ(calc(var(--cube) / 2))", background: "linear-gradient(#cfe3ee, #b9d4e4)" }} />
          </div>
        </div>
        <Chip className={styles.outsideChip}>
          <Hand className="size-3.5" /> Step in here
        </Chip>
      </div>
      <div className={cn("absolute inset-0 overflow-hidden", styles.inside)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${ART}/world-owl.webp`} alt="" width={1200} height={420} className={cn("h-full w-auto max-w-none", styles.insidePan)} />
        <Chip className={styles.insideChip}>
          <Orbit className="size-3.5" /> You&apos;re inside the story!
        </Chip>
      </div>
    </div>
  );
}

function PanoramaScene() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-sky-200">
      <div className={cn("flex h-full w-max", styles.panoTrack)}>
        {[0, 1].map((copy) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={copy} src={`${ART}/world-forest.webp`} alt="" width={1600} height={560} className="h-full w-auto max-w-none" />
        ))}
      </div>
      <Chip top>
        <span className="font-bold">360°</span> Turn around to look
      </Chip>
      <div className="absolute inset-x-0 bottom-5 flex justify-center">
        <span className="relative grid size-16 place-items-center rounded-full bg-black/55 ring-1 ring-white/20">
          <span className="absolute top-1 text-[9px] font-bold text-white/80">N</span>
          <span className={cn("absolute inset-2", styles.needle)}>
            <span className="absolute top-0 left-1/2 h-1/2 w-1 -translate-x-1/2 rounded-full bg-gradient-to-t from-transparent to-brand-400" />
          </span>
          <Compass className="size-5 text-white" />
        </span>
      </div>
    </div>
  );
}

function ModelScene() {
  return (
    <div className="absolute inset-0">
      <Room />
      <div className={cn(styles.ring, styles.ringPulse, styles.ringFade)} />
      <div className={cn("absolute top-[73%] left-1/2 h-[6%] w-[46%] -translate-x-1/2 rounded-[50%] bg-black/35 blur-[6px]", styles.dropShadow)} />
      <div className="absolute inset-x-0 top-[45%] flex justify-center">
        <div className={styles.turntable}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/lion-side.webp`} alt="" width={212} height={280} className={cn("w-[104px]", styles.drop)} />
        </div>
      </div>
      <div className={cn("absolute top-[66%] right-[9%]", styles.friend)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${ART}/tortoise.webp`} alt="" width={212} height={141} className="w-[58px] drop-shadow-[0_6px_6px_rgb(0_0_0/0.3)]" />
      </div>
      <Chip top className={styles.placeChip}>
        <Hand className="size-3.5" /> Tap the ring to place it
      </Chip>
      <Chip top className={styles.walkChip}>
        <Box className="size-3.5" /> Walk all the way around it
      </Chip>
    </div>
  );
}
