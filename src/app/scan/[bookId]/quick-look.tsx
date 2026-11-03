"use client";

import { Box, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { disposeObject, getGLTFLoader } from "@/ar/content-objects";
import type { ContentData } from "@/lib/content";

const MIME_TYPE = "model/vnd.usdz+zip";
const launchClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ink-100 px-3 text-sm font-semibold text-ink-800";

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
  const [selectedId, setSelectedId] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<{ id: string; url?: string }>();
  const selected = objects.find((item) => item.id === selectedId) ?? objects[0];

  useEffect(() => {
    setSupported(document.createElement("a").relList.supports("ar"));
  }, []);

  useEffect(() => {
    // Prepare the asset before the tap so Safari can handle a real rel=ar link.
    if (!supported || !selected) return;

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
  }, [supported, selected, attempt]);

  if (!supported || !selected) return null;

  const result = preview?.id === selected.id ? preview : undefined;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {result?.url ? (
        <a rel="ar" href={result.url} aria-label={`Open ${selected.name} in AR Quick Look`} className={`${launchClass} after:content-['AR_Quick_Look']`}>
          {/* Keep the image as the link's only child for Safari's native viewer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ar-quick-look.svg" alt="" className="size-4" />
        </a>
      ) : result ? (
        <button type="button" className={launchClass} onClick={() => { setPreview(undefined); setAttempt((value) => value + 1); }}>
          <Box aria-hidden="true" className="size-4" /> Retry AR Quick Look
        </button>
      ) : (
        <span role="status" className={`${launchClass} text-ink-500`}>
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Preparing AR Quick Look…
        </span>
      )}
      {objects.length > 1 && (
        <select
          aria-label="Object to preview"
          value={selected.id}
          onChange={(event) => { setPreview(undefined); setSelectedId(event.target.value); }}
          className="min-h-11 max-w-full rounded-2xl bg-ink-100 px-3 text-sm text-ink-800"
        >
          {objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      )}
    </div>
  );
}
