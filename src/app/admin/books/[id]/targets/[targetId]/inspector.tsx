"use client";

import { Copy, Crosshair, Diamond, Film, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { CONTENT_META, defaultTransform, hasText, type ContentData } from "@/lib/content";
import { PRESET_LABEL, PRESETS, type Motion, type Pose, type Preset } from "@/lib/motion-schema";
import { cn } from "@/lib/utils";

const AXIS_COLOR: Record<string, string> = { X: "text-rose-500", Y: "text-emerald-500", Z: "text-blue-500" };
const LABEL_COLORS = ["#ffffff", "#161624", "#5b5bf6", "#10b981", "#f59e0b", "#ef4444"];
const TEXT3D_COLORS = ["#5b5bf6", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#f4f4f8", "#161624"];

export function NumberInput({
  value,
  onChange,
  step,
  label,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  label: string;
  suffix?: string;
}) {
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

function Swatches({ colors, value, onPick }: { colors: string[]; value: string | null; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          aria-label={c}
          className="size-7 rounded-full ring-1 ring-ink-200"
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px white, 0 0 0 4px ${c === "#ffffff" || c === "#f4f4f8" ? "#bfbfd1" : c}` : undefined }}
        />
      ))}
    </div>
  );
}

export function Inspector({
  content,
  transform,
  keyframing,
  motion,
  clips,
  onChange,
  onTransform,
  onMotion,
  onOpenTimeline,
  onReplace,
  onDuplicate,
  onDelete,
}: {
  content: ContentData;
  /** What the transform fields show: the authored placement, or the timeline pose while keyframing. */
  transform: Pose;
  keyframing: { time: number } | null;
  motion: Motion | null;
  clips: string[];
  onChange: (changes: Partial<ContentData>) => void;
  onTransform: (pose: Pose) => void;
  onMotion: (motion: Motion | null) => void;
  onOpenTimeline: () => void;
  onReplace: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const meta = CONTENT_META[content.type];
  const playable = content.type === "MODEL" || content.type === "VIDEO" || content.type === "AUDIO";
  const spatial = content.type !== "AUDIO";
  const setPose = (changes: Partial<Pose>) => onTransform({ ...transform, ...changes });
  const motionValue = motion?.kind === "keyframes" ? "keyframes" : motion?.kind === "preset" ? motion.preset : "none";
  const speed = motion?.kind === "preset" ? motion.speed : 1;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{meta.label}</div>
        <div className="flex gap-1">
          {meta.uploadKind && (
            <Button variant="ghost" size="xs" onClick={onReplace} title={`Replace with another ${meta.label.toLowerCase()}`}>
              <RefreshCw /> Replace
            </Button>
          )}
          <Button variant="ghost" size="xs" onClick={onDuplicate} title="Duplicate">
            <Copy />
          </Button>
          <Button variant="danger-ghost" size="xs" onClick={onDelete} title="Remove">
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Preview the file itself — with sound, unlike the muted video in the 3D view */}
        {content.type === "VIDEO" && content.url && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video key={content.url} src={content.url} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black" />
        )}
        {content.type === "AUDIO" && content.url && (
          <div className="rounded-xl bg-ink-50 p-3">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio key={content.url} src={content.url} controls preload="metadata" className="w-full" />
          </div>
        )}
        {content.type === "IMAGE" && content.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={content.url} alt="" className="max-h-40 w-full rounded-xl bg-ink-50 object-contain" />
        )}

        <Field label="Name">
          <Input value={content.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>

        {hasText(content.type) && (
          <>
            <Field label="Text" hint={content.type === "TEXT3D" ? "Press Enter for a new line. Latin letters and accents are supported." : undefined}>
              <Textarea
                id={`content-text-${content.id}`}
                value={content.text ?? ""}
                onChange={(e) => onChange({ text: e.target.value })}
                className="min-h-16"
              />
            </Field>
            <Field label={content.type === "TEXT3D" ? "Colour" : "Background"}>
              <Swatches
                colors={content.type === "TEXT3D" ? TEXT3D_COLORS : LABEL_COLORS}
                value={content.color}
                onPick={(color) => onChange({ color })}
              />
            </Field>
          </>
        )}

        {spatial && (
          <>
            {keyframing && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                <Diamond className="mt-0.5 size-3.5 shrink-0 fill-current" />
                Editing the pose at {keyframing.time.toFixed(2)}s — click “Add keyframe” to record it.
              </div>
            )}
            <Field label="Position">
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput label="X" step={0.01} value={transform.posX} onChange={(v) => setPose({ posX: v })} />
                <NumberInput label="Y" step={0.01} value={transform.posY} onChange={(v) => setPose({ posY: v })} />
                <NumberInput label="Z" step={0.01} value={transform.posZ} onChange={(v) => setPose({ posZ: v })} />
              </div>
            </Field>
            <Field label="Rotation">
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput label="X" step={1} suffix="°" value={transform.rotX} onChange={(v) => setPose({ rotX: v })} />
                <NumberInput label="Y" step={1} suffix="°" value={transform.rotY} onChange={(v) => setPose({ rotY: v })} />
                <NumberInput label="Z" step={1} suffix="°" value={transform.rotZ} onChange={(v) => setPose({ rotZ: v })} />
              </div>
            </Field>
            <Field label="Scale" hint="1 = as wide as the page (3D text: letters ~8% of the page)">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.05}
                  max={3}
                  step={0.01}
                  value={Math.min(3, transform.scale)}
                  onChange={(e) => setPose({ scale: parseFloat(e.target.value) })}
                  className="flex-1 accent-brand-500"
                />
                <div className="w-24">
                  <NumberInput label="" step={0.01} value={transform.scale} onChange={(v) => v > 0 && setPose({ scale: v })} />
                </div>
              </div>
            </Field>
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="xs" onClick={() => setPose({ posX: 0, posY: 0 })}>
                <Crosshair /> Centre
              </Button>
              <Button variant="outline" size="xs" onClick={() => setPose({ rotX: 90, rotY: 0, rotZ: 0, posZ: 0 })}>
                Stand up
              </Button>
              <Button variant="outline" size="xs" onClick={() => setPose({ rotX: 0, rotY: 0, rotZ: 0, posZ: 0.01 })}>
                Lay flat
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setPose(defaultTransform(content.type))}>
                Reset
              </Button>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-ink-200/70 p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                <Film className="size-4 text-brand-500" /> Animation
              </div>
              <Select
                value={motionValue}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "none") onMotion(null);
                  else if (value === "keyframes") onOpenTimeline();
                  else onMotion({ kind: "preset", preset: value as Preset, speed });
                }}
              >
                <option value="none">None</option>
                <optgroup label="Ready-made">
                  {PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {PRESET_LABEL[p]}
                    </option>
                  ))}
                </optgroup>
                <option value="keyframes">Custom keyframes…</option>
              </Select>
              {motion?.kind === "preset" && (
                <label className="flex items-center gap-3 text-xs font-medium text-ink-600">
                  Speed
                  <input
                    type="range"
                    min={0.25}
                    max={3}
                    step={0.05}
                    value={speed}
                    onChange={(e) => onMotion({ ...motion, speed: parseFloat(e.target.value) })}
                    className="flex-1 accent-brand-500"
                  />
                  <span className="w-10 text-right tabular-nums">{speed.toFixed(2)}×</span>
                </label>
              )}
              {motion?.kind === "keyframes" && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2">
                  <span className="text-xs text-ink-600">
                    {motion.frames.length} keyframe{motion.frames.length === 1 ? "" : "s"} · {motion.duration.toFixed(1)}s
                    {motion.loop ? " · loops" : ""}
                  </span>
                  <Button size="xs" variant={keyframing ? "soft" : "primary"} onClick={onOpenTimeline}>
                    <Diamond /> {keyframing ? "Editing…" : "Edit animation"}
                  </Button>
                </div>
              )}
              <p className="text-[11px] leading-relaxed text-ink-400">
                Plays when students scan the page. Tip: right-click an item in the scene for more actions.
              </p>
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
              <Field label="Clip from the GLB file">
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
