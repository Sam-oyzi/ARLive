"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Box,
  Film,
  Image as ImageIcon,
  Layers,
  LoaderCircle,
  Move3D,
  Pause,
  Play,
  Rotate3D,
  Save,
  Scale3D,
  Type,
  TypeOutline,
  Video,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { runAction } from "@/lib/action-client";
import { CONTENT_META, type ContentData, type ContentType } from "@/lib/content";
import {
  parseMotion,
  poseOf,
  sampleKeyframes,
  serializeMotion,
  upsertKeyframe,
  type KeyframeMotion,
  type Motion,
  type Pose,
} from "@/lib/motion-schema";
import { replaceTargetImageFromFile, TARGET_IMAGE_ACCEPT } from "@/lib/target-image-client";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { addContent, deleteContent, duplicateContent, replaceContentFile, saveContents } from "@/server/actions/books";
import type { ContextTarget, TransformMode } from "./editor-canvas";
import { Inspector } from "./inspector";
import { NarrationCard, PageDetails, TargetImageCard, TranslationsCard, WorldCard, type EditorTarget } from "./page-cards";
import { SceneMenu, type SceneMenuAction } from "./scene-menu";
import { Timeline } from "./timeline";

const EditorCanvas = dynamic(() => import("./editor-canvas"), {
  ssr: false,
  loading: () => (
    <div className="grid size-full place-items-center text-ink-400">
      <LoaderCircle className="size-6 animate-spin" />
    </div>
  ),
});

const TYPE_ICON: Record<ContentType, LucideIcon> = {
  MODEL: Box,
  TEXT3D: TypeOutline,
  VIDEO: Video,
  IMAGE: ImageIcon,
  AUDIO: Volume2,
  TEXT: Type,
};
const MODES: { mode: TransformMode; icon: LucideIcon; label: string; key: string }[] = [
  { mode: "translate", icon: Move3D, label: "Move", key: "w" },
  { mode: "rotate", icon: Rotate3D, label: "Rotate", key: "e" },
  { mode: "scale", icon: Scale3D, label: "Scale", key: "r" },
];

type PendingFile = { mode: "add"; type: ContentType } | { mode: "replace"; id: string } | { mode: "target" };
type Editing = { id: string; time: number; playing: boolean; selectedKey: number | null };

export function TargetEditor({ target, initialContents }: { target: EditorTarget; initialContents: ContentData[] }) {
  const [contents, setContents] = useState(initialContents);
  const [selectedId, setSelectedId] = useState<string | null>(initialContents[0]?.id ?? null);
  const [mode, setMode] = useState<TransformMode>("translate");
  const [preview, setPreview] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clips, setClips] = useState<Record<string, string[]>>({});
  const [upload, setUpload] = useState<{ label: string; progress: number } | null>(null);
  const [targetProgress, setTargetProgress] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; contentId: string | null } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Keyframe editing: the item on the timeline, the playhead, and a pose the user moved but hasn't keyed yet.
  const [editing, setEditing] = useState<Editing | null>(null);
  const [manualPose, setManualPose] = useState<Pose | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<PendingFile | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rightDown = useRef<{ x: number; y: number } | null>(null);
  const contextHandled = useRef(false);
  const router = useRouter();

  const selected = contents.find((c) => c.id === selectedId) ?? null;
  const editingContent = editing ? (contents.find((c) => c.id === editing.id) ?? null) : null;
  const editingMotion = useMemo(() => {
    const motion = parseMotion(editingContent?.motion);
    return motion?.kind === "keyframes" ? motion : null;
  }, [editingContent?.motion]);
  const displayPose: Pose | null =
    editing && editingContent
      ? (manualPose ?? (editingMotion ? sampleKeyframes(editingMotion, editing.time) : null) ?? poseOf(editingContent))
      : null;

  const patch = useCallback((id: string, changes: Partial<ContentData>) => {
    setContents((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    setDirty(true);
  }, []);
  const onClips = useCallback((id: string, names: string[]) => setClips((m) => ({ ...m, [id]: names })), []);

  /** Set an item's animation; keyframed items rest on their first keyframe. */
  function setMotion(id: string, motion: Motion | null) {
    const changes: Partial<ContentData> = { motion: serializeMotion(motion) };
    if (motion?.kind === "keyframes" && motion.frames[0]) Object.assign(changes, poseOf(motion.frames[0]));
    patch(id, changes);
  }

  function onTransform(id: string, pose: Pose) {
    if (editing?.id === id) {
      setManualPose(pose);
      setEditing((e) => e && { ...e, playing: false });
      return;
    }
    const content = contents.find((c) => c.id === id);
    if (!content) return;
    const motion = parseMotion(content.motion);
    if (motion?.kind === "keyframes" && motion.frames.length) {
      // Moving a keyframed item outside the timeline carries its whole animation along.
      const frames = motion.frames.map((f) => ({
        ...f,
        posX: f.posX + pose.posX - content.posX,
        posY: f.posY + pose.posY - content.posY,
        posZ: f.posZ + pose.posZ - content.posZ,
        rotX: f.rotX + pose.rotX - content.rotX,
        rotY: f.rotY + pose.rotY - content.rotY,
        rotZ: f.rotZ + pose.rotZ - content.rotZ,
        scale: f.scale * (pose.scale / content.scale),
      }));
      patch(id, { ...pose, motion: serializeMotion({ ...motion, frames }) });
    } else {
      patch(id, pose);
    }
  }

  // ---------- timeline ----------

  function openTimeline(id: string) {
    const content = contents.find((c) => c.id === id);
    if (!content) return;
    const existing = parseMotion(content.motion);
    if (existing?.kind !== "keyframes") {
      setMotion(id, { kind: "keyframes", duration: 3, loop: true, easing: "smooth", frames: [{ t: 0, ...poseOf(content) }] });
    }
    setSelectedId(id);
    setManualPose(null);
    setEditing({ id, time: 0, playing: false, selectedKey: 0 });
  }

  function closeTimeline() {
    setEditing(null);
    setManualPose(null);
  }

  function updateMotion(update: (m: KeyframeMotion) => KeyframeMotion) {
    if (editing && editingMotion) setMotion(editing.id, update(editingMotion));
  }

  function scrub(time: number) {
    setEditing((e) => e && { ...e, time, playing: false });
    setManualPose(null);
  }

  function togglePlay() {
    if (!editing || !editingMotion) return;
    setManualPose(null);
    setEditing({
      ...editing,
      playing: !editing.playing,
      time: !editing.playing && !editingMotion.loop && editing.time >= editingMotion.duration ? 0 : editing.time,
    });
  }

  function addKey() {
    if (!editing || !editingMotion || !displayPose) return;
    const frames = upsertKeyframe(editingMotion.frames, editing.time, displayPose);
    const keyTime = Math.round(editing.time * 100) / 100;
    updateMotion((m) => ({ ...m, frames }));
    setManualPose(null);
    setEditing({ ...editing, playing: false, selectedKey: frames.findIndex((f) => Math.abs(f.t - keyTime) < 0.005) });
  }

  function deleteKey() {
    if (!editing || !editingMotion || editing.selectedKey === null) return;
    const index = editing.selectedKey;
    updateMotion((m) => ({ ...m, frames: m.frames.filter((_, i) => i !== index) }));
    setManualPose(null);
    setEditing({ ...editing, selectedKey: null });
  }

  function moveKey(index: number, t: number) {
    updateMotion((m) => ({ ...m, frames: m.frames.map((f, i) => (i === index ? { ...f, t } : f)) }));
  }

  function changeTimeline(changes: Partial<Pick<KeyframeMotion, "duration" | "loop" | "easing">>) {
    updateMotion((m) => {
      const duration = changes.duration ?? m.duration;
      return { ...m, ...changes, frames: m.frames.map((f) => ({ ...f, t: Math.min(f.t, duration) })) };
    });
    if (changes.duration !== undefined) setEditing((e) => e && { ...e, time: Math.min(e.time, changes.duration!) });
  }

  // Playback: advance the playhead every frame.
  const motionRef = useRef(editingMotion);
  motionRef.current = editingMotion;
  useEffect(() => {
    if (!editing?.playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setEditing((e) => {
        const m = motionRef.current;
        if (!e || !e.playing || !m) return e;
        let time = e.time + delta;
        let playing = true;
        if (time >= m.duration) {
          if (m.loop) time %= m.duration;
          else {
            time = m.duration;
            playing = false;
          }
        }
        return { ...e, time, playing };
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [editing?.playing]);

  // ---------- keyboard ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (editing) {
        if (key === "i") return void (e.preventDefault(), addKey());
        if (key === " ") return void (e.preventDefault(), togglePlay());
        if ((key === "delete" || key === "backspace") && editing.selectedKey !== null) return void (e.preventDefault(), deleteKey());
        if (key === "escape") return closeTimeline();
      }
      const match = MODES.find((m) => m.key === key);
      if (match) setMode(match.mode);
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

  // ---------- persistence ----------

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    const result = await runAction(
      saveContents(
        target.id,
        contents.map(({ id, name, text, color, posX, posY, posZ, rotX, rotY, rotZ, scale, autoplay, loop, animation, motion }) => ({
          id, name, text, color, posX, posY, posZ, rotX, rotY, rotZ, scale, autoplay, loop, animation, motion,
        })),
      ),
    );
    if (result?.ok) setDirty(false);
    setSaving(false);
  }

  function pickFile(pending: PendingFile, accept: string) {
    pendingFile.current = pending;
    if (!fileInput.current) return;
    fileInput.current.accept = accept;
    fileInput.current.click();
  }

  async function uploadFor(type: ContentType, file: File): Promise<string | null> {
    const kind = CONTENT_META[type].uploadKind;
    if (!kind) return null;
    setUpload({ label: `Uploading ${file.name}`, progress: 0 });
    try {
      const result = await uploadFile(file, kind, file.name, (p) =>
        setUpload((u) =>
          u && {
            // Once the bytes are in, the server is still shrinking the model.
            label: p >= 100 && type === "MODEL" ? `Optimising ${file.name} for phones…` : u.label,
            progress: p,
          },
        ),
      );
      if (result.optimized) toast.success("3D model optimised", { description: result.optimized.summary });
      else if (result.optimizeError) toast.warning(result.optimizeError);
      return result.url;
    } catch (error) {
      toast.error((error as Error).message);
      return null;
    } finally {
      setUpload(null);
    }
  }

  async function onFile(file: File) {
    const pending = pendingFile.current;
    pendingFile.current = null;
    if (!pending) return;
    if (pending.mode === "target") {
      setTargetProgress(0);
      const ok = await replaceTargetImageFromFile(target.id, file, setTargetProgress);
      setTargetProgress(null);
      if (ok) router.refresh();
    } else if (pending.mode === "add") {
      await create(pending.type, file);
    } else {
      await replaceFile(pending.id, file);
    }
  }

  async function create(type: ContentType, file?: File) {
    let url: string | null = null;
    if (file) {
      url = await uploadFor(type, file);
      if (!url) return;
    }
    const name = file ? file.name.replace(/\.[^.]+$/, "") : CONTENT_META[type].label;
    const text = type === "TEXT" ? "New label" : type === "TEXT3D" ? "Hello" : null;
    const result = await runAction(addContent(target.id, { type, name, url, text }));
    if (result?.data) {
      setContents((list) => [...list, result.data!]);
      setSelectedId(result.data.id);
    }
  }

  async function replaceFile(id: string, file: File) {
    const content = contents.find((c) => c.id === id);
    if (!content) return;
    const url = await uploadFor(content.type, file);
    if (!url) return;
    const result = await runAction(replaceContentFile(id, url));
    if (result?.data) {
      const { url: newUrl, animation } = result.data;
      setContents((list) => list.map((c) => (c.id === id ? { ...c, url: newUrl, animation } : c)));
      setClips((m) => ({ ...m, [id]: [] }));
    }
  }

  async function duplicate(id: string) {
    const source = contents.find((c) => c.id === id);
    if (!source) return;
    const result = await runAction(duplicateContent(id));
    if (!result?.data) return;
    const copy = result.data;
    // Start from the on-screen state (which may have unsaved edits); Save persists it.
    setContents((list) => [...list, { ...source, id: copy.id, name: copy.name, order: copy.order, posX: source.posX + 0.08 }]);
    setSelectedId(copy.id);
    setDirty(true);
  }

  async function remove(id: string) {
    const result = await runAction(deleteContent(id));
    if (result?.ok) {
      if (editing?.id === id) closeTimeline();
      setContents((list) => list.filter((c) => c.id !== id));
      setSelectedId(null);
    }
  }

  // ---------- selection & context menu ----------

  function select(id: string | null) {
    if (editing && id !== editing.id) closeTimeline();
    setSelectedId(id);
  }

  function onContext(target: ContextTarget, clientX: number, clientY: number) {
    contextHandled.current = true;
    const down = rightDown.current;
    if (down && Math.hypot(clientX - down.x, clientY - down.y) > 6) return; // that was a right-drag pan
    const rect = stage.current!.getBoundingClientRect();
    setMenu({ x: clientX - rect.left, y: clientY - rect.top, contentId: target.kind === "content" ? target.id : null });
  }

  function onMenuAction(action: SceneMenuAction) {
    switch (action.kind) {
      case "replace": {
        const content = contents.find((c) => c.id === action.id);
        if (content) pickFile({ mode: "replace", id: action.id }, CONTENT_META[content.type].accept);
        break;
      }
      case "edit-text":
        select(action.id);
        requestAnimationFrame(() => {
          const field = document.getElementById(`content-text-${action.id}`) as HTMLTextAreaElement | null;
          field?.scrollIntoView({ block: "center", behavior: "smooth" });
          field?.focus();
          field?.select();
        });
        break;
      case "animate":
        openTimeline(action.id);
        break;
      case "duplicate":
        duplicate(action.id);
        break;
      case "delete":
        setDeleteId(action.id);
        break;
      case "replace-target":
        pickFile({ mode: "target" }, TARGET_IMAGE_ACCEPT);
        break;
      case "add":
        if (action.type === "MODEL") pickFile({ mode: "add", type: "MODEL" }, CONTENT_META.MODEL.accept);
        else create(action.type);
        break;
    }
  }

  const deleting = contents.find((c) => c.id === deleteId);

  return (
    <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_380px]">
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      {/* Stage: fixed height when stacked, fills the workspace height on wide screens */}
      <Card
        ref={stage}
        className="relative h-[65vh] min-h-[420px] overflow-hidden xl:h-full xl:min-h-0"
        onPointerDownCapture={(e) => {
          if (e.button === 2) rightDown.current = { x: e.clientX, y: e.clientY };
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          // Right-click on empty space (nothing in the scene handled it): offer the page menu.
          if (!contextHandled.current) onContext({ kind: "page" }, e.clientX, e.clientY);
          contextHandled.current = false;
        }}
      >
        <EditorCanvas
          imageUrl={target.imageUrl}
          aspect={target.height / target.width}
          contents={contents}
          selectedId={selectedId}
          mode={mode}
          preview={preview}
          editingPose={editing && displayPose ? { id: editing.id, pose: displayPose } : null}
          showGizmo={!editing?.playing}
          onSelect={select}
          onTransform={onTransform}
          onClips={onClips}
          onContext={onContext}
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
          <span className="mx-0.5 w-px self-stretch bg-ink-200" />
          <button
            onClick={() => setPreview((p) => !p)}
            title="Preview animations in the editor"
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              preview ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-ink-100",
            )}
          >
            {preview ? <Pause className="size-4" /> : <Play className="size-4" />}
            <span className="hidden sm:inline">Animations</span>
          </button>
        </div>
        <div className="absolute top-4 right-4">
          <Button onClick={save} disabled={!dirty || saving} size="sm" className="shadow-lift">
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            {dirty ? "Save scene" : "Saved"}
          </Button>
        </div>
        {!editing && (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-ink-950/70 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur">
            Drag to orbit · right-click for actions · 1 unit = page width
          </div>
        )}
        {editing && editingMotion && editingContent && (
          <Timeline
            name={editingContent.name}
            motion={editingMotion}
            time={editing.time}
            playing={editing.playing}
            selectedKey={editing.selectedKey}
            poseChanged={manualPose !== null}
            onTime={scrub}
            onTogglePlay={togglePlay}
            onAddKey={addKey}
            onDeleteKey={deleteKey}
            onSelectKey={(index) => setEditing((e) => e && { ...e, selectedKey: index })}
            onMoveKey={moveKey}
            onChange={changeTimeline}
            onClose={closeTimeline}
          />
        )}
        {menu && (
          <SceneMenu
            x={menu.x}
            y={menu.y}
            content={contents.find((c) => c.id === menu.contentId) ?? null}
            onAction={onMenuAction}
            onClose={() => setMenu(null)}
          />
        )}
      </Card>

      {/* Panel: scrolls on its own so the 3D view stays in place */}
      <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1 xl:pb-1 [&>*]:shrink-0">
        <Card className="p-5">
          <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Add to this page</div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CONTENT_META) as ContentType[]).map((type) => {
              const Icon = TYPE_ICON[type];
              return (
                <button
                  key={type}
                  onClick={() => (CONTENT_META[type].uploadKind ? pickFile({ mode: "add", type }, CONTENT_META[type].accept) : create(type))}
                  disabled={!!upload}
                  title={`${CONTENT_META[type].label} — ${CONTENT_META[type].hint}`}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-ink-200 px-1 py-3 text-[11px] font-semibold text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                >
                  <Icon className="size-5" />
                  {CONTENT_META[type].short}
                </button>
              );
            })}
          </div>
          {upload && (
            <div className="mt-3 rounded-xl bg-ink-50 p-3 text-xs">
              <div className="mb-1.5 flex justify-between font-medium text-ink-700">
                <span className="truncate">{upload.label}</span>
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
            <p className="py-3 text-sm text-ink-500">Nothing here yet. Add a 3D model, 3D text, video, image, audio or label.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {contents.map((c) => {
                const Icon = TYPE_ICON[c.type];
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => select(c.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        select(c.id);
                        const rect = stage.current!.getBoundingClientRect();
                        // Open the same menu, at the right edge of the 3D view.
                        setMenu({ x: rect.width - 16, y: Math.min(e.clientY - rect.top, rect.height - 16), contentId: c.id });
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition",
                        active ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "text-ink-700 hover:bg-ink-50",
                      )}
                    >
                      <span className={cn("grid size-8 place-items-center rounded-lg", active ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-500")}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                      {c.motion && <Film className="size-3.5 shrink-0 text-brand-400" aria-label="Animated" />}
                      <span className="text-[11px] text-ink-400">{CONTENT_META[c.type].label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {selected && (
          <Inspector
            key={selected.id}
            content={selected}
            transform={editing?.id === selected.id && displayPose ? displayPose : poseOf(selected)}
            keyframing={editing?.id === selected.id ? { time: editing.time } : null}
            motion={parseMotion(selected.motion)}
            clips={clips[selected.id] ?? []}
            onChange={(changes) => patch(selected.id, changes)}
            onTransform={(pose) => onTransform(selected.id, pose)}
            onMotion={(motion) => {
              if (editing?.id === selected.id && motion?.kind !== "keyframes") closeTimeline();
              setMotion(selected.id, motion);
            }}
            onOpenTimeline={() => openTimeline(selected.id)}
            onReplace={() => pickFile({ mode: "replace", id: selected.id }, CONTENT_META[selected.type].accept)}
            onDuplicate={() => duplicate(selected.id)}
            onDelete={() => setDeleteId(selected.id)}
          />
        )}

        <TargetImageCard target={target} progress={targetProgress} onReplace={() => pickFile({ mode: "target" }, TARGET_IMAGE_ACCEPT)} />
        <PageDetails target={target} />
        <TranslationsCard target={target} />
        <NarrationCard target={target} />
        <WorldCard target={target} />
      </div>

      <Confirm
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="It's removed from this page for every student. Uploaded files are deleted when nothing else uses them."
        onConfirm={async () => {
          if (deleteId) await remove(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
