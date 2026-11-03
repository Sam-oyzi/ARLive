"use client";

import Link from "next/link";
import { ArrowLeft, Printer, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type PrintPage = { id: string; imageUrl: string; title: string; ar: boolean };

/** One sheet per page at the book's real size; the browser's "Save as PDF" turns it into a print file. */
export function PrintBook({
  book,
  format,
  pages,
}: {
  book: { id: string; title: string };
  format: { label: string; widthMm: number; heightMm: number };
  pages: PrintPage[];
}) {
  const [badges, setBadges] = useState(true);
  const [numbers, setNumbers] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const ready = loaded >= pages.length;

  useEffect(() => {
    // Count images as they finish so "Print" only enables once every page is ready.
    let alive = true;
    Promise.all(
      pages.map(
        (p) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = img.onerror = () => {
              if (alive) setLoaded((n) => n + 1);
              resolve();
            };
            img.src = p.imageUrl;
          }),
      ),
    );
    return () => {
      alive = false;
    };
  }, [pages]);

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
          <Link href={`/read/${book.id}`} className="grid size-9 place-items-center rounded-xl border border-ink-200 text-ink-600 hover:text-ink-900" aria-label="Back to the book">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="truncate font-display font-bold text-ink-900">Print “{book.title}”</div>
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
            <button
              onClick={() => window.print()}
              disabled={!ready}
              className="flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
            >
              <Printer className="size-4" /> {ready ? "Print / Save as PDF" : `Loading ${loaded}/${pages.length}…`}
            </button>
          </div>
        </div>
        <p className="mx-auto max-w-5xl px-6 pb-3 text-xs text-ink-500">
          In the print dialog choose <b>Save as PDF</b> (or your printer), <b>Margins: None</b>, <b>Scale: 100%</b> and turn on <b>Background graphics</b>.
          For a bound book, send the PDF to a print shop at {format.label}. Matte paper scans best: glossy reflections confuse the camera.
        </p>
      </header>

      <main className="flex flex-col items-center gap-8 py-10 print:block print:gap-0 print:p-0">
        {pages.map((page, i) => {
          // Page 1 is a right-hand page; badges sit in the outer bottom corner.
          const recto = i % 2 === 0;
          return (
            <section
              key={page.id}
              className="sheet relative overflow-hidden bg-white shadow-lift"
              style={{ width: w, height: h }}
              aria-label={`Page ${i + 1}: ${page.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
              {badges && page.ar && (
                <div
                  className={cn("absolute bottom-[5mm] flex items-center gap-[1.5mm] rounded-[2mm] border border-[#a88b61] bg-[#f6eddb] px-[2mm] py-[1.2mm] text-[#624631]", recto ? "right-[5mm]" : "left-[5mm]")}
                  style={{ fontSize: "2.6mm", fontWeight: 700, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                >
                  <ScanLine style={{ width: "3.4mm", height: "3.4mm" }} /> AR · scan this page
                </div>
              )}
              {numbers && (
                <div className="absolute bottom-[4mm] left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-[2mm] text-ink-700" style={{ fontSize: "2.6mm" }}>
                  {i + 1}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
