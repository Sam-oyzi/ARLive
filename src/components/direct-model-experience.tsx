"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ContentData } from "@/lib/content";
import type { SoundLayer } from "@/lib/sound-layers";
import { QuickLookAssets } from "@/ar/quick-look-assets";
import { QuickLookLaunch } from "@/app/scan/[bookId]/quick-look";
import { ModelPlacementViewer } from "./model-placement-viewer";

/** Digital reading uses exactly the same model viewers as printed-target recognition. */
export function DirectModelExperience({ engine, content, title, sounds, backHref }: {
  engine: "quicklook" | "eighthwall";
  content: ContentData;
  title: string;
  sounds: SoundLayer[];
  backHref: string;
}) {
  const router = useRouter();
  const assets = useRef<QuickLookAssets | null>(null);
  useEffect(() => {
    const prepared = assets.current ?? new QuickLookAssets();
    assets.current = prepared;
    return () => { prepared.dispose(); if (assets.current === prepared) assets.current = null; };
  }, []);
  const prepare = useCallback((model: ContentData) => {
    assets.current ??= new QuickLookAssets();
    return assets.current.prepare(model);
  }, []);
  const exit = () => router.push(backHref);
  return engine === "quicklook"
    ? <QuickLookLaunch content={content} title={title} prepare={prepare} onExit={exit} exitLabel="Back to the book" />
    : <ModelPlacementViewer content={content} title={title} sounds={sounds} onExit={exit} exitLabel="Back to the book" />;
}
