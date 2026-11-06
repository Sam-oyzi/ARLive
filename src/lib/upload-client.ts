// Browser-side upload helper: streams the raw file to /api/upload with progress events.
import type { UploadKind } from "./storage";

export type UploadResult = {
  url: string;
  size: number;
  width?: number;
  height?: number;
  /** 3D models: what the optimiser did (null when it kept the original). */
  optimized?: { summary: string } | null;
  optimizeError?: string;
};

export async function uploadFile(
  file: File | Blob,
  kind: UploadKind,
  filename: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  let optimized: UploadResult["optimized"];
  let optimizeError: string | undefined;
  if (kind === "models") {
    try {
      const result = await (await import("./glb-optimize-client")).optimizeModelForUpload(file);
      if (result) { file = result.file; optimized = { summary: result.summary }; }
    } catch (error) {
      console.error("Model optimisation failed", error);
      optimizeError = "This model couldn't be optimised, so the original file is used.";
    }
  }
  const chunks = file.size > 80 * 1024 * 1024 ? await uploadInChunks(file, kind, filename, onProgress) : null;
  const uploaded = chunks ?? await new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/upload?kind=${kind}&filename=${encodeURIComponent(filename)}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      let body: { error?: string } & Partial<UploadResult> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error page
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.url) resolve(body as UploadResult);
      else reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
  return { ...uploaded, ...(optimized ? { optimized } : {}), ...(optimizeError ? { optimizeError } : {}) };
}

/** Each request stays below the edge request limit, including 200 MB videos and 250 MB GLBs. */
async function uploadInChunks(file: Blob, kind: UploadKind, filename: string, onProgress?: (percent: number) => void): Promise<UploadResult | null> {
  const start = await fetch("/api/upload?multipart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, filename, size: file.size }) });
  if (start.status === 501) return null; // local Node server
  const session = await start.json() as { token: string; partSize: number; error?: string };
  if (!start.ok) throw new Error(session.error ?? "Upload failed.");
  const headers = { "x-pagewakes-upload": session.token };
  const parts: { partNumber: number; etag: string }[] = [];
  try {
    for (let offset = 0; offset < file.size; offset += session.partSize) {
      let part: { partNumber: number; etag: string; error?: string } | undefined;
      let failure: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`/api/upload?multipart&part=${parts.length + 1}`, { method: "PUT", headers, body: file.slice(offset, offset + session.partSize) });
          const result = await response.json() as typeof part;
          if (!response.ok || !result?.etag) throw new Error(result?.error ?? "Upload part failed.");
          part = result; break;
        } catch (error) { failure = error; }
      }
      if (!part) throw failure;
      parts.push(part);
      onProgress?.(Math.min(100, (offset + session.partSize) / file.size * 100));
    }
    const response = await fetch("/api/upload?multipart", { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(parts) });
    const result = await response.json() as UploadResult & { error?: string };
    if (!response.ok || !result.url) throw new Error(result.error ?? "Upload failed.");
    return result;
  } catch (error) {
    await fetch("/api/upload?multipart", { method: "DELETE", headers }).catch(() => {});
    throw error;
  }
}

export function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a readable image."));
    };
    img.src = url;
  });
}
