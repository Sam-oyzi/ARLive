import type { BadgeTone } from "@/components/ui/badge";

/** What a parent can ask a custom story to help their child with. */
export const STORY_GOALS = {
  kindness: { label: "Kindness & sharing", emoji: "🤝" },
  courage: { label: "Being brave", emoji: "🦁" },
  honesty: { label: "Telling the truth", emoji: "💬" },
  feelings: { label: "Big feelings", emoji: "🌈" },
  bedtime: { label: "Bedtime routine", emoji: "🌙" },
  healthy: { label: "Healthy habits", emoji: "🥦" },
  tidy: { label: "Tidying up", emoji: "🧸" },
  screens: { label: "Less screen time", emoji: "📵" },
  school: { label: "Starting school", emoji: "🎒" },
  sibling: { label: "A new sibling", emoji: "👶" },
  patience: { label: "Patience & listening", emoji: "⏳" },
  other: { label: "Something else", emoji: "✨" },
} as const;

export type StoryGoal = keyof typeof STORY_GOALS;
export const STORY_GOAL_KEYS = Object.keys(STORY_GOALS) as [StoryGoal, ...StoryGoal[]];

export function goalLabel(goal: string): string {
  return STORY_GOALS[goal as StoryGoal]?.label ?? goal;
}

export const STORY_STATUSES = ["NEW", "IN_PROGRESS", "DELIVERED", "DECLINED"] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

export const STORY_STATUS: Record<StoryStatus, { label: string; parentLabel: string; tone: BadgeTone }> = {
  NEW: { label: "New", parentLabel: "Received", tone: "amber" },
  IN_PROGRESS: { label: "In progress", parentLabel: "Being written", tone: "blue" },
  DELIVERED: { label: "Delivered", parentLabel: "Ready to read", tone: "green" },
  DECLINED: { label: "Declined", parentLabel: "Not possible", tone: "red" },
};

export function storyStatus(status: string) {
  return STORY_STATUS[status as StoryStatus] ?? STORY_STATUS.NEW;
}

/** Languages a custom story can be written in. */
export const STORY_LANGUAGES = ["en", "fr", "ar", "es", "de"] as const;

export function languageName(code: string): string {
  return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
}
