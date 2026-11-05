"use client";

import { AudioLines, Globe, Image as ImageIcon, Languages, LoaderCircle, Mic, Music, Orbit, Play, Plus, Square, Trash2, Trees, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { runAction } from "@/lib/action-client";
import { CONTENT_META } from "@/lib/content";
import { playPageSound, type PageSound } from "@/lib/page-sound";
import { SOUND_LIMIT, type PageSoundRow, type SoundKind } from "@/lib/sound-layers";
import { composeStoryPage, type StoryPage } from "@/lib/story-page";
import { TEXT_POSITIONS, type TextPosition } from "@/lib/story-text";
import { uploadFile } from "@/lib/upload-client";
import type { PageTranslations } from "@/lib/page-translations";
import { languageName } from "@/lib/stories";
import { cn } from "@/lib/utils";
import type { ScanAction } from "@/lib/scan-actions";
import { WORLD_EFFECT_HINT, WORLD_EFFECT_LABEL, WORLD_EFFECTS, worldEffectOf, type WorldEffect } from "@/lib/world-effects";
import { addPageSound, deletePageSound, savePageTranslation, setPageNarration, setPageWorld, setPageWorldEffect, updatePageSound, updateTarget } from "@/server/actions/books";

export type EditorTarget = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  width: number;
  height: number;
  narrationUrl: string | null;
  /** Scene sounds and the reading soundtrack, in Studio order. */
  sounds: PageSoundRow[];
  note: string | null;
  textPosition: TextPosition;
  /** The book's page height / width, for the preview. */
  pageAspect: number;
  /** The first page: only gets words when a position is chosen. */
  isCover: boolean;
  translations: PageTranslations;
  worldUrl: string | null;
  worldEffect: WorldEffect;
  scanAction: ScanAction;
  /** Compiled as an AR target, so the printed page can be scanned. */
  ar: boolean;
  bookId: string;
};

const AUDIO_ACCEPT = CONTENT_META.AUDIO.accept;

const PLAYS_IN: Record<ScanAction, string> = {
  ar: "They play while the printed page is in view of the scanner (MindAR).",
  eighthwall: "They play once the 8th Wall model stands in the room.",
  world: "They play once the reader is inside the story box.",
  panorama: "They play in the 360° view, a little quieter while the voice reads.",
  quicklook: "Apple's AR Quick Look can't play a page's sounds: choose another experience to hear them.",
};

/**
 * Everything this page says and plays, in one place: the voice that reads it aloud, the soundtrack
 * readers can turn on while reading, and up to four sounds that play together on their own in its
 * experience (a brook, birds, an owl…).
 */
export function PageSoundsCard({ target }: { target: EditorTarget }) {
  const [sounds, setSounds] = useState(target.sounds);
  const saving = useRef(new Map<string, number>());

  /** Changes show at once; saving waits for a pause, so dragging the volume doesn't save every step. */
  function change(id: string, patch: Partial<PageSoundRow>) {
    const sound = { ...sounds.find((item) => item.id === id)!, ...patch };
    setSounds((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    window.clearTimeout(saving.current.get(id));
    saving.current.set(id, window.setTimeout(() => {
      void runAction(updatePageSound(id, { name: sound.name.trim() || "Sound", volume: sound.volume, loop: sound.loop, delay: sound.delay }));
    }, 500));
  }

  async function remove(id: string) {
    window.clearTimeout(saving.current.get(id));
    const result = await runAction(deletePageSound(id));
    if (result?.ok) setSounds((list) => list.filter((sound) => sound.id !== id));
  }

  const section = (kind: SoundKind) => ({
    targetId: target.id,
    kind,
    sounds: sounds.filter((sound) => sound.kind === kind),
    onAdded: (sound: PageSoundRow) => setSounds((list) => [...list, sound]),
    onChange: change,
    onRemove: remove,
  });

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
        <AudioLines className="size-3.5" /> Sounds
      </div>

      <section className="mt-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900"><Mic className="size-4 text-ink-400" /> Voice</h3>
        <p className="mt-1 mb-2.5 text-xs leading-relaxed text-ink-500">
          This page read aloud. <b>Auto read</b> plays it in the reader, and the 360° view plays it on arrival.
        </p>
        <VoiceRow target={target} />
      </section>

      <SoundSection
        {...section("reading")}
        icon={Music}
        title="Soundtrack while reading"
        hint={<>Music or nature that loops softly in the reader when the reader turns on <b>Soundtrack</b>, quieter while the voice reads. It keeps playing on the next pages until a page sets its own, so setting it on the first page covers the whole book.</>}
      />
      <SoundSection
        {...section("scene")}
        icon={Trees}
        title="Sounds in the experience"
        warn={target.scanAction === "quicklook"}
        hint={<>Nature, animals, music: they start by themselves and mix together. {PLAYS_IN[target.scanAction]}</>}
      />
    </Card>
  );
}

function SoundSection({ targetId, kind, sounds, icon: Icon, title, hint, warn, onAdded, onChange, onRemove }: {
  targetId: string;
  kind: SoundKind;
  sounds: PageSoundRow[];
  icon: LucideIcon;
  title: string;
  hint: ReactNode;
  warn?: boolean;
  onAdded: (sound: PageSoundRow) => void;
  onChange: (id: string, patch: Partial<PageSoundRow>) => void;
  onRemove: (id: string) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const preview = useRef<PageSound[]>([]);
  const limit = SOUND_LIMIT[kind];

  const stopPreview = useCallback(() => {
    preview.current.forEach((sound) => sound.stop());
    preview.current = [];
    setPreviewing(false);
  }, []);
  useEffect(() => stopPreview, [stopPreview]);

  async function add(file: File) {
    setProgress(0);
    try {
      const uploaded = await uploadFile(file, "audio", file.name, setProgress);
      const result = await runAction(addPageSound(targetId, { name: file.name, url: uploaded.url, kind }));
      if (result?.ok && result.data) onAdded(result.data);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setProgress(null);
    }
  }

  function togglePreview() {
    if (previewing) return stopPreview();
    preview.current = sounds.map((sound) => playPageSound(sound));
    setPreviewing(true);
  }

  return (
    <section className="mt-5 border-t border-ink-100 pt-4">
      <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-900">
        <span className="flex items-center gap-1.5"><Icon className="size-4 text-ink-400" /> {title}</span>
        <span className="text-xs font-medium text-ink-500 tabular-nums">{sounds.length}/{limit}</span>
      </h3>
      <p className={cn("mt-1 mb-3 text-xs leading-relaxed", warn ? "font-medium text-amber-700" : "text-ink-500")}>{hint}</p>
      <div className="flex flex-col gap-2.5">
        {sounds.map((sound) => (
          <SoundRow
            key={sound.id}
            sound={sound}
            onChange={(patch) => { stopPreview(); onChange(sound.id, patch); }}
            onRemove={() => { stopPreview(); onRemove(sound.id); }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={progress !== null || sounds.length >= limit} onClick={() => input.current?.click()}>
          {progress !== null ? <LoaderCircle className="animate-spin" /> : <Plus />}
          {progress !== null ? `Uploading ${Math.round(progress)}%` : sounds.length >= limit ? `${limit} is the most` : kind === "reading" ? "Add soundtrack" : "Add a sound"}
        </Button>
        {sounds.length > 0 && (
          <Button variant={previewing ? "primary" : "outline"} size="sm" onClick={togglePreview}>
            {previewing ? <Square /> : <Play />} {previewing ? "Stop" : sounds.length > 1 ? "Preview the mix" : "Preview"}
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) add(file);
          event.target.value = "";
        }}
      />
    </section>
  );
}

function SoundRow({ sound, onChange, onRemove }: { sound: PageSoundRow; onChange: (patch: Partial<PageSoundRow>) => void; onRemove: () => void }) {
  const percent = Math.round(sound.volume * 100);
  return (
    <div className="rounded-2xl border border-ink-200/70 bg-ink-50/40 p-3">
      <div className="flex items-center gap-2">
        <Input value={sound.name} onChange={(event) => onChange({ name: event.target.value })} maxLength={60} aria-label="Sound name" className="h-9 flex-1" />
        <Button variant="danger-ghost" size="sm" onClick={onRemove} aria-label={`Remove ${sound.name}`}>
          <Trash2 />
        </Button>
      </div>
      <audio src={sound.url} controls preload="none" className="mt-2 h-9 w-full" />
      <div className="mt-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2.5 text-xs text-ink-600">
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          onChange={(event) => onChange({ volume: Number(event.target.value) / 100 })}
          aria-label={`${sound.name} volume`}
          className="w-full accent-brand-500"
        />
        <span className="w-9 text-right tabular-nums">{percent}%</span>
        <span>Starts after</span>
        <span className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            max={120}
            step={0.5}
            value={sound.delay}
            onChange={(event) => onChange({ delay: Math.max(0, Math.min(120, Number(event.target.value) || 0)) })}
            aria-label={`${sound.name} starts after, in seconds`}
            className="h-8 w-20"
          />
          seconds
        </span>
        <span />
        <span>Repeat</span>
        <span className="flex items-center gap-2">
          <Switch checked={sound.loop} onCheckedChange={(loop) => onChange({ loop })} aria-label={`Repeat ${sound.name}`} />
          {sound.loop ? "Loops for as long as the page is open" : "Plays once"}
        </span>
        <span />
      </div>
    </div>
  );
}

/** The page read aloud: one recording, played by the reader and the 360° view. */
function VoiceRow({ target }: { target: EditorTarget }) {
  const [url, setUrl] = useState(target.narrationUrl);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setProgress(0);
    try {
      const result = await uploadFile(file, "audio", file.name, setProgress);
      const saved = await runAction(setPageNarration(target.id, result.url));
      if (saved?.ok) setUrl(result.url);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      {url ? (
        <div className="flex flex-col gap-2.5">
          <audio src={url} controls preload="none" className="h-9 w-full" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={progress !== null} onClick={() => input.current?.click()}>
              {progress !== null ? <LoaderCircle className="animate-spin" /> : <Mic />}
              {progress !== null ? `Uploading ${Math.round(progress)}%` : "Replace"}
            </Button>
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={async () => {
                const result = await runAction(setPageNarration(target.id, null));
                if (result?.ok) setUrl(null);
              }}
            >
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" disabled={progress !== null} onClick={() => input.current?.click()}>
          {progress !== null ? <LoaderCircle className="animate-spin" /> : <Mic />}
          {progress !== null ? `Uploading ${Math.round(progress)}%` : "Add the voice (MP3, M4A, OGG or WAV)"}
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          event.target.value = "";
        }}
      />
    </>
  );
}

export function TargetImageCard({
  target,
  progress,
  onReplace,
}: {
  target: EditorTarget;
  /** Upload progress while replacing, else null */
  progress: number | null;
  onReplace: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Target image</div>
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={target.imageUrl} alt="" className="h-24 w-[72px] shrink-0 rounded-xl object-cover ring-1 ring-ink-200" />
        <div className="flex min-w-0 flex-col justify-between gap-2">
          <p className="text-xs leading-relaxed text-ink-500">
            The picture students point their camera at. Replacing it keeps everything placed on this page; recompile the book afterwards.
          </p>
          <Button variant="outline" size="sm" disabled={progress !== null} onClick={onReplace}>
            {progress !== null ? <LoaderCircle className="animate-spin" /> : <ImageIcon />}
            {progress !== null ? `Uploading ${Math.round(progress)}%` : "Replace image"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function PageDetails({ target }: { target: EditorTarget }) {
  const [state, action] = useActionState(updateTarget, undefined);
  const [story, setStory] = useState(target.description ?? "");
  const [position, setPosition] = useState<TextPosition>(target.textPosition);
  const [preview, setPreview] = useState<StoryPage | null>(null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state]);

  // How the words will sit on this page in the phone reader and in print.
  useEffect(() => {
    let alive = true;
    let page: StoryPage | null = null;
    const timer = setTimeout(async () => {
      page = await composeStoryPage({ imageUrl: target.imageUrl, story, position, aspect: target.pageAspect, width: 480, cover: target.isCover }).catch(() => null);
      if (alive) setPreview(page);
      else if (page) URL.revokeObjectURL(page.url);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
      if (page) URL.revokeObjectURL(page.url);
    };
  }, [target.imageUrl, target.pageAspect, target.isCover, story, position]);

  return (
    <Card className="p-5">
      <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Page text</div>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={target.id} />
        <Field label="Title">
          <Input name="name" defaultValue={target.name} required />
        </Field>
        <Field
          label="Story text"
          hint={
            <>
              Short lines, like a picture book: each new line is a line on the page. Put sound words between stars, <code>*Buzz buzz*</code>,
              to make them big and colourful. Also shown on the AR info card.
            </>
          }
        >
          <Textarea
            name="description"
            value={story}
            onChange={(event) => setStory(event.target.value)}
            maxLength={1000}
            className="min-h-28"
            placeholder={"Lou can go\nlike the rain.\nLou can go…\n\n*Plip plop!*"}
          />
        </Field>
        <Field
          label="Note under the page"
          hint="On a laptop the story sits on the page, so the space underneath holds this instead: a comment, an explanation, a question to talk about. Leave it empty for nothing."
        >
          <Textarea name="note" defaultValue={target.note ?? ""} maxLength={600} className="min-h-16" placeholder="Did you know? A tortoise can live for over 100 years." />
        </Field>
        <Field label="Text on the page" hint="Where the words sit in the phone reader and in print.">
          <Select name="textPosition" value={position} onChange={(event) => setPosition(event.target.value as TextPosition)}>
            {(Object.keys(TEXT_POSITIONS) as TextPosition[]).map((key) => (
              <option key={key} value={key}>
                {TEXT_POSITIONS[key]}
              </option>
            ))}
          </Select>
        </Field>
        {target.isCover && position === "auto" && (
          <p className="text-xs text-ink-500">This is the cover: its title is in the picture, so no words are added unless you pick a position.</p>
        )}
        {position !== "off" && !(target.isCover && position === "auto") && story.trim() && (
          <div className="overflow-hidden rounded-xl ring-1 ring-ink-200" style={{ aspectRatio: `1 / ${target.pageAspect}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img src={preview.url} alt="Preview of the words on this page" className="size-full object-cover" /> : <div className="size-full animate-pulse bg-ink-100" />}
          </div>
        )}
        {preview?.mode === "room" && (
          <p className="text-xs text-amber-700">No empty paper fits these words, even split in two or smaller, so the picture is shown a little smaller to make room. Shorter text or a picture with a quiet top or bottom fixes it.</p>
        )}
        <SubmitButton variant="outline" size="sm" pendingText="Saving…">
          Save page text
        </SubmitButton>
      </form>
    </Card>
  );
}

const TRANSLATION_LANGUAGES = ["fr", "ar", "es", "de"] as const;

/** The page's title and story in other languages; readers switch language from the page. */
export function TranslationsCard({ target }: { target: EditorTarget }) {
  const [lang, setLang] = useState<(typeof TRANSLATION_LANGUAGES)[number]>("fr");
  const [saved, setSaved] = useState(target.translations);
  const [title, setTitle] = useState(saved.fr?.title ?? "");
  const [story, setStory] = useState(saved.fr?.story ?? "");
  const [note, setNote] = useState(saved.fr?.note ?? "");
  const [pending, setPending] = useState(false);
  const rtl = lang === "ar";

  function pick(next: (typeof TRANSLATION_LANGUAGES)[number]) {
    setLang(next);
    setTitle(saved[next]?.title ?? "");
    setStory(saved[next]?.story ?? "");
    setNote(saved[next]?.note ?? "");
  }

  async function save() {
    setPending(true);
    const result = await runAction(savePageTranslation(target.id, { locale: lang, title, story, note }));
    setPending(false);
    if (!result?.ok) return;
    setSaved((all) => {
      const next = { ...all };
      if (title.trim()) next[lang] = { ...all[lang], title: title.trim(), story: story.trim() || undefined, note: note.trim() || undefined };
      else delete next[lang];
      return next;
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
        <Languages className="size-3.5" /> Translations
      </div>
      <div role="tablist" aria-label="Language" className="mb-3 flex flex-wrap gap-1.5">
        {TRANSLATION_LANGUAGES.map((code) => (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={lang === code}
            onClick={() => pick(code)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
              lang === code ? "bg-ink-900 text-white ring-ink-900" : "text-ink-600 ring-ink-200 hover:ring-ink-300",
            )}
          >
            {languageName(code)}
            {saved[code] && <span className="ml-1 text-emerald-500">●</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} dir={rtl ? "rtl" : "ltr"} lang={lang} maxLength={120} placeholder={`Title in ${languageName(lang)}`} />
        </Field>
        <Field label="Story text" hint="Same rules as the original: short lines, *sound words* between stars. Leave the title empty to remove this language.">
          <Textarea value={story} onChange={(e) => setStory(e.target.value)} dir={rtl ? "rtl" : "ltr"} lang={lang} maxLength={1000} className="min-h-24" />
        </Field>
        <Field label="Note under the page">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} dir={rtl ? "rtl" : "ltr"} lang={lang} maxLength={600} className="min-h-14" />
        </Field>
        <Button variant="outline" size="sm" disabled={pending} onClick={save}>
          {pending && <LoaderCircle className="animate-spin" />} Save {languageName(lang)}
        </Button>
      </div>
    </Card>
  );
}

/** Artwork shared by the tracked story box and the explicitly selected 360° view. */
export function WorldCard({ target }: { target: EditorTarget }) {
  const [url, setUrl] = useState(target.worldUrl);
  const [effect, setEffect] = useState(target.worldEffect);
  const scanAction = target.scanAction;
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setProgress(0);
    try {
      const result = await uploadFile(file, "worlds", file.name, setProgress);
      const saved = await runAction(setPageWorld(target.id, result.url));
      if (saved?.ok) setUrl(result.url);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
        <Orbit className="size-3.5" /> Story world artwork
      </div>
      <p className="mb-4 text-xs leading-relaxed text-ink-500">
        Choose the page experience at the top of the editor. Step Inside or 360° opens only that experience;
        saved 3D models and AR Quick Look stay hidden until you choose AR content.
      </p>
      {url ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="aspect-[2/1] w-full rounded-xl object-cover ring-1 ring-ink-200" />
          <Field label="Moving in the room" hint={WORLD_EFFECT_HINT[effect]}>
            <Select
              value={effect}
              onChange={async (event) => {
                const next = worldEffectOf(event.target.value);
                const previous = effect;
                setEffect(next);
                const result = await runAction(setPageWorldEffect(target.id, next));
                if (!result?.ok) setEffect(previous);
              }}
            >
              {WORLD_EFFECTS.map((value) => (
                <option key={value} value={value}>{WORLD_EFFECT_LABEL[value]}</option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2">
            {(scanAction === "world" || scanAction === "panorama") && <Link href={`/world/${target.bookId}/${target.id}`} target="_blank" className={buttonClasses("secondary", "sm")}>
              <Globe /> Preview {scanAction === "world" ? "Step Inside" : "360° view"}
            </Link>}
            <Button variant="outline" size="sm" disabled={progress !== null} onClick={() => input.current?.click()}>
              {progress !== null ? <LoaderCircle className="animate-spin" /> : <ImageIcon />}
              {progress !== null ? `Uploading ${Math.round(progress)}%` : "Replace"}
            </Button>
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={async () => {
                const result = await runAction(setPageWorld(target.id, null));
                if (result?.ok) setUrl(null);
              }}
            >
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-ink-500">
            Add a 2:1 panorama (e.g. 4096×2048) of the place this page happens in. Use it for a tracked Step Inside story box,
            or explicitly choose a 360° view at the top of the editor.
          </p>
          <Button variant="outline" size="sm" disabled={progress !== null} onClick={() => input.current?.click()} className="self-start">
            {progress !== null ? <LoaderCircle className="animate-spin" /> : <Orbit />}
            {progress !== null ? `Uploading ${Math.round(progress)}%` : "Add a story world"}
          </Button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          event.target.value = "";
        }}
      />
    </Card>
  );
}
