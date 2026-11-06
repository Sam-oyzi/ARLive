"use client";

import { useState, type ComponentProps } from "react";
import { AudioLines, Bold, Minus, Plus, Redo2, Type, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORY_FONTS, STORY_FONT_OPTIONS, type StoryBlock, type StoryRunStyle } from "@/lib/story-layout";
import type { SelectionStyle } from "./selection-editor";

const MIN_SIZE = 1.5;
const MAX_SIZE = 12;

function Tool({ label, ...props }: ComponentProps<typeof Button> & { label: string }) {
  return <Button variant="ghost" size="icon-sm" aria-label={label} title={label}
    onPointerDown={(event) => event.preventDefault()}
    className="aria-pressed:bg-violet-100 aria-pressed:text-violet-800 aria-[pressed=mixed]:bg-violet-50" {...props} />;
}

export function TextToolbar({ block, selection, needsHighlight, saving, canUndo, canRedo, canFormatSound, onHistory, onFormat, onSound, onLeave }: {
  block?: StoryBlock;
  selection: SelectionStyle | null;
  needsHighlight: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canFormatSound: boolean;
  onHistory: (direction: "undo" | "redo") => void;
  onFormat: (style: StoryRunStyle) => void;
  onSound: () => void;
  onLeave: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const disabled = saving || !block || needsHighlight;
  const size = selection?.size ?? block?.size ?? 3.6;
  const shownSize = Math.round(size * 100) / 100;
  const color = selection?.color ?? block?.color ?? "#2b2118";
  const font = selection ? selection.font : block?.font;
  const scope = selection ? "Selected text" : needsHighlight ? "Highlight text" : block ? "Whole paragraph" : "No paragraph";

  function setSize(value: number) {
    onFormat({ size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value * 100) / 100)) });
  }

  function draftSize() {
    if (!draft?.trim()) return;
    const value = Number(draft.replace(",", "."));
    return Number.isFinite(value) ? value : undefined;
  }

  function commitSize() {
    const value = draftSize();
    if (!disabled && value !== undefined) setSize(value);
    setDraft(null);
  }

  function stepSize(step: number) {
    setSize((draftSize() ?? shownSize) + step);
    setDraft(null);
  }

  function navigateHistory(direction: "undo" | "redo") {
    setDraft(null);
    onHistory(direction);
  }

  return (
    <div data-text-format role="group" aria-label="Text formatting" className="mb-4 flex flex-col items-center gap-2" onBlur={(event) => {
      const next = event.relatedTarget;
      if (next instanceof HTMLElement && !event.currentTarget.contains(next) && !next.isContentEditable) onLeave();
    }}>
      <div className="flex w-fit max-w-full flex-wrap items-center gap-x-1 gap-y-2 rounded-2xl border border-ink-200 bg-white p-1.5 text-sm shadow-soft">
        <div className="flex border-r border-ink-200 pr-1">
          <Tool label="Undo" aria-keyshortcuts="Control+Z Meta+Z" disabled={saving || !canUndo} onClick={() => navigateHistory("undo")}><Undo2 /></Tool>
          <Tool label="Redo" aria-keyshortcuts="Control+Y Control+Shift+Z Meta+Shift+Z" disabled={saving || !canRedo} onClick={() => navigateHistory("redo")}><Redo2 /></Tool>
        </div>
        <select aria-label="Font" title={font ? STORY_FONT_OPTIONS[font].label : "Font"} disabled={disabled}
          className="h-8 w-40 truncate rounded-lg border border-ink-200 bg-white px-2 font-medium disabled:opacity-50"
          value={font ?? ""}
          onChange={(event) => onFormat({ font: event.target.value as StoryBlock["font"] })}>
          <option value="" disabled>{selection?.mixedFont ? "Mixed fonts" : "Font"}</option>
          {STORY_FONTS.map((font) => {
            const label = STORY_FONT_OPTIONS[font].label;
            return <option key={font} value={font} title={label}>{label.split(" · ")[0]}</option>;
          })}
        </select>
        <div className="flex items-center rounded-lg border border-ink-200">
          <Tool label="Decrease text size" disabled={disabled || (draft === null && !selection?.mixedSize && size <= MIN_SIZE)} onClick={() => stepSize(-0.1)}><Minus /></Tool>
          <input aria-label="Text size" title="Text size as a percentage of page width" type="text" inputMode="decimal" maxLength={6}
            className="h-8 w-11 rounded text-center font-semibold tabular-nums disabled:opacity-50"
            disabled={disabled} placeholder={selection?.mixedSize ? "Mixed" : "Size"}
            value={draft ?? (selection?.mixedSize || !block ? "" : shownSize)}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitSize}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitSize();
              } else if (event.key === "Escape" && draft !== null) {
                event.preventDefault();
                event.stopPropagation();
                setDraft(null);
              } else if (draft !== null && (event.ctrlKey || event.metaKey) && /^[zy]$/i.test(event.key)) {
                event.stopPropagation();
              }
            }} />
          <Tool label="Increase text size" disabled={disabled || (draft === null && !selection?.mixedSize && size >= MAX_SIZE)} onClick={() => stepSize(0.1)}><Plus /></Tool>
        </div>
        <div className="flex items-center">
          <label className="relative grid size-8 place-items-center rounded-lg hover:bg-ink-100 focus-within:ring-2 focus-within:ring-violet-500 has-disabled:opacity-50" title="Text color">
            <Type aria-hidden className="size-4" />
            <span aria-hidden className="absolute right-2 bottom-1 left-2 h-0.5 rounded" style={{ backgroundColor: color }} />
            <input aria-label="Text color" type="color" disabled={disabled} value={color}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              onInput={(event) => onFormat({ color: event.currentTarget.value })} />
          </label>
          <Tool label="Bold" disabled={disabled} aria-pressed={selection?.mixedBold ? "mixed" : selection?.bold ?? !!block?.bold}
            onClick={() => onFormat({ bold: !(selection?.bold ?? block?.bold) })}><Bold /></Tool>
          <Tool label="Sound words" disabled={saving || !block || !canFormatSound} aria-pressed={!!selection?.allSound} onClick={onSound}><AudioLines /></Tool>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-ink-500">
        <span role="status" className={`rounded-full px-2 py-0.5 font-semibold ${selection ? "bg-violet-100 text-violet-800" : "bg-ink-100 text-ink-700"}`}>{scope}</span>
        <span>{selection ? "Formatting applies to the highlighted characters." : block ? "Highlight words on the page to style them separately." : "Add a paragraph to start editing."}</span>
      </div>
    </div>
  );
}
