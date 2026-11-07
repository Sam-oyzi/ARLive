"use client";

// Behind the book on tablets and laptops: the open pages' own art, shrunk to a few pixels and blurred,
// so the desk takes on the colours of the story (green in the forest, blue by the river) without
// drawing the eye away from the page. It fades to the new colours as the pages turn.
import { useEffect, useState } from "react";
import { loadPageImage } from "@/lib/page-images";

/** Pixels per page in the tiny picture: once blurred, that is all a backdrop needs (a few KB). */
const TINY = { width: 18, height: 24 };
// Calm in the middle, where the book is; the story's colours show round the edges.
const WASH = "radial-gradient(65% 70% at 50% 46%, rgb(244 238 226 / 0.25), rgb(244 238 226 / 0.4) 100%)";

const made = new Map<string, Promise<string | null>>();

/** The open pages side by side, as a tiny picture. The reader has already loaded them. */
function tinySpread(urls: string[]): Promise<string | null> {
  const key = urls.join("|");
  let tiny = made.get(key);
  if (!tiny) {
    tiny = Promise.all(urls.map((url) => loadPageImage(url).catch(() => null))).then((images) => {
      const pages = images.filter((image): image is HTMLImageElement => !!image);
      if (!pages.length) return null;
      const canvas = document.createElement("canvas");
      canvas.width = TINY.width * pages.length;
      canvas.height = TINY.height;
      try {
        const context = canvas.getContext("2d");
        if (!context) return null;
        pages.forEach((image, i) => context.drawImage(image, i * TINY.width, 0, TINY.width, TINY.height));
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      } finally {
        canvas.width = canvas.height = 0;
      }
    });
    made.set(key, tiny);
    if (made.size > 40) made.delete(made.keys().next().value!);
  }
  return tiny;
}

export function StoryBackdrop({ art }: { art: string[] }) {
  const key = art.filter(Boolean).join("|");
  const [layers, setLayers] = useState<{ key: string; src: string }[]>([]);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    let settle = 0;
    tinySpread(key.split("|")).then((src) => {
      if (!alive || !src) return;
      // The new colours fade in over the old ones, then the old layer goes.
      setLayers((current) => (current.at(-1)?.key === key ? current : [...current.slice(-1), { key, src }]));
      settle = window.setTimeout(() => { if (alive) setLayers((current) => current.slice(-1)); }, 1200);
    });
    return () => {
      alive = false;
      window.clearTimeout(settle);
    };
  }, [key]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {layers.map((layer) => (
        <div
          key={layer.key}
          className="absolute -inset-[12%] animate-backdrop-in bg-cover bg-center opacity-90 blur-[56px] saturate-[1.4]"
          style={{ backgroundImage: `url(${layer.src})` }}
        />
      ))}
      <div className="absolute inset-0" style={{ background: WASH }} />
    </div>
  );
}
