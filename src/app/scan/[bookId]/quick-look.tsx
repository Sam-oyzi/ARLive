"use client";

import { Box, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { disposeObject, getGLTFLoader } from "@/ar/content-objects";
import type { ContentData } from "@/lib/content";

const MIME_TYPE = "model/vnd.usdz+zip";

async function loadPreviewObject(content: ContentData) {
  if (content.type === "MODEL" && content.url) {
    return (await getGLTFLoader().loadAsync(content.url)).scene;
  }
  if (content.type === "TEXT3D" && content.text?.trim()) {
    const { createTextGeometry } = await import("@/ar/text3d");
    const geometry = await createTextGeometry(content.text);
    return new Mesh(geometry, new MeshStandardMaterial({ color: content.color || "#5b5bf6" }));
  }
  throw new Error("No 3D object to preview");
}

async function exportPreview(content: ContentData) {
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
  const model = await loadPreviewObject(content);

  try {
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const longestSide = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(longestSide) || longestSide <= 0) throw new Error("Empty model");

    const center = bounds.getCenter(new Vector3());
    center.y = bounds.min.y;
    const centered = new Group();
    centered.position.copy(center.negate());
    centered.add(model);
    const preview = new Group();
    preview.scale.setScalar(0.25 / longestSide);
    preview.add(centered);

    const data = await new USDZExporter().parseAsync(preview, { quickLookCompatible: true });
    return new Blob([data], { type: MIME_TYPE });
  } finally {
    disposeObject(model);
  }
}

export function QuickLook({ contents }: { contents: ContentData[] }) {
  const objects = contents.filter((item) => (item.type === "MODEL" && item.url) || (item.type === "TEXT3D" && item.text?.trim()));
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [preview, setPreview] = useState<{ id: string; url?: string }>();
  const selected = objects.find((item) => item.id === selectedId) ?? objects[0];

  useEffect(() => {
    setSupported(document.createElement("a").relList.supports("ar"));
  }, []);

  useEffect(() => {
    if (!open || !selected) return;

    let cancelled = false;
    let url: string | undefined;
    exportPreview(selected).then((blob) => {
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setPreview({ id: selected.id, url });
    }).catch(() => {
      if (!cancelled) setPreview({ id: selected.id });
    });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, selected]);

  if (!supported || !selected) return null;

  const result = preview?.id === selected.id ? preview : undefined;
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { setPreview(undefined); setOpen(!open); }}
        className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-ink-100 px-3 text-sm font-semibold text-ink-800"
      >
        <Box className="size-4" aria-hidden="true" /> AR Quick Look
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-ink-100 p-2 text-sm">
          {objects.length > 1 && (
            <select
              aria-label="Object to preview"
              value={selected.id}
              onChange={(event) => { setPreview(undefined); setSelectedId(event.target.value); }}
              className="min-h-10 max-w-full rounded-xl bg-white px-2 text-ink-900"
            >
              {objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
          {result?.url ? (
            <div className="flex items-center gap-2">
              <a rel="ar" href={result.url} aria-label={`Open ${selected.name} in AR Quick Look`} className="grid size-11 place-items-center rounded-xl bg-white">
                {/* Safari requires a single image child for Quick Look. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ar-quick-look.svg" alt="" className="size-6" />
              </a>
              <span>Tap the cube to place in AR</span>
            </div>
          ) : result ? (
            <p role="status" className="px-2">This object couldn’t be prepared for Quick Look.</p>
          ) : (
            <p role="status" className="flex items-center gap-2 px-2"><LoaderCircle className="size-4 animate-spin" /> Preparing AR preview…</p>
          )}
        </div>
      )}
    </div>
  );
}
