"use client";

import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supportsQuickLook } from "@/ar/quick-look-assets";
import type { ContentData } from "@/lib/content";

/** How long Safari gets to bring Quick Look up before we decide it wants a tap first. */
const OPEN_TIMEOUT_MS = 1500;

/** Hands a prepared USDZ to Quick Look: a rel=ar link whose only child is an image, as <model-viewer> does. */
function openQuickLook(url: string) {
  const anchor = document.createElement("a");
  anchor.rel = "ar";
  anchor.href = url;
  anchor.style.display = "none";
  anchor.appendChild(document.createElement("img"));
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Opens only the Studio-selected object, straight away: no engine or object picker and no button to
 * press. Coming back from Quick Look returns to the caller (scanning, or the book). A button only
 * appears if Safari wouldn't open Quick Look without a tap.
 */
export function QuickLookLaunch({ content, title, prepare, onExit, exitLabel = "Back to scanning" }: {
  content: ContentData | undefined;
  title: string;
  prepare: (content: ContentData) => Promise<string>;
  onExit: () => void;
  exitLabel?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const opened = useRef<string | null>(null);
  const exit = useRef(onExit);
  exit.current = onExit;

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setError(null);
    setNeedsTap(false);
    if (!supportsQuickLook()) {
      setError("This page uses Apple AR Quick Look. Open it in Safari on an iPhone or iPad.");
      return;
    }
    if (!content) {
      setError("This page needs a 3D model. Ask the administrator to add one in Studio.");
      return;
    }
    // Usually ready already: the scanner prepares it while the book is being scanned.
    prepare(content).then((ready) => { if (alive) setUrl(ready); }).catch(() => {
      if (alive) setError("The 3D model couldn't be prepared. Check your connection and try again.");
    });
    return () => { alive = false; };
  }, [content, prepare, attempt]);

  useEffect(() => {
    if (!url) return;
    // Quick Look covers Safari, so the page loses focus while it's up and gets it back when it closes.
    let away = false;
    const leave = () => { away = true; };
    const back = () => { if (away && !document.hidden) exit.current(); };
    const visibility = () => (document.hidden ? leave() : back());
    window.addEventListener("blur", leave);
    window.addEventListener("pagehide", leave);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", visibility);
    const timer = window.setTimeout(() => { if (!away) setNeedsTap(true); }, OPEN_TIMEOUT_MS);
    // Once per prepared model, also under React's development double effects.
    if (opened.current !== url) {
      opened.current = url;
      openQuickLook(url);
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", leave);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [url]);

  return (
    <div className={error ? "fixed inset-0 z-[60] bg-ink-950 text-white" : "fixed inset-0 z-[60] bg-black/30 text-white"}>
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 px-4 safe-top">
        <button onClick={onExit} aria-label={exitLabel} className="grid size-11 place-items-center rounded-full bg-black/50 backdrop-blur"><ArrowLeft className="size-5" /></button>
        <span className="rounded-full bg-black/50 px-4 py-2 text-sm font-semibold backdrop-blur">{title}</span>
      </div>
      {error ? (
        <div className="grid size-full place-items-center px-6 text-center">
          <div className="flex max-w-sm flex-col items-center gap-5">
            <p role="alert">{error}</p>
            {supportsQuickLook() && content && <button onClick={() => setAttempt((value) => value + 1)} className="rounded-xl bg-white px-5 py-3 font-bold text-ink-950">Try again</button>}
          </div>
        </div>
      ) : (
        // Small and low on the screen: without a fresh tap Safari shows its own "View in AR?" in the
        // middle, and this mustn't look like a second question.
        <div className="absolute inset-x-0 bottom-0 flex justify-center px-6 pb-8 safe-bottom">
          {needsTap && url ? (
            <button onClick={() => openQuickLook(url)} className="flex h-12 items-center rounded-full bg-white px-5 text-sm font-bold text-ink-950 shadow-lift">
              Open in AR Quick Look
            </button>
          ) : (
            <p role="status" className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-2.5 text-sm font-semibold backdrop-blur">
              <LoaderCircle className="size-4 animate-spin" /> {url ? "Opening AR Quick Look…" : "Preparing the 3D model…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
