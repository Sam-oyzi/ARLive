"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { composeStoryPage, type StoryPage } from "@/lib/story-page";
import type { PageTranslations } from "@/lib/page-translations";
import type { StoryBlock } from "@/lib/story-layout";
import { TEXT_POSITIONS, type TextPosition } from "@/lib/story-text";
import { PageTextEditor } from "./page-text-editor";

type Page = { id: string; name: string; imageUrl: string; story: string | null; textPosition: TextPosition; translations?: PageTranslations; layouts: Record<string, StoryBlock[]> };

export function WordsPreview({ bookId, aspect, pages }: { bookId: string; aspect: number; pages: Page[] }) {
  const [debug, setDebug] = useState(false);
  const [language, setLanguage] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, StoryBlock[] | undefined>>({});
  const languages = [...new Set(pages.flatMap((page) => Object.keys(page.translations ?? {})))].sort();
  const keyFor = (page: Page) => page.translations?.[language] ? language : "original";
  const versionOf = (page: Page) => {
    const translation = page.translations?.[language];
    const key = keyFor(page);
    const override = `${page.id}:${key}`;
    return {
      title: translation?.title ?? page.name,
      imageUrl: translation?.imageUrl ?? page.imageUrl,
      story: translation ? translation.story ?? null : page.story,
      lang: translation ? language : "en",
      blocks: Object.hasOwn(overrides, override) ? overrides[override] : page.layouts[key],
    };
  };
  // undefined while drawing, null when the page has no words drawn on it.
  const [drawn, setDrawn] = useState<Record<string, StoryPage | null>>({});

  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    setDrawn({});
    (async () => {
      for (const [index, page] of pages.entries()) {
        const result = await composeStoryPage({ ...versionOf(page), position: page.textPosition, aspect, width: 520, cover: index === 0, debug }).catch(() => null);
        if (!alive) {
          if (result) URL.revokeObjectURL(result.url);
          return;
        }
        if (result) made.push(result.url);
        setDrawn((d) => ({ ...d, [page.id]: result }));
      }
    })();
    return () => {
      alive = false;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pages, aspect, debug, language, overrides]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200/70 bg-white px-4 py-3 shadow-soft">
        {languages.length > 0 && <label className="flex items-center gap-2 text-sm">Edition
          <select className="rounded-lg border px-2 py-1" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="">Original</option>
            {languages.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
          </select>
        </label>}
        <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
          <Switch checked={debug} onCheckedChange={setDebug} /> Show empty paper
        </label>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
        {pages.map((page, i) => {
          const result = drawn[page.id];
          const version = versionOf(page);
          const key = keyFor(page);
          return (
            <Dialog key={page.id} open={active === page.id} onOpenChange={(open) => setActive(open ? page.id : null)}>
            <DialogTrigger asChild>
            <button type="button" className="group text-left" aria-label={`Edit text on page ${i + 1}: ${version.title}`}>
              <div className="overflow-hidden rounded-xl bg-ink-100 shadow-soft ring-1 ring-ink-200/70 transition group-hover:shadow-lift" style={{ aspectRatio: `1 / ${aspect}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result?.url ?? version.imageUrl} alt="" className="size-full object-cover" />
              </div>
              <div className="mt-2 flex items-start justify-between gap-2">
                <span className="min-w-0 text-sm font-semibold text-ink-900">
                  <span className="text-ink-400">#{i + 1}</span> <span className="group-hover:text-brand-600">{version.title}</span>
                </span>
                {version.blocks !== undefined ? (
                  <Badge tone="blue">Manual layout</Badge>
                ) : result?.mode === "room" ? (
                  <Badge tone="amber">Over artwork</Badge>
                ) : result?.mode === "space" ? (
                  <Badge tone="green">{result.words.length > 1 ? "Split on empty paper" : "On empty paper"}</Badge>
                ) : result === null ? (
                  <Badge>{version.story ? (i === 0 && page.textPosition === "auto" ? "Cover" : "Off") : "No words"}</Badge>
                ) : null}
              </div>
              {version.blocks === undefined && <p className="mt-0.5 text-xs text-ink-500">{TEXT_POSITIONS[page.textPosition]}</p>}
            </button>
            </DialogTrigger>
            {active === page.id && <PageTextEditor
              bookId={bookId} pageId={page.id} title={version.title} imageUrl={version.imageUrl}
              story={version.story} aspect={aspect} language={key === "original" ? "" : key}
              position={page.textPosition} saved={version.blocks}
              onSaved={(blocks) => {
                setOverrides((current) => ({ ...current, [`${page.id}:${key}`]: blocks }));
                setActive(null);
              }}
            />}
            </Dialog>
          );
        })}
      </div>
    </>
  );
}
