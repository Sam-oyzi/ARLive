export const UPLOAD_KINDS = {
  targets: { exts: ["jpg", "jpeg", "png", "webp"], maxMB: 15 },
  covers: { exts: ["jpg", "jpeg", "png", "webp"], maxMB: 10 },
  logos: { exts: ["jpg", "jpeg", "png", "webp", "svg"], maxMB: 5 },
  // Uploads are optimised on arrival (src/lib/glb-optimize.ts), so large AI-generated files are fine.
  models: { exts: ["glb"], maxMB: 250 },
  videos: { exts: ["mp4", "webm", "mov"], maxMB: 200 },
  images: { exts: ["jpg", "jpeg", "png", "webp", "gif"], maxMB: 15 },
  audio: { exts: ["mp3", "m4a", "ogg", "wav"], maxMB: 50 },
  // 360° story worlds: 2:1 panoramas, often 8K wide.
  worlds: { exts: ["jpg", "jpeg", "png", "webp"], maxMB: 40 },
  mind: { exts: ["mind"], maxMB: 100 },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

export function isUploadKind(kind: string): kind is UploadKind {
  return Object.prototype.hasOwnProperty.call(UPLOAD_KINDS, kind);
}

export class UploadError extends Error {}

export function extensionOf(filename: string): string {
  return filename.split("/").pop()?.split(".").slice(1).pop()?.toLowerCase() ?? "";
}

export function uploadKey(segments: string[]): string | null {
  if (segments.length !== 2) return null;
  const [kind, name] = segments;
  if (!isUploadKind(kind!) || !/^[a-z0-9_-]+\.[a-z0-9]+$/i.test(name!)) return null;
  return `${kind}/${name}`;
}

export const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  glb: "model/gltf-binary",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mind: "application/octet-stream",
};
