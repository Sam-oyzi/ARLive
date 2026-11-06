"use client";

// Keyframe timeline docked under the 3D view, Blender-style: scrub the playhead, pose the item with
// the gizmo, press "Add keyframe" (I). Diamonds can be dragged between their neighbours.
import { Diamond, Pause, Play, Repeat, SkipBack, Trash2, X } from "lucide-react";
import { useRef } from "react";
import type { KeyframeMotion } from "@/lib/motion-schema";
import { cn } from "@/lib/utils";

export function Timeline({
  name,
  motion,
  time,
  playing,
  selectedKey,
  poseChanged,
  onTime,
  onTogglePlay,
  onAddKey,
  onDeleteKey,
  onSelectKey,
  onMoveKey,
  onChange,
  onClose,
}: {
  name: string;
  motion: KeyframeMotion;
  time: number;
  playing: boolean;
  selectedKey: number | null;
  /** The pose was moved since the last keyframe: remind to key it. */
  poseChanged: boolean;
  onTime: (t: number) => void;
  onTogglePlay: () => void;
  onAddKey: () => void;
  onDeleteKey: () => void;
  onSelectKey: (index: number) => void;
  onMoveKey: (index: number, t: number) => void;
  onChange: (changes: Partial<Pick<KeyframeMotion, "duration" | "loop" | "easing">>) => void;
  onClose: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "scrub" } | { kind: "key"; index: number } | null>(null);
  const d = motion.duration;
  const pct = (t: number) => `${(Math.min(Math.max(t, 0), d) / d) * 100}%`;

  function timeAt(clientX: number) {
    const rect = track.current!.getBoundingClientRect();
    const t = ((clientX - rect.left) / rect.width) * d;
    return Math.round(Math.min(Math.max(t, 0), d) * 100) / 100;
  }

  function onPointerMove(e: React.PointerEvent) {
    const current = drag.current;
    if (!current) return;
    const t = timeAt(e.clientX);
    if (current.kind === "scrub") onTime(t);
    else {
      // Keys keep their order: a dragged key stays between its neighbours.
      const prev = motion.frames[current.index - 1];
      const next = motion.frames[current.index + 1];
      const clamped = Math.min(Math.max(t, prev ? prev.t + 0.01 : 0), next ? next.t - 0.01 : d);
      onMoveKey(current.index, clamped);
      onTime(clamped);
    }
  }

  const ticks = [];
  const step = d <= 4 ? 0.25 : d <= 10 ? 0.5 : d <= 30 ? 1 : 5;
  for (let t = 0; t <= d + 1e-6; t += step) ticks.push(Math.round(t * 100) / 100);
  const labelEvery = step * (d <= 4 ? 4 : 2);

  return (
    <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-ink-950/90 p-3 text-white shadow-lift ring-1 ring-white/10 backdrop-blur">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="mr-1 min-w-0 text-xs">
          <div className="font-semibold text-white/50 uppercase">Animation</div>
          <div className="max-w-40 truncate font-semibold">{name}</div>
        </div>
        <button onClick={() => onTime(0)} className="grid size-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" title="Go to start" aria-label="Go to start">
          <SkipBack className="size-4" />
        </button>
        <button
          onClick={onTogglePlay}
          className="grid size-8 place-items-center rounded-lg bg-white text-ink-950 hover:bg-white/90"
          title="Play / pause (Space)"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <span className="w-24 text-center font-mono text-xs tabular-nums text-white/80">
          {time.toFixed(2)} / {d.toFixed(2)}s
        </span>

        <label className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs">
          Length
          <input
            type="number"
            min={0.5}
            max={600}
            step={0.5}
            value={d}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v) && v >= 0.1) onChange({ duration: Math.min(600, v) });
            }}
            className="w-12 bg-transparent text-right font-mono tabular-nums outline-none"
          />
          s
        </label>
        <button
          onClick={() => onChange({ loop: !motion.loop })}
          className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold", motion.loop ? "bg-brand-600" : "bg-white/10 text-white/60")}
          title="Loop"
        >
          <Repeat className="size-3.5" /> Loop
        </button>
        <select
          value={motion.easing}
          onChange={(e) => onChange({ easing: e.target.value as KeyframeMotion["easing"] })}
          className="rounded-lg bg-white/10 px-2 py-1.5 text-xs font-semibold outline-none [&>option]:text-ink-900"
          title="Interpolation between keyframes"
        >
          <option value="smooth">Smooth</option>
          <option value="linear">Linear</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {poseChanged && <span className="hidden text-xs font-semibold text-amber-300 sm:inline">● Pose changed — add a keyframe</span>}
          <button
            onClick={onAddKey}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-ink-950",
              poseChanged ? "animate-pulse bg-amber-300" : "bg-amber-400 hover:bg-amber-300",
            )}
            title="Add keyframe at the playhead (I)"
          >
            <Diamond className="size-3.5 fill-current" /> Add keyframe
          </button>
          <button
            onClick={onDeleteKey}
            disabled={selectedKey === null}
            className="grid size-8 place-items-center rounded-lg bg-white/10 hover:bg-rose-500/80 disabled:opacity-30 disabled:hover:bg-white/10"
            title="Delete selected keyframe (Delete)"
            aria-label="Delete selected keyframe"
          >
            <Trash2 className="size-4" />
          </button>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" title="Close timeline (Esc)" aria-label="Close timeline">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={track}
        className="relative h-12 cursor-pointer touch-none rounded-xl bg-white/[0.06] select-none"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { kind: "scrub" };
          onTime(timeAt(e.clientX));
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {ticks.map((t) => {
          const major = Math.abs(t / labelEvery - Math.round(t / labelEvery)) < 1e-6;
          return (
            <div key={t} className="pointer-events-none absolute top-0" style={{ left: pct(t) }}>
              <div className={cn("w-px bg-white/20", major ? "h-3" : "h-1.5")} />
              {major && <span className="absolute top-3 -translate-x-1/2 text-[9px] text-white/40 tabular-nums">{t}s</span>}
            </div>
          );
        })}

        {motion.frames.map((frame, index) => (
          <button
            key={index}
            onPointerDown={(e) => {
              e.stopPropagation();
              track.current!.setPointerCapture(e.pointerId);
              drag.current = { kind: "key", index };
              onSelectKey(index);
              onTime(frame.t);
            }}
            className="absolute top-[60%] -translate-x-1/2 -translate-y-1/2 p-1.5"
            style={{ left: pct(frame.t) }}
            title={`Keyframe at ${frame.t.toFixed(2)}s — drag to move`}
            aria-label={`Keyframe at ${frame.t.toFixed(2)} seconds`}
          >
            <span
              className={cn(
                "block size-3 rotate-45 rounded-[2px] transition",
                index === selectedKey ? "scale-125 bg-amber-300 ring-2 ring-white" : "bg-amber-500 hover:bg-amber-300",
              )}
            />
          </button>
        ))}

        <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-brand-400" style={{ left: pct(time) }}>
          <div className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-brand-400" />
        </div>
      </div>
    </div>
  );
}
