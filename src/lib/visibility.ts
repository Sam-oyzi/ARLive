// Safe to import from client components (src/lib/books.ts also talks to the database).

/** Who may open a library book. Custom stories always use the approved list. */
export const VISIBILITIES = {
  PUBLIC: { label: "Everyone", hint: "Free to read, no account needed" },
  MEMBERS: { label: "Any account", hint: "Free for anyone signed in" },
  APPROVED: { label: "Approved emails", hint: "Only readers you approve" },
} as const;

export type Visibility = keyof typeof VISIBILITIES;
export const VISIBILITY_KEYS = Object.keys(VISIBILITIES) as [Visibility, ...Visibility[]];

export function visibilityOf(value: string): Visibility {
  return Object.hasOwn(VISIBILITIES, value) ? (value as Visibility) : "APPROVED";
}
