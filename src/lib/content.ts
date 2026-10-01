// Shared (client + server) description of AR content types.
export const CONTENT_TYPES = ["MODEL", "VIDEO", "IMAGE", "AUDIO", "TEXT"] as const;
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
  order: number;
};

export const CONTENT_META: Record<
  ContentType,
  { label: string; uploadKind: "models" | "videos" | "images" | "audio" | null; accept: string; hint: string }
> = {
  MODEL: { label: "3D model", uploadKind: "models", accept: ".glb", hint: "GLB with optional animations" },
  VIDEO: { label: "Video", uploadKind: "videos", accept: "video/mp4,video/webm,.mov", hint: "MP4 (H.264) plays everywhere" },
  IMAGE: { label: "Image", uploadKind: "images", accept: "image/*", hint: "PNG with transparency works great" },
  AUDIO: { label: "Audio", uploadKind: "audio", accept: "audio/*", hint: "Narration or sound effect" },
  TEXT: { label: "Text label", uploadKind: null, accept: "", hint: "A floating caption" },
};

/** Sensible starting transforms: models stand up out of the page, flat media lies on it. */
export function defaultTransform(type: ContentType) {
  switch (type) {
    case "MODEL":
      return { posX: 0, posY: 0, posZ: 0, rotX: 90, rotY: 0, rotZ: 0, scale: 0.5 };
    case "TEXT":
      return { posX: 0, posY: -0.42, posZ: 0.02, rotX: 0, rotY: 0, rotZ: 0, scale: 0.6 };
    default:
      return { posX: 0, posY: 0, posZ: 0.01, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };
  }
}
