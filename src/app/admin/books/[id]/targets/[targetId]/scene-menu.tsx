"use client";

// Right-click menu for the 3D stage: actions on the clicked item, or on the page itself.
import { Box, Copy, Film, ImageUp, Pencil, Plus, RefreshCw, Trash2, Type, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CONTENT_META, hasText, type ContentData } from "@/lib/content";
import { cn } from "@/lib/utils";

export type SceneMenuAction =
  | { kind: "replace"; id: string }
  | { kind: "edit-text"; id: string }
  | { kind: "animate"; id: string }
  | { kind: "duplicate"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "replace-target" }
  | { kind: "add"; type: "MODEL" | "TEXT3D" | "TEXT" };

type Item = { label: string; icon: LucideIcon; action: SceneMenuAction; danger?: boolean } | "separator";

function itemsFor(content: ContentData | null): Item[] {
  if (!content) {
    return [
      { label: "Replace target image…", icon: ImageUp, action: { kind: "replace-target" } },
      "separator",
      { label: "Add 3D model…", icon: Box, action: { kind: "add", type: "MODEL" } },
      { label: "Add 3D text", icon: Type, action: { kind: "add", type: "TEXT3D" } },
      { label: "Add label", icon: Plus, action: { kind: "add", type: "TEXT" } },
    ];
  }
  const meta = CONTENT_META[content.type];
  const items: Item[] = [];
  if (meta.uploadKind) items.push({ label: `Replace ${meta.label.toLowerCase()}…`, icon: RefreshCw, action: { kind: "replace", id: content.id } });
  if (hasText(content.type)) items.push({ label: "Edit text", icon: Pencil, action: { kind: "edit-text", id: content.id } });
  if (content.type !== "AUDIO") items.push({ label: "Animate with keyframes…", icon: Film, action: { kind: "animate", id: content.id } });
  items.push({ label: "Duplicate", icon: Copy, action: { kind: "duplicate", id: content.id } });
  items.push("separator", { label: "Delete", icon: Trash2, action: { kind: "delete", id: content.id }, danger: true });
  return items;
}

export function SceneMenu({
  x,
  y,
  content,
  onAction,
  onClose,
}: {
  /** Position relative to the stage */
  x: number;
  y: number;
  /** The right-clicked item, or null for the page */
  content: ContentData | null;
  onAction: (action: SceneMenuAction) => void;
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu inside the stage.
  useLayoutEffect(() => {
    const el = menu.current;
    const stage = el?.parentElement;
    if (!el || !stage) return;
    setPos({
      left: Math.min(x, stage.clientWidth - el.offsetWidth - 8),
      top: Math.min(y, stage.clientHeight - el.offsetHeight - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="absolute inset-0 z-20" onPointerDown={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        ref={menu}
        role="menu"
        className="absolute z-30 min-w-52 animate-fade-up rounded-2xl border border-ink-200/70 bg-white p-1.5 shadow-lift"
        style={{ left: Math.max(8, pos.left), top: Math.max(8, pos.top) }}
      >
        <div className="truncate px-3 pt-1.5 pb-1 text-xs font-semibold text-ink-400">{content ? content.name : "Page"}</div>
        {itemsFor(content).map((item, i) =>
          item === "separator" ? (
            <div key={i} className="my-1 h-px bg-ink-100" />
          ) : (
            <button
              key={i}
              role="menuitem"
              onClick={() => {
                onClose();
                onAction(item.action);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium [&_svg]:size-4",
                item.danger ? "text-rose-600 hover:bg-rose-50 [&_svg]:text-rose-400" : "text-ink-700 hover:bg-ink-100 [&_svg]:text-ink-400",
              )}
            >
              <item.icon /> {item.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}
