"use client";

import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from "react";
import { storyFontFamily, storyLines, storyRunText, type StoryBlock, type StoryRun, type StoryRunStyle } from "@/lib/story-layout";
import { STORY_SOUND_COLORS } from "@/lib/story-text";

export function runCss(run: StoryRun, soundIndex: number, base: StoryBlock): CSSProperties {
  return {
    fontFamily: storyFontFamily(run.font ?? (run.sound ? "display" : base.font), (property) => "var(" + property + ")"),
    fontSize: (run.size ?? (run.sound ? base.size * 1.75 : base.size)) + "cqw",
    color: run.color ?? (run.sound ? STORY_SOUND_COLORS[soundIndex % STORY_SOUND_COLORS.length] : base.color),
    fontWeight: (run.bold ?? (run.sound || base.bold)) ? 700 : 500,
    textTransform: run.sound ? "uppercase" : "none",
  };
}

export type SelectionStyle = StoryRunStyle & { mixedFont: boolean; mixedSize: boolean; mixedBold: boolean; allSound: boolean };
export type FormatSelection = (style: StoryRunStyle & { sound?: boolean }) => void;
export type TextBookmark = { start: number; end: number };
export type TextEdit = { before?: TextBookmark; after?: TextBookmark; group?: string };

export function SelectionEditor({ block, bookmark, command, onSelection, onCommit, onExit }: {
  block: StoryBlock;
  bookmark?: TextBookmark;
  command: RefObject<FormatSelection | null>;
  onSelection: (style: SelectionStyle | null) => void;
  onCommit: (changes: Partial<Pick<StoryBlock, "text" | "runs">>, edit: TextEdit) => void;
  onExit: () => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const initial = useRef({ block, bookmark });
  const commitChanges = useRef(onCommit);
  useLayoutEffect(() => { commitChanges.current = onCommit; }, [onCommit]);

  useLayoutEffect(() => {
    const root = element.current!;
    const base = initial.current.block;
    let selected: Range | null = null;
    let beforeInput: TextBookmark | undefined;
    let soundIndex = 0;
    const span = (run: StoryRun, colorIndex = 0) => {
      const el = document.createElement("span");
      const { text, ...style } = run;
      el.dataset.run = JSON.stringify(style);
      if (run.sound) el.dataset.paletteColor = STORY_SOUND_COLORS[colorIndex % STORY_SOUND_COLORS.length]!;
      Object.assign(el.style, runCss(run, colorIndex, base));
      el.textContent = text;
      return el;
    };
    root.replaceChildren(...storyLines(base).map((line) => {
      const row = document.createElement("div");
      row.className = "min-h-[0.7em]";
      row.append(...line.map((run) => span(run, run.sound ? soundIndex++ : 0)));
      return row;
    }));

    function styleOf(node: Node): Omit<StoryRun, "text"> {
      const data = node.parentElement?.closest<HTMLElement>("[data-run]")?.dataset.run;
      return data ? JSON.parse(data) : {};
    }

    function pieces(range: Range) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const result: { node: Text; start: number; end: number }[] = [];
      for (let next = walker.nextNode(); next; next = walker.nextNode()) {
        if (!range.intersectsNode(next)) continue;
        const node = next as Text;
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.length;
        if (end > start) result.push({ node, start, end });
      }
      return result;
    }

    function readBookmark(range: Range | undefined | null): TextBookmark | undefined {
      if (!range || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
      const prefix = document.createRange();
      prefix.setStart(root, 0);
      prefix.setEnd(range.startContainer, range.startOffset);
      const start = prefix.toString().length;
      return { start, end: start + range.toString().length };
    }

    function restoreBookmark({ start, end }: TextBookmark) {
      const range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let offset = 0;
      for (let next = walker.nextNode(); next; next = walker.nextNode()) {
        const node = next as Text;
        const limit = offset + node.length;
        if (start >= offset && start <= limit) range.setStart(node, start - offset);
        if (end <= limit) {
          range.setEnd(node, end - offset);
          break;
        }
        offset = limit;
      }
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    function report(range: Range) {
      if (range.collapsed) return onSelection(null);
      const picked = pieces(range);
      if (!picked.length) return onSelection(null);
      const styles = picked.map(({ node }) => styleOf(node));
      const fonts = new Set(styles.map((style) => style.font ?? (style.sound ? "display" : base.font)));
      const sizes = new Set(styles.map((style) => style.size ?? (style.sound ? Math.min(12, base.size * 1.75) : base.size)));
      const weights = new Set(styles.map((style) => style.bold ?? (!!style.sound || base.bold)));
      const first = styles[0]!;
      const color = picked[0]?.node.parentElement?.closest<HTMLElement>("[data-run]")?.dataset.paletteColor;
      onSelection({
        mixedFont: fonts.size > 1,
        mixedSize: sizes.size > 1,
        mixedBold: weights.size > 1,
        allSound: styles.every((style) => style.sound),
        font: fonts.size === 1 ? fonts.values().next().value : undefined,
        size: sizes.values().next().value,
        color: first.color ?? (first.sound ? color ?? STORY_SOUND_COLORS[0] : base.color),
        bold: weights.size === 1 && weights.has(true),
      });
    }

    function track() {
      if (document.activeElement !== root) return;
      const selection = document.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
      selected = range.cloneRange();
      report(range);
    }

    function commit(edit: TextEdit, updateText = true) {
      const runs: StoryRun[] = [];
      const append = (text: string, style: Omit<StoryRun, "text"> = {}) => {
        if (!text) return;
        const last = runs.at(-1);
        if (last && last.sound === style.sound && last.font === style.font && last.size === style.size && last.color === style.color && last.bold === style.bold) last.text += text;
        else runs.push({ ...style, text });
      };
      function read(node: Node) {
        if (node instanceof Text) return append(node.data, styleOf(node));
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName === "BR") return append("\n");
        const row = node.tagName === "DIV" || node.tagName === "P";
        if (row && runs.length && !runs.at(-1)!.text.endsWith("\n")) append("\n");
        if (row && node.childNodes.length === 1 && node.firstChild instanceof HTMLBRElement) append("\n");
        else {
          node.childNodes.forEach(read);
          if (row && (!node.hasChildNodes() || !runs.at(-1)?.text.endsWith("\n"))) append("\n");
        }
      }
      root.childNodes.forEach(read);
      const last = runs.at(-1);
      if (last) last.text = last.text.replace(/\n$/, "");
      const styled = runs.some((run) => run.font !== undefined || run.size !== undefined || run.color !== undefined || run.bold !== undefined);
      commitChanges.current({
        ...(updateText ? { text: storyRunText(runs) } : {}),
        runs: styled ? runs.filter((run) => run.text) : undefined,
      }, edit);
    }

    command.current = (style) => {
      track();
      if (!selected || selected.collapsed) return;
      const before = readBookmark(selected);
      const parts = pieces(selected);
      // Splitting a sound phrase should not advance the palette for the remaining words.
      const keepSoundColors = style.sound === undefined && parts.some(({ node, start, end }) =>
        styleOf(node).sound && (start !== 0 || end !== node.length));
      const formatted = parts.map(({ node, start, end }) => {
        const previous = styleOf(node);
        const chosen = span({ ...previous, ...style, text: node.data.slice(start, end) });
        const originalColor = node.parentElement?.closest<HTMLElement>("[data-run]")?.style.color;
        if (previous.sound && style.sound !== false && !style.color && originalColor) {
          chosen.style.color = originalColor;
          chosen.dataset.paletteColor = node.parentElement?.closest<HTMLElement>("[data-run]")?.dataset.paletteColor ?? STORY_SOUND_COLORS[0]!;
        }
        const parent = node.parentElement;
        if (start === 0 && end === node.length && parent?.hasAttribute("data-run") && parent.childNodes.length === 1) {
          parent.replaceWith(chosen);
          return chosen;
        }
        const part = start ? node.splitText(start) : node;
        if (part.length > end - start) part.splitText(end - start);
        part.replaceWith(chosen);
        return chosen;
      });
      if (!formatted.length) return;
      if (keepSoundColors) {
        for (const element of root.querySelectorAll<HTMLElement>("[data-run][data-palette-color]")) {
          const run = JSON.parse(element.dataset.run!) as Omit<StoryRun, "text">;
          if (run.sound && !run.color) element.dataset.run = JSON.stringify({ ...run, color: element.dataset.paletteColor });
        }
      }
      selected = document.createRange();
      selected.setStartBefore(formatted[0]!);
      selected.setEndAfter(formatted.at(-1)!);
      if (document.activeElement === root) {
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(selected);
      }
      report(selected);
      commit({ before, after: readBookmark(selected), group: style.color ? "color" : undefined }, style.sound !== undefined);
    };

    function currentBookmark() {
      const selection = document.getSelection();
      return readBookmark(selection?.rangeCount ? selection.getRangeAt(0) : null);
    }

    function rememberInput() {
      beforeInput = currentBookmark();
    }

    function onInput(event: Event) {
      const type = (event as InputEvent).inputType;
      const group = /^(insertText|insertCompositionText|deleteContentBackward|deleteContentForward)$/.test(type) ? type : undefined;
      commit({ before: beforeInput, after: currentBookmark(), group });
      track();
    }

    root.addEventListener("beforeinput", rememberInput);
    root.addEventListener("input", onInput);
    root.addEventListener("keyup", track);
    root.addEventListener("pointerup", track);
    document.addEventListener("selectionchange", track);
    root.focus();
    if (initial.current.bookmark) {
      restoreBookmark(initial.current.bookmark);
      track();
    }
    return () => {
      root.removeEventListener("beforeinput", rememberInput);
      root.removeEventListener("input", onInput);
      root.removeEventListener("keyup", track);
      root.removeEventListener("pointerup", track);
      document.removeEventListener("selectionchange", track);
      command.current = null;
      onSelection(null);
    };
  }, [command, onSelection]);

  return (
    <div ref={element} contentEditable role="textbox" aria-label="Edit paragraph on page" aria-multiline="true"
      className="min-h-[1em] cursor-text touch-auto outline-none selection:bg-violet-200"
      onPaste={(event) => {
        event.preventDefault();
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof HTMLElement && !next.closest("[data-text-format]")) onExit();
      }}
    />
  );
}
