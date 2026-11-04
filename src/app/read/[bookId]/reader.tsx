"use client";

import Link from "next/link";
import {
  ArrowLeft,
  AudioLines,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Languages,
  Printer,
  ScanLine,
  Search,
  Settings2,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlipBook, type FlipBookHandle, type FlipPage } from "@/components/flipbook/flipbook";
import { Dropdown, DropdownContent, DropdownTrigger } from "@/components/ui/dropdown";
import { Thumb } from "@/components/thumb";
import { runAction } from "@/lib/action-client";
import type { PageTranslations } from "@/lib/page-translations";
import { composeStoryPage, type StoryPage } from "@/lib/story-page";
import { plainStory, type TextPosition } from "@/lib/story-text";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";
import { setTargetAr } from "@/server/actions/books";

type ReaderPage = {
  id: string;
  imageUrl: string;
  title: string;
  story: string | null;
  ar: boolean;
  narrationUrl: string | null;
  textPosition: TextPosition;
  translations?: PageTranslations;
};

// A cream desk with soft watercolour washes, so the book reads like paper on a table.
const DESK = [
  "radial-gradient(55% 45% at 12% 18%, rgb(167 186 150 / 0.28), transparent 70%)",
  "radial-gradient(45% 40% at 88% 82%, rgb(214 168 134 / 0.26), transparent 70%)",
  "radial-gradient(40% 35% at 85% 12%, rgb(150 200 228 / 0.2), transparent 70%)",
  "radial-gradient(120% 90% at 50% 40%, #f4eee2 0%, #ebe3d3 100%)",
].join(", ");

const PAGE_PAPER = "#f1e9da";
const chip = "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition";
const glass = "bg-[#f6efe1]/92 shadow-[0_6px_24px_rgb(81_58_32_/_0.12)] backdrop-blur-md";
// Phones and upright tablets read one page at a time, like a book app.
const SINGLE_PAGE_QUERY = "(max-width: 767px), (orientation: portrait) and (max-width: 1100px)";
// Controls fade out on their own this long after they appear.
const CHROME_MS = 3200;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export function Reader({
  book,
  aspect,
  pages,
  editable,
  backHref,
}: {
  book: {
    id: string;
    title: string;
    backCoverImageUrl: string;
    format: string;
    subject: { name: string; color: string; icon: string };
    canScan: boolean;
    needsCompile: boolean;
  };
  aspect: number;
  pages: ReaderPage[];
  /** Platform admins can choose which pages are AR targets. */
  editable: boolean;
  backHref: string;
}) {
  const flipbook = useRef<FlipBookHandle>(null);
  const [visible, setVisible] = useState<number[]>([0]);
  const [magnifier, setMagnifier] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
  const [locale, setLocale] = useState("");
  // Optimistic AR flags while toggling.
  const [arOverride, setArOverride] = useState<Record<string, boolean>>({});
  const isAr = (p: ReaderPage) => arOverride[p.id] ?? p.ar;
  const changed = Object.keys(arOverride).length > 0;
  const single = useMediaQuery(SINGLE_PAGE_QUERY);

  useEffect(() => setFinePointer(window.matchMedia("(pointer: fine)").matches), []);

  // ---------- controls that come and go (single page) ----------
  const [chrome, setChrome] = useState(true);
  const chromeTimer = useRef(0);
  const showChrome = useCallback((show: boolean) => {
    window.clearTimeout(chromeTimer.current);
    setChrome(show);
    if (show) chromeTimer.current = window.setTimeout(() => setChrome(false), CHROME_MS);
  }, []);
  useEffect(() => {
    if (single) showChrome(true);
    else {
      window.clearTimeout(chromeTimer.current);
      setChrome(true);
    }
    return () => window.clearTimeout(chromeTimer.current);
  }, [single, showChrome]);
  const chromeHidden = single && !chrome;

  const languages = useMemo(() => [...new Set(pages.flatMap((page) => Object.keys(page.translations ?? {})))].sort(), [pages]);
  const languageName = (lang: string) => lang ? new Intl.DisplayNames([lang], { type: "language" }).of(lang) ?? lang : "Original";
  const readingPages = useMemo(() => pages.map((page) => {
    const translation = page.translations?.[locale];
    return translation
      ? { ...page, imageUrl: translation.imageUrl ?? page.imageUrl, title: translation.title, story: translation.story ?? null, lang: locale }
      : { ...page, lang: "en" };
  }), [pages, locale]);

  // ---------- words on the page (phones) ----------
  // Like a picture book, the story is part of the page on a phone: drawn into the picture so it turns
  // with it. Laptops keep the caption under the spread.
  const [composed, setComposed] = useState<Record<string, StoryPage>>({});
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (!single) return;
    let alive = true;
    const made: string[] = [];
    (async () => {
      // The open page first, then outwards, so the next turn is ready.
      const here = visibleRef.current[0] ?? 0;
      const order = readingPages.map((_, i) => i).sort((a, b) => Math.abs(a - here) - Math.abs(b - here));
      for (const i of order) {
        const page = readingPages[i]!;
        const drawn = await composeStoryPage({ imageUrl: page.imageUrl, story: page.story, position: page.textPosition, aspect, lang: page.lang, cover: i === 0 }).catch(() => null);
        if (!drawn) continue;
        if (!alive) {
          URL.revokeObjectURL(drawn.url);
          return;
        }
        made.push(drawn.url);
        setComposed((m) => ({ ...m, [page.id]: drawn }));
      }
    })();
    return () => {
      alive = false;
      setComposed({});
      // After the reader has swapped back to the plain pictures.
      setTimeout(() => made.forEach((url) => URL.revokeObjectURL(url)), 1000);
    };
  }, [single, readingPages, aspect]);

  const flipPages: FlipPage[] = useMemo(
    () => readingPages.map((p) => ({ id: p.id, imageUrl: composed[p.id]?.url ?? p.imageUrl, title: p.title, ar: arOverride[p.id] ?? p.ar })),
    [readingPages, arOverride, composed],
  );

  // ---------- read to me ----------
  // Narration is recorded in the book's original language only.
  const narrated = locale === "" && pages.some((p) => p.narrationUrl);
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  const audio = useRef<HTMLAudioElement>(null);
  const turnTimer = useRef(0);

  const stopReading = useCallback(() => {
    readingRef.current = false;
    setReading(false);
    window.clearTimeout(turnTimer.current);
    audio.current?.pause();
  }, []);

  /** Plays the open pages' voices in order, then turns the page like a read-along book. */
  const readPages = useCallback((indexes: number[]) => {
    const el = audio.current;
    if (!el) return;
    window.clearTimeout(turnTimer.current);
    el.pause();
    if (indexes.length === 0) return stopReading(); // the back cover
    const urls = indexes.flatMap((i) => (pages[i]?.narrationUrl ? [pages[i]!.narrationUrl!] : []));
    let next = 0;
    const playNext = () => {
      if (!readingRef.current) return;
      if (next < urls.length) {
        el.src = urls[next++]!;
        el.play().catch(stopReading);
        return;
      }
      // Pages without a voice (a picture spread, the cover) get a moment to look at.
      turnTimer.current = window.setTimeout(() => readingRef.current && flipbook.current?.next(), urls.length ? 900 : 3000);
    };
    el.onended = playNext;
    playNext();
  }, [pages, stopReading]);

  function toggleReading() {
    if (readingRef.current) return stopReading();
    readingRef.current = true;
    setReading(true);
    // Started inside the tap, so phones allow the audio for the rest of the book.
    readPages(visible);
  }

  useEffect(() => {
    if (!narrated && readingRef.current) stopReading();
  }, [narrated, stopReading]);
  useEffect(() => () => window.clearTimeout(turnTimer.current), []);

  const firstSpread = useRef(true);
  const onSpreadChange = useCallback((indexes: number[]) => {
    setVisible(indexes);
    if (readingRef.current) readPages(indexes);
    // Turning a page puts the controls away, like a book app.
    if (!firstSpread.current) setChrome(false);
    firstSpread.current = false;
  }, [readPages]);

  async function toggleAr(page: ReaderPage) {
    const next = !isAr(page);
    setArOverride((m) => ({ ...m, [page.id]: next }));
    const result = await runAction(setTargetAr(page.id, next));
    if (!result?.ok) setArOverride((m) => ({ ...m, [page.id]: !next }));
  }

  const arCount = pages.filter(isAr).length;
  const shown = visible.flatMap((i) => readingPages[i] ? [readingPages[i]] : []);
  const backCover = pages.length > 0 && shown.length === 0;
  const atEnd = pages.length === 0 || backCover;
  // Preserve the last spread's caption height while the back cover is closed.
  const captionPages = backCover ? readingPages.slice(-2) : shown;
  // On a phone the words are on the page once it's drawn; until then (or with no words) the caption shows them.
  const wordsOnPage = single && (backCover || shown.every((p) => composed[p.id] || !p.story || p.textPosition === "off" || (p === readingPages[0] && p.textPosition === "auto")));
  const position = backCover ? pages.length + 1 : (visible[0] ?? 0) + 1;

  const header = (
    <header
      className={cn(
        "flex shrink-0 items-center gap-3 px-4 pt-3 pb-1 safe-top transition duration-300 sm:px-6",
        single && cn("absolute inset-x-0 top-0 z-20 pb-3", glass),
        chromeHidden && "pointer-events-none -translate-y-full opacity-0",
      )}
    >
      <Link href={backHref} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-600 ring-1 ring-ink-900/10 hover:bg-white/60 hover:text-ink-900" aria-label="Back">
        <ArrowLeft className="size-5" />
      </Link>
      <div className="flex min-w-0 items-center gap-2.5">
        {readingPages[0]?.imageUrl ? (
          <span className="h-10 w-8 shrink-0 overflow-hidden rounded-md bg-[#f3e8d3] shadow-sm ring-1 ring-[#947a55]/25">
            <Thumb src={readingPages[0].imageUrl} width={32} height={40} className="size-full object-contain" />
          </span>
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: book.subject.color }}>
            <SubjectIcon icon={book.subject.icon} className="size-[18px]" />
          </span>
        )}
        <div className="min-w-0 leading-tight">
          <div className="truncate font-serif text-xl"><bdi lang={readingPages[0]?.lang}>{pages[0]?.translations?.[locale]?.title ?? book.title}</bdi></div>
          <div className="truncate text-xs text-ink-500">
            {book.subject.name} · {pages.length} pages · {arCount} with AR
          </div>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {languages.length > 0 && (
          <Dropdown modal={false}>
            <DropdownTrigger aria-label={`Book language: ${languageName(locale)}`} className={cn(chip, "max-w-36 bg-[#f6eedf]/70 text-[#58432f] ring-1 ring-[#947a55]/25 hover:bg-[#f9f1e4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a88b61] data-[state=open]:bg-[#eee1ca]", single && "px-2.5")}>
              <Languages aria-hidden="true" className="size-4 shrink-0" />
              <bdi lang={locale || undefined} className={cn("truncate", single && "sr-only")}>{languageName(locale)}</bdi>
              <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
            </DropdownTrigger>
            <DropdownContent align="end" className="max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-36 overflow-y-auto border-[#a88b61]/30 bg-[#faf2e4] shadow-[0_10px_26px_rgb(81_58_32_/_0.18)]">
              <DropdownMenu.RadioGroup value={locale} onValueChange={setLocale} aria-label="Book language">
                {["", ...languages].map((lang) => (
                  <DropdownMenu.RadioItem key={lang} value={lang} textValue={languageName(lang)} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2 text-sm text-[#58432f] outline-none select-none data-[state=checked]:bg-[#eee2cb] data-[state=checked]:font-semibold data-[highlighted]:bg-[#e9d9bc]">
                    <bdi lang={lang || undefined}>{languageName(lang)}</bdi>
                    <span className="size-4 shrink-0">
                      <DropdownMenu.ItemIndicator><Check aria-hidden="true" className="size-4" /></DropdownMenu.ItemIndicator>
                    </span>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownContent>
          </Dropdown>
        )}
        {narrated && (
          <button
            onClick={toggleReading}
            aria-pressed={reading}
            title={reading ? "Stop reading aloud" : "Read the story aloud, page by page"}
            className={cn(chip, reading ? "bg-sky-600 text-white" : "text-ink-700 ring-1 ring-ink-900/10 hover:bg-white/60", single && "px-2.5")}
          >
            {reading ? <AudioLines className="size-4 animate-pulse" /> : <Volume2 className="size-4" />}
            <span className={cn(single ? "sr-only" : "hidden sm:inline")}>{reading ? "Reading…" : "Read to me"}</span>
          </button>
        )}
        {finePointer && !single && (
          <button
            onClick={() => setMagnifier((m) => !m)}
            className={cn(chip, magnifier ? "bg-ink-900 text-white" : "text-ink-700 ring-1 ring-ink-900/10 hover:bg-white/60")}
            aria-pressed={magnifier}
            title="Magnifier: move the pointer over a page"
          >
            <Search className="size-4" /> <span className="hidden sm:inline">Magnifier</span>
          </button>
        )}
        {editable && (
          <>
            <Link href={`/admin/books/${book.id}`} className={cn(chip, "hidden text-ink-700 ring-1 ring-ink-900/10 hover:bg-white/60 sm:flex")}>
              <Settings2 className="size-4" /> Studio
            </Link>
            <Link href={`/print/${book.id}`} className={cn(chip, "bg-ink-900 text-white hover:bg-ink-800")}>
              <Printer className="size-4" /> <span className={cn(single && "sr-only")}>Print</span>
            </Link>
          </>
        )}
        {!editable && pages.length > 0 && !single && (
          <Link href={`/print/${book.id}`} className={cn(chip, "text-ink-700 ring-1 ring-ink-900/10 hover:bg-white/60")} title="Download or print this book">
            <Download className="size-4" /> Download
          </Link>
        )}
        {!editable && book.canScan && (
          <Link href={`/scan/${book.id}`} className={cn(chip, "font-semibold text-white shadow-soft", single && "px-3")} style={{ background: book.subject.color }}>
            <ScanLine className="size-4" /> {single ? "Scan" : "Scan with camera"}
          </Link>
        )}
      </div>
    </header>
  );

  const strip = (
    <nav
      className={cn(
        "flex shrink-0 justify-center gap-1.5 overflow-x-auto px-4 pt-3 pb-4 scrollbar-none safe-bottom transition duration-300",
        single && cn("absolute inset-x-0 bottom-0 z-20 flex-col items-stretch gap-2 pt-2", glass),
        chromeHidden && "pointer-events-none translate-y-full opacity-0",
      )}
      aria-label="Pages"
    >
      {single && (
        <div className="text-center text-xs font-semibold text-ink-500 tabular-nums">
          {backCover ? "Back cover" : `Page ${position} of ${pages.length}`}
        </div>
      )}
      <div className={cn("flex gap-1.5", single ? "overflow-x-auto px-1 pb-1 scrollbar-none" : "contents")}>
        {pages.map((p, i) => (
          <button
            key={p.id}
            onClick={() => flipbook.current?.goToPage(i)}
            title={`${i + 1}. ${p.title}${isAr(p) ? " (AR)" : ""}`}
            className={cn(
              "relative w-8 shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-2 transition",
              visible.includes(i) ? "ring-ink-800" : "opacity-55 ring-transparent hover:opacity-100",
            )}
            style={{ aspectRatio: `1 / ${aspect}` }}
          >
            <Thumb src={readingPages[i]?.imageUrl ?? p.imageUrl} width={32} height={Math.round(32 * aspect)} className="size-full object-cover" />
            {isAr(p) && <span className="absolute right-0.5 bottom-0.5 size-2 rounded-full ring-1 ring-white" style={{ background: book.subject.color }} />}
          </button>
        ))}
      </div>
    </nav>
  );

  return (
    // Phones read on plain paper so the edge-to-edge page blends into the screen, like a book app.
    <div className="fixed inset-0 flex flex-col overflow-hidden text-ink-900" style={{ background: single ? PAGE_PAPER : DESK }}>
      {/* Shared by every page so phones keep allowing playback after the first tap. */}
      <audio ref={audio} preload="none" className="hidden" />

      {header}

      {editable && (book.needsCompile || changed) && !chromeHidden && (
        <div className={cn("mx-auto mt-1 flex w-fit max-w-[calc(100%-2rem)] shrink-0 items-center gap-2 rounded-full bg-amber-100/80 px-4 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-amber-300/60", single && "absolute inset-x-0 top-24 z-20")}>
          <TriangleAlert className="size-3.5 shrink-0" />
          AR pages changed: recompile in the studio so phones recognise them.
          <Link href={`/admin/books/${book.id}`} className="shrink-0 font-semibold underline underline-offset-2">
            Open studio
          </Link>
        </div>
      )}

      {/* the book */}
      <div className={cn("relative min-h-0 flex-1", single && "safe-top")}>
        {pages.length === 0 ? (
          <div className="grid size-full place-items-center font-serif text-xl text-ink-500 italic">This book has no pages yet.</div>
        ) : (
          <FlipBook
            ref={flipbook}
            pages={flipPages}
            backCoverImageUrl={book.backCoverImageUrl}
            aspect={aspect}
            magnifier={magnifier && !single}
            single={single}
            onTap={() => showChrome(!chrome)}
            onSpreadChange={onSpreadChange}
            className="absolute inset-0"
            renderOverlay={(_, index, side) => {
              const page = pages[index]!;
              const ar = isAr(page);
              // Badges sit in a top corner, or a bottom one when the words drawn on the page are up there.
              const words = composed[page.id]?.words;
              const corner = cn(side === "left" ? "left-3" : "right-3", words && words.top < 0.2 ? "bottom-3" : "top-3");
              return editable ? (
                <button
                  onClick={() => toggleAr(page)}
                  className={cn(
                    "absolute flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-md ring-1 backdrop-blur transition",
                    corner,
                    ar ? "bg-brand-600 text-white ring-white/30" : "bg-white/85 text-ink-700 ring-ink-200",
                  )}
                  title={ar ? "Compiled as an AR target — click to make it a story page" : "Story page — click to compile it as an AR target"}
                >
                  <ScanLine className="size-3.5" /> {ar ? "AR page" : "Story page"}
                </button>
              ) : ar ? (
                <span className={cn("pointer-events-none absolute flex items-center gap-1.5 rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur", corner)}>
                  <ScanLine className="size-3.5" /> Scan me
                </span>
              ) : null;
            }}
          />
        )}
        {!single && (
          <>
            <button
              onClick={() => flipbook.current?.prev()}
              disabled={!pages.length || visible.includes(0)}
              className="absolute top-1/2 left-1 grid h-16 w-10 -translate-y-1/2 place-items-center text-ink-400 transition enabled:hover:text-ink-900 disabled:opacity-30 sm:left-4"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-8" strokeWidth={1.25} />
            </button>
            <button
              onClick={() => flipbook.current?.next()}
              disabled={atEnd}
              className="absolute top-1/2 right-1 grid h-16 w-10 -translate-y-1/2 place-items-center text-ink-400 transition enabled:hover:text-ink-900 disabled:opacity-30 sm:right-4"
              aria-label="Next page"
            >
              <ChevronRight className="size-8" strokeWidth={1.25} />
            </button>
          </>
        )}
      </div>

      {/* caption for the open pages: part of the story, so it stays when the controls hide */}
      <div className={cn("mx-auto w-full max-w-3xl shrink-0 px-6 pt-1 text-center", single && "px-5 pb-3 safe-bottom", wordsOnPage && "sr-only")}>
        <div className="truncate text-[13px] text-ink-600">{backCover ? "Back cover" : shown.map((page, index) => <span key={page.id}>{index > 0 && " · "}<bdi lang={page.lang}>{page.title}</bdi></span>)}</div>
        {backCover && <span className="sr-only">Wonder begins with a question.</span>}
        {captionPages.some((page) => page.story) && (
          <p aria-hidden={backCover || undefined} className={cn("mx-auto mt-1 max-w-2xl font-serif leading-snug text-ink-700 italic", single ? "line-clamp-3 text-base" : "line-clamp-2 text-[17px]", backCover && "invisible")}>
            {captionPages.map((page) => page.story && <bdi key={page.id} lang={page.lang}>{plainStory(page.story)}{"  "}</bdi>)}
          </p>
        )}
      </div>

      {strip}

      <span className="sr-only" aria-live="polite">{backCover ? "Back cover" : `Page ${position} of ${pages.length}`}</span>
    </div>
  );
}
