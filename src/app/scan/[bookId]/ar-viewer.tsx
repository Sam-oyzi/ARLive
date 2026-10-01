"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  ChevronDown,
  Download,
  Hand,
  LoaderCircle,
  RotateCcw,
  Share2,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { ARError, ARSession, loadMindAR, type ARAnchor, type ARStage } from "@/ar/ar-session";
import { applyTransform, createContent, type ContentHandle } from "@/ar/content-objects";
import { PhoneQR } from "@/components/phone-qr";
import type { ContentData } from "@/lib/content";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn, plural } from "@/lib/utils";

type ViewerTarget = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  targetIndex: number;
  contents: ContentData[];
};

type Props = {
  book: { id: string; title: string; mindUrl: string; coverUrl: string | null; subject: { name: string; color: string; icon: string } };
  targets: ViewerTarget[];
  backHref: string;
};

type Phase = "intro" | "starting" | "running" | "error";

const STAGE_TEXT: Record<ARStage, string> = {
  camera: "Waking up the camera…",
  targets: "Loading the book's pages…",
  warmup: "Preparing the AR engine…",
  running: "Ready",
};

type Loaded = { anchor: ARAnchor; handles: ContentHandle[] };

export function ARViewer({ book, targets, backHref }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ARSession | null>(null);
  const loadedRef = useRef(new Map<string, Loaded>());
  const lastLogged = useRef(new Map<string, number>());
  const wakeLock = useRef<{ release(): Promise<void> } | null>(null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [stage, setStage] = useState<ARStage>("camera");
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [insecure, setInsecure] = useState(false);
  const [gestured, setGestured] = useState(false);

  const active = targets.find((t) => t.id === activeId) ?? null;
  const accent = { "--accent": book.subject.color } as CSSProperties;

  useEffect(() => {
    // Start downloading the tracking engine while the student reads the intro.
    loadMindAR().catch(() => {});
    setIsDesktop(window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 900);
    setInsecure(!window.isSecureContext);
  }, []);

  const teardown = useCallback(() => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    for (const { handles } of loadedRef.current.values()) handles.forEach((h) => h.dispose());
    loadedRef.current.clear();
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const logScan = useCallback(
    (targetId: string) => {
      const now = Date.now();
      if (now - (lastLogged.current.get(targetId) ?? 0) < 20_000) return;
      lastLogged.current.set(targetId, now);
      fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, targetId }),
        keepalive: true,
      }).catch(() => {});
    },
    [book.id],
  );

  function start() {
    const container = containerRef.current;
    if (!container) return;
    teardown();
    setError(null);
    setPhase("starting");
    setStage("camera");

    const session = new ARSession(container, { mindUrl: book.mindUrl, onTrackingChange: setTracking });
    sessionRef.current = session;

    // Everything up to the first await runs inside the tap, so media can be unlocked for sound.
    for (const target of targets) {
      const anchor = session.addAnchor(target.targetIndex);
      const handles = target.contents.map((content) => {
        const handle = createContent(content, "ar");
        const wrapper = new THREE.Group();
        applyTransform(wrapper, content);
        wrapper.add(handle.object);
        anchor.gesture.add(wrapper);
        handle.unlock();
        handle.setMuted(muted);
        return handle;
      });
      session.onTick((delta) => {
        if (anchor.visible) handles.forEach((h) => h.update(delta));
      });
      anchor.onFound = () => {
        handles.forEach((h) => {
          h.load().catch(() => {});
          h.play();
        });
        setActiveId(target.id);
        setExpanded(false);
        navigator.vibrate?.(25);
        logScan(target.id);
      };
      anchor.onLost = () => handles.forEach((h) => h.pause());
      loadedRef.current.set(target.id, { anchor, handles });
    }

    session
      .start(setStage)
      .then(async () => {
        setPhase("running");
        try {
          const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
          wakeLock.current = (await nav.wakeLock?.request("screen")) ?? null;
        } catch {
          // not supported or denied; the screen may dim
        }
        // Warm up the remaining content in page order so the first scan feels instant.
        for (const { handles } of loadedRef.current.values()) {
          if (sessionRef.current !== session) return;
          await Promise.all(handles.map((h) => h.load().catch(() => {})));
        }
      })
      .catch((err: unknown) => {
        teardown();
        setError(
          err instanceof ARError
            ? { message: err.message, code: err.code }
            : { message: "AR couldn't start on this device. Try Chrome on Android or Safari on iPhone." },
        );
        setPhase("error");
      });
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    for (const { handles } of loadedRef.current.values()) handles.forEach((h) => h.setMuted(next));
  }

  function replay() {
    if (!activeId) return;
    loadedRef.current.get(activeId)?.handles.forEach((h) => h.restart());
  }

  function resetGesture() {
    if (!activeId) return;
    const gesture = loadedRef.current.get(activeId)?.anchor.gesture;
    gesture?.rotation.set(0, 0, 0);
    gesture?.scale.setScalar(1);
    setGestured(false);
  }

  // ---- Spin (one finger) and pinch (two fingers) the active content ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef(0);

  function activeGesture() {
    return activeId ? loadedRef.current.get(activeId)?.anchor.gesture : undefined;
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), scale: activeGesture()?.scale.x ?? 1 };
    }
    const now = Date.now();
    if (now - lastTap.current < 300) resetGesture();
    lastTap.current = now;
  }

  function onPointerMove(e: React.PointerEvent) {
    const previous = pointers.current.get(e.pointerId);
    if (!previous) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gesture = activeGesture();
    if (!gesture) return;
    if (pointers.current.size === 1) {
      gesture.rotation.z += (e.clientX - previous.x) * 0.012;
      setGestured(true);
    } else if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      gesture.scale.setScalar(THREE.MathUtils.clamp((pinch.current.scale * distance) / pinch.current.distance, 0.3, 4));
      setGestured(true);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function takePhoto() {
    const data = sessionRef.current?.snapshot();
    if (data) setPhoto(data);
  }

  async function sharePhoto() {
    if (!photo) return;
    const blob = await (await fetch(photo)).blob();
    const file = new File([blob], `arlive-${Date.now()}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: active?.name ?? book.title }).catch(() => {});
    } else {
      const a = document.createElement("a");
      a.href = photo;
      a.download = file.name;
      a.click();
    }
  }

  const glass = "bg-black/45 text-white backdrop-blur-xl ring-1 ring-white/15";

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white [overscroll-behavior:none]" style={accent}>
      {/* camera + 3D layers are injected here by ARSession */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* gesture surface */}
      {phase === "running" && (
        <div
          className="absolute inset-0 z-[2] touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 safe-top">
        <Link href={backHref} className={cn("grid size-11 shrink-0 place-items-center rounded-full", glass)} aria-label="Back">
          <ArrowLeft className="size-5" />
        </Link>
        <div className={cn("flex min-w-0 items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5", glass)}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)]">
            <SubjectIcon icon={book.subject.icon} className="size-4" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold">{book.title}</span>
            <span className="block truncate text-[11px] text-white/60">{book.subject.name}</span>
          </span>
        </div>
        {phase === "running" && (
          <div className="ml-auto flex gap-2">
            <button onClick={toggleMute} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <button onClick={takePhoto} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label="Take photo">
              <Camera className="size-5" />
            </button>
          </div>
        )}
      </div>

      {/* scanning guide */}
      {phase === "running" && !tracking && (
        <div className="pointer-events-none absolute inset-0 z-[3] flex flex-col items-center justify-center">
          <div className="relative h-[46vh] max-h-[420px] w-[72vw] max-w-[330px]">
            {[
              "top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl",
              "top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl",
              "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl",
              "right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl",
            ].map((pos) => (
              <span key={pos} className={cn("absolute size-12 border-white", pos)} />
            ))}
            <span className="absolute inset-x-3 h-0.5 animate-scan rounded-full bg-[var(--accent)] shadow-[0_0_24px_6px_var(--accent)]" />
          </div>
          <p className={cn("mt-6 rounded-full px-4 py-2 text-sm font-semibold", glass)}>
            {active ? "Point at the page again" : "Point your camera at a page"}
          </p>
        </div>
      )}

      {/* page strip while scanning */}
      {phase === "running" && !tracking && !active && (
        <div className="absolute inset-x-0 bottom-0 z-10 safe-bottom">
          <div className="px-4 pb-2 text-xs font-semibold text-white/70">{plural(targets.length, "page")} with AR in this book</div>
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none">
            {targets.map((t) => (
              <div key={t.id} className="w-16 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.imageUrl} alt={t.name} className="aspect-[3/4] w-full rounded-xl object-cover ring-2 ring-white/30" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* info card for the recognised page */}
      {phase === "running" && active && (
        <div className="absolute inset-x-0 bottom-0 z-10 px-3 safe-bottom">
          <div className="mx-auto max-w-lg animate-fade-up rounded-[28px] bg-white/95 p-4 text-ink-900 shadow-lift backdrop-blur-xl">
            <button className="flex w-full items-start gap-3 text-left" onClick={() => setExpanded((v) => !v)}>
              <span className="relative mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-white">
                <SubjectIcon icon={book.subject.icon} className="size-5" />
                {tracking && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-white" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold tracking-wide text-[var(--accent)] uppercase">
                  {tracking ? "Page recognised" : "Last page"}
                </span>
                <span className="block font-display text-lg leading-tight font-bold">{active.name}</span>
                {active.description && (
                  <span className={cn("mt-1 block text-sm leading-relaxed text-ink-600", !expanded && "line-clamp-2")}>{active.description}</span>
                )}
              </span>
              {active.description && <ChevronDown className={cn("mt-1 size-5 shrink-0 text-ink-400 transition", expanded && "rotate-180")} />}
            </button>
            <div className="mt-3 flex gap-2">
              <button onClick={replay} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl bg-ink-100 text-sm font-semibold text-ink-800 active:bg-ink-200">
                <RotateCcw className="size-4" /> Replay
              </button>
              {gestured ? (
                <button onClick={resetGesture} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl bg-ink-100 text-sm font-semibold text-ink-800 active:bg-ink-200">
                  <Hand className="size-4" /> Reset
                </button>
              ) : (
                <span className="flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl text-xs font-medium text-ink-500">
                  <Hand className="size-4" /> Drag to spin · pinch to zoom
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* intro */}
      {phase === "intro" && (
        <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-ink-950">
          <div className="absolute inset-0 bg-grid-dark" />
          <div className="absolute -top-32 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-40 blur-[120px]" />
          <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pt-24 pb-10 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 animate-pulse-ring rounded-[28px] bg-[var(--accent)]" />
              <div className="relative grid h-36 w-28 place-items-center overflow-hidden rounded-[22px] bg-[var(--accent)] shadow-[0_30px_60px_-20px_var(--accent)] ring-1 ring-white/20">
                {book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverUrl} alt="" className="size-full object-cover" />
                ) : (
                  <SubjectIcon icon={book.subject.icon} className="size-12" />
                )}
              </div>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{book.title}</h1>
            <p className="mt-2 text-white/60">{plural(targets.length, "page comes", "pages come")} alive in 3D. Open your book and get ready.</p>

            {insecure && (
              <div className="mt-6 flex gap-3 rounded-2xl bg-amber-400/15 p-4 text-left text-sm text-amber-100 ring-1 ring-amber-300/30">
                <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                Browsers only allow the camera on secure (https://) pages. Ask your teacher for the https link.
              </div>
            )}

            <button
              onClick={start}
              className="mt-8 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-base font-bold text-ink-950 shadow-[0_20px_40px_-12px_rgb(255_255_255/0.35)] transition active:scale-[0.98]"
            >
              <Camera className="size-5" /> Start scanning
            </button>
            <p className="mt-3 text-xs text-white/45">We&apos;ll ask for camera access. Nothing is recorded.</p>

            {isDesktop && (
              <div className="mt-8 w-full text-left text-ink-900">
                <PhoneQR path={`/scan/${book.id}`} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* starting */}
      {phase === "starting" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative grid size-20 place-items-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[var(--accent)]" />
              <span className="relative grid size-16 place-items-center rounded-full bg-[var(--accent)]">
                <LoaderCircle className="size-7 animate-spin" />
              </span>
            </div>
            <p className="font-semibold">{STAGE_TEXT[stage]}</p>
          </div>
        </div>
      )}

      {/* error */}
      {phase === "error" && error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950 px-6">
          <div className="flex max-w-sm flex-col items-center text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-rose-500/15 text-rose-300">
              <CameraOff className="size-7" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold">AR couldn&apos;t start</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/65">{error.message}</p>
            <div className="mt-6 flex w-full gap-2">
              <Link href={backHref} className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">
                Go back
              </Link>
              {error.code !== "insecure" && error.code !== "unsupported" && (
                <button onClick={start} className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white text-sm font-bold text-ink-950">
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* photo preview */}
      {photo && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black/90 p-4 backdrop-blur safe-top safe-bottom">
          <div className="flex justify-end">
            <button onClick={() => setPhoto(null)} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label="Close photo">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="AR snapshot" className="max-h-full max-w-full rounded-3xl shadow-lift" />
          </div>
          <div className="mx-auto flex w-full max-w-sm gap-2">
            <a href={photo} download={`arlive-${book.id}.jpg`} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-semibold">
              <Download className="size-4" /> Save
            </a>
            <button onClick={sharePhoto} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-ink-950">
              <Share2 className="size-4" /> Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
