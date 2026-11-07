"use client";

import Link from "next/link";
import { ArrowLeft, Printer, ScanLine } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Fragment, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { composeStoryPage, freeCorner, type StoryPage } from "@/lib/story-page";
import { readerHref } from "@/lib/reader-navigation";
import type { TextPosition } from "@/lib/story-text";
import type { StoryBlock } from "@/lib/story-layout";
import { cn } from "@/lib/utils";
import { recordDownload } from "@/server/actions/library";
import { PrintGuide } from "./print-guide";

type PrintPage = { id: string; imageUrl: string; title: string; ar: boolean; experience: "box" | "panorama" | null; story: string | null; lang: string; textPosition: TextPosition; textScale: number; blocks?: StoryBlock[] };

// Pixels per millimetre for the pages with words drawn in: about 240 dpi, crisp in print.
const PRINT_PX_PER_MM = 240 / 25.4;

/** One sheet per page at the book's real size; the browser's "Save as PDF" turns it into a print file. */
export function PrintBook({
  book,
  language,
  guideQrUrl,
  format,
  pages,
  backCover,
  countDownload,
}: {
  book: { id: string; title: string };
  language: string;
  guideQrUrl: string;
  /** The last sheet: the back cover art with a QR code that opens the book on a phone. */
  backCover: { imageUrl: string; qrUrl: string; ar: boolean };
  countDownload: boolean;
  format: { label: string; widthMm: number; heightMm: number };
  pages: PrintPage[];
}) {
  const [badges, setBadges] = useState(true);
  const [numbers, setNumbers] = useState(false);
  const [qr, setQr] = useState(true);
  const [words, setWords] = useState(true);
  // What each sheet prints: the picture with its story drawn in, or the picture alone.
  const [sheets, setSheets] = useState<Record<string, { url: string; words?: StoryPage["words"] }>>({});
  const [loaded, setLoaded] = useState(0);
  const ready = loaded >= pages.length + 1;

  useEffect(() => {
    // Count sheets as they finish so "Print" only enables once every page is ready.
    let alive = true;
    const made: string[] = [];
    setLoaded(0);
    setSheets({});
    const preload = (url: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = url;
      });
    (async () => {
      for (const [index, page] of pages.entries()) {
        const drawn = words
          ? await composeStoryPage({
              imageUrl: page.imageUrl,
              story: page.story,
              lang: page.lang,
              blocks: page.blocks,
              position: page.textPosition,
              scale: page.textScale,
              aspect: format.heightMm / format.widthMm,
              width: format.widthMm * PRINT_PX_PER_MM,
              cover: index === 0,
            }).catch(() => null)
          : null;
        if (!alive) {
          if (drawn) URL.revokeObjectURL(drawn.url);
          return;
        }
        if (drawn) made.push(drawn.url);
        await preload(drawn?.url ?? page.imageUrl);
        setSheets((s) => ({ ...s, [page.id]: drawn ? { url: drawn.url, words: drawn.words } : { url: page.imageUrl } }));
        setLoaded((n) => n + 1);
      }
      await preload(backCover.imageUrl);
      if (alive) setLoaded((n) => n + 1);
    })();
    return () => {
      alive = false;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pages, backCover.imageUrl, words, format.widthMm, format.heightMm]);

  const w = `${format.widthMm}mm`;
  const h = `${format.heightMm}mm`;

  return (
    <div className="min-h-dvh bg-ink-100 print:bg-white">
      <style>{`
        @page { size: ${w} ${h}; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; break-after: page; }
        }
      `}</style>

      <header className="sticky top-0 z-10 border-b border-ink-200/70 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-3">
          <Link href={readerHref(book.id, null, language)} className="grid size-9 place-items-center rounded-xl border border-ink-200 text-ink-600 hover:text-ink-900" aria-label="Back to the book">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="truncate font-display font-bold text-ink-900">Download “{book.title}”</div>
            <div className="text-xs text-ink-500">
              {pages.length} pages · {format.label}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-5 text-sm font-medium text-ink-700">
            <label className="flex items-center gap-2">
              <Switch checked={badges} onCheckedChange={setBadges} /> “Scan me” badge on AR pages
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={numbers} onCheckedChange={setNumbers} /> Page numbers
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={words} onCheckedChange={setWords} /> Story text on the pages
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={qr} onCheckedChange={setQr} /> QR code on the back cover
            </label>
            <button
              onClick={() => {
                if (countDownload) recordDownload(book.id).catch(() => {});
                window.print();
              }}
              disabled={!ready}
              className="flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
            >
              <Printer className="size-4" /> {ready ? "Save as PDF / Print" : `Loading ${loaded}/${pages.length + 1}…`}
            </button>
          </div>
        </div>
        <p className="mx-auto max-w-5xl px-6 pb-3 text-xs text-ink-500">
          In the print dialog choose <b>Save as PDF</b> (or your printer), <b>Margins: None</b>, <b>Scale: 100%</b> and turn on <b>Background graphics</b>.
          Print it at home or at a print shop at {format.label}, then scan the pages marked AR with your phone. Matte paper scans best: glossy reflections confuse the camera.
        </p>
      </header>

      <main className="flex flex-col items-center gap-8 py-10 print:block print:gap-0 print:p-0">
        {pages.map((page, i) => {
          // The print-only instructions after the front cover shift the physical page sides.
          const recto = i === 0 || i % 2 === 1;
          return (
            <Fragment key={page.id}>
            <section
              className="sheet relative overflow-hidden bg-white shadow-lift"
              style={{ width: w, height: h }}
              lang={page.lang}
              aria-label={`Page ${i + 1}: ${page.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sheets[page.id]?.url ?? page.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
              {badges && page.ar && (
                <div
                  // Bottom outer corner, or the top one when the page's words are down there. One badge per
                  // page, coloured by what scanning does: blue steps into the story world, cream shows AR.
                  className={cn(
                    "absolute flex items-center gap-[1.5mm] rounded-[2mm] border px-[2mm] py-[1.2mm]",
                    page.experience ? "border-[#0369a1] bg-[#0284c7] text-white" : "border-[#a88b61] bg-[#f6eddb] text-[#624631]",
                    recto ? "right-[5mm]" : "left-[5mm]",
                    freeCorner(sheets[page.id]?.words, recto ? "right" : "left", "bottom") === "top" ? "top-[5mm]" : "bottom-[5mm]",
                  )}
                  style={{ fontSize: "2.6mm", fontWeight: 700, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                >
                  <ScanLine style={{ width: "3.4mm", height: "3.4mm" }} /> {page.experience === "box" ? "Scan me · step inside" : page.experience === "panorama" ? "Scan me · 360° view" : "AR · scan this page"}
                </div>
              )}
              {numbers && (
                <div className="absolute bottom-[4mm] left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-[2mm] text-ink-700" style={{ fontSize: "2.6mm" }}>
                  {i + 1}
                </div>
              )}
            </section>
            {i === 0 && <PrintGuide language={language} title={book.title} width={w} height={h} qrUrl={guideQrUrl} ar={backCover.ar} />}
            </Fragment>
          );
        })}
        <section className="sheet relative overflow-hidden bg-white shadow-lift" style={{ width: w, height: h }} aria-label="Back cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backCover.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
          {qr && (
            <div
              className="absolute top-[10%] left-1/2 flex -translate-x-1/2 items-center gap-[3mm] rounded-[3mm] border border-[#a88b61] bg-[#fbf6ea] p-[2.5mm] text-[#624631]"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", width: "62%" }}
            >
              <QRCodeSVG value={backCover.qrUrl} marginSize={0} bgColor="#fbf6ea" fgColor="#3b2a1c" style={{ width: "26mm", height: "26mm", flexShrink: 0 }} />
              <div style={{ fontSize: "3mm", lineHeight: 1.35 }}>
                <div style={{ fontWeight: 700, fontSize: "3.4mm" }}>{backCover.ar ? "Bring this book to life" : "Read it on any screen"}</div>
                {backCover.ar ? "Scan with a phone camera, then point it at the pages marked AR." : "Scan with a phone camera to open the book."}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
