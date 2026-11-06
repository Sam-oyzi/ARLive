"use client";

import { useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { parseStory, type TextPosition } from "@/lib/story-text";
import { STORY_FONTS, STORY_FONT_OPTIONS, storyFontFamily, type StoryBlock } from "@/lib/story-layout";
import { saveStoryLayout } from "@/server/actions/story-layout";

export function PageTextEditor({ bookId, pageId, title, imageUrl, story, aspect, language, position, saved, onSaved }: {
  bookId: string;
  pageId: string;
  title: string;
  imageUrl: string;
  story: string | null;
  aspect: number;
  language: string;
  position: TextPosition;
  saved?: StoryBlock[];
  onSaved: (blocks: StoryBlock[] | undefined) => void;
}) {
  const initialBlock: StoryBlock = { text: story ?? "", x: 8, y: position === "bottom" ? 70 : position === "middle" ? 40 : 8, width: 84, size: 3.6, color: "#2b2118", font: "book", align: "start", bold: false };
  const [blocks, setBlocks] = useState(() => saved ?? (story && position !== "off" ? [initialBlock] : []));
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; pointer: number; x: number; y: number; left: number; top: number } | null>(null);
  const block = blocks[selected];
  const rtl = /^(ar|he|fa|ur)(-|$)/i.test(language);

  function patch(index: number, changes: Partial<StoryBlock>) {
    setBlocks((current) => current.map((item, i) => i === index ? { ...item, ...changes } : item));
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const bounds = stage.current?.getBoundingClientRect();
    const item = start && blocks[start.index];
    if (!start || !bounds || !item || start.pointer !== event.pointerId) return;
    const x = start.left + (event.clientX - start.x) * 100 / bounds.width;
    const y = start.top + (event.clientY - start.y) * 100 / bounds.height;
    const height = event.currentTarget.getBoundingClientRect().height * 100 / bounds.height;
    patch(start.index, { x: Math.min(100 - item.width, Math.max(0, x)), y: Math.min(Math.max(0, 100 - height), 98, Math.max(0, y)) });
  }

  async function save(reset = false) {
    setSaving(true);
    try {
      const next = reset ? null : blocks.filter((item) => item.text.trim());
      const result = await saveStoryLayout(bookId, pageId, language, next);
      if (!result?.ok) {
        toast.error(result?.error ?? "Could not save page text.");
        return;
      }
      toast.success(reset ? "Automatic layout restored" : "Page text saved");
      onSaved(next ?? undefined);
    } catch {
      toast.error("Could not save page text.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent title={`Edit text · ${title}`} description="Drag a paragraph to position it. Double-click it to type directly on the page." className="sm:max-w-5xl">
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div ref={stage} className="relative isolate mx-auto w-full max-w-[480px] overflow-hidden rounded-xl bg-amber-50 shadow-soft [container-type:inline-size]" style={{ aspectRatio: `1 / ${aspect}` }} dir={rtl ? "rtl" : "ltr"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover" />
          {blocks.map((item, index) => (
            <div
              key={index}
              className={`absolute min-h-4 touch-none whitespace-pre-wrap break-words outline-offset-2 ${selected === index ? "outline-2 outline-brand-500" : "hover:outline hover:outline-brand-400"} ${editing === index ? "" : "cursor-grab active:cursor-grabbing"}`}
              style={{
                left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, fontSize: `${item.size}cqw`,
                lineHeight: 1.36, color: item.color, textAlign: item.align, fontWeight: item.bold ? 700 : 500,
                fontFamily: storyFontFamily(item.font, (property) => `var(${property})`),
              }}
              onPointerDown={(event) => {
                if (event.button !== 0 || editing === index) return;
                setSelected(index);
                setEditing(null);
                drag.current = { index, pointer: event.pointerId, x: event.clientX, y: event.clientY, left: item.x, top: item.y };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={move}
              onLostPointerCapture={() => { drag.current = null; }}
              onDoubleClick={() => { setSelected(index); setEditing(index); }}
            >
              {editing === index ? (
                <textarea autoFocus aria-label="Edit paragraph on page" className="block w-full resize-none bg-white/80 [field-sizing:content]" rows={2} value={item.text} onChange={(e) => patch(index, { text: e.target.value })} onBlur={() => setEditing(null)} maxLength={2000} />
              ) : item.text ? parseStory(item.text).map((line, row) => (
                <div key={row} className="min-h-[0.7em]">
                  {line.map((segment, i) => segment.sound
                    ? <strong key={i} className="font-[var(--font-sound)] text-[1.75em] text-orange-700">{segment.text.toLocaleUpperCase()}</strong>
                    : <span key={i}>{segment.text}</span>)}
                </div>
              )) : <span className="text-ink-500">Empty paragraph</span>}
            </div>
          ))}
        </div>
        <div className="space-y-3 text-sm">
          <Button variant="outline" disabled={saving || blocks.length >= 24} onClick={() => {
            setSelected(blocks.length);
            setBlocks((current) => [...current, { ...initialBlock, text: "New paragraph", y: Math.min(85, 8 + current.length * 12) }]);
          }}>Add paragraph</Button>
          {block && (
            <>
              <label className="grid gap-1">Selected paragraph
                <select className="rounded-lg border p-2" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
                  {blocks.map((_, i) => <option key={i} value={i}>Paragraph {i + 1}</option>)}
                </select>
              </label>
              <label className="grid gap-1">Text
                <textarea dir="auto" className="min-h-24 rounded-lg border p-2" value={block.text} maxLength={2000} onChange={(e) => patch(selected, { text: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1">Font
                  <select className="rounded-lg border p-2" value={block.font} onChange={(e) => patch(selected, { font: e.target.value as StoryBlock["font"] })}>
                    {STORY_FONTS.map((font) => <option key={font} value={font}>{STORY_FONT_OPTIONS[font].label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">Alignment
                  <select className="rounded-lg border p-2" value={block.align} onChange={(e) => patch(selected, { align: e.target.value as StoryBlock["align"] })}>
                    <option value="start">Start</option><option value="center">Center</option><option value="end">End</option>
                  </select>
                </label>
                <label className="grid gap-1">Text size ({block.size}%)
                  <input type="range" min={1.5} max={12} step={0.1} value={block.size} onChange={(e) => patch(selected, { size: +e.target.value })} />
                </label>
                <label className="grid gap-1">Text color
                  <input type="color" value={block.color} onChange={(e) => patch(selected, { color: e.target.value })} />
                </label>
                <label className="grid gap-1">Width ({block.width}%)
                  <input type="range" min={10} max={100} step={1} value={block.width} onChange={(e) => {
                    const width = +e.target.value;
                    patch(selected, { width, x: Math.min(block.x, 100 - width) });
                  }} />
                </label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={block.bold} onChange={(e) => patch(selected, { bold: e.target.checked })} /> Bold</label>
              </div>
              <Button variant="outline" disabled={saving} onClick={() => {
                setBlocks((current) => current.filter((_, i) => i !== selected));
                setSelected(Math.max(0, selected - 1));
                setEditing(null);
              }}>Remove paragraph</Button>
            </>
          )}
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save layout"}</Button>
            {saved !== undefined && <Button variant="outline" disabled={saving} onClick={() => void save(true)}>Use automatic layout</Button>}
          </div>
        </div>
      </div>
    </DialogContent>
  );
}
