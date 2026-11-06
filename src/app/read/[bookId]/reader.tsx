"use client";

import Link from "next/link";
import {
  ArrowLeft,
  AudioLines,
  BookOpenText,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Languages,
  Lightbulb,
  Music,
  Orbit,
  Pause,
  Printer,
  ScanLine,
  Search,
  Settings2,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlipBook, type FlipBookHandle, type FlipPage } from "@/components/flipbook/flipbook";
import { Dropdown, DropdownContent, DropdownTrigger } from "@/components/ui/dropdown";
import { Thumb } from "@/components/thumb";
import { worldExperienceOf, opensModel, type ScanAction } from "@/lib/scan-actions";
import type { PageTranslations } from "@/lib/page-translations";
import { storyBlockText, type StoryBlock } from "@/lib/story-layout";
import { nativeLanguageName, readerWords } from "@/lib/reader-words";
import { composeStoryPageCached, freeCorner, whenIdle, type StoryPage } from "@/lib/story-page";
import { plainStory, type TextPosition } from "@/lib/story-text";
import { isReadingSpeed, READING_SPEED_LABEL, readingSeconds, type ReadingSpeed } from "@/lib/reading-time";
import { stopSoundGroup, usePageSounds } from "@/lib/page-sound";
import { soundtrackFor, type SoundLayer } from "@/lib/sound-layers";
import { readerHref, withReturnTo } from "@/lib/reader-navigation";
import { requestStoryMotion } from "@/lib/story-motion";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";

type ReaderPage = {
  id: string;
  imageUrl: string;
  title: string;
  story: string | null;
  ar: boolean;
  narrationUrl: string | null;
  /** Loops in the reader when the soundtrack is on; pages without one keep the previous page's. */
  soundtrack: SoundLayer[];
  /** Under the page on a laptop, where the story itself is on the page. */
  note: string | null;
  worldUrl: string | null;
  scanAction: ScanAction;
  hasModel: boolean;
  textPosition: TextPosition;
  translations?: PageTranslations;
  storyLayouts?: Record<string, StoryBlock[]>;
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
// Small controls on a page are bigger than they look: a clear margin round the pill takes the finger
// too, so a near miss opens the control instead of turning the page.
const PAD = "-m-2.5 p-2.5";
// On a phone, pages are drawn with their words this many pages either side of the open one.
const NEARBY = 2;
// Controls fade out on their own this long after they appear.
const CHROME_MS = 3200;
const READER_SOUND_GROUP = "reader";

/** A language in its own words ("Français", "العربية"); "" is the book as written, in English. */
function languageLabel(lang: string) {
  return nativeLanguageName(lang || "en");
}

/** Picks the reading language: in the top bar, and on each page on a phone. */
const AUTO_READ_KEY = "sketchling.autoRead";
const menuItem = "flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2 text-sm text-[#58432f] outline-none select-none data-[state=checked]:bg-[#eee2cb] data-[state=checked]:font-semibold data-[highlighted]:bg-[#e9d9bc]";

/** Auto read: a button to start and stop, and a menu for the voice and the reading speed. */
function AutoReadControl({ reading, onToggle, narrated, voice, onVoice, speed, onSpeed, compact }: {
  reading: boolean;
  onToggle: () => void;
  /** The book has voices in this language. */
  narrated: boolean;
  voice: boolean;
  onVoice: (voice: boolean) => void;
  speed: ReadingSpeed;
  onSpeed: (speed: ReadingSpeed) => void;
  compact: boolean;
}) {
  const speaking = narrated && voice;
  return (
    <div className={cn("flex items-center rounded-full", reading ? "bg-sky-600 text-white" : "text-ink-700 ring-1 ring-ink-900/10")}>
      <button
        onClick={onToggle}
        aria-pressed={reading}
        title={reading ? "Stop turning the pages" : speaking ? "Read the story aloud and turn the pages" : "Turn the pages by themselves, at a child's reading speed"}
        className={cn(chip, "rounded-r-none pr-2", !reading && "hover:bg-white/60", compact && "pl-2.5")}
      >
        {reading ? (speaking ? <AudioLines className="size-4 animate-pulse" /> : <Pause className="size-4" />) : speaking ? <Volume2 className="size-4" /> : <BookOpenText className="size-4" />}
        <span className={cn(compact ? "sr-only" : "hidden sm:inline")}>{reading ? "Reading…" : "Auto read"}</span>
      </button>
      {/* Modal, like the language menu: a tap outside only closes it, never turns a page. */}
      <Dropdown>
        <DropdownTrigger aria-label="Auto read settings" className={cn("grid h-9 place-items-center rounded-r-full pr-2.5 pl-1", !reading && "hover:bg-white/60")}>
          <ChevronDown aria-hidden="true" className="size-3.5" />
        </DropdownTrigger>
        <DropdownContent align="end" className="min-w-60 border-[#a88b61]/30 bg-[#faf2e4] shadow-[0_10px_26px_rgb(81_58_32_/_0.18)]">
          {narrated && (
            <>
              <DropdownMenu.CheckboxItem checked={voice} onCheckedChange={onVoice} onSelect={(event) => event.preventDefault()} className={menuItem}>
                Read the words aloud
                <span className="size-4 shrink-0"><DropdownMenu.ItemIndicator><Check aria-hidden="true" className="size-4" /></DropdownMenu.ItemIndicator></span>
              </DropdownMenu.CheckboxItem>
              <DropdownMenu.Separator className="my-1 h-px bg-[#a88b61]/20" />
            </>
          )}
          <DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-xs font-semibold text-[#8a7358]">
            {narrated ? "Reading speed (pages without a voice)" : "Reading speed"}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={speed} onValueChange={(value) => isReadingSpeed(value) && onSpeed(value)}>
            {(Object.keys(READING_SPEED_LABEL) as ReadingSpeed[]).map((key) => (
              <DropdownMenu.RadioItem key={key} value={key} onSelect={(event) => event.preventDefault()} className={menuItem}>
                {READING_SPEED_LABEL[key]}
                <span className="size-4 shrink-0"><DropdownMenu.ItemIndicator><Check aria-hidden="true" className="size-4" /></DropdownMenu.ItemIndicator></span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownContent>
      </Dropdown>
    </div>
  );
}

function LanguageMenu({
  locale,
  languages,
  onChange,
  align = "end",
  className,
  children,
}: {
  locale: string;
  languages: string[];
  onChange: (lang: string) => void;
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}) {
  return (
    // Modal, so a tap outside only closes the menu: on a phone it would otherwise turn the page under it.
    <Dropdown>
      <DropdownTrigger aria-label={`Book language: ${languageLabel(locale)}`} className={className}>
        {children}
      </DropdownTrigger>
      <DropdownContent align={align} className="max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-36 overflow-y-auto border-[#a88b61]/30 bg-[#faf2e4] shadow-[0_10px_26px_rgb(81_58_32_/_0.18)]">
        <DropdownMenu.RadioGroup value={locale} onValueChange={onChange} aria-label="Book language">
          {["", ...languages].map((lang) => (
            <DropdownMenu.RadioItem key={lang} value={lang} textValue={languageLabel(lang)} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2 text-sm text-[#58432f] outline-none select-none data-[state=checked]:bg-[#eee2cb] data-[state=checked]:font-semibold data-[highlighted]:bg-[#e9d9bc]">
              <bdi lang={lang || undefined}>{languageLabel(lang)}</bdi>
              <span className="size-4 shrink-0">
                <DropdownMenu.ItemIndicator><Check aria-hidden="true" className="size-4" /></DropdownMenu.ItemIndicator>
              </span>
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownContent>
    </Dropdown>
  );
}

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
  initialPage = 0,
  initialLanguage = "",
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
  initialPage?: number;
  initialLanguage?: string;
  pages: ReaderPage[];
  /** Platform admins can open the studio and see compilation status. */
  editable: boolean;
  backHref: string;
}) {
  const flipbook = useRef<FlipBookHandle>(null);
  const [visible, setVisible] = useState<number[]>(initialPage < pages.length ? [initialPage] : []);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [focusedPage, setFocusedPage] = useState(initialPage);
  const [magnifier, setMagnifier] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
  const [locale, setLocale] = useState(pages.some((page) => page.translations?.[initialLanguage]) ? initialLanguage : "");
  const isAr = (p: ReaderPage) => p.ar;
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
  const readingPages = useMemo(() => pages.map((page) => {
    const translation = page.translations?.[locale];
    const version = translation
      ? { ...page, imageUrl: translation.imageUrl ?? page.imageUrl, title: translation.title, story: translation.story ?? null, note: translation.note ?? null, lang: locale }
      : { ...page, lang: "en" };
    const blocks = page.storyLayouts?.[translation ? locale : "original"];
    const story = storyBlockText(blocks, version.story);
    const narrationUrl = plainStory(story ?? "") === plainStory(version.story ?? "") ? version.narrationUrl : null;
    return { ...version, blocks, story, narrationUrl };
  }), [pages, locale]);

  // ---------- words on the page (phones) ----------
  // Like a picture book, the story is part of the page on a phone: drawn into the picture so it turns
  // with it. Laptops keep the caption under the spread.
  const [composed, setComposed] = useState<Record<string, StoryPage>>({});
  // Laptops too: the words are part of the page, so the space under the book is free for notes.
  const here = visible[0] ?? 0;
  useEffect(() => {
    let alive = true;
    (async () => {
      // The open page first, then the pages either side so the next turn is ready. Only those:
      // drawing a page is heavy work for a phone, so the others wait until the reader gets near them.
      const order = readingPages.map((_, i) => i).filter((i) => Math.abs(i - here) <= NEARBY).sort((a, b) => Math.abs(a - here) - Math.abs(b - here));
      for (const [n, i] of order.entries()) {
        // The open page right away; the others in the browser's quiet moments, never during a turn.
        if (n > 0) await whenIdle();
        if (!alive) return;
        const page = readingPages[i]!;
        const drawn = await composeStoryPageCached({ imageUrl: page.imageUrl, story: page.story, position: page.textPosition, aspect, lang: page.lang, cover: i === 0, blocks: page.blocks }).catch(() => null);
        if (!alive) return;
        if (drawn) setComposed((m) => (m[page.id]?.url === drawn.url ? m : { ...m, [page.id]: drawn }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [single, readingPages, aspect, here]);
  // Another language means other words on every page: back to the bare pictures until they're drawn.
  useEffect(() => () => setComposed({}), [single, readingPages, aspect]);

  const flipPages: FlipPage[] = useMemo(
    () => readingPages.map((p) => ({ id: p.id, imageUrl: composed[p.id]?.url ?? p.imageUrl, title: p.title, ar: p.ar })),
    [readingPages, composed],
  );

  // ---------- auto read ----------
  // The pages turn by themselves, with the same curl as a finger: after the page's voice when it has
  // one (and the voice is on), otherwise after the time a child takes to read it. Voices are recorded
  // in the book's original language only.
  const narrated = locale === "" && readingPages.some((p) => p.narrationUrl);
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  const [voice, setVoice] = useState(true);
  const [speed, setSpeed] = useState<ReadingSpeed>("normal");
  const [music, setMusic] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const settings = useRef({ voice: true, speed: "normal" as ReadingSpeed, locale });
  settings.current = { voice, speed, locale };
  // When the open pages turn, for the bar along the top.
  const [countdown, setCountdown] = useState<{ key: number; seconds: number } | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const turnTimer = useRef(0);

  // The reader's choices stay for the next book (only on this device).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(AUTO_READ_KEY) ?? "{}") as { voice?: unknown; speed?: unknown; music?: unknown };
      if (typeof saved.voice === "boolean") setVoice(saved.voice);
      if (typeof saved.music === "boolean") setMusic(saved.music);
      if (isReadingSpeed(saved.speed)) setSpeed(saved.speed);
    } catch {
      // private mode or blocked storage: the defaults are fine
    }
  }, []);
  /** Saved only when the reader changes it, so loading the saved choice can never overwrite it. */
  const choose = (next: { voice?: boolean; speed?: ReadingSpeed; music?: boolean }) => {
    if (next.voice !== undefined) setVoice(next.voice);
    if (next.speed !== undefined) setSpeed(next.speed);
    if (next.music !== undefined) setMusic(next.music);
    try {
      localStorage.setItem(AUTO_READ_KEY, JSON.stringify({ voice, speed, music, ...next }));
    } catch {
      // as above
    }
  };

  const stopReading = useCallback(() => {
    readingRef.current = false;
    setReading(false);
    setCountdown(null);
    window.clearTimeout(turnTimer.current);
    audio.current?.pause();
  }, []);

  /** Reads the open pages, then turns to the next ones. */
  const readPages = useCallback((indexes: number[]) => {
    const el = audio.current;
    if (!el) return;
    window.clearTimeout(turnTimer.current);
    el.pause();
    setCountdown(null);
    if (indexes.length === 0) return stopReading(); // the back cover
    const { voice: speaking, speed: pace, locale: language } = settings.current;
    const story = (i: number) => plainStory(readingPages[i]?.story ?? "");
    const voiced = speaking && language === "" ? indexes.filter((i) => readingPages[i]?.narrationUrl) : [];
    const silent = indexes.filter((i) => !voiced.includes(i));
    const turnAfter = (seconds: number) => {
      setCountdown({ key: Date.now(), seconds });
      turnTimer.current = window.setTimeout(() => readingRef.current && flipbook.current?.turnByHand(), seconds * 1000);
    };
    // Pages without a voice (or with the voice off) get a child's reading time.
    const readSilently = () => turnAfter(silent.length ? readingSeconds(silent.map(story), pace) : 1.2);
    let next = 0;
    const playNext = () => {
      if (!readingRef.current) return;
      if (next < voiced.length) {
        el.src = readingPages[voiced[next++]!]!.narrationUrl!;
        // If the phone refuses to play it, the child reads it instead.
        el.play().catch(() => turnAfter(readingSeconds(indexes.map(story), pace)));
        return;
      }
      readSilently();
    };
    el.onended = playNext;
    playNext();
  }, [readingPages, stopReading]);

  function toggleReading() {
    if (readingRef.current) return stopReading();
    readingRef.current = true;
    setReading(true);
    // Started inside the tap, so phones allow the voice for the rest of the book.
    readPages(visible);
  }

  // A new speed, voice setting or language applies from the open pages.
  useEffect(() => {
    if (readingRef.current) readPages(visibleRef.current);
  }, [voice, speed, locale, readPages]);
  // Hidden (another app, the lock screen): stop counting, and read these pages again on return.
  useEffect(() => {
    const onVisibility = () => {
      if (!readingRef.current) return;
      if (document.hidden) {
        window.clearTimeout(turnTimer.current);
        audio.current?.pause();
        setCountdown(null);
      } else readPages(visibleRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [readPages]);
  useEffect(() => () => window.clearTimeout(turnTimer.current), []);

  const firstSpread = useRef(true);
  const onSpreadChange = useCallback((indexes: number[]) => {
    setVisible(indexes);
    setFocusedPage((current) => indexes.includes(current) ? current : (indexes[0] ?? pages.length));
    if (readingRef.current) readPages(indexes);
    // Turning a page puts the controls away, like a book app.
    if (!firstSpread.current) setChrome(false);
    firstSpread.current = false;
  }, [readPages, pages.length]);

  const arCount = pages.filter(isAr).length;
  const shown = visible.flatMap((i) => readingPages[i] ? [readingPages[i]] : []);
  const backCover = pages.length > 0 && shown.length === 0;
  const atEnd = pages.length === 0 || backCover;
  // Preserve the last spread's caption height while the back cover is closed.
  const captionPages = backCover ? readingPages.slice(-2) : shown;
  const notes = backCover ? [] : shown.filter((page) => page.note);

  // ---------- soundtrack ----------
  // Loops under the reading when the reader turns it on, quieter while a voice reads. A page without
  // its own keeps the one before it, so one set on the first page plays through the book.
  const hasSoundtrack = pages.some((page) => page.soundtrack.length > 0);
  const soundtrack = useMemo(() => soundtrackFor(pages, visible), [pages, visible]);
  usePageSounds(music && hasSoundtrack ? soundtrack : null, { ducked: voicePlaying, group: READER_SOUND_GROUP });
  // On a phone the words are on the page once it's drawn; until then (or with no words) the caption shows them.
  const wordsOnPage = (backCover || shown.every((p) => composed[p.id] || !p.story || p.textPosition === "off" || (p === readingPages[0] && p.textPosition === "auto")));
  const position = backCover ? pages.length + 1 : (visible[0] ?? 0) + 1;
  // What the reader writes on the page itself follows the book's language.
  const say = readerWords(locale || "en");
  const printHref = `/print/${book.id}${locale ? `?lang=${encodeURIComponent(locale)}` : ""}`;
  const currentPageId = backCover ? "back-cover" : pages[focusedPage]?.id;
  useEffect(() => {
    const href = readerHref(book.id, currentPageId, locale);
    if (`${window.location.pathname}${window.location.search}` !== href) window.history.replaceState(window.history.state, "", href);
  }, [book.id, currentPageId, locale]);


  const handoffToExperience = useCallback(() => {
    readingRef.current = false;
    setReading(false);
    setCountdown(null);
    window.clearTimeout(turnTimer.current);
    const el = audio.current;
    if (el) {
      el.pause();
      el.onended = null;
      el.currentTime = 0;
    }
    setVoicePlaying(false);
    stopSoundGroup(READER_SOUND_GROUP);
  }, []);


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
          <LanguageMenu
            locale={locale}
            languages={languages}
            onChange={setLocale}
            className={cn(chip, "max-w-36 bg-[#f6eedf]/70 text-[#58432f] ring-1 ring-[#947a55]/25 hover:bg-[#f9f1e4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a88b61] data-[state=open]:bg-[#eee1ca]", single && "px-2.5")}
          >
            <Languages aria-hidden="true" className="size-4 shrink-0" />
            <bdi lang={locale || undefined} className={cn("truncate", single && "sr-only")}>{languageLabel(locale)}</bdi>
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
          </LanguageMenu>
        )}
        {hasSoundtrack && (
          <button
            onClick={() => choose({ music: !music })}
            aria-pressed={music}
            aria-label="Soundtrack"
            title={music ? "Turn the soundtrack off" : "Play the soundtrack while reading"}
            className={cn(chip, music ? "bg-emerald-600 text-white" : "text-ink-700 ring-1 ring-ink-900/10 hover:bg-white/60", single && "px-2.5")}
          >
            <Music className={cn("size-4", music && "animate-pulse")} />
            <span className={cn(single ? "sr-only" : "hidden lg:inline")}>Soundtrack</span>
          </button>
        )}
        {pages.length > 0 && (
          <AutoReadControl
            reading={reading}
            onToggle={toggleReading}
            narrated={narrated}
            voice={voice}
            onVoice={(value) => choose({ voice: value })}
            speed={speed}
            onSpeed={(value) => choose({ speed: value })}
            compact={single}
          />
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
            <Link href={printHref} className={cn(chip, "bg-ink-900 text-white hover:bg-ink-800")}>
              <Printer className="size-4" /> <span className={cn(single && "sr-only")}>Print</span>
            </Link>
          </>
        )}
        {!editable && pages.length > 0 && !single && (
          <Link href={printHref} className={cn(chip, "text-ink-700 ring-1 ring-ink-900/10 hover:bg-white/60")} title="Download or print this book">
            <Download className="size-4" /> Download
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
          {backCover ? say.backCover : say.page(position, pages.length)}
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
      <audio
        ref={audio}
        preload="none"
        className="hidden"
        onPlaying={() => setVoicePlaying(true)}
        onPause={() => setVoicePlaying(false)}
        onEnded={() => setVoicePlaying(false)}
      />
      {/* Auto read: how long until the page turns, right along the top so it shows with the controls away. */}
      {reading && countdown && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-30 h-1 bg-sky-600/15">
          <div key={countdown.key} className="h-full origin-left bg-sky-600 animate-auto-read" style={{ animationDuration: `${countdown.seconds}s` }} />
        </div>
      )}

      {header}

      {editable && book.needsCompile && !chromeHidden && (
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
            initialPage={initialPage}
            magnifier={magnifier && !single}
            single={single}
            onTap={() => showChrome(!chrome)}
            onSpreadChange={onSpreadChange}
            className="absolute inset-0"
            renderOverlay={(_, index, side) => {
              const page = pages[index]!;
              const ar = isAr(page);
              const words = composed[page.id]?.words;
              // Badges sit in a top corner, or a bottom one when the words drawn on the page are up there.
              const at = (edge: "left" | "right") => cn(edge === "left" ? "left-3" : "right-3", freeCorner(words, edge) === "top" ? "top-3" : "bottom-3");
              const experience = worldExperienceOf(page.scanAction, page.worldUrl);
              const returnTo = readerHref(book.id, page.id, locale);
              const badge = opensModel(page.scanAction) && page.hasModel ? (
                <Link href={withReturnTo(`/place/${book.id}/${page.id}`, returnTo)} onClick={() => { handoffToExperience(); if (page.scanAction === "eighthwall") void requestStoryMotion(); }} className={PAD} title="Place this model in your room. No printed book needed.">
                  <span className="flex items-center gap-1.5 rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                    <Box aria-hidden="true" className="size-3.5" /> <bdi lang={locale || undefined}>{say.placeModel}</bdi>
                  </span>
                </Link>
              ) : experience ? (
                <Link href={withReturnTo(`/world/${book.id}/${page.id}`, returnTo)} onClick={() => { handoffToExperience(); void requestStoryMotion(); }} className={PAD}>
                  <span className="flex items-center gap-1.5 rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                    <Orbit aria-hidden="true" className="size-3.5" /> <bdi lang={locale || undefined}>{experience === "box" ? say.stepInside : say.lookAround}</bdi>
                  </span>
                </Link>
              ) : page.scanAction === "ar" && ar && book.canScan ? (
                <Link href={withReturnTo(`/scan/${book.id}`, returnTo)} onClick={handoffToExperience} className={PAD} title="Point your camera at this page in the printed book">
                  <span className="flex items-center gap-1.5 rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                    <ScanLine aria-hidden="true" className="size-3.5" /> <bdi lang={locale || undefined}>{say.scanPrintedBook}</bdi>
                  </span>
                </Link>
              ) : null;
              // On a phone the controls hide while reading, so each page carries its own language switch.
              const other = side === "left" ? "right" : "left";
              return (
                <>
                  {badge && <div className={cn("absolute flex flex-col gap-1.5", at(side), side === "left" ? "items-start" : "items-end")}>{badge}</div>}
                  {single && languages.length > 0 && (
                    <LanguageMenu
                      locale={locale}
                      languages={languages}
                      onChange={setLocale}
                      align={other === "left" ? "start" : "end"}
                      className={cn("absolute", PAD, at(other))}
                    >
                      <span className="flex items-center gap-1 rounded-full bg-[#faf2e4]/90 px-2 py-1 text-[11px] font-bold text-[#58432f] shadow-md ring-1 ring-[#947a55]/30 backdrop-blur">
                        <Languages aria-hidden="true" className="size-3.5" />
                        {locale ? locale.toUpperCase() : <span className="sr-only">{languageLabel("")}</span>}
                      </span>
                    </LanguageMenu>
                  )}
                </>
              );
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

      {/* Under the book: the page titles and their notes. The story itself is on the page (and stays here
          for screen readers); until a page is drawn, or when it carries no words, it shows here instead. */}
      <div className={cn(
        "mx-auto w-full max-w-3xl shrink-0 px-6 pt-1 text-center",
        single ? "px-5 pb-3 safe-bottom" : "h-[min(6rem,16dvh)] overflow-y-auto",
        single && wordsOnPage && "sr-only",
      )}>
        <div className="truncate text-[13px] text-ink-600">{backCover ? say.backCover : shown.map((page, index) => <span key={page.id}>{index > 0 && " · "}<bdi lang={page.lang}>{page.title}</bdi></span>)}</div>
        {backCover && <span className="sr-only">Wonder begins with a question.</span>}
        {captionPages.some((page) => page.story) && (
          <p aria-hidden={backCover || undefined} className={cn("mx-auto mt-1 max-w-2xl font-serif leading-snug text-ink-700 italic", single ? "line-clamp-3 text-base" : "line-clamp-2 text-[17px]", (backCover || (wordsOnPage && !single)) && "sr-only")}>
            {captionPages.map((page) => page.story && <bdi key={page.id} lang={page.lang}>{plainStory(page.story)}{"  "}</bdi>)}
          </p>
        )}
        {!single && notes.length > 0 && (
          <div className="mx-auto mt-1.5 flex max-w-2xl flex-col gap-1">
            {notes.map((page) => (
              <p key={page.id} lang={page.lang} dir="auto" className="flex items-start justify-center gap-2 text-[15px] leading-snug text-ink-700">
                <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span>{page.note}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {strip}

      <span className="sr-only" aria-live="polite">{backCover ? say.backCover : say.page(position, pages.length)}</span>
    </div>
  );
}
