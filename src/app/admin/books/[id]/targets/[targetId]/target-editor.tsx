"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Box,
  Crosshair,
  Image as ImageIcon,
  Layers,
  LoaderCircle,
  Move3D,
  Rotate3D,
  Save,
  Scale3D,
  Trash2,
  Type,
  Video,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Progress } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { runAction } from "@/lib/action-client";
import { CONTENT_META, defaultTransform, type ContentData, type ContentType } from "@/lib/content";
import { replaceTargetImageFromFile, TARGET_IMAGE_ACCEPT } from "@/lib/target-image-client";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { addContent, deleteContent, saveContents, updateTarget } from "@/server/actions/books";
import type { Transform, TransformMode } from "./editor-canvas";

const EditorCanvas = dynamic(() => import("./editor-canvas"), {
  ssr: false,
  loading: () => (
    <div className="grid size-full place-items-center text-ink-400">
      <LoaderCircle className="size-6 animate-spin" />
    </div>
  ),
});

const TYPE_ICON: Record<ContentType, LucideIcon> = { MODEL: Box, VIDEO: Video, IMAGE: ImageIcon, AUDIO: Volume2, TEXT: Type };
const MODES: { mode: TransformMode; icon: LucideIcon; label: string; key: string }[] = [
  { mode: "translate", icon: Move3D, label: "Move", key: "w" },
  { mode: "rotate", icon: Rotate3D, label: "Rotate", key: "e" },
  { mode: "scale", icon: Scale3D, label: "Scale", key: "r" },
];

type Target = { id: string; name: string; description: string | null; imageUrl: string; width: number; height: number };

export function TargetEditor({ target, initialContents }: { target: Target; initialContents: ContentData[] }) {
  const [contents, setContents] = useState(initialContents);
  const [selectedId, setSelectedId] = useState<string | null>(initialContents[0]?.id ?? null);
  const [mode, setMode] = useState<TransformMode>("translate");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clips, setClips] = useState<Record<string, string[]>>({});
  const [upload, setUpload] = useState<{ type: ContentType; name: string; progress: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingType = useRef<ContentType>("MODEL");
  const selected = contents.find((c) => c.id === selectedId) ?? null;

  const patch = useCallback((id: string, changes: Partial<ContentData>) => {
    setContents((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    setDirty(true);
  }, []);
  const onTransform = useCallback((id: string, t: Transform) => patch(id, t), [patch]);
  const onClips = useCallback((id: string, names: string[]) => setClips((m) => ({ ...m, [id]: names })), []);

  // W / E / R switch gizmo modes, like most 3D tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      const match = MODES.find((m) => m.key === e.key.toLowerCase());
      if (match) setMode(match.mode);
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    const result = await runAction(
      saveContents(
        target.id,
        contents.map(({ id, name, text, color, posX, posY, posZ, rotX, rotY, rotZ, scale, autoplay, loop, animation }) => ({
          id, name, text, color, posX, posY, posZ, rotX, rotY, rotZ, scale, autoplay, loop, animation,
        })),
      ),
    );
    if (result?.ok) setDirty(false);
    setSaving(false);
  }

  async function create(type: ContentType, file?: File) {
    let url: string | null = null;
    const name = file ? file.name.replace(/\.[^.]+$/, "") : CONTENT_META[type].label;
    if (file) {
      const kind = CONTENT_META[type].uploadKind!;
      setUpload({ type, name, progress: 0 });
      try {
        url = (await uploadFile(file, kind, file.name, (p) => setUpload((u) => u && { ...u, progress: p }))).url;
      } catch (error) {
        toast.error((error as Error).message);
        setUpload(null);
        return;
      }
    }
    const result = await runAction(addContent(target.id, { type, name, url, text: type === "TEXT" ? "New label" : null }));
    setUpload(null);
    if (result?.data) {
      setContents((list) => [...list, result.data!]);
      setSelectedId(result.data.id);
    }
  }

  function pick(type: ContentType) {
    if (type === "TEXT") return create("TEXT");
    pendingType.current = type;
    if (fileInput.current) {
      fileInput.current.accept = CONTENT_META[type].accept;
      fileInput.current.click();
    }
  }

  async function remove(id: string) {
    const result = await runAction(deleteContent(id));
    if (result?.ok) {
      setContents((list) => list.filter((c) => c.id !== id));
      setSelectedId(null);
    }
  }

  return (
    <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_380px]">
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) create(pendingType.current, file);
          e.target.value = "";
        }}
      />

      {/* Stage */}
      {/* Stage: fixed height when stacked, fills the workspace height on wide screens */}
      <Card className="relative h-[65vh] min-h-[420px] overflow-hidden xl:h-full xl:min-h-0">
        <EditorCanvas
          imageUrl={target.imageUrl}
          aspect={target.height / target.width}
          contents={contents}
          selectedId={selectedId}
          mode={mode}
          onSelect={setSelectedId}
          onTransform={onTransform}
          onClips={onClips}
        />
        <div className="absolute top-4 left-4 flex gap-1 rounded-2xl bg-white/90 p-1 shadow-soft backdrop-blur">
          {MODES.map((m) => (
            <button
              key={m.mode}
              onClick={() => setMode(m.mode)}
              title={`${m.label} (${m.key.toUpperCase()})`}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                mode === m.mode ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100",
              )}
            >
              <m.icon className="size-4" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>
        <div className="absolute top-4 right-4">
          <Button onClick={save} disabled={!dirty || saving} size="sm" className="shadow-lift">
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            {dirty ? "Save scene" : "Saved"}
          </Button>
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-ink-950/70 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur">
          Drag to orbit · scroll to zoom · click an object to select · 1 unit = page width
        </div>
      </Card>

      {/* Panel: scrolls on its own so the 3D view stays in place */}
      <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1 xl:pb-1 [&>*]:shrink-0">

        <Card className="p-5">
          <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Add to this page</div>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(CONTENT_META) as ContentType[]).map((type) => {
              const Icon = TYPE_ICON[type];
              return (
                <button
                  key={type}
                  onClick={() => pick(type)}
                  disabled={!!upload}
                  title={`${CONTENT_META[type].label} — ${CONTENT_META[type].hint}`}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-ink-200 px-1 py-3 text-[11px] font-semibold text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                >
                  <Icon className="size-5" />
                  {CONTENT_META[type].label.split(" ")[0]}
                </button>
              );
            })}
          </div>
          {upload && (
            <div className="mt-3 rounded-xl bg-ink-50 p-3 text-xs">
              <div className="mb-1.5 flex justify-between font-medium text-ink-700">
                <span className="truncate">Uploading {upload.name}</span>
                <span className="tabular-nums">{Math.round(upload.progress)}%</span>
              </div>
              <Progress value={upload.progress} className="h-1.5" />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
            <Layers className="size-3.5" /> Layers
          </div>
          {contents.length === 0 ? (
            <p className="py-3 text-sm text-ink-500">Nothing here yet. Add a 3D model, video, image, audio or label.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {contents.map((c) => {
                const Icon = TYPE_ICON[c.type];
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition",
                        c.id === selectedId ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "text-ink-700 hover:bg-ink-50",
                      )}
                    >
                      <span className={cn("grid size-8 place-items-center rounded-lg", c.id === selectedId ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-500")}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                      <span className="text-[11px] text-ink-400">{CONTENT_META[c.type].label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {selected && <Inspector key={selected.id} content={selected} clips={clips[selected.id] ?? []} onChange={(c) => patch(selected.id, c)} onDelete={() => remove(selected.id)} />}

        <TargetImageCard target={target} />
        <PageDetails target={target} />
      </div>
    </div>
  );
}

const AXIS_COLOR: Record<string, string> = { X: "text-rose-500", Y: "text-emerald-500", Z: "text-blue-500" };

function NumberInput({ value, onChange, step, label, suffix }: { value: number; onChange: (v: number) => void; step: number; label: string; suffix?: string }) {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  const [text, setText] = useState(value.toFixed(decimals));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value.toFixed(decimals));
  }, [value, focused, decimals]);
  return (
    <label className="flex h-9 items-center rounded-xl border border-ink-200 bg-white pl-2.5 text-xs focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
      {/* Same colours as the gizmo arrows: X red, Y green, Z blue */}
      <span className={cn("w-3 font-bold", AXIS_COLOR[label] ?? "text-ink-400")}>{label}</span>
      <input
        type="number"
        step={step}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full min-w-0 bg-transparent px-1.5 text-right font-medium text-ink-900 tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && <span className="pr-2 text-ink-400">{suffix}</span>}
    </label>
  );
}

function Inspector({
  content,
  clips,
  onChange,
  onDelete,
}: {
  content: ContentData;
  clips: string[];
  onChange: (changes: Partial<ContentData>) => void;
  onDelete: () => void;
}) {
  const playable = content.type === "MODEL" || content.type === "VIDEO" || content.type === "AUDIO";
  const spatial = content.type !== "AUDIO";
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{CONTENT_META[content.type].label}</div>
        <Button variant="danger-ghost" size="xs" onClick={onDelete}>
          <Trash2 /> Remove
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <Input value={content.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>

        {content.type === "TEXT" && (
          <>
            <Field label="Text">
              <Textarea value={content.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} className="min-h-16" />
            </Field>
            <Field label="Background">
              <div className="flex gap-2">
                {["#ffffff", "#161624", "#5b5bf6", "#10b981", "#f59e0b", "#ef4444"].map((c) => (
                  <button
                    key={c}
                    onClick={() => onChange({ color: c })}
                    aria-label={c}
                    className="size-7 rounded-full ring-1 ring-ink-200"
                    style={{ background: c, boxShadow: content.color === c ? `0 0 0 2px white, 0 0 0 4px ${c === "#ffffff" ? "#bfbfd1" : c}` : undefined }}
                  />
                ))}
              </div>
            </Field>
          </>
        )}

        {spatial && (
          <>
            <Field label="Position">
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput label="X" step={0.01} value={content.posX} onChange={(v) => onChange({ posX: v })} />
                <NumberInput label="Y" step={0.01} value={content.posY} onChange={(v) => onChange({ posY: v })} />
                <NumberInput label="Z" step={0.01} value={content.posZ} onChange={(v) => onChange({ posZ: v })} />
              </div>
            </Field>
            <Field label="Rotation">
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput label="X" step={1} suffix="°" value={content.rotX} onChange={(v) => onChange({ rotX: v })} />
                <NumberInput label="Y" step={1} suffix="°" value={content.rotY} onChange={(v) => onChange({ rotY: v })} />
                <NumberInput label="Z" step={1} suffix="°" value={content.rotZ} onChange={(v) => onChange({ rotZ: v })} />
              </div>
            </Field>
            <Field label="Scale" hint="1 = as wide as the page">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.05}
                  max={3}
                  step={0.01}
                  value={Math.min(3, content.scale)}
                  onChange={(e) => onChange({ scale: parseFloat(e.target.value) })}
                  className="flex-1 accent-brand-500"
                />
                <div className="w-24">
                  <NumberInput label="" step={0.01} value={content.scale} onChange={(v) => v > 0 && onChange({ scale: v })} />
                </div>
              </div>
            </Field>
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="xs" onClick={() => onChange({ posX: 0, posY: 0 })}>
                <Crosshair /> Centre
              </Button>
              <Button variant="outline" size="xs" onClick={() => onChange({ rotX: 90, rotY: 0, rotZ: 0, posZ: 0 })}>
                Stand up
              </Button>
              <Button variant="outline" size="xs" onClick={() => onChange({ rotX: 0, rotY: 0, rotZ: 0, posZ: 0.01 })}>
                Lay flat
              </Button>
              <Button variant="ghost" size="xs" onClick={() => onChange(defaultTransform(content.type))}>
                Reset
              </Button>
            </div>
          </>
        )}

        {playable && (
          <div className="flex flex-col gap-3 rounded-2xl bg-ink-50 p-3.5">
            <label className="flex items-center justify-between text-sm font-medium text-ink-700">
              Play when the page is found
              <Switch checked={content.autoplay} onCheckedChange={(v) => onChange({ autoplay: v })} />
            </label>
            <label className="flex items-center justify-between text-sm font-medium text-ink-700">
              Loop
              <Switch checked={content.loop} onCheckedChange={(v) => onChange({ loop: v })} />
            </label>
            {content.type === "MODEL" && clips.length > 0 && (
              <Field label="Animation">
                <Select value={content.animation ?? ""} onChange={(e) => onChange({ animation: e.target.value || null })}>
                  <option value="">All clips ({clips.length})</option>
                  {clips.map((clip) => (
                    <option key={clip} value={clip}>
                      {clip}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function TargetImageCard({ target }: { target: Target }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const router = useRouter();

  async function onFile(file: File) {
    setProgress(0);
    const ok = await replaceTargetImageFromFile(target.id, file, setProgress);
    setProgress(null);
    if (ok) router.refresh();
  }

  return (
    <Card className="p-5">
      <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Target image</div>
      <input
        ref={input}
        type="file"
        accept={TARGET_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={target.imageUrl} alt="" className="h-24 w-[72px] shrink-0 rounded-xl object-cover ring-1 ring-ink-200" />
        <div className="flex min-w-0 flex-col justify-between gap-2">
          <p className="text-xs leading-relaxed text-ink-500">
            The picture students point their camera at. Replacing it keeps everything placed on this page; recompile the book afterwards.
          </p>
          <Button variant="outline" size="sm" disabled={progress !== null} onClick={() => input.current?.click()}>
            {progress !== null ? <LoaderCircle className="animate-spin" /> : <ImageIcon />}
            {progress !== null ? `Uploading ${Math.round(progress)}%` : "Replace image"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PageDetails({ target }: { target: Target }) {
  const [state, action] = useActionState(updateTarget, undefined);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state]);
  return (
    <Card className="p-5">
      <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Page info shown to students</div>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={target.id} />
        <Field label="Title">
          <Input name="name" defaultValue={target.name} required />
        </Field>
        <Field label="Explanation" hint="Appears in the info card when a student scans this page.">
          <Textarea name="description" defaultValue={target.description ?? ""} placeholder="The heart pumps blood through…" />
        </Field>
        <SubmitButton variant="outline" size="sm" pendingText="Saving…">
          Save page info
        </SubmitButton>
      </form>
    </Card>
  );
}
