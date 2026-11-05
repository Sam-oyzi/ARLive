"use client";

import { Globe, Image as ImageIcon, Languages, LoaderCircle, Mic, Orbit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { runAction } from "@/lib/action-client";
import { CONTENT_META } from "@/lib/content";
import { composeStoryPage, type StoryPage } from "@/lib/story-page";
import { TEXT_POSITIONS, type TextPosition } from "@/lib/story-text";
import { uploadFile } from "@/lib/upload-client";
import type { PageTranslations } from "@/lib/page-translations";
import { languageName } from "@/lib/stories";
import { cn } from "@/lib/utils";
import { WORLD_EFFECT_HINT, WORLD_EFFECT_LABEL, WORLD_EFFECTS, worldEffectOf, type WorldEffect } from "@/lib/world-effects";
import { savePageTranslation, setPageNarration, setPageWorld, setPageWorldEffect, updateTarget } from "@/server/actions/books";

export type EditorTarget = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  width: number;
  height: number;
  narrationUrl: string | null;
  textPosition: TextPosition;
  /** The book's page height / width, for the preview. */
  pageAspect: number;
  /** The first page: only gets words when a position is chosen. */
  isCover: boolean;
  translations: PageTranslations;
  worldUrl: string | null;
  worldEffect: WorldEffect;
  bookId: string;
};

const AUDIO_ACCEPT = CONTENT_META.AUDIO.accept;

/** A recording of this page read aloud. The reader plays it with "Read to me" and turns the page when it ends. */
export function NarrationCard({ target }: { target: EditorTarget }) {
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
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
        <Mic className="size-3.5" /> Voice narration
      </div>
      {url ? (
        <div className="flex flex-col gap-3">
          <audio src={url} controls preload="none" className="w-full" />
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
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-ink-500">
            Record this page read aloud (MP3, M4A, OGG or WAV). Readers tap <b>Read to me</b> and each page plays its own voice, then turns.
          </p>
          <Button variant="outline" size="sm" disabled={progress !== null} onClick={() => input.current?.click()} className="self-start">
            {progress !== null ? <LoaderCircle className="animate-spin" /> : <Mic />}
            {progress !== null ? `Uploading ${Math.round(progress)}%` : "Add voice"}
          </Button>
        </div>
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
    </Card>
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
  const [pending, setPending] = useState(false);
  const rtl = lang === "ar";

  function pick(next: (typeof TRANSLATION_LANGUAGES)[number]) {
    setLang(next);
    setTitle(saved[next]?.title ?? "");
    setStory(saved[next]?.story ?? "");
  }

  async function save() {
    setPending(true);
    const result = await runAction(savePageTranslation(target.id, { locale: lang, title, story }));
    setPending(false);
    if (!result?.ok) return;
    setSaved((all) => {
      const next = { ...all };
      if (title.trim()) next[lang] = { ...all[lang], title: title.trim(), story: story.trim() || undefined };
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
        <Button variant="outline" size="sm" disabled={pending} onClick={save}>
          {pending && <LoaderCircle className="animate-spin" />} Save {languageName(lang)}
        </Button>
      </div>
    </Card>
  );
}

/** A 360° panorama readers step into from this page: the story world around them. */
export function WorldCard({ target }: { target: EditorTarget }) {
  const [url, setUrl] = useState(target.worldUrl);
  const [effect, setEffect] = useState(target.worldEffect);
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
        <Orbit className="size-3.5" /> Story world (360°)
      </div>
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
            <Link href={`/world/${target.bookId}/${target.id}`} target="_blank" className={buttonClasses("secondary", "sm")}>
              <Globe /> Step inside
            </Link>
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
            A 360° panorama (a 2:1 &ldquo;equirectangular&rdquo; image, e.g. 4096×2048) of the place this page happens in. From the scanner or
            the reader, children step inside it and look around by turning their phone, as if they were in the story.
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
