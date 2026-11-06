// What moves inside a page's story room, chosen per page in the studio. Client-safe.
export const WORLD_EFFECTS = ["none", "rain", "snow"] as const;
export type WorldEffect = (typeof WORLD_EFFECTS)[number];

export const WORLD_EFFECT_LABEL: Record<WorldEffect, string> = {
  none: "Nothing moving",
  rain: "Rain: the water cycle",
  snow: "Snow falling",
};

export const WORLD_EFFECT_HINT: Record<WorldEffect, string> = {
  none: "Just the story world around the child.",
  rain: "A cloud rains over the sea; Lou the drop falls with the rain, then rises back as vapour.",
  snow: "Snowflakes drift down all around the room.",
};

export function worldEffectOf(value: unknown): WorldEffect {
  return (WORLD_EFFECTS as readonly unknown[]).includes(value) ? (value as WorldEffect) : "none";
}
