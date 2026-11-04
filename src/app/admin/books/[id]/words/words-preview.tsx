"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { composeStoryPage, type StoryPage } from "@/lib/story-page";
import { TEXT_POSITIONS, type TextPosition } from "@/lib/story-text";

type Page = { id: string; name: string; imageUrl: string; story: string | null; textPosition: TextPosition };

export function WordsPreview({ bookId, aspect, pages }: { bookId: string; aspect: number; pages: Page[] }) {
  const [debug, setDebug] = useState(false);
  // undefined while drawing, null when the page has no words drawn on it.
  const [drawn, setDrawn] = useState<Record<string, StoryPage | null>>({});

  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    setDrawn({});
    (async () => {
      for (const [index, page] of pages.entries()) {
        const result = await composeStoryPage({ imageUrl: page.imageUrl, story: page.story, position: page.textPosition, aspect, width: 520, cover: index === 0, debug }).catch(() => null);
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
  }, [pages, aspect, debug]);

  const shrunk = pages.filter((p) => drawn[p.id]?.mode === "room").length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200/70 bg-white px-4 py-3 shadow-soft">
        <p className="text-sm text-ink-600">
          {shrunk > 0 ? (
            <>
              <span className="font-semibold text-amber-700">{shrunk} page{shrunk === 1 ? "" : "s"}</span> had no empty paper big enough, so the picture is shown smaller. Shorter lines, or a quieter top or bottom in the picture, keep it full size.
            </>
          ) : (
            "Every page's words sit on empty paper."
          )}
        </p>
        <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
          <Switch checked={debug} onCheckedChange={setDebug} /> Show empty paper
        </label>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
        {pages.map((page, i) => {
          const result = drawn[page.id];
          return (
            <Link key={page.id} href={`/admin/books/${bookId}/targets/${page.id}`} className="group">
              <div className="overflow-hidden rounded-xl bg-ink-100 shadow-soft ring-1 ring-ink-200/70 transition group-hover:shadow-lift" style={{ aspectRatio: `1 / ${aspect}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {result === undefined ? <div className="size-full animate-pulse" /> : <img src={result?.url ?? page.imageUrl} alt="" className="size-full object-cover" />}
              </div>
              <div className="mt-2 flex items-start justify-between gap-2">
                <span className="min-w-0 text-sm font-semibold text-ink-900">
                  <span className="text-ink-400">#{i + 1}</span> <span className="group-hover:text-brand-600">{page.name}</span>
                </span>
                {result?.mode === "room" ? (
                  <Badge tone="amber">Picture smaller</Badge>
                ) : result?.mode === "space" ? (
                  <Badge tone="green">On empty paper</Badge>
                ) : result === null ? (
                  <Badge>{page.story ? (i === 0 && page.textPosition === "auto" ? "Cover" : "Off") : "No words"}</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-ink-500">{TEXT_POSITIONS[page.textPosition]}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
