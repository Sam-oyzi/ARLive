"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { type TextPosition } from "@/lib/story-text";
import { storyFontFamily, storyLines, type StoryBlock, type StoryRunStyle } from "@/lib/story-layout";
import { saveStoryLayout } from "@/server/actions/story-layout";

import { runCss, SelectionEditor, type FormatSelection, type SelectionStyle, type TextBookmark, type TextEdit } from "./selection-editor";
import { TextToolbar } from "./text-toolbar";

type Layout = { blocks: StoryBlock[]; selected: number; bookmark?: TextBookmark };
type Change = { before: Layout; after: Layout; group?: string; at: number };

export function PageTextEditor({ bookId, pageId, title, imageUrl, story, aspect, language, position, saved, automaticBlocks, onSaved }: {
  bookId: string;
  pageId: string;
  title: string;
  imageUrl: string;
  story: string | null;
  aspect: number;
  language: string;
  position: TextPosition;
  saved?: StoryBlock[];
  automaticBlocks?: StoryBlock[];
  onSaved: (blocks: StoryBlock[] | undefined) => void;
}) {
  const initialBlock: StoryBlock = { text: story ?? "", x: 8, y: position === "bottom" ? 70 : position === "middle" ? 40 : 8, width: 84, size: 3.6, color: "#2b2118", font: "book", align: "start", bold: false };
  const [layout, setLayout] = useState<Layout>(() => ({ blocks: saved ?? automaticBlocks ?? (story && position !== "off" ? [initialBlock] : []), selected: 0 }));
  const current = useRef(layout);
  const history = useRef<{ undo: Change[]; redo: Change[] }>({ undo: [], redo: [] });
  const [editorVersion, setEditorVersion] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [selectionStyle, setSelectionStyle] = useState<SelectionStyle | null>(null);
  const [sourceSelected, setSourceSelected] = useState(false);
  const formatSelection = useRef<FormatSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ index: number; pointer: number; x: number; y: number; left: number; top: number } | null>(null);
  const { blocks, selected } = layout;
  const block = blocks[selected];
  const rtl = /^(ar|he|fa|ur)(-|$)/i.test(language);
  const alignments = [
    { icon: AlignLeft, label: "Align left", value: rtl ? "end" : "start" },
    { icon: AlignCenter, label: "Align center", value: "center" },
    { icon: AlignRight, label: "Align right", value: rtl ? "start" : "end" },
  ] as const;

  function show(next: Layout) {
    current.current = next;
    setLayout(next);
  }

  function select(index: number) {
    show({ blocks: current.current.blocks, selected: index });
    const last = history.current.undo.at(-1);
    if (last) last.group = undefined;
  }

  function change(nextBlocks: StoryBlock[], index: number, edit: TextEdit = {}) {
    const { undo, redo } = history.current;
    const previous = current.current;
    const next = { blocks: nextBlocks, selected: index, bookmark: edit.after };
    const last = undo.at(-1);
    const now = performance.now();
    const continuous = last?.after.bookmark?.start === edit.before?.start && last?.after.bookmark?.end === edit.before?.end;
    if (edit.group && last?.group === edit.group && last.after.blocks === previous.blocks && last.after.selected === index
      && continuous && (edit.group === "drag" || now - last.at < 750)) {
      last.after = next;
      last.at = now;
    } else {
      undo.push({ before: { ...previous, bookmark: edit.before }, after: next, group: edit.group, at: now });
      if (undo.length > 100) undo.shift();
    }
    redo.length = 0;
    show(next);
  }

  function patch(index: number, changes: Partial<StoryBlock>, edit?: TextEdit) {
    const { blocks: previous } = current.current;
    const item = previous[index];
    if (!item || Object.entries(changes).every(([key, value]) => item[key as keyof StoryBlock] === value)) return;
    change(previous.map((block, i) => i === index ? { ...block, ...changes } : block), index, edit);
  }

  function travel(direction: "undo" | "redo") {
    if (saving) return;
    const { undo, redo } = history.current;
    const entry = history.current[direction].pop();
    if (!entry) return;
    entry.group = undefined;
    (direction === "undo" ? redo : undo).push(entry);
    const next = direction === "undo" ? entry.before : entry.after;
    show(next);
    if (editing !== null) {
      setEditing(next.bookmark && next.blocks[next.selected] ? next.selected : null);
      setEditorVersion((version) => version + 1);
      if (!next.bookmark) stage.current?.focus({ preventScroll: true });
    }
  }

  function historyKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    event.preventDefault();
    travel(key === "y" || event.shiftKey ? "redo" : "undo");
  }

  function format(style: StoryRunStyle) {
    if (!block) return;
    if (editing !== null) {
      formatSelection.current?.(style);
      return;
    }
    if (sourceSelected) return;
    // Box controls set the selected property for the whole paragraph. Other run styles are kept.
    const keys = Object.keys(style) as (keyof StoryRunStyle)[];
    const runs = block.runs?.some((run) => keys.some((key) => run[key] !== undefined))
      ? block.runs.map((run) => {
        const rest = { ...run };
        keys.forEach((key) => delete rest[key]);
        return rest;
      })
      : block.runs;
    patch(selected, { ...style, runs }, { group: style.color ? "color" : undefined });
  }

  function removeParagraph() {
    if (!block || saving) return;
    change(blocks.filter((_, i) => i !== selected), Math.max(0, selected - 1));
    setEditing(null);
    stage.current?.focus({ preventScroll: true });
  }

  function toggleSoundWords() {
    const input = textInput.current;
    if (!input || !block) return;
    let start = input.selectionStart;
    let end = input.selectionEnd;
    const picked = block.text.slice(start, end);
    if (!picked.trim() || /[\r\n]/.test(picked)) {
      input.focus();
      toast.info("Select a word or phrase on one line first.");
      return;
    }
    let replacement: string;
    if (/^\*[^*]+\*$/.test(picked)) replacement = picked.slice(1, -1);
    else if (!picked.includes("*") && block.text[start - 1] === "*" && block.text[end] === "*") {
      start--;
      end++;
      replacement = picked;
    } else if (picked.includes("*") || (block.text.slice(0, start).split("\n").at(-1)!.match(/\*/g)?.length ?? 0) % 2) {
      input.focus();
      toast.info("Select the whole sound phrase to remove its style.");
      return;
    } else {
      replacement = picked.replace(/^(\s*)(.*?)(\s*)$/, "$1*$2*$3");
    }
    const text = block.text.slice(0, start) + replacement + block.text.slice(end);
    if (text.length > 2000) return;
    patch(selected, { text });
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start, start + replacement.length);
    });
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const bounds = stage.current?.getBoundingClientRect();
    const item = start && blocks[start.index];
    if (!start || !bounds || !item || start.pointer !== event.pointerId) return;
    const x = start.left + (event.clientX - start.x) * 100 / bounds.width;
    const y = start.top + (event.clientY - start.y) * 100 / bounds.height;
    const height = event.currentTarget.getBoundingClientRect().height * 100 / bounds.height;
    patch(start.index, { x: Math.min(100 - item.width, Math.max(0, x)), y: Math.min(Math.max(0, 100 - height), 98, Math.max(0, y)) }, { group: "drag" });
  }

  async function save(reset = false) {
    setSaving(true);
    try {
      const next = reset ? null : current.current.blocks.filter((item) => item.text.trim());
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
    <DialogContent title={`Edit text · ${title}`} description="Drag a paragraph to position it. Double-click to edit its text, or select it and press Delete to remove it." className="sm:max-w-[min(64rem,calc(100vw-1.5rem))]" onKeyDown={historyKey}>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-label="Page preview" className="min-w-0">
          <TextToolbar
            block={block}
            selection={selectionStyle}
            needsHighlight={(editing !== null && !selectionStyle) || sourceSelected}
            saving={saving}
            canUndo={history.current.undo.length > 0}
            canRedo={history.current.redo.length > 0}
            canFormatSound={!!selectionStyle || (editing === null && !block?.runs)}
            onHistory={(direction) => {
              if (editing === null && document.activeElement?.getAttribute("aria-label") === (direction === "undo" ? "Undo" : "Redo")) {
                stage.current?.focus({ preventScroll: true });
              }
              travel(direction);
            }}
            onLeave={() => setEditing(null)}
            onFormat={format}
            onSound={() => {
              if (editing !== null) formatSelection.current?.({ sound: !selectionStyle?.allSound });
              else toggleSoundWords();
            }}
          />
          <div
            ref={stage}
            tabIndex={-1}
            className="relative isolate mx-auto w-full overflow-hidden rounded-xl bg-amber-50 shadow-soft outline-none [container-type:inline-size]"
            style={{ aspectRatio: `1 / ${aspect}`, maxWidth: `min(480px, max(300px, calc((100dvh - 14.5rem) / ${aspect})))` }}
            dir={rtl ? "rtl" : "ltr"}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setEditing(null);
                stage.current?.focus({ preventScroll: true });
              }
            }}
            onKeyDown={(event) => {
              if (event.key !== "Delete" || event.repeat || editing !== null || !block || saving) return;
              event.preventDefault();
              removeParagraph();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover" />
            {blocks.map((item, index) => {
              let soundIndex = 0;
              return (
              <div
                key={index}
                className={`absolute min-h-4 whitespace-pre-wrap break-words outline-offset-2 ${selected === index ? "outline-2 outline-brand-500" : "hover:outline hover:outline-brand-400"} ${editing === index ? "" : "touch-none cursor-grab active:cursor-grabbing"}`}
                style={{
                  left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, fontSize: `${item.size}cqw`,
                  lineHeight: 1.36, color: item.color, textAlign: item.align, fontWeight: item.bold ? 700 : 500,
                  fontFamily: storyFontFamily(item.font, (property) => `var(${property})`),
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0 || editing === index) return;
                  select(index);
                  setEditing(null);
                  stage.current?.focus({ preventScroll: true });
                  drag.current = { index, pointer: event.pointerId, x: event.clientX, y: event.clientY, left: item.x, top: item.y };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={move}
                onLostPointerCapture={() => { drag.current = null; }}
                onDoubleClick={() => { select(index); setEditing(index); }}
              >
                {editing === index ? (
                  <SelectionEditor key={editorVersion} block={item} bookmark={layout.bookmark} command={formatSelection} onSelection={setSelectionStyle}
                    onCommit={(changes, edit) => patch(index, changes, edit)} onExit={() => setEditing(null)} />
                ) : item.text ? storyLines(item).map((line, row) => (
                  <div key={row} className="min-h-[0.7em]">
                    {line.map((run, i) => <span key={i} style={runCss(run, run.sound ? soundIndex++ : 0, item)}>{run.text}</span>)}
                  </div>
                )) : <span className="text-ink-500">Empty paragraph</span>}
              </div>
              );
            })}
          </div>
        </section>
        <aside aria-label="Paragraph controls" className="min-w-0 space-y-4 rounded-2xl border border-ink-200/80 bg-ink-50/50 p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-ink-900">Paragraph</h3>
            <Button size="sm" variant="outline" disabled={saving || blocks.length >= 24} onClick={() => {
              setEditing(null);
              change([...blocks, { ...initialBlock, text: "New paragraph", y: Math.min(85, 8 + blocks.length * 12) }], blocks.length);
            }}><Plus /> Add paragraph</Button>
          </div>
          {block && (
            <>
              <div className="flex items-end gap-1">
                <label className="grid min-w-0 flex-1 gap-1">Selected paragraph
                  <select className="h-9 w-full rounded-lg border border-ink-200 bg-white px-2" value={selected} onChange={(e) => { setEditing(null); select(Number(e.target.value)); }}>
                    {blocks.map((_, i) => <option key={i} value={i}>Paragraph {i + 1}</option>)}
                  </select>
                </label>
                <Button variant="danger-ghost" size="icon" aria-label="Remove paragraph" title="Remove paragraph" disabled={saving} onClick={removeParagraph}><Trash2 /></Button>
              </div>
              <label className="grid gap-1">Text source
                <textarea ref={textInput} dir="auto" className="min-h-24 w-full min-w-0 rounded-lg border border-ink-200 bg-white p-2" value={block.text} readOnly={!!block.runs} maxLength={2000}
                  onSelect={(event) => setSourceSelected(event.currentTarget.selectionStart !== event.currentTarget.selectionEnd)}
                  onBlur={() => setSourceSelected(false)} onChange={(e) => {
                    const type = (e.nativeEvent as InputEvent).inputType;
                    const group = /^(insertText|insertCompositionText|deleteContentBackward|deleteContentForward)$/.test(type) ? type : undefined;
                    patch(selected, { text: e.target.value }, { group });
                  }} />
              </label>
              <div className="flex items-center justify-between gap-2">
                <span>Alignment</span>
                <div role="group" aria-label="Paragraph alignment" className="flex rounded-lg border border-ink-200 bg-white p-0.5">
                  {alignments.map(({ icon: Icon, label, value }) => (
                    <Button key={value} variant="ghost" size="icon-sm" aria-label={label} title={label} aria-pressed={block.align === value}
                      className="aria-pressed:bg-violet-100 aria-pressed:text-violet-800"
                      disabled={saving} onClick={() => patch(selected, { align: value })}><Icon /></Button>
                  ))}
                </div>
              </div>
              <label className="grid gap-1">Width ({Math.round(block.width * 10) / 10}%)
                <input className="w-full min-w-0" type="range" min={10} max={100} step={1} value={block.width} onChange={(e) => {
                  const width = +e.target.value;
                  patch(selected, { width, x: Math.min(block.x, 100 - width) }, { group: "width" });
                }} />
              </label>
            </>
          )}
          <div className="grid gap-1 border-t border-ink-200 pt-3">
            <Button disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save layout"}</Button>
            {saved !== undefined && <Button variant="ghost" size="sm" disabled={saving} onClick={() => void save(true)}>Use automatic layout</Button>}
          </div>
        </aside>
      </div>
    </DialogContent>
  );
}
