// Shared (client + server) description of AR content types.
export const CONTENT_TYPES = ["MODEL", "VIDEO", "IMAGE", "AUDIO", "TEXT", "TEXT3D"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type ContentData = {
  id: string;
  type: ContentType;
  name: string;
  url: string | null;
  text: string | null;
  color: string | null;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  autoplay: boolean;
  loop: boolean;
  animation: string | null;
  /** JSON, see src/lib/motion-schema.ts */
  motion: string | null;
  order: number;
};

type Meta = {
  label: string;
  /** For buttons where space is tight */
  short: string;
  uploadKind: "models" | "videos" | "images" | "audio" | null;
  accept: string;
  hint: string;
};

export const CONTENT_META: Record<ContentType, Meta> = {
  MODEL: { label: "3D model", short: "Model", uploadKind: "models", accept: ".glb", hint: "GLB with optional animations" },
  TEXT3D: { label: "3D text", short: "3D text", uploadKind: null, accept: "", hint: "Thick letters with depth and lighting" },
  VIDEO: { label: "Video", short: "Video", uploadKind: "videos", accept: "video/mp4,video/webm,.mov", hint: "MP4 (H.264) plays everywhere" },
  IMAGE: { label: "Image", short: "Image", uploadKind: "images", accept: "image/*", hint: "PNG with transparency works great" },
  AUDIO: { label: "Audio", short: "Audio", uploadKind: "audio", accept: "audio/*", hint: "Narration, music or a sound effect" },
  TEXT: { label: "Text label", short: "Label", uploadKind: null, accept: "", hint: "A flat caption card" },
};

export const hasText = (type: ContentType) => type === "TEXT" || type === "TEXT3D";

/** Sensible starting transforms: models and 3D text stand up out of the page, flat media lies on it. */
export function defaultTransform(type: ContentType) {
  switch (type) {
    case "MODEL":
      return { posX: 0, posY: 0, posZ: 0, rotX: 90, rotY: 0, rotZ: 0, scale: 0.5 };
    case "TEXT3D":
      return { posX: 0, posY: 0, posZ: 0, rotX: 90, rotY: 0, rotZ: 0, scale: 1 };
    case "TEXT":
      return { posX: 0, posY: -0.42, posZ: 0.02, rotX: 0, rotY: 0, rotZ: 0, scale: 0.6 };
    default:
      return { posX: 0, posY: 0, posZ: 0.01, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };
  }
}
