"use client";

import { ArrowLeft, Hand, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EIGHTH_WALL_CREDIT, EIGHTH_WALL_LICENSE_URL, isTouchPhone } from "@/ar/eighth-wall-session";
import { startEighthWallModelSession, type ModelPlacementSession, type ModelPlacementState } from "@/ar/eighth-wall-model-session";
import { usePageSounds, type SoundLayer } from "@/lib/page-sound";
import { requestStoryMotion } from "@/lib/story-motion";
import type { ContentData } from "@/lib/content";
import { useI18n } from "@/lib/i18n/client";

export function ModelPlacementViewer({ content, title, sounds, onExit, exitLabel }: {
  content: ContentData;
  title: string;
  /** The page's sounds, played once the model stands in the room. */
  sounds?: SoundLayer[];
  onExit: () => void;
  exitLabel?: string;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const session = useRef<ModelPlacementSession | null>(null);
  const { t } = useI18n();
  const w = t.world;
  const words = useRef(w);
  words.current = w;
  const [state, setState] = useState<ModelPlacementState>("starting");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  usePageSounds(state === "placed" && !error ? sounds : null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setError(null);
      setState("starting");
      try {
        if (!isTouchPhone()) throw new Error(words.current.phoneForModel);
        // XR8 handles any first-use sensor/camera permission prompt. Do not reject an automatic
        // target handoff merely because it didn't originate in another tap.
        if (controller.signal.aborted) return;
        const running = await startEighthWallModelSession(content, overlay.current!, stage.current!, setState, (message) => {
          if (!controller.signal.aborted) setError(message);
        }, controller.signal);
        if (controller.signal.aborted) running.end();
        else session.current = running;
      } catch (cause) {
        if (!controller.signal.aborted) setError((cause as Error).message || words.current.placeFailed);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      session.current?.end();
      session.current = null;
    };
  }, [content, attempt]);

  return (
    <div ref={overlay} dir="ltr" className="fixed inset-0 z-[60] touch-none overflow-hidden bg-black text-white">
      <div ref={stage} className="absolute inset-0" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 safe-top">
        <button onClick={() => { session.current?.end(); onExit(); }} aria-label={exitLabel ?? t.scan.backToScanning} className="grid size-11 place-items-center rounded-full bg-black/50 backdrop-blur">
          <ArrowLeft className="size-5" />
        </button>
        <span className="rounded-full bg-black/50 px-4 py-2 text-sm font-semibold backdrop-blur">{title}</span>
      </div>
      {error ? (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div className="max-w-sm">
            <p role="alert">{error}</p>
            <button onClick={() => { void requestStoryMotion(); setAttempt((value) => value + 1); }} className="mt-5 rounded-2xl bg-white px-6 py-3 font-bold text-black">{t.common.tryAgain}</button>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-6 safe-bottom">
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-black/50 px-4 py-3 text-center text-sm font-semibold backdrop-blur">
            {state === "placed" ? <><Hand className="size-4" /> {w.dragTurn}</> : <><LoaderCircle className="size-4 animate-spin" /> {state === "starting" ? w.startingCamera : w.placing}</>}
          </p>
          <p className="max-w-sm text-center text-[10px] leading-snug text-white/60">{EIGHTH_WALL_CREDIT} <a href={EIGHTH_WALL_LICENSE_URL} target="_blank" rel="noreferrer" className="pointer-events-auto underline">{w.license}</a></p>
        </div>
      )}
    </div>
  );
}
