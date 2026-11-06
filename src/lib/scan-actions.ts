// One experience per page, shared by the reader and the printed-page scanner.
// Keep the stored `world` value compatible with existing books: it means the tracked story box.
export const SCAN_ACTIONS = ["ar", "quicklook", "eighthwall", "world", "panorama"] as const;
export type ScanAction = (typeof SCAN_ACTIONS)[number];
export type WorldExperience = "box" | "panorama";

export const SCAN_ACTION_LABEL: Record<ScanAction, string> = {
  ar: "AR content · MindAR",
  quicklook: "AR content · Quick Look",
  eighthwall: "AR content · 8th Wall",
  world: "Step Inside · automatic story box",
  panorama: "360° view · look around",
};

export function scanActionOf(value: unknown): ScanAction {
  return (SCAN_ACTIONS as readonly unknown[]).includes(value) ? (value as ScanAction) : "ar";
}

export type ModelSource = { type: string; url?: string | null; text?: string | null };

export function isPlaceableModel(content: ModelSource): boolean {
  return (content.type === "MODEL" && !!content.url) || (content.type === "TEXT3D" && !!content.text?.trim());
}

/** Native/world model engines use the first 3D item in the saved layer order. */
export function placementModel<T extends ModelSource>(contents: T[]): T | undefined {
  return contents.find(isPlaceableModel);
}

export function opensModel(action: unknown): boolean {
  return action === "quicklook" || action === "eighthwall";
}

/** Only MindAR renders the authored content on the target; other choices launch their own viewer. */
export function rendersOnTarget(action: unknown): boolean {
  return scanActionOf(action) === "ar";
}

/** A texture alone never enables a world, and tracking failure never selects 360°. */
export function worldExperienceOf(action: unknown, worldUrl: string | null): WorldExperience | null {
  if (!worldUrl) return null;
  if (action === "world") return "box";
  if (action === "panorama") return "panorama";
  return null;
}
