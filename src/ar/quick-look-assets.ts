import type { ContentData } from "@/lib/content";
import { loadPlacementAsset } from "./model-assets";

export function supportsQuickLook(): boolean {
  return document.createElement("a").relList.supports("ar");
}

export async function exportQuickLook(content: ContentData): Promise<Blob> {
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
  const asset = await loadPlacementAsset(content);
  try {
    const bytes = await new USDZExporter().parseAsync(asset.object, { quickLookCompatible: true, animations: asset.animations });
    return new Blob([bytes], { type: "model/vnd.usdz+zip" });
  } finally {
    asset.dispose();
  }
}

/** Prepares USDZ while the book scans. A scan launches the prepared link without an object picker. */
export class QuickLookAssets {
  private entries = new Map<string, { promise: Promise<string>; url?: string }>();
  private disposed = false;
  constructor(private build = exportQuickLook) {}

  prepare(content: ContentData): Promise<string> {
    if (this.disposed) return Promise.reject(new Error("The scanner has closed."));
    const key = JSON.stringify([content.id, content.url, content.text, content.color, content.scale, content.animation, content.autoplay]);
    const cached = this.entries.get(key);
    if (cached) return cached.promise;
    const entry = { promise: Promise.resolve("") } as { promise: Promise<string>; url?: string };
    entry.promise = this.build(content).then((blob) => {
      if (this.disposed) throw new Error("The scanner has closed.");
      entry.url = URL.createObjectURL(blob);
      return entry.url;
    }).catch((error) => {
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, entry);
    return entry.promise;
  }

  dispose() {
    this.disposed = true;
    for (const entry of this.entries.values()) if (entry.url) URL.revokeObjectURL(entry.url);
    this.entries.clear();
  }
}
