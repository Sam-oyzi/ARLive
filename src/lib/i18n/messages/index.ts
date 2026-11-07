import type { Locale } from "../config";
import { ar } from "./ar";
import { en, type Messages } from "./en";
import { fr } from "./fr";

export type { Messages };
export const messages: Record<Locale, Messages> = { fr, en, ar };

/**
 * The few generic messages the server's form helpers send in English (src/server/forms.ts), put in
 * the reader's language on the way to the screen. Everything else already arrives translated.
 */
export function localizeMessage(message: string, t: Messages): string {
  const generic: Record<string, string> = {
    "Something went wrong. Please try again.": t.common.somethingWrong,
    "Please check the form.": t.common.checkForm,
    "That value is already taken.": t.common.taken,
  };
  return generic[message] ?? message;
}

/** A category's name in the reader's language: the built-in ones are translated, the rest keep their studio name. */
export function categoryName(t: Messages, slug: string, name: string): string {
  return t.categories[slug]?.name ?? name;
}

export function categoryDescription(t: Messages, slug: string, description: string | null): string | null {
  return t.categories[slug]?.description ?? description;
}
