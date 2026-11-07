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
  Orbit,
  RotateCcw,
  Share2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { ARError, ARSession, loadMindAR, type ARAnchor, type ARStage } from "@/ar/ar-session";
import { applyTransform, createContent, type ContentHandle } from "@/ar/content-objects";
import { MotionPlayer } from "@/ar/motion";
import { parseMotion } from "@/lib/motion-schema";
import { PhoneQR } from "@/components/phone-qr";
import { WorldViewer } from "@/components/story-world/world-viewer";
import { Thumb } from "@/components/thumb";
import type { ContentData } from "@/lib/content";
import { SubjectIcon } from "@/lib/subject-icons";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { storyMotionReady } from "@/lib/story-motion";
import { worldExperienceOf, opensModel, placementModel, rendersOnTarget, type ScanAction } from "@/lib/scan-actions";
import { ScanLaunchGate } from "@/lib/scan-launch";
import { usePageSounds, type SoundLayer } from "@/lib/page-sound";
import type { WorldEffect } from "@/lib/world-effects";
import { QuickLookLaunch } from "./quick-look";
import { QuickLookAssets, supportsQuickLook } from "@/ar/quick-look-assets";
import { ModelPlacementViewer } from "@/components/model-placement-viewer";

type ViewerTarget = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  /** Artwork for the selected story box or 360° view. */
  worldUrl: string | null;
  worldEffect: WorldEffect;
  /** The studio-selected page experience. */
  scanAction: ScanAction;
  narrationUrl: string | null;
  /** Sounds for whichever experience this page opens. */
  sounds: SoundLayer[];
  targetIndex: number;
  contents: ContentData[];
};

type Props = {
  book: { id: string; title: string; mindUrl: string; coverUrl: string | null; subject: { name: string; color: string; icon: string } };
  targets: ViewerTarget[];
  backHref: string;
  scanHref: string;
  previewTargetId?: string;
};

type Phase = "starting" | "running" | "error";

/** Pages the studio set to open their story world when scanned (and that have one). */
const opensWorld = (target: ViewerTarget) => worldExperienceOf(target.scanAction, target.worldUrl) !== null;

type Loaded = { anchor: ARAnchor; handles: ContentHandle[]; motions: MotionPlayer[] };

export function ARViewer({ book, targets, backHref, scanHref, previewTargetId }: Props) {
  const { t } = useI18n();
  const w = t.scan;
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ARSession | null>(null);
  const loadedRef = useRef(new Map<string, Loaded>());
  const lastLogged = useRef(new Map<string, number>());
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const [phase, setPhase] = useState<Phase>("starting");
  const [stage, setStage] = useState<ARStage>("camera");
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [gestured, setGestured] = useState(false);
  // A short "drag to spin" hint each time a page is recognised, then out of the way.
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    if (!activeId) return;
    setShowHint(true);
    const timer = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(timer);
  }, [activeId]);
  // A recognised page opens exactly the experience selected in Studio.
  const [world, setWorld] = useState<ViewerTarget | null>(null);
  // Avoid pulling the child straight back inside when they return to the same printed page.
  const launchGate = useRef(new ScanLaunchGate());
  const [modelTarget, setModelTarget] = useState<ViewerTarget | null>(null);
  const quickAssets = useRef<QuickLookAssets | null>(null);
  const prepareQuickLook = useCallback((content: ContentData) => {
    quickAssets.current ??= new QuickLookAssets();
    return quickAssets.current.prepare(content);
  }, []);

  useEffect(() => {
    const assets = new QuickLookAssets();
    quickAssets.current = assets;
    if (supportsQuickLook()) {
      // Serial preparation limits memory use on phones; recognition can await an in-flight asset.
      void (async () => {
        for (const target of targets) {
          if (quickAssets.current !== assets) break;
          const model = target.scanAction === "quicklook" && placementModel(target.contents);
          if (model) await assets.prepare(model).catch(() => {});
        }
      })();
    }
    return () => { if (quickAssets.current === assets) quickAssets.current = null; assets.dispose(); };
  }, [targets]);

  const active = targets.find((t) => t.id === activeId) ?? null;
  // A MindAR page's sounds, kept a moment after tracking drops so a wobble doesn't cut them.
  // Pages that open another viewer play their sound there instead.
  const [heard, setHeard] = useState(false);
  useEffect(() => {
    if (tracking) {
      setHeard(true);
      return;
    }
    const timer = window.setTimeout(() => setHeard(false), 3000);
    return () => window.clearTimeout(timer);
  }, [tracking]);
  const onTargetSound = phase === "running" && heard && !world && !modelTarget && active && rendersOnTarget(active.scanAction);
  usePageSounds(onTargetSound ? active.sounds : null, { muted });
  const accent = { "--accent": book.subject.color } as CSSProperties;

  useEffect(() => {
    // Warm the tracking engine while the camera opens.
    loadMindAR().catch(() => {});
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

  // While the child is inside a story world, the scanner's camera rests; it starts again on the way out.
  useEffect(() => {
    if (!world && !modelTarget) return;
    teardown();
    setPhase("starting");
  }, [world, modelTarget, teardown]);

  /** Keeps the screen on while scanning. Browsers drop the lock whenever the page is hidden. */
  const keepScreenOn = useCallback(async () => {
    if (wakeLock.current && !wakeLock.current.released) return;
    try {
      const lock = await navigator.wakeLock?.request("screen");
      if (sessionRef.current) wakeLock.current = lock ?? null;
      else lock?.release().catch(() => {}); // left the scanner while waiting
    } catch {
      // not supported or denied; the screen may dim
    }
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    // Quick Look is a native overlay. Keep the tracking session and resume its
    // video if the browser paused it while the overlay had focus.
    const resume = () => {
      if (document.hidden) return;
      sessionRef.current?.resumeCamera();
      void keepScreenOn();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, [phase, keepScreenOn]);

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
    // Story worlds use motion sensors on iPhone; ask from the scanner's start tap.
    if (navigator.userActivation?.isActive && targets.some((target) => target.scanAction === "world" || target.scanAction === "eighthwall")) {
      void storyMotionReady();
    }
    teardown();
    launchGate.current.resumeScanning();
    setError(null);
    setActiveId(null);
    setTracking(false);
    setExpanded(false);
    setGestured(false);
    setPhase("starting");
    setStage("camera");

    let session: ARSession | null = null;
    const fail = (err: unknown) => {
      if (session && sessionRef.current !== session) return;
      teardown();
      setError(
        err instanceof ARError
          ? { message: err.message, code: err.code }
          : { message: "AR couldn't start on this device. Try Chrome on Android or Safari on iPhone." },
      );
      setPhase("error");
    };

    try {
      session = new ARSession(container, { mindUrl: book.mindUrl, onTrackingChange: setTracking });
      sessionRef.current = session;

      // Everything up to the first await runs inside the tap, so media can be unlocked for sound.
      for (const target of targets) {
        const anchor = session.addAnchor(target.targetIndex);
        const handles: ContentHandle[] = [];
        const motions: MotionPlayer[] = [];
        for (const content of rendersOnTarget(target.scanAction) ? target.contents : []) {
          const handle = createContent(content, "ar");
          // wrapper = authored placement (keyframes drive it) → motion group (presets drive it) → content
          const wrapper = new THREE.Group();
          applyTransform(wrapper, content);
          const motionGroup = new THREE.Group();
          motionGroup.add(handle.object);
          wrapper.add(motionGroup);
          anchor.gesture.add(wrapper);
          handle.unlock();
          handle.setMuted(muted);
          handles.push(handle);
          motions.push(new MotionPlayer(parseMotion(content.motion), content.type, wrapper, motionGroup));
        }
        session.onTick((delta) => {
          if (!anchor.visible) return;
          handles.forEach((h) => h.update(delta));
          motions.forEach((m) => m.update(delta));
        });
        anchor.onFound = () => {
          // Like an image target that opens a scene: a page with a story world takes the child inside it,
          // the first time it's scanned.
          const action = launchGate.current.found(target.id, opensWorld(target) || opensModel(target.scanAction));
          if (action === "ignore") return;
          if (action === "resume") { setActiveId(target.id); return; }
          if (action === "launch") {
            navigator.vibrate?.(25);
            logScan(target.id);
            if (opensWorld(target)) setWorld(target);
            else setModelTarget(target);
            return;
          }
          handles.forEach((h) => {
            h.load().catch(() => {});
            h.play();
          });
          motions.forEach((m) => m.found());
          setActiveId(target.id);
          setExpanded(false);
          navigator.vibrate?.(25);
          logScan(target.id);
        };
        anchor.onLost = () => {
          launchGate.current.lost(target.id);
          handles.forEach((h) => h.pause());
          motions.forEach((m) => m.lost());
        };
        loadedRef.current.set(target.id, { anchor, handles, motions });
      }
    } catch (err) {
      fail(err);
      return;
    }

    session
      .start(setStage)
      .then(async () => {
        if (sessionRef.current !== session) return; // left the scanner while it was starting
        setPhase("running");
        await keepScreenOn();
        // Warm up the remaining content in page order so the first scan feels instant.
        for (const { handles } of loadedRef.current.values()) {
          if (sessionRef.current !== session) return;
          await Promise.all(handles.map((h) => h.load().catch(() => {})));
        }
      })
      .catch(fail);
  }

  useEffect(() => {
    const preview = targets.find((target) => target.id === previewTargetId && opensModel(target.scanAction));
    const timer = window.setTimeout(() => preview ? setModelTarget(preview) : start(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once for this scanner mount
  }, []);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    for (const { handles } of loadedRef.current.values()) handles.forEach((h) => h.setMuted(next));
  }

  function replay() {
    if (!activeId) return;
    const loaded = loadedRef.current.get(activeId);
    loaded?.handles.forEach((h) => h.restart());
    loaded?.motions.forEach((m) => m.restart());
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
    // A second finger starts a pinch, so it must not count as a double tap.
    const singleFinger = pointers.current.size === 1;
    const now = Date.now();
    if (singleFinger && now - lastTap.current < 300) resetGesture();
    lastTap.current = singleFinger ? now : 0;
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
    const file = new File([blob], `pagewakes-${Date.now()}.jpg`, { type: "image/jpeg" });
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
    <div dir="ltr" className="fixed inset-0 overflow-hidden bg-black text-white [overscroll-behavior:none]" style={accent}>
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

      {/* top bar — above the loading/error screens (z-20) so Back is always reachable,
          below the photo preview (z-30) which has its own close button */}
      <div className="absolute inset-x-0 top-0 z-[25] flex items-center gap-3 px-4 safe-top">
        <Link href={backHref} className={cn("grid size-11 shrink-0 place-items-center rounded-full", glass)} aria-label={w.back}>
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
            <button onClick={toggleMute} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label={muted ? w.unmute : w.mute}>
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <button onClick={takePhoto} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label={w.photo}>
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
            {active ? w.pointAgain : w.pointCamera}
          </p>
        </div>
      )}

      {/* page strip while scanning */}
      {phase === "running" && !tracking && !active && (
        <div className="absolute inset-x-0 bottom-0 z-10 safe-bottom">
          <div className="px-4 pb-2 text-xs font-semibold text-white/70">{w.pagesWithAr(targets.length)}</div>
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none">
            {targets.map((t) => (
              <div key={t.id} className="w-16 shrink-0">
                <Thumb src={t.imageUrl} alt={t.name} width={64} height={85} className="aspect-[3/4] w-full rounded-xl object-cover ring-2 ring-white/30" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* the recognised page: a slim bar, so the AR on the page stays in view; details on a tap */}
      {phase === "running" && active && (
        <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-2 safe-bottom">
          <div className="mx-auto max-w-lg animate-fade-up">
            {(opensWorld(active) || opensModel(active.scanAction)) && (
              <div className="mb-2 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => {
                    if (opensWorld(active)) setWorld(active);
                    else setModelTarget(active);
                  }}
                  className="flex h-12 items-center gap-2 rounded-full bg-sky-600 px-5 text-sm font-bold text-white shadow-lift active:scale-[0.98]"
                >
                  <Orbit className="size-4" /> {active.scanAction === "panorama" ? w.open.panorama : active.scanAction === "world" ? w.open.world : active.scanAction === "quicklook" ? w.open.quicklook : w.open.model}
                </button>
              </div>
            )}
            {expanded ? (
              <div className="mb-2 rounded-3xl bg-white/95 p-4 text-ink-900 shadow-lift backdrop-blur-xl">
                {active.description && <p className="text-sm leading-relaxed text-ink-600">{active.description}</p>}
                {rendersOnTarget(active.scanAction) && <>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                    <Hand className="size-3.5" /> {w.dragSpin}
                  </p>
                </>}
              </div>
            ) : (
              showHint && rendersOnTarget(active.scanAction) && (
                <p className={cn("mx-auto mb-2 flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", glass)}>
                  <Hand className="size-3.5" /> {w.dragSpin}
                </p>
              )
            )}
            <div className={cn("flex items-center gap-1.5 rounded-full p-1.5", glass)}>
              <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white">
                  <SubjectIcon icon={book.subject.icon} className="size-4" />
                  {tracking && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-black/30" />}
                </span>
                <span className="min-w-0 truncate text-sm font-bold">{active.name}</span>
                <ChevronDown className={cn("size-4 shrink-0 opacity-70 transition", !expanded && "rotate-180")} />
              </button>
              {gestured && (
                <button onClick={resetGesture} aria-label={w.putBack} className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 active:bg-white/25">
                  <Hand className="size-4" />
                </button>
              )}
              {rendersOnTarget(active.scanAction) && <button onClick={replay} aria-label={w.replay} className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 active:bg-white/25">
                <RotateCcw className="size-4" />
              </button>}
            </div>
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
            <p className="font-semibold">{w.stages[stage]}</p>
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
            <h2 className="mt-5 font-display text-xl font-bold">{w.failed}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/65">{(error.code && w.errors[error.code]) || (error.code ? error.message : w.errors.default)}</p>
            <div className="mt-6 flex w-full gap-2">
              <Link href={backHref} className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">
                {w.goBack}
              </Link>
              {error.code !== "insecure" && error.code !== "unsupported" && (
                <button onClick={start} className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white text-sm font-bold text-ink-950">
                  {t.common.tryAgain}
                </button>
              )}
            </div>
            {/* No usable camera here (typical on laptops): hand over to a phone. */}
            {error.code !== "targets" && <PhoneQR path={scanHref} dark size={120} className="mt-6 w-full text-left" />}
          </div>
        </div>
      )}

      {/* photo preview */}
      {photo && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black/90 p-4 backdrop-blur safe-top safe-bottom">
          <div className="flex justify-end">
            <button onClick={() => setPhoto(null)} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label={w.closePhoto}>
              <X className="size-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="AR snapshot" className="max-h-full max-w-full rounded-3xl shadow-lift" />
          </div>
          <div className="mx-auto flex w-full max-w-sm gap-2">
            <a href={photo} download={`pagewakes-${book.id}.jpg`} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-semibold">
              <Download className="size-4" /> {w.savePhoto}
            </a>
            <button onClick={sharePhoto} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-ink-950">
              <Share2 className="size-4" /> {w.share}
            </button>
          </div>
        </div>
      )}

      {modelTarget && (modelTarget.scanAction === "quicklook" ? (
        <QuickLookLaunch
          key={modelTarget.id}
          content={placementModel(modelTarget.contents)}
          title={modelTarget.name}
          prepare={prepareQuickLook}
          onExit={() => { setModelTarget(null); start(); }}
          exitLabel={w.backToScanning}
        />
      ) : placementModel(modelTarget.contents) ? (
        <ModelPlacementViewer
          key={modelTarget.id}
          content={placementModel(modelTarget.contents)!}
          title={modelTarget.name}
          sounds={modelTarget.sounds}
          onExit={() => { setModelTarget(null); start(); }}
          exitLabel={w.backToScanning}
        />
      ) : (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black px-6 text-center text-white">
          <div><p role="alert">{w.needsModel}</p><button className="mt-5 rounded-xl bg-white px-5 py-3 font-bold text-black" onClick={() => { setModelTarget(null); start(); }}>{w.backToScanning}</button></div>
        </div>
      ))}

      {world?.worldUrl && (
        <div className="fixed inset-0 z-[60]">
          <WorldViewer
            key={`${world.id}:${world.scanAction}`}
            world={{
              url: world.worldUrl,
              effect: world.worldEffect,
              title: world.name,
              bookTitle: book.title,
              color: book.subject.color,
              narrationUrl: world.narrationUrl,
              sounds: world.sounds,
            }}
            backHref={scanHref}
            experience={worldExperienceOf(world.scanAction, world.worldUrl)!}
            onExit={() => {
              // Back to scanning, from this tap (the camera may only start from one on iPhone).
              setWorld(null);
              start();
            }}
          />
        </div>
      )}
    </div>
  );
}
